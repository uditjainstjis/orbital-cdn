// Paired A/B/C experiment: does prediction actually help, and does the agent
// add anything on top of prediction?
//
// The comparison is PAIRED. All three arms see the identical request sequence
// against the identical weather trace, replayed from the same starting hour.
// Anything else and the difference would be dominated by which arm happened to
// run during a storm.
//
//   A  CURRENT     deterministic routing, no forecast term
//   B  PREDICTIVE  same router plus the predicted-failure cost
//   C  AUTOPILOT   B, plus a sticky route the agent may move pre-emptively,
//                  under the same hold/cooldown/improvement gates it uses live
//
// Outcome is decided by physics, not by the arm: a request fails if the fade at
// its gateway at that hour exceeds the link margin. Identical rule everywhere.

import { GATEWAYS, CITIES } from '../network.js'
import { POLICY_WEIGHTS, gwCostMs } from '../engine.js'
import { fadeDbFor, LINK, HORIZONS_H } from './weather.js'
import { AGENT, PREDICT } from './config.js'
import TRACE from './weather_trace.json' with { type: 'json' }
import MODEL from './fade_model.json' with { type: 'json' }
import { predictProba, vectorise } from './gbm.js'
import { outageProbability } from './itu.js'

const POLICIES = ['latency', 'balanced', 'green', 'reliable']

// ─── Offline trace access (independent of the live weather clock) ───────────

function rateAt(gwName, hour) {
  const s = TRACE.sites[gwName]
  if (!s) return 0
  return s.rates_mm_h[((hour % s.n) + s.n) % s.n]
}

function fadeAt(gw, hour) {
  return fadeDbFor(gw, rateAt(gw.name, hour))
}

/** Same feature construction as the live forecaster, over trace indices. */
function featuresAt(gw, hour) {
  const r = b => rateAt(gw.name, hour - b)
  const hist = n => Array.from({ length: n }, (_, i) => r(i + 1))
  const mean = a => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0)
  const p3 = hist(3), p6 = hist(6), p24 = hist(24)
  let sinceWet = 0
  for (let i = 1; i <= 200; i++) { if (r(i) > 0.5) break; sinceWet = i }
  const s = TRACE.sites[gw.name]
  const startHour = parseInt(String(s.start_hour).slice(8, 10), 10)
  return {
    rain: r(0), rain_lag1: r(1), rain_lag2: r(2), rain_lag3: r(3),
    rain_lag6: r(6), rain_lag12: r(12),
    trend_1h: r(0) - r(1), trend_3h: r(0) - r(3),
    roll_mean_3: mean(p3), roll_mean_6: mean(p6), roll_mean_24: mean(p24),
    roll_max_6: Math.max(...p6, 0), roll_max_24: Math.max(...p24, 0),
    wet_frac_24: p24.filter(v => v > 0.1).length / 24,
    fade_now: fadeDbFor(gw, r(0)),
    hours_since_wet: sinceWet,
    site_wet_fraction: s.wet_fraction,
    site_mean_rain: mean(s.rates_mm_h),
    abs_lat: Math.abs(gw.lat),
    hour_of_day: (startHour + hour) % 24,
    doy_frac: ((hour / 24) % 365) / 365,
  }
}

function forecastAt(gw, hour) {
  const f = featuresAt(gw, hour)
  const x = vectorise(MODEL.features, f)
  const risk = {}
  for (const H of HORIZONS_H) risk[H] = predictProba(MODEL.trees[String(H)], x)
  return { risk, fadeNowDb: f.fade_now, outageNow: outageProbability(f.fade_now, LINK.marginDb), confidence: 1 }
}

function predictiveMs(fc) {
  let s = 0, w = 0
  for (const [h, hw] of Object.entries(PREDICT.HORIZON_WEIGHTS)) {
    if (typeof fc.risk[h] !== 'number') continue
    s += hw * fc.risk[h]; w += hw
  }
  const expected = w ? s / w : 0
  return PREDICT.FAILURE_COST_MS * (fc.outageNow + expected * (1 - fc.outageNow))
}

function fwdRisk(risk) {
  let s = 0, w = 0
  for (const [h, hw] of Object.entries(PREDICT.HORIZON_WEIGHTS)) {
    if (typeof risk[h] !== 'number') continue
    s += hw * risk[h]; w += hw
  }
  return w ? s / w : 0
}

// ─── Arms ───────────────────────────────────────────────────────────────────

/**
 * `vision` decides how much of the weather an arm is allowed to see:
 *   'none'     only the static weather label — the pre-predictive engine
 *   'now'      current fade, but no forecast (a reactive operator)
 *   'forecast' current fade plus the predicted risk over the horizons
 *
 * Separating 'now' from 'forecast' is the point of the experiment: it isolates
 * the value of PREDICTING from the value of merely OBSERVING, which is the
 * question a reviewer will actually ask.
 */
function chooseGateway(city, policy, hour, vision) {
  const w = POLICY_WEIGHTS[policy]
  let best = null
  for (const gw of GATEWAYS) {
    let fc = null
    if (vision === 'forecast') fc = forecastAt(gw, hour)
    else if (vision === 'now') {
      const f = forecastAt(gw, hour)
      // Reactive: knows what the fade is right now, nothing about what is coming.
      fc = { risk: {}, fadeNowDb: f.fadeNowDb, outageNow: f.outageNow, confidence: 1 }
    }
    const cost = gwCostMs(city, gw, w, null, fc)
    if (!best || cost < best.cost) best = { gw, cost, fc }
  }
  return best
}

/**
 * Run one arm over a fixed request schedule.
 * `schedule` is [{ hour, city, policy }] shared by every arm.
 */
function runArm(schedule, { vision, useAgent }) {
  const rtts = []
  let failures = 0, reroutes = 0, proactive = 0
  // A standing route is per ORIGIN. One global sticky gateway would be
  // meaningless when requests arrive from eight different cities.
  const sticky = new Map()   // city -> { gw, since, lastAction }

  for (let i = 0; i < schedule.length; i++) {
    const { hour, city, policy } = schedule[i]
    let chosen

    if (!useAgent) {
      chosen = chooseGateway(city, policy, hour, vision).gw
    } else {
      const key = city.city
      let st = sticky.get(key)
      if (!st) {
        st = { gw: chooseGateway(city, policy, hour, 'forecast').gw, since: i, lastAction: -1e9 }
        sticky.set(key, st)
      } else {
        const curFc = forecastAt(st.gw, hour)
        const curCost = gwCostMs(city, st.gw, POLICY_WEIGHTS[policy], null, curFc)
        const cand = chooseGateway(city, policy, hour, 'forecast')
        const improvement = curCost - cand.cost - AGENT.ACTION_COST_MS
        const riskDrop = fwdRisk(curFc.risk) - fwdRisk(cand.fc.risk)
        const triggered = fwdRisk(curFc.risk) >= AGENT.GATEWAY_RISK_TRIGGER ||
                          curFc.outageNow >= AGENT.LINK_OUTAGE_TRIGGER
        if (cand.gw.name !== st.gw.name && triggered &&
            (i - st.since) >= 3 && (i - st.lastAction) >= 2 &&
            improvement >= AGENT.MIN_IMPROVEMENT_MS && riskDrop >= AGENT.MIN_RISK_DROP) {
          // Was the move made BEFORE the abandoned gateway actually failed?
          if (fadeAt(st.gw, hour) <= LINK.marginDb) proactive++
          st.gw = cand.gw; st.since = i; st.lastAction = i
          reroutes++
        }
      }
      chosen = st.gw
    }

    // Outcome: identical physics rule in every arm.
    const fade = fadeAt(chosen, hour)
    const failed = fade > LINK.marginDb
    if (failed) failures++
    // Latency proxy: reach time plus the weather penalty actually incurred.
    const w = POLICY_WEIGHTS[policy]
    rtts.push(gwCostMs(city, chosen, w, null, null) + fade * 2)
  }

  rtts.sort((a, b) => a - b)
  const q = p => rtts[Math.min(rtts.length - 1, Math.ceil(p * rtts.length) - 1)] ?? 0
  return {
    n: schedule.length,
    failures,
    failureRate: schedule.length ? failures / schedule.length : 0,
    meanRtt: rtts.length ? rtts.reduce((s, v) => s + v, 0) / rtts.length : 0,
    p95Rtt: q(0.95),
    reroutes,
    proactiveReroutes: proactive,
  }
}

/**
 * Build one shared schedule and run all three arms against it.
 * Deterministic: same seed, same hours, same cities, same policies.
 */
export function runExperiment({ hours = 900, requestsPerHour = 2, startHour = 48 } = {}) {
  const schedule = []
  let s = 1234567
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
  for (let h = 0; h < hours; h++) {
    for (let k = 0; k < requestsPerHour; k++) {
      schedule.push({
        hour: startHour + h,
        city: CITIES[Math.floor(rnd() * CITIES.length)],
        policy: POLICIES[Math.floor(rnd() * POLICIES.length)],
      })
    }
  }

  const A  = runArm(schedule, { vision: 'none',     useAgent: false })
  const R  = runArm(schedule, { vision: 'now',      useAgent: false })
  const B  = runArm(schedule, { vision: 'forecast', useAgent: false })
  const C  = runArm(schedule, { vision: 'forecast', useAgent: true  })

  // Decompose the benefit rather than reporting one headline number. The
  // question a reviewer asks is not "does this help" but "which part helps",
  // and observing is not the same capability as forecasting.
  return {
    schedule: { requests: schedule.length, hours, startHour },
    arms: { CURRENT: A, REACTIVE: R, PREDICTIVE: B, AUTOPILOT: C },
    headline: {
      totalFailuresBaseline: A.failures,
      avoidedByObserving:   A.failures - R.failures,
      avoidedByForecasting: R.failures - B.failures,
      residual:             B.failures,
      rttCostOfForecast:    B.meanRtt - R.meanRtt,
      rttCostOfAgent:       C.meanRtt - B.meanRtt,
      agentReroutes:        C.reroutes,
      proactiveShare:       C.reroutes ? C.proactiveReroutes / C.reroutes : 0,
    },
  }
}
