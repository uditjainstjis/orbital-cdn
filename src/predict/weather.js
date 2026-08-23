// Weather clock and gateway fade forecasting.
//
// The weather is a REPLAY of real recorded observations, not a random process.
// That distinction is the whole point: if the forecaster and the weather came
// from the same generator, a calibration score would only measure how well the
// model predicts its own random number generator. Here the trace is NASA POWER
// hourly precipitation for each real teleport site, and the forecaster is only
// ever shown observations at or before the current hour.
//
// Trace time runs faster than wall-clock so a demo is watchable. The speed is
// stated in the UI — an hour of weather every few seconds, not a claim that
// rain evolves that fast.

import TRACE from './weather_trace.json' with { type: 'json' }
import MODEL from './fade_model.json' with { type: 'json' }
import { predictProba, vectorise } from './gbm.js'
import { instantaneousFadeDb, outageProbability } from './itu.js'

export const HORIZONS_H = MODEL.horizons_h            // [1, 3, 6, 12]
export const FADE_THRESHOLD_DB = MODEL.threshold_db   // 3 dB
export const MODEL_VERSION = `${MODEL.name}:${MODEL.version}`
export const TRACE_META = {
  source: TRACE.source, period: TRACE.period,
  units: TRACE.stored_units, hours: Object.values(TRACE.sites)[0]?.n ?? 0,
}

// Ka-band downlink assumptions, exposed rather than buried.
export const LINK = {
  fGHz: 20.0,            // Ka-band downlink
  nominalElevDeg: 35.0,  // representative gateway elevation
  marginDb: 6.0,         // rain-fade margin the link is designed with
  tauDeg: 45,            // circular polarisation
}

// ─── Trace clock ────────────────────────────────────────────────────────────

let secondsPerTraceHour = 6      // demo speed; 1 trace-hour every 6 s
let originMs = Date.now()
let offsetHours = 0              // manual scrubbing / incident jumps

export function setWeatherSpeed(s) { secondsPerTraceHour = Math.max(0.5, s) }
export function getWeatherSpeed() { return secondsPerTraceHour }

/** Fractional trace-hour index right now. */
export function traceCursor() {
  const elapsed = (Date.now() - originMs) / 1000
  return offsetHours + elapsed / secondsPerTraceHour
}

export function jumpTraceHours(dh) { offsetHours += dh }
export function resetTraceClock() { originMs = Date.now(); offsetHours = 0 }

function siteTrace(name) { return TRACE.sites[name] }

/** Observed rain rate (mm/h) at a gateway, `back` hours before now. */
export function rainAt(gwName, back = 0) {
  const s = siteTrace(gwName)
  if (!s) return 0
  const i = Math.floor(traceCursor()) - back
  if (i < 0) return 0
  return s.rates_mm_h[((i % s.n) + s.n) % s.n] + (INJECT[gwName]?.active(back) ?? 0)
}

/** The trace value the forecaster is NOT allowed to see — used only to score it. */
export function futureMaxRain(gwName, horizonH) {
  const s = siteTrace(gwName)
  if (!s) return 0
  const i0 = Math.floor(traceCursor())
  let m = 0
  for (let k = 1; k <= horizonH; k++) {
    const idx = ((i0 + k) % s.n + s.n) % s.n
    m = Math.max(m, s.rates_mm_h[idx] + (INJECT[gwName]?.active(-k) ?? 0))
  }
  return m
}

// ─── Incident injection ─────────────────────────────────────────────────────
// A scenario button adds a real rain cell on top of the recorded trace. It is
// additive and explicitly labelled so it is never confused with observed data.

const INJECT = {}

export function injectRain(gwName, { peakMmH = 25, durationH = 6, rampH = 2 } = {}) {
  const startCursor = traceCursor()
  INJECT[gwName] = {
    label: `injected rain cell ${peakMmH} mm/h`,
    peakMmH, durationH, startCursor,
    active(back) {
      // `back` is hours before now; negative means into the future
      const t = traceCursor() - back - startCursor
      if (t < 0 || t > durationH) return 0
      const ramp = Math.min(1, t / rampH)
      const fall = Math.min(1, (durationH - t) / rampH)
      return peakMmH * Math.max(0, Math.min(ramp, fall))
    },
  }
}

export function clearInjections() { Object.keys(INJECT).forEach(k => delete INJECT[k]) }
export function activeInjections() {
  return Object.entries(INJECT)
    .filter(([g]) => (INJECT[g].active(0) ?? 0) > 0.05)
    .map(([g, v]) => ({ gateway: g, label: v.label, nowMmH: +v.active(0).toFixed(1) }))
}

// ─── Physics: rain rate to outage probability ───────────────────────────────

export function fadeDbFor(gw, rainMmH, elevDeg = LINK.nominalElevDeg) {
  return instantaneousFadeDb({
    latDeg: gw.lat, elevDeg, fGHz: LINK.fGHz,
    rainRateMmH: rainMmH, tauDeg: LINK.tauDeg,
  })
}

export function currentFade(gw) {
  return fadeDbFor(gw, rainAt(gw.name))
}

/** Outage probability implied by the fade happening right now. */
export function currentOutage(gw) {
  return outageProbability(currentFade(gw), LINK.marginDb)
}

// ─── Forecast features — strictly backward looking ──────────────────────────

function featuresFor(gw) {
  const r = b => rainAt(gw.name, b)
  const hist = n => Array.from({ length: n }, (_, i) => r(i + 1))
  const mean = a => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0)
  const past3 = hist(3), past6 = hist(6), past24 = hist(24)

  let sinceWet = 0
  for (let i = 1; i <= 200; i++) { if (r(i) > 0.5) break; sinceWet = i }

  const s = siteTrace(gw.name)
  const i0 = Math.floor(traceCursor())
  const startHour = s ? parseInt(String(s.start_hour).slice(8, 10), 10) : 0

  return {
    rain: r(0),
    rain_lag1: r(1), rain_lag2: r(2), rain_lag3: r(3), rain_lag6: r(6), rain_lag12: r(12),
    trend_1h: r(0) - r(1),
    trend_3h: r(0) - r(3),
    roll_mean_3: mean(past3), roll_mean_6: mean(past6), roll_mean_24: mean(past24),
    roll_max_6: Math.max(...past6, 0), roll_max_24: Math.max(...past24, 0),
    wet_frac_24: past24.filter(v => v > 0.1).length / 24,
    fade_now: fadeDbFor(gw, r(0)),
    hours_since_wet: sinceWet,
    site_wet_fraction: s?.wet_fraction ?? 0,
    site_mean_rain: s ? mean(s.rates_mm_h) : 0,
    abs_lat: Math.abs(gw.lat),
    hour_of_day: (startHour + i0) % 24,
    doy_frac: ((i0 / 24) % 365) / 365,
  }
}

/**
 * Forecast the probability that fade exceeds the threshold within each horizon.
 * Returns learned probabilities plus the persistence baseline for comparison.
 */
export function forecastGateway(gw) {
  const f = featuresFor(gw)
  const x = vectorise(MODEL.features, f)
  const risk = {}
  const baseline = {}
  for (const H of HORIZONS_H) {
    risk[H] = predictProba(MODEL.trees[String(H)], x)
    baseline[H] = Math.max(0, Math.min(1, f.fade_now / FADE_THRESHOLD_DB))
  }
  return {
    gateway: gw.name, risk, baseline,
    fadeNowDb: f.fade_now,
    rainNowMmH: f.rain,
    outageNow: outageProbability(f.fade_now, LINK.marginDb),
    confidence: confidenceFor(f),
    modelVersion: MODEL_VERSION,
  }
}

/**
 * Confidence, used to gate autonomous action.
 *
 * Low when the current conditions sit outside the range the model was trained
 * on — an injected 40 mm/h cell at a site whose recorded maximum is 2 mm/h is
 * exactly the case where a confident prediction would be unearned.
 */
function confidenceFor(f) {
  const s = Object.values(TRACE.sites)
  const globalMax = Math.max(...s.map(v => v.max_mm_h))
  let c = 1
  if (f.rain > globalMax) c -= 0.45                       // out of distribution
  else if (f.rain > globalMax * 0.8) c -= 0.15
  if (f.hours_since_wet > 150) c -= 0.1                   // long dry gap, sparse support
  return Math.max(0.25, Math.min(1, c))
}

/** Everything the UI and the agent need for one gateway. */
export function gatewayForecasts(gateways) {
  return gateways.map(gw => forecastGateway(gw))
}
