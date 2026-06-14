// Orbital CDN routing engine — 6-term multi-objective cost function
// Ported from the original flat-map simulator, physics unchanged.

import { GATEWAYS } from './network.js'

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

// ─── DC selection ──────────────────────────────────────────────────────────

function findBestDC(city, policy, dcList) {
  const w = POLICY_WEIGHTS[policy]
  return dcList.reduce((best, dc) => {
    const dist = Math.abs(((dc.lon - city.lon + 540) % 360) - 180) / 180  // normalised 0-1
    const cost = w.lat * dist
               + w.sol * (dc.eclipsed ? 1 : 0)
               + w.rad * (dc.inSAA   ? 1 : 0)
    return (!best || cost < best.cost) ? { ...dc, cost, dist: dist.toFixed(3) } : best
  }, null)
}

// ─── Gateway selection ─────────────────────────────────────────────────────

function findBestGateway(city, policy) {
  const w = POLICY_WEIGHTS[policy]
  return GATEWAYS.reduce((best, gw) => {
    const dist   = (Math.abs(gw.lat - city.lat) + Math.abs(gw.lon - city.lon)) / 360
    const wxPenalty = gw.weather === 'clear' ? 0 : gw.weather === 'cloudy' ? 0.5 : 1.0
    const cost   = w.lat * dist + w.wx * wxPenalty
    return (!best || cost < best.cost)
      ? { ...gw, cost, dist: dist.toFixed(3), wxScore: wxPenalty.toFixed(1) }
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

// ─── Main simulation ───────────────────────────────────────────────────────

export function runSimulation({ city, service, policy, sats }) {
  const dcList = sats.filter(s => s.isDC)
  const w      = POLICY_WEIGHTS[policy]

  // Step 1: Uplink satellite
  const uplink = findNearestSat(city.lat, city.lon, sats)

  // Step 2: Best DC
  const allDCs  = dcList.map(dc => {
    const dist  = Math.abs(((dc.lon - city.lon + 540) % 360) - 180) / 180
    const cost  = w.lat * dist + w.sol * (dc.eclipsed ? 1 : 0) + w.rad * (dc.inSAA ? 1 : 0)
    return { ...dc, scoreDist: dist.toFixed(3), scoreTotal: cost.toFixed(3) }
  })
  const dc = findBestDC(city, policy, dcList)

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
    const dist      = (Math.abs(gw.lat - city.lat) + Math.abs(gw.lon - city.lon)) / 360
    const wxPenalty = gw.weather === 'clear' ? 0 : gw.weather === 'cloudy' ? 0.5 : 1.0
    const cost      = w.lat * dist + w.wx * wxPenalty
    return { ...gw, scoreDist: dist.toFixed(3), scoreWx: wxPenalty.toFixed(1), scoreTotal: cost.toFixed(3) }
  })
  const gw    = findBestGateway(city, policy)
  const gwSat = findNearestSat(gw.lat, gw.lon, sats)

  // Step 5: RTT calculation
  const baseDist = 6000 + nHops * 1200  // km (estimated orbital arc)
  const propMs   = (baseDist / 299792) * 1000   // one-way vacuum propagation
  const procMs   = service.compute === 'high' ? 42 : service.compute === 'medium' ? 16 : 6
  const wxMs     = gw.weather === 'clear' ? 0 : gw.weather === 'cloudy' ? 8 : 22
  const rtt      = Math.round(propMs * 2 + procMs + wxMs)
  const baseline = Math.round(propMs * 1.6 + procMs)
  const stretch  = ((rtt / baseline - 1) * 100).toFixed(0)

  return {
    city, service, policy, weights: w,
    uplink, dc, allDCs, hopSats, saaCross,
    gw, gwSat, allGWs,
    nHops, baseDist,
    propMs, procMs, wxMs,
    rtt, baseline, stretch,
    sunlitDCs: dcList.filter(d => !d.eclipsed).length,
  }
}
