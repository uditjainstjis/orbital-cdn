// Orbital Network Operations Agent.
//
// Not a chatbot and not a language model. This is a deterministic policy engine
// that runs a closed loop:
//
//     OBSERVE -> PREDICT -> PLAN -> ACT -> VERIFY -> LEARN
//
// The routing engine remains the source of truth for geometry and cost. The
// agent's only power is to decide, given predictions, whether moving traffic is
// worth it — and to be held to account afterwards by the verification step.
//
// Everything it does is recorded so that a decision can be replayed and judged.

import { GATEWAYS } from '../network.js'
import { forecastGateway, futureMaxRain, fadeDbFor, LINK, HORIZONS_H, FADE_THRESHOLD_DB } from './weather.js'
import { AGENT, PREDICT, MODES } from './config.js'
import { gwCostMs, POLICY_WEIGHTS } from '../engine.js'

const KEY_MODE = 'ocdn.agent.mode'
const KEY_LOG  = 'ocdn.agent.log'
const MAX_LOG  = 400

// ─── Mode ───────────────────────────────────────────────────────────────────

export function getMode() {
  try { return localStorage.getItem(KEY_MODE) || MODES.ASSIST } catch { return MODES.ASSIST }
}
export function setMode(m) {
  try { localStorage.setItem(KEY_MODE, m) } catch { /* ignore */ }
}

// ─── Decision log (persistent, auditable) ───────────────────────────────────

let logCache = null
function loadLog() {
  if (logCache) return logCache
  try {
    const raw = localStorage.getItem(KEY_LOG)
    logCache = raw ? JSON.parse(raw) : []
    if (!Array.isArray(logCache)) logCache = []
  } catch { logCache = [] }
  return logCache
}
function saveLog() {
  try { localStorage.setItem(KEY_LOG, JSON.stringify(logCache)) } catch { /* ignore */ }
}
export function decisions() { return loadLog() }
export function clearDecisions() { logCache = []; saveLog() }

function record(entry) {
  const log = loadLog()
  log.push(entry)
  if (log.length > MAX_LOG) logCache = log.slice(log.length - MAX_LOG)
  saveLog()
  return entry
}

// ─── Runtime state ──────────────────────────────────────────────────────────

const state = {
  currentGateway: null,
  routeSince: 0,
  lastActionAt: 0,
  pending: null,          // proposal awaiting approval in ASSIST mode
  lastObservation: null,
}

export function agentState() { return { ...state, mode: getMode() } }
export function setCurrentGateway(name) {
  if (state.currentGateway !== name) {
    state.currentGateway = name
    state.routeSince = Date.now()
  }
}

// ─── Tools ──────────────────────────────────────────────────────────────────
// Explicit, inspectable functions rather than free-form reasoning.

/** Tool: inspect_network — full observable state. */
export function inspectNetwork() {
  const forecasts = {}
  for (const gw of GATEWAYS) forecasts[gw.name] = forecastGateway(gw)
  return {
    timestamp: Date.now(),
    gateways: GATEWAYS.map(gw => ({
      name: gw.name, site: gw.site, lat: gw.lat, lon: gw.lon,
      weather: gw.weather,
      ...forecasts[gw.name],
    })),
    currentGateway: state.currentGateway,
    mode: getMode(),
  }
}

/** Tool: predict_gateway_risk */
export function predictGatewayRisk(gwName, horizonH = 3) {
  const gw = GATEWAYS.find(g => g.name === gwName)
  if (!gw) return null
  const f = forecastGateway(gw)
  return { gateway: gwName, horizonH, risk: f.risk[horizonH] ?? null, confidence: f.confidence,
           fadeNowDb: f.fadeNowDb, outageNow: f.outageNow, modelVersion: f.modelVersion }
}

/** Tool: evaluate_route — cost every gateway for this origin without acting. */
export function evaluateRoutes(city, policy, prof) {
  const w = POLICY_WEIGHTS[policy]
  return GATEWAYS.map(gw => {
    const fc = forecastGateway(gw)
    return {
      gateway: gw.name,
      costMs: gwCostMs(city, gw, w, prof, fc),
      fadeNowDb: fc.fadeNowDb,
      outageNow: fc.outageNow,
      risk: fc.risk,
      confidence: fc.confidence,
      weather: gw.weather,
    }
  }).sort((a, b) => a.costMs - b.costMs)
}

// ─── Planning ───────────────────────────────────────────────────────────────

/** Weighted forward risk across horizons, matching the router's taper. */
function forwardRisk(fcRisk) {
  let s = 0, w = 0
  for (const [h, hw] of Object.entries(PREDICT.HORIZON_WEIGHTS)) {
    if (typeof fcRisk?.[h] !== 'number') continue
    s += hw * fcRisk[h]; w += hw
  }
  return w ? s / w : 0
}

/**
 * Decide whether to act.
 *
 * The gates below are what stop an agent from making the network worse:
 * a minimum hold time, a cooldown after acting, a required improvement that
 * must exceed the cost of moving, and a required drop in predicted risk. An
 * agent without these oscillates between two gateways forever.
 */
export function plan({ city, policy, prof }) {
  const now = Date.now()
  const routes = evaluateRoutes(city, policy, prof)
  const current = routes.find(r => r.gateway === state.currentGateway) ?? routes[0]
  const best = routes[0]

  const obs = {
    at: now,
    current: current?.gateway ?? null,
    currentCostMs: current ? +current.costMs.toFixed(1) : null,
    currentRisk: +forwardRisk(current?.risk).toFixed(3),
    best: best.gateway,
    bestCostMs: +best.costMs.toFixed(1),
    bestRisk: +forwardRisk(best.risk).toFixed(3),
  }
  state.lastObservation = obs

  if (!current || best.gateway === current.gateway) {
    return { action: 'HOLD', reason: 'current_route_is_best', ...obs }
  }

  const improvementMs = current.costMs - best.costMs - AGENT.ACTION_COST_MS
  const riskDrop = forwardRisk(current.risk) - forwardRisk(best.risk)
  const heldMs = now - state.routeSince
  const sinceAction = now - state.lastActionAt

  const triggered =
    forwardRisk(current.risk) >= AGENT.GATEWAY_RISK_TRIGGER ||
    current.outageNow >= AGENT.LINK_OUTAGE_TRIGGER

  const blocked =
    !triggered                              ? 'no_trigger'
    : heldMs < AGENT.MIN_HOLD_MS            ? 'min_hold_time'
    : sinceAction < AGENT.COOLDOWN_MS       ? 'cooldown'
    : improvementMs < AGENT.MIN_IMPROVEMENT_MS ? 'improvement_below_threshold'
    : riskDrop < AGENT.MIN_RISK_DROP        ? 'risk_drop_below_threshold'
    : best.confidence < PREDICT.MIN_CONFIDENCE_TO_ACT ? 'low_confidence'
    : null

  const proposal = {
    ...obs,
    from: current.gateway, to: best.gateway,
    improvementMs: +improvementMs.toFixed(1),
    riskDrop: +riskDrop.toFixed(3),
    confidence: +best.confidence.toFixed(2),
    heldMs, triggered,
  }

  if (blocked) return { action: 'HOLD', reason: blocked, ...proposal }
  return { action: 'REROUTE', reason: 'predicted_gateway_degradation', ...proposal }
}

// ─── Acting ─────────────────────────────────────────────────────────────────

/**
 * Run one agent tick. Returns the decision; in ASSIST mode a REROUTE becomes a
 * pending proposal rather than an action.
 */
export function step({ city, policy, prof }) {
  const mode = getMode()
  if (mode === MODES.OFF) return { action: 'DISABLED', reason: 'mode_off' }

  const d = plan({ city, policy, prof })
  if (d.action !== 'REROUTE') return d

  if (mode === MODES.ASSIST) {
    state.pending = d
    return record({ ...d, event: 'PROPOSED', mode, ts: Date.now(), verified: null })
  }

  return applyReroute(d, mode)
}

export function pendingProposal() { return state.pending }

export function approvePending() {
  if (!state.pending) return null
  const d = state.pending
  state.pending = null
  return applyReroute(d, MODES.ASSIST)
}

export function rejectPending() {
  const d = state.pending
  state.pending = null
  if (d) record({ ...d, event: 'REJECTED', ts: Date.now(), verified: null })
  return d
}

function applyReroute(d, mode) {
  const now = Date.now()
  state.currentGateway = d.to
  state.routeSince = now
  state.lastActionAt = now

  // Record the prediction that justified the action, so it can be scored later.
  const entry = record({
    ...d, event: 'REROUTE', mode, ts: now,
    predictedRiskAvoided: d.riskDrop,
    verifyAtHour: 3,             // check against what actually happened 3 trace-hours on
    verified: null,
  })
  return entry
}

// ─── Verification and learning ──────────────────────────────────────────────

/**
 * Score past decisions against what the weather actually did.
 *
 * This is the part that makes the loop honest: a prediction that is never
 * checked is a claim, not a forecast. We compare the risk the agent acted on
 * with whether fade actually crossed the threshold at the gateway it left.
 */
export function verifyPending() {
  const log = loadLog()
  let scored = 0
  for (const e of log) {
    if (e.verified !== null || e.event !== 'REROUTE') continue
    const gw = GATEWAYS.find(g => g.name === e.from)
    if (!gw) { e.verified = { skipped: 'gateway_missing' }; continue }
    // Did fade at the abandoned gateway actually exceed the threshold?
    const futureRain = futureMaxRain(gw.name, e.verifyAtHour ?? 3)
    const futureFade = fadeDbFor(gw, futureRain)
    const actuallyDegraded = futureFade > FADE_THRESHOLD_DB
    e.verified = {
      at: Date.now(),
      predictedRisk: e.currentRisk,
      actuallyDegraded,
      futureFadeDb: +futureFade.toFixed(2),
      beneficial: actuallyDegraded,       // we left a gateway that did degrade
    }
    scored++
  }
  if (scored) saveLog()
  return scored
}

/** Brier score and reliability bins over verified decisions. */
export function calibration() {
  const v = loadLog().filter(e => e.verified && typeof e.verified.actuallyDegraded === 'boolean')
  if (!v.length) return { n: 0 }
  const brier = v.reduce((s, e) => {
    const p = e.currentRisk ?? 0
    const y = e.verified.actuallyDegraded ? 1 : 0
    return s + (p - y) ** 2
  }, 0) / v.length

  const bins = [0, 0.2, 0.4, 0.6, 0.8, 1.0001].slice(0, -1).map((lo, i) => {
    const hi = [0.2, 0.4, 0.6, 0.8, 1.0001][i]
    const inBin = v.filter(e => (e.currentRisk ?? 0) >= lo && (e.currentRisk ?? 0) < hi)
    return {
      range: `${lo.toFixed(1)}-${Math.min(1, hi).toFixed(1)}`,
      n: inBin.length,
      predicted: inBin.length ? inBin.reduce((s, e) => s + (e.currentRisk ?? 0), 0) / inBin.length : 0,
      observed: inBin.length ? inBin.filter(e => e.verified.actuallyDegraded).length / inBin.length : 0,
    }
  })

  const beneficial = v.filter(e => e.verified.beneficial).length
  return {
    n: v.length,
    brier: +brier.toFixed(4),
    beneficialReroutes: beneficial,
    beneficialShare: +(beneficial / v.length).toFixed(3),
    bins,
  }
}

export { HORIZONS_H, LINK, MODES }
