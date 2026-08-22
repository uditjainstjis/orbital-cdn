// The crossover chart.
//
// This is the one picture in the product that is ours alone. Every satellite
// demo can render a globe; none of them can draw *where the advantage begins*,
// because that requires having measured it.
//
// What it shows: around each terrestrial cloud region, a geodesic circle at the
// published LEO-vs-fibre break-even distance. Inside the ring, terrestrial fibre
// wins and orbital routing is a waste. Outside it, orbit wins. The eight origin
// cities are plotted with the win rate this simulator actually measured — and
// they fall on the correct side of the line without having been placed there.
//
// Projection is equirectangular, so a true geodesic circle renders as a
// distorted oval. That distortion is correct and is left in deliberately; a
// neat circle here would mean the maths was wrong.

import { TERRESTRIAL_ORIGINS, haversine } from './engine.js'
import { CITIES, GATEWAYS } from './network.js'
import LAND from './land.json' with { type: 'json' }   // Natural Earth 110m land, RDP-simplified to 813 points

const R_EARTH = 6371
const CROSSOVER_KM = 4472        // Chaudhry & Yanikomeroglu, arXiv:2203.00154, 550 km shell

// ─── Geodesy ────────────────────────────────────────────────────────────────

const rad = d => (d * Math.PI) / 180
const deg = r => (r * 180) / Math.PI

/** Destination point given start, bearing and great-circle distance. */
function destination(latDeg, lonDeg, bearingDeg, distKm) {
  const d = distKm / R_EARTH
  const br = rad(bearingDeg)
  const la1 = rad(latDeg)
  const lo1 = rad(lonDeg)
  const la2 = Math.asin(Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(br))
  const lo2 = lo1 + Math.atan2(
    Math.sin(br) * Math.sin(d) * Math.cos(la1),
    Math.cos(d) - Math.sin(la1) * Math.sin(la2),
  )
  return [deg(la2), ((deg(lo2) + 540) % 360) - 180]
}

/** Points of a geodesic circle, split into segments at the antimeridian. */
function geodesicCircle(lat, lon, km, steps = 240) {
  const segs = []
  let cur = []
  let prevLon = null
  for (let i = 0; i <= steps; i++) {
    const [la, lo] = destination(lat, lon, (i / steps) * 360, km)
    if (prevLon !== null && Math.abs(lo - prevLon) > 180) {
      segs.push(cur)
      cur = []
    }
    cur.push([la, lo])
    prevLon = lo
  }
  if (cur.length) segs.push(cur)
  return segs.filter(s => s.length > 1)
}

// ─── Projection ─────────────────────────────────────────────────────────────

const W = 1000
const H = 420
const LAT_TOP = 80          // above this there is nothing to show
const LAT_BOT = -58         // below this is Antarctica, which distorts the frame
const px = lon => ((lon + 180) / 360) * W
const py = lat => ((LAT_TOP - Math.max(LAT_BOT, Math.min(LAT_TOP, lat))) / (LAT_TOP - LAT_BOT)) * H

const path = pts => pts.map(([la, lo], i) => `${i ? 'L' : 'M'}${px(lo).toFixed(1)} ${py(la).toFixed(1)}`).join(' ')

// ─── Render ─────────────────────────────────────────────────────────────────

/**
 * @param {Array<{key:string, winRate:number, n:number, p50:number}>} byCity
 *        measured per-origin results from telemetry.summarize()
 */
export function crossoverSvg(byCity = []) {
  const measured = new Map(byCity.map(c => [c.key, c]))

  // Coastlines, heavily simplified. Enough to read as Earth at a glance without
  // pretending to be an atlas — a schematic reads more technical than a texture.
  const land = LAND.map(ring => {
    const segs = []
    let cur = []
    let prev = null
    for (const [lo, la] of ring) {
      if (prev !== null && Math.abs(lo - prev) > 180) { segs.push(cur); cur = [] }
      cur.push([la, lo]); prev = lo
    }
    if (cur.length) segs.push(cur)
    return segs.filter(sg => sg.length > 2).map(sg => `<path d="${path(sg)} Z"/>`).join('')
  }).join('')

  const graticule = []
  for (let lo = -180; lo <= 180; lo += 30) {
    graticule.push(`<line x1="${px(lo)}" y1="0" x2="${px(lo)}" y2="${H}"/>`)
  }
  for (let la = -60; la <= 60; la += 30) {
    graticule.push(`<line x1="0" y1="${py(la)}" x2="${W}" y2="${py(la)}"/>`)
  }

  // Break-even rings around each terrestrial cloud region
  const rings = TERRESTRIAL_ORIGINS.map(o => {
    const segs = geodesicCircle(o.lat, o.lon, CROSSOVER_KM)
    const fills = segs.map(s => `<path d="${path(s)} Z" fill="rgba(255,255,255,0.035)"/>`).join('')
    const lines = segs.map(s => `<path d="${path(s)}" fill="none" stroke="var(--muted)"
      stroke-width="1.1" stroke-dasharray="5 4" opacity="0.85"/>`).join('')
    return fills + lines
  }).join('')

  const regions = TERRESTRIAL_ORIGINS.map(o => `
    <g transform="translate(${px(o.lon).toFixed(1)} ${py(o.lat).toFixed(1)})">
      <rect x="-4.5" y="-4.5" width="9" height="9" fill="none" stroke="var(--muted)" stroke-width="1.4"/>
      <circle r="1.6" fill="var(--muted)"/>
      <text x="0" y="-10" class="xo-region" text-anchor="middle">${o.name}</text>
    </g>`).join('')

  const cities = CITIES.map(c => {
    const m = measured.get(c.city)
    const win = m ? m.winRate : null
    const near = TERRESTRIAL_ORIGINS.reduce((b, o) => {
      const d = haversine(c.lat, c.lon, o.lat, o.lon)
      return (!b || d < b) ? d : b
    }, null)
    const outside = near > CROSSOVER_KM
    const col = win === null ? 'var(--muted)' : win > 0.5 ? 'var(--green)' : 'var(--red)'
    const label = win === null ? c.city : `${c.city} ${(win * 100).toFixed(0)}%`
    const flip = c.lon > 120 ? -1 : 1
    return `
      <g transform="translate(${px(c.lon).toFixed(1)} ${py(c.lat).toFixed(1)})">
        ${outside ? `<circle r="9" fill="none" stroke="${col}" stroke-width="0.8" opacity="0.35"/>` : ''}
        <circle r="4.2" fill="${col}" opacity="0.9"/>
        <circle r="4.2" fill="none" stroke="var(--bg)" stroke-width="1.2"/>
        <text x="${flip * 9}" y="3.6" class="xo-city" fill="${col}"
              text-anchor="${flip > 0 ? 'start' : 'end'}">${label}</text>
      </g>`
  }).join('')

  const gws = GATEWAYS.map(g => `
    <path d="M${px(g.lon).toFixed(1)} ${(py(g.lat) - 3.4).toFixed(1)}
             l3.4 3.4 -3.4 3.4 -3.4 -3.4 Z"
          fill="none" stroke="var(--blue)" stroke-width="1" opacity="0.5"/>`).join('')

  return `
  <svg viewBox="0 0 ${W} ${H}" class="xo-svg" preserveAspectRatio="xMidYMid meet">
    <rect width="${W}" height="${H}" fill="rgba(255,255,255,0.012)"/>
    <g class="xo-grat">${graticule.join('')}</g>
    <g class="xo-land">${land}</g>
    <line x1="0" y1="${py(0)}" x2="${W}" y2="${py(0)}" stroke="var(--border)" stroke-width="1"/>
    ${rings}
    ${gws}
    ${regions}
    ${cities}
  </svg>`
}

export function crossoverLegend() {
  return `
  <div class="xo-legend">
    <span><i class="xo-sw xo-ring"></i>Break-even ring — <b>${CROSSOVER_KM.toLocaleString()} km</b> from a cloud region</span>
    <span><i class="xo-sw" style="background:var(--green)"></i>Orbital wins here</span>
    <span><i class="xo-sw" style="background:var(--red)"></i>Fibre wins here</span>
    <span><i class="xo-sw xo-dia"></i>Ground station</span>
  </div>`
}

export { CROSSOVER_KM }
