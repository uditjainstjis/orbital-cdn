// Regression tests for the routing engine.
//
// Every case in the "scars" group below corresponds to a bug that actually
// shipped into a build of this simulator and produced a plausible-looking but
// wrong number. They are here so those specific mistakes cannot come back.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  haversine, pathDistanceKm, dcCostMs, gwCostMs, weatherMs,
  predictiveCostMs, POLICY_WEIGHTS, TERRESTRIAL_ORIGINS, measuredFibre,
} from '../src/engine.js'
import { PREDICT } from '../src/predict/config.js'

const W = POLICY_WEIGHTS.balanced

// ─── Geodesy ────────────────────────────────────────────────────────────────

test('haversine matches published great-circle distances within 1%', () => {
  const cases = [
    ['London→New York',  51.5,  -0.13,  40.71, -74.01, 5570],
    ['Delhi→Singapore',  28.61,  77.21,  1.35, 103.82, 4145],
    ['Sydney→Lagos',    -33.87, 151.21,  6.52,   3.38, 15600],
  ]
  for (const [name, a, b, c, d, expected] of cases) {
    const got = haversine(a, b, c, d)
    const err = Math.abs(got - expected) / expected
    assert.ok(err < 0.01, `${name}: got ${got.toFixed(0)} km, expected ~${expected} km (${(err * 100).toFixed(1)}% off)`)
  }
})

test('haversine is zero for identical points and symmetric', () => {
  assert.equal(haversine(28.6, 77.2, 28.6, 77.2), 0)
  const ab = haversine(51.5, -0.13, 35.68, 139.69)
  const ba = haversine(35.68, 139.69, 51.5, -0.13)
  assert.ok(Math.abs(ab - ba) < 1e-9, 'distance must not depend on argument order')
})

// ─── Scar: the round-trip double-count ──────────────────────────────────────
//
// pathDistanceKm already walks city → orbit → DC → orbit → gateway. A caller
// once doubled it "for the return trip", charging Sydney 45,000 km for a
// request and making every long-haul route look catastrophic.

test('pathDistanceKm returns the complete path and is not itself doubled', () => {
  const scenario = {
    city:    { lat: -33.87, lon: 151.21 },
    uplink:  { lat: -30.0,  lon: 150.0, alt: 550 },
    hopSats: [{ lat: -10.0, lon: 140.0, alt: 550 }, { lat: 5.0, lon: 120.0, alt: 550 }],
    dc:      { lat: 1.0,    lon: 103.0, alt: 640 },
    gw:      { lat: 1.35,   lon: 103.82 },
    gwSat:   { lat: 2.0,    lon: 104.0, alt: 550 },
  }
  const d = pathDistanceKm(scenario)
  const groundGreatCircle = haversine(-33.87, 151.21, 1.35, 103.82)

  assert.ok(d > groundGreatCircle,
    'path through orbit must exceed the ground great circle — it climbs twice')
  assert.ok(d < groundGreatCircle + 4000,
    `path of ${d.toFixed(0)} km against a ${groundGreatCircle.toFixed(0)} km great circle ` +
    'implies the out-and-back was counted twice')
})

// ─── Scar: unit mismatch between cost terms ─────────────────────────────────
//
// The penalties were once dimensionless flags while distance was in ms, so a
// binary eclipse outweighed half a planet of detour.

test('every cost term is denominated in milliseconds and stays commensurate', () => {
  const city = { lat: 28.61, lon: 77.21 }
  const near = { dcName: 'DC-1', lat: 20, lon: 80,   eclipsed: false, inSAA: false }
  const far  = { dcName: 'DC-2', lat: -40, lon: -70, eclipsed: false, inSAA: false }

  const eclipsePenalty = dcCostMs(city, { ...near, eclipsed: true }, W) - dcCostMs(city, near, W)
  const detourPenalty  = dcCostMs(city, far, W) - dcCostMs(city, near, W)

  assert.ok(eclipsePenalty > 0, 'an eclipsed DC must cost more than a sunlit one')
  assert.ok(detourPenalty > eclipsePenalty,
    `crossing the planet (${detourPenalty.toFixed(1)} ms) must outweigh an eclipse ` +
    `(${eclipsePenalty.toFixed(1)} ms); if it does not, the terms are in different units`)
})

test('learned latency and radiation penalties are carried by their own weights', () => {
  const city = { lat: 0, lon: 0 }
  const dc   = { dcName: 'DC-1', lat: 10, lon: 10, eclipsed: false, inSAA: false }
  const base = dcCostMs(city, dc, W)

  const latOnly = dcCostMs(city, dc, W, { ready: true, dcLatPenalty: { 'DC-1': 1 }, dcRadPenalty: {} })
  const radOnly = dcCostMs(city, dc, W, { ready: true, dcLatPenalty: {}, dcRadPenalty: { 'DC-1': 1 } })

  assert.ok(latOnly > base, 'observed tail latency must raise the cost')
  assert.ok(radOnly > base, 'observed SAA exposure must raise the cost')

  // Under a policy that ignores radiation, only the radiation term collapses.
  const noRad = { ...W, rad: 0 }
  assert.ok(dcCostMs(city, dc, noRad, { ready: true, dcLatPenalty: {}, dcRadPenalty: { 'DC-1': 1 } })
            === dcCostMs(city, dc, noRad),
    'radiation history must be scaled by w.rad, not by w.sol')
})

// ─── Scar: predictive cost silently returning zero ──────────────────────────
//
// With no forecast horizons supplied this function once returned 0, which made
// the REACTIVE arm of the experiment numerically identical to the BLIND arm.
// Reporting that would have produced the conclusion "only forecasting helps" —
// the exact opposite of the measured result.

test('observed outage is charged even when no forecast horizon is supplied', () => {
  const blind    = predictiveCostMs({}, null)
  const reactive = predictiveCostMs({}, { outageNow: 0.5, confidence: 1, risk: {} })

  assert.equal(blind, 0, 'no forecast object at all means no predictive cost')
  assert.ok(reactive > 0,
    'a gateway observed to be in outage must cost something even with no horizons; ' +
    'returning 0 here makes a reactive router indistinguishable from a blind one')
  assert.equal(reactive, PREDICT.FAILURE_COST_MS * 0.5)
})

test('predictive cost rises with risk and is damped by low confidence', () => {
  const mk = (risk, confidence) => predictiveCostMs({}, { outageNow: 0, confidence, risk })
  assert.ok(mk({ 1: 0.9 }, 1) > mk({ 1: 0.1 }, 1), 'higher risk must cost more')
  assert.ok(mk({ 1: 0.9 }, 0.2) < mk({ 1: 0.9 }, 1),
    'an out-of-distribution prediction must not drive routing on its own')
})

test('predictive cost never exceeds the failure cost it is pricing', () => {
  const worst = predictiveCostMs({}, { outageNow: 1, confidence: 1, risk: { 1: 1, 3: 1, 6: 1, 12: 1 } })
  assert.ok(worst <= PREDICT.FAILURE_COST_MS + 1e-9,
    `expected cost ${worst} exceeded FAILURE_COST_MS ${PREDICT.FAILURE_COST_MS}`)
})

// ─── Weather and gateway cost ───────────────────────────────────────────────

test('weather cost is monotonic in severity', () => {
  assert.ok(weatherMs('clear') < weatherMs('cloudy'))
  assert.ok(weatherMs('cloudy') < weatherMs('rain'))
  assert.equal(weatherMs('clear'), 0)
})

test('a policy that ignores weather is unmoved by rain', () => {
  const city = { lat: 28.6, lon: 77.2 }
  const gw   = { name: 'Mumbai', lat: 19.1, lon: 72.9, weather: 'rain' }
  const dry  = { ...gw, weather: 'clear' }
  const wxBlind = { ...W, wx: 0 }
  assert.equal(gwCostMs(city, gw, wxBlind), gwCostMs(city, dry, wxBlind))
  assert.ok(gwCostMs(city, gw, W) > gwCostMs(city, dry, W),
    'the balanced policy does weight weather and must react to it')
})

// ─── Baselines ──────────────────────────────────────────────────────────────

test('fibre baselines are measured values carrying their provenance', () => {
  // The whole credibility argument rests on this table being external, and on
  // each row naming the node it was measured through so a judge can re-ping it.
  for (const city of ['London', 'New York', 'Delhi', 'Lagos', 'Sydney', 'Tokyo']) {
    const m = measuredFibre(city)
    assert.ok(m, `${city} has no measured fibre baseline`)
    assert.equal(typeof m.rtt, 'number')
    assert.ok(m.rtt > 0 && m.rtt < 1000, `${city} baseline ${m.rtt} ms is not physically plausible`)
    assert.ok(typeof m.via === 'string' && m.via.length,
      `${city} does not record which node the measurement was taken through`)
  }
})

test('measured baselines agree with the independent Azure backbone medians', () => {
  // Two different networks, so exact agreement is not expected — but an order
  // of magnitude apart would mean one of the two numbers is wrong.
  for (const city of ['New York', 'London', 'Tokyo', 'Sao Paulo', 'Sydney']) {
    const { rtt, azure } = measuredFibre(city)
    if (azure == null) continue
    const ratio = Math.max(rtt, azure) / Math.min(rtt, azure)
    assert.ok(ratio < 2.2,
      `${city}: WonderNetwork ${rtt} ms vs Azure P50 ${azure} ms is a ${ratio.toFixed(1)}x gap`)
  }
})

test('terrestrial origins are real cloud regions with valid coordinates', () => {
  assert.ok(TERRESTRIAL_ORIGINS.length >= 3)
  for (const o of TERRESTRIAL_ORIGINS) {
    assert.ok(Math.abs(o.lat) <= 90,  `${o.name} latitude out of range`)
    assert.ok(Math.abs(o.lon) <= 180, `${o.name} longitude out of range`)
  }
})
