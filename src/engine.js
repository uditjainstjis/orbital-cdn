// Orbital CDN routing engine — 6-term multi-objective cost function
// Ported from the original flat-map simulator, physics unchanged.

import { GATEWAYS } from './network.js'
import { adaptiveProfile, adaptiveEnabled } from './telemetry.js'

// Adaptation strength — how much observed history is allowed to bend the
// hand-set policy weights. 0 = pure policy, 1 = history dominates.
const ADAPT_GAIN = 0.6

// ─── Policy weight vectors ─────────────────────────────────────────────────

export const POLICY_WEIGHTS = {
  latency:  { lat: 0.95, sol: 0.05, rad: 0.05, wx: 0.05, eng: 0.05 },
  balanced: { lat: 0.50, sol: 0.50, rad: 0.50, wx: 0.40, eng: 0.40 },
  green:    { lat: 0.20, sol: 0.90, rad: 0.20, wx: 0.30, eng: 0.85 },
  reliable: { lat: 0.20, sol: 0.30, rad: 0.95, wx: 0.90, eng: 0.20 },
}

export const POLICY_DESCS = {
  latency:  'Latency-first: shortest path regardless of radiation, battery, or weather.',
  balanced: 'Balanced: moderate latency trade-off, prefers sunlit DCs, avoids heavy weather.',
  green:    'Green: routes to sunlit DCs, fewer laser hops, maximises solar-powered requests.',
  reliable: 'Reliable: avoids SAA radiation zones and weather-exposed gateways, accepts longer paths.',
}

// ─── Geometry ──────────────────────────────────────────────────────────────

const EARTH_R   = 6371        // km
const C_VAC     = 299792      // km/s — laser crosslink in vacuum
const C_FIBRE   = 204190      // km/s — c / 1.468 refractive index of silica
const FIBRE_WIND = 1.42      // real fibre route vs great-circle ("route factor")
const HALF_CIRCUM = Math.PI * EARTH_R   // 20,015 km — max great-circle separation

// Every term in the cost function is expressed in latency-equivalent
// milliseconds, so the policy weights trade like against like. Without this the
// binary eclipse flag outweighs half a planet of detour and "balanced" routes
// a Delhi request to the far side of the Earth to find sunlight.
const ECLIPSE_COST_MS = 25   // what one weight-unit of solar preference is worth
const SAA_COST_MS     = 40   // radiation exposure, as latency we would pay to avoid it
const ADAPT_COST_MS   = 30   // full-strength learned penalty, same currency

/** Round-trip propagation cost of reaching a point, in ms. */
function reachMs(fromLat, fromLon, toLat, toLon) {
  return (haversine(fromLat, fromLon, toLat, toLon) / C_VAC) * 1000 * 2
}

/** Great-circle surface distance between two lat/lon points, km. */
export function haversine(lat1, lon1, lat2, lon2) {
  const R = Math.PI / 180
  const dLat = (lat2 - lat1) * R
  const dLon = (lon2 - lon1) * R
  const a = Math.sin(dLat / 2) ** 2
          + Math.cos(lat1 * R) * Math.cos(lat2 * R) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(a)))
}

/** Slant range from a ground point to a satellite at `alt` km over `sLat,sLon`. */
function slant(gLat, gLon, sLat, sLon, alt) {
  const ground = haversine(gLat, gLon, sLat, sLon)
  return Math.sqrt(ground ** 2 + alt ** 2)
}

/** Arc length between two orbiting nodes, measured at orbital radius. */
function orbitalArc(aLat, aLon, bLat, bLon, alt) {
  return haversine(aLat, aLon, bLat, bLon) * ((EARTH_R + alt) / EARTH_R)
}

/**
 * Total round-trip path length for a request, in km.
 *
 * city →(uplink)→ sat → ISL relays → orbital DC →(ISL)→ sat over the gateway
 * →(downlink)→ ground gateway. Because the chain already runs out to the DC
 * and back down to the ground, this IS the complete request+response path —
 * it must not be doubled again to get RTT.
 *
 * Shared with the history generator so seeded and live records are comparable.
 */
export function pathDistanceKm({ city, uplink, hopSats, dc, gw, gwSat }) {
  const upAlt = uplink.alt ?? 550
  const dcAlt = dc.alt ?? 640

  // Ground → uplink satellite
  let d = slant(city.lat, city.lon, uplink.lat, uplink.lon, upAlt)

  // Uplink → relay chain → orbital DC, all as crosslinks at orbital radius
  let prev = uplink
  for (const h of hopSats) {
    d += orbitalArc(prev.lat, prev.lon, h.lat, h.lon, upAlt)
    prev = h
  }
  d += orbitalArc(prev.lat, prev.lon, dc.lat, dc.lon, dcAlt)

  // DC → a satellite actually above the gateway → ground.
  // Without this relay the "downlink" would be a straight line through the
  // Earth whenever the DC is over the far side of the planet.
  const down = gwSat ?? dc
  d += orbitalArc(dc.lat, dc.lon, down.lat, down.lon, dcAlt)
  d += slant(gw.lat, gw.lon, down.lat, down.lon, down.alt ?? upAlt)

  return d
}

// Major terrestrial cloud regions the content would otherwise be served from.
// A space CDN competes with long-haul fibre to one of these, not with a
// short hop to the local gateway — so this is what the baseline measures.
export const TERRESTRIAL_ORIGINS = [
  { name: 'us-east-1',      lat:  38.9, lon:  -77.0 },
  { name: 'eu-central-1',   lat:  50.1, lon:    8.7 },
  { name: 'ap-southeast-1', lat:   1.3, lon:  103.8 },
]

/**
 * Terrestrial fibre RTT from a city to its nearest cloud region.
 *
 * Not idealised glass-speed: includes the route winding factor, per-distance
 * switching/amplification cost, and last-mile access latency, which is why
 * this lands near real measured intercontinental RTTs rather than under them.
 */
export function fibreBaselineMs(city, procMs) {
  const origin = TERRESTRIAL_ORIGINS.reduce((best, o) => {
    const d = haversine(city.lat, city.lon, o.lat, o.lon)
    return (!best || d < best.d) ? { ...o, d } : best
  }, null)

  const route     = origin.d * FIBRE_WIND
  const glassMs   = (route / C_FIBRE) * 1000
  const switchMs  = (route / 1000) * 1.0    // routers, amplifiers, regen ~1 ms per 1000 km
  const accessMs  = 5                        // last-mile each way
  return 2 * (glassMs + switchMs + accessMs) + procMs
}

// ─── DC selection ──────────────────────────────────────────────────────────

export function dcCostMs(city, dc, w, prof) {
  // Learned terms carry the coefficient of the objective they belong to:
  // observed tail latency is a latency cost, observed SAA exposure is a
  // radiation cost. Weighting radiation history by w.sol was a bug.
  const lat = prof?.ready ? (prof.dcLatPenalty[dc.dcName] ?? 0) : 0
  const rad = prof?.ready ? (prof.dcRadPenalty[dc.dcName] ?? 0) : 0
  return w.lat * reachMs(city.lat, city.lon, dc.lat, dc.lon)
       + w.sol * ECLIPSE_COST_MS * (dc.eclipsed ? 1 : 0)
       + w.rad * SAA_COST_MS     * (dc.inSAA   ? 1 : 0)
       + w.lat * ADAPT_COST_MS   * ADAPT_GAIN * lat
       + w.rad * ADAPT_COST_MS   * ADAPT_GAIN * rad
}

function findBestDC(city, policy, dcList, prof) {
  const w = POLICY_WEIGHTS[policy]
  return dcList.reduce((best, dc) => {
    const cost    = dcCostMs(city, dc, w, prof)
    const learned = prof?.ready
      ? (prof.dcLatPenalty[dc.dcName] ?? 0) + (prof.dcRadPenalty[dc.dcName] ?? 0)
      : 0
    return (!best || cost < best.cost)
      ? { ...dc, cost, dist: (haversine(city.lat, city.lon, dc.lat, dc.lon) / HALF_CIRCUM).toFixed(3), learned }
      : best
  }, null)
}

// ─── Gateway selection ─────────────────────────────────────────────────────

/** Rain-fade delay actually added at a gateway, in ms. */
export function weatherMs(weather) {
  return weather === 'clear' ? 0 : weather === 'cloudy' ? 8 : 22
}

export function gwCostMs(city, gw, w, prof) {
  const learned = prof?.ready ? (prof.gwPenalty[gw.name] ?? 0) : 0
  return w.lat * reachMs(city.lat, city.lon, gw.lat, gw.lon)
       + w.wx  * weatherMs(gw.weather)
       + w.wx  * ADAPT_COST_MS * ADAPT_GAIN * learned
}

function findBestGateway(city, policy, prof) {
  const w = POLICY_WEIGHTS[policy]
  return GATEWAYS.reduce((best, gw) => {
    const cost    = gwCostMs(city, gw, w, prof)
    const learned = prof?.ready ? (prof.gwPenalty[gw.name] ?? 0) : 0
    return (!best || cost < best.cost)
      ? { ...gw, cost,
          dist: (haversine(city.lat, city.lon, gw.lat, gw.lon) / HALF_CIRCUM).toFixed(3),
          wxScore: (weatherMs(gw.weather) / 22).toFixed(1), learned }
      : best
  }, null)
}

// ─── Nearest satellite ─────────────────────────────────────────────────────

function findNearestSat(lat, lon, satList) {
  return satList
    .filter(s => !s.isDC)
    .reduce((best, s) => {
      const d = (s.lat - lat) ** 2 + (s.lon - lon) ** 2
      return (!best || d < best._d) ? { ...s, _d: d } : best
    }, null)
}

// ─── SAA check ────────────────────────────────────────────────────────────

function inSAA(lat, lon) {
  return lat >= -50 && lat <= 0 && lon >= -80 && lon <= 10
}

// ─── Controlled policy counterfactual ──────────────────────────────────────

/**
 * Re-run the same request under every policy against the same constellation
 * state, and return the resulting RTT for each.
 *
 * Deterministic on purpose: the relay chain is interpolated without jitter so
 * the only thing that differs between policies is the policy itself. This is a
 * controlled comparison, not four independent samples.
 */
export function comparePolicies({ city, service, sats, prof }) {
  const dcList = sats.filter(s => s.isDC)
  const uplink = findNearestSat(city.lat, city.lon, sats)
  const procMs = service.compute === 'high' ? 42 : service.compute === 'medium' ? 16 : 6
  const out    = {}

  for (const pol of Object.keys(POLICY_WEIGHTS)) {
    const dc = findBestDC(city, pol, dcList, prof)
    const gw = findBestGateway(city, pol, prof)
    if (!dc || !gw || !uplink) { out[pol] = null; continue }

    const hopSats = [1, 2].map(k => {
      const f = k / 3
      return {
        lat: uplink.lat + (dc.lat - uplink.lat) * f,
        lon: uplink.lon + (dc.lon - uplink.lon) * f,
      }
    })

    const gwSat = findNearestSat(gw.lat, gw.lon, sats)
    const dist  = pathDistanceKm({ city, uplink, hopSats, dc, gw, gwSat })
    const wxMs  = weatherMs(gw.weather)
    out[pol] = Math.round((dist / C_VAC) * 1000 + procMs + wxMs)
  }
  return out
}

// ─── Main simulation ───────────────────────────────────────────────────────

export function runSimulation({ city, service, policy, sats, learnWindow = '7d' }) {
  const dcList = sats.filter(s => s.isDC)
  const w      = POLICY_WEIGHTS[policy]

  // Adaptation: bias this decision with what the network actually observed
  // over the selected learning window. Falls back to pure policy weights when
  // adaptive mode is off or there is not enough history yet.
  const useAdaptive = adaptiveEnabled()
  const prof        = useAdaptive ? adaptiveProfile(learnWindow) : { ready: false }

  // Step 1: Uplink satellite
  const uplink = findNearestSat(city.lat, city.lon, sats)

  // Step 2: Best DC
  // Scored with the SAME function that picks the route — dcCostMs — so the
  // deep-dive table can never rank a candidate above the one actually chosen.
  const allDCs  = dcList.map(dc => {
    const lrnL = prof.ready ? (prof.dcLatPenalty[dc.dcName] ?? 0) : 0
    const lrnR = prof.ready ? (prof.dcRadPenalty[dc.dcName] ?? 0) : 0
    return {
      ...dc,
      scoreDist:    reachMs(city.lat, city.lon, dc.lat, dc.lon).toFixed(1),
      scoreLearned: (ADAPT_COST_MS * ADAPT_GAIN * (w.lat * lrnL + w.rad * lrnR)).toFixed(1),
      scoreTotal:   dcCostMs(city, dc, w, prof).toFixed(1),
    }
  })
  const dc = findBestDC(city, policy, dcList, prof)

  // Step 3: ISL path (interpolated relay hops)
  const nHops   = 2 + Math.floor(Math.random() * 2)  // 2 or 3 relay hops
  const hopSats = []
  for (let i = 0; i < nHops; i++) {
    const t   = (i + 1) / (nHops + 1)
    const lat = uplink.lat + (dc.lat - uplink.lat) * t + (Math.random() - 0.5) * 6
    const lon = uplink.lon + (dc.lon - uplink.lon) * t + (Math.random() - 0.5) * 6
    hopSats.push({ lat, lon, inSAA: inSAA(lat, lon) })
  }
  const saaCross = hopSats.filter(h => h.inSAA).length

  // Step 4: Gateway
  const allGWs = GATEWAYS.map(gw => {
    const learned = prof.ready ? (prof.gwPenalty[gw.name] ?? 0) : 0
    return {
      ...gw,
      scoreDist:    reachMs(city.lat, city.lon, gw.lat, gw.lon).toFixed(1),
      scoreWx:      weatherMs(gw.weather).toFixed(1),
      scoreLearned: (w.wx * ADAPT_COST_MS * ADAPT_GAIN * learned).toFixed(1),
      scoreTotal:   gwCostMs(city, gw, w, prof).toFixed(1),
    }
  })
  const gw    = findBestGateway(city, policy, prof)
  const gwSat = findNearestSat(gw.lat, gw.lon, sats)

  // Step 5: RTT from the actual geometry of the path that was chosen
  const baseDist = pathDistanceKm({ city, uplink, hopSats, dc, gw, gwSat })
  const propMs   = (baseDist / C_VAC) * 1000    // full out-and-back vacuum propagation
  const procMs   = service.compute === 'high' ? 42 : service.compute === 'medium' ? 16 : 6
  const wxMs     = weatherMs(gw.weather)
  const rtt      = Math.round(propMs + procMs + wxMs)
  const baseline = Math.round(fibreBaselineMs(city, procMs))
  const stretch  = ((rtt / baseline - 1) * 100).toFixed(0)

  return {
    city, service, policy, weights: w,
    uplink, dc, allDCs, hopSats, saaCross,
    gw, gwSat, allGWs,
    nHops, baseDist,
    propMs, procMs, wxMs,
    rtt, baseline, stretch,
    sunlitDCs: dcList.filter(d => !d.eclipsed).length,
    counterfactual: comparePolicies({ city, service, sats, prof }),
    adaptive:  useAdaptive && prof.ready,
    learnWindow,
    profile:   prof,
  }
}
