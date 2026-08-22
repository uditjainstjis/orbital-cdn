// Validates the P.838-3 implementation against the published Table 5 reference
// values in the recommendation itself. If a coefficient was mistyped, this fails.
import { specificAttenuationCoeffs, rainAttenuation001, instantaneousFadeDb } from './itu.js'

// Rec. ITU-R P.838-3, Table 5 — frequency-dependent coefficients
const TABLE5 = [
  { f: 1,   kH: 0.0000259, aH: 0.9691, kV: 0.0000308, aV: 0.8592 },
  { f: 12,  kH: 0.02386,   aH: 1.1825, kV: 0.02455,   aV: 1.1216 },
  { f: 19,  kH: 0.08084,   aH: 1.0691, kV: 0.08642,   aV: 0.9930 },
  { f: 20,  kH: 0.09164,   aH: 1.0568, kV: 0.09611,   aV: 0.9847 },
  { f: 25,  kH: 0.1571,    aH: 0.9991, kV: 0.1533,    aV: 0.9491 },
  { f: 28,  kH: 0.2051,    aH: 0.9679, kV: 0.1964,    aV: 0.9277 },
  { f: 30,  kH: 0.2403,    aH: 0.9485, kV: 0.2291,    aV: 0.9129 },
]

let fail = 0
const relerr = (got, want) => Math.abs(got - want) / Math.abs(want)
console.log('freq    kH  (got / published)          alphaH                     kV                         alphaV')
for (const row of TABLE5) {
  const c = specificAttenuationCoeffs(row.f, 0, 0)   // geometry-independent parts
  const checks = [
    ['kH', c.kH, row.kH], ['aH', c.alphaH, row.aH],
    ['kV', c.kV, row.kV], ['aV', c.alphaV, row.aV],
  ]
  const bad = checks.filter(([, g, w]) => relerr(g, w) > 0.02)
  if (bad.length) { fail++; console.log(`  FAIL ${row.f} GHz:`, bad.map(([n,g,w])=>`${n} ${g.toExponential(4)} vs ${w}`).join('  ')) }
  else console.log(`  ok ${String(row.f).padStart(3)} GHz  ${c.kH.toFixed(6)}/${row.kH}  ${c.alphaH.toFixed(4)}/${row.aH}  ${c.kV.toFixed(6)}/${row.kV}  ${c.alphaV.toFixed(4)}/${row.aV}`)
}

// Sanity: a tropical Ka-band link should show large fade at 0.01%, temperate small.
console.log('\nP.618-13 slant-path A0.01 (20 GHz, 35 deg elevation, circular):')
for (const s of [
  { n: 'Singapore  (R0.01=120)', lat: 1.4,   r: 120 },
  { n: 'Lagos      (R0.01= 95)', lat: 6.5,   r: 95  },
  { n: 'Frankfurt  (R0.01= 30)', lat: 50.3,  r: 30  },
  { n: 'Sydney     (R0.01= 50)', lat: -33.7, r: 50  },
]) {
  const a = rainAttenuation001({ latDeg: s.lat, elevDeg: 35, fGHz: 20, r001: s.r })
  console.log(`  ${s.n}  A0.01 = ${a.A001.toFixed(1)} dB   LE = ${a.LE.toFixed(1)} km  gamma = ${a.gammaR.toFixed(2)} dB/km  hR = ${a.hR.toFixed(2)} km`)
}

console.log('\nInstantaneous fade vs rain rate (20 GHz, 35 deg, lat 1.4):')
for (const r of [0, 1, 5, 10, 20, 30, 50]) {
  console.log(`  R = ${String(r).padStart(2)} mm/h -> ${instantaneousFadeDb({ latDeg: 1.4, elevDeg: 35, fGHz: 20, rainRateMmH: r }).toFixed(2)} dB`)
}

console.log(fail ? `\n${fail} FAILURES` : '\nAll Table 5 coefficients reproduced within 2%.')
process.exit(fail ? 1 : 0)
