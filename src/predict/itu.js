// ITU-R rain attenuation for Earth-space links.
//
// This is a standards implementation, not a model we invented and not a
// learned approximation. Rain fade above ~10 GHz is a solved analytic problem
// and it is what satellite operators actually use for link design:
//
//   ITU-R P.838-3  specific attenuation      gamma_R = k * R^alpha
//   ITU-R P.839-4  rain height               hR = h0 + 0.36 km
//   ITU-R P.618-13 slant-path procedure      steps 1-10, section 2.2.1.1
//
// Every coefficient below is transcribed from the recommendation. The unit
// test in itu.test.js reproduces the published Table 5 reference values, so a
// transcription error cannot pass silently.

// ─── P.838-3 Tables 1-4 ─────────────────────────────────────────────────────

const KH = {
  a: [-5.33980, -0.35351, -0.23789, -0.94158],
  b: [-0.10008,  1.26970,  0.86036,  0.64552],
  c: [ 1.13098,  0.45400,  0.15354,  0.16817],
  m: -0.18961, k: 0.71147,
}
const KV = {
  a: [-3.80595, -3.44965, -0.39902,  0.50167],
  b: [ 0.56934, -0.22911,  0.73042,  1.07319],
  c: [ 0.81061,  0.51059,  0.11899,  0.27195],
  m: -0.16398, k: 0.63297,
}
const AH = {
  a: [-0.14318,  0.29591,  0.32177, -5.37610, 16.1721],
  b: [ 1.82442,  0.77564,  0.63773, -0.96230, -3.29980],
  c: [-0.55187,  0.19822,  0.13164,  1.47828,  3.43990],
  m: 0.67849, k: -1.95537,
}
const AV = {
  a: [-0.07771,  0.56727, -0.20238, -48.2991, 48.5833],
  b: [ 2.33840,  0.95545,  1.14520, 0.791669, 0.791459],
  c: [-0.76284,  0.54039,  0.26809, 0.116226, 0.116479],
  m: -0.053739, k: 0.83433,
}

/** P.838-3 eq (2): log10(k) as a sum of Gaussians in log10(f), plus a linear term. */
function kCoeff(t, f) {
  const lf = Math.log10(f)
  let s = 0
  for (let j = 0; j < t.a.length; j++) {
    s += t.a[j] * Math.exp(-Math.pow((lf - t.b[j]) / t.c[j], 2))
  }
  return Math.pow(10, s + t.m * lf + t.k)
}

/** P.838-3 eq (3): alpha is the same form but NOT in log space. */
function aCoeff(t, f) {
  const lf = Math.log10(f)
  let s = 0
  for (let j = 0; j < t.a.length; j++) {
    s += t.a[j] * Math.exp(-Math.pow((lf - t.b[j]) / t.c[j], 2))
  }
  return s + t.m * lf + t.k
}

/**
 * P.838-3 eq (4) and (5): combine horizontal and vertical coefficients for a
 * given path geometry. tau = 45 deg for circular polarisation.
 */
export function specificAttenuationCoeffs(fGHz, elevDeg, tauDeg = 45) {
  const kH = kCoeff(KH, fGHz), kV = kCoeff(KV, fGHz)
  const aH = aCoeff(AH, fGHz), aV = aCoeff(AV, fGHz)
  const th = (elevDeg * Math.PI) / 180
  const ta = (tauDeg * Math.PI) / 180

  const k = (kH + kV + (kH - kV) * Math.cos(th) ** 2 * Math.cos(2 * ta)) / 2
  const a = (kH * aH + kV * aV + (kH * aH - kV * aV) * Math.cos(th) ** 2 * Math.cos(2 * ta)) / (2 * k)
  return { k, alpha: a, kH, kV, alphaH: aH, alphaV: aV }
}

/** Specific attenuation in dB/km for a rain rate R (mm/h). P.838-3 eq (1). */
export function specificAttenuation(fGHz, elevDeg, rainRateMmH, tauDeg = 45) {
  if (rainRateMmH <= 0) return 0
  const { k, alpha } = specificAttenuationCoeffs(fGHz, elevDeg, tauDeg)
  return k * Math.pow(rainRateMmH, alpha)
}

// ─── P.839-4: rain height ───────────────────────────────────────────────────

/**
 * hR = h0 + 0.36 km, where h0 is the mean annual 0 degC isotherm height.
 *
 * P.839-4 ships h0 as a digital map. Rather than embed the grid we use the
 * widely-used latitude approximation from the earlier analytic form of the
 * recommendation, which is adequate at the resolution this simulator works at.
 * Stated explicitly because it is an approximation, not the current map.
 */
export function rainHeightKm(latDeg) {
  const lat = Math.abs(latDeg)
  const h0 = lat < 23 ? 5.0 - 0.075 * Math.max(0, lat - 23)
           : 5.0 - 0.075 * (lat - 23)
  return Math.max(0, h0) + 0.36
}

// ─── P.618-13 section 2.2.1.1: slant-path attenuation ───────────────────────

const EARTH_EFF_R = 8500   // km, effective Earth radius used by P.618

/**
 * Attenuation exceeded for 0.01% of an average year, following P.618-13
 * steps 1-9 exactly.
 *
 *   hs       ground station height above mean sea level (km)
 *   elevDeg  path elevation angle
 *   fGHz     frequency
 *   r001     rainfall rate exceeded 0.01% of the year, 1-min integration (mm/h)
 */
export function rainAttenuation001({ latDeg, hsKm = 0, elevDeg, fGHz, r001, tauDeg = 45 }) {
  const hR = rainHeightKm(latDeg)                                    // Step 1
  if (hR - hsKm <= 0) return { A001: 0, LE: 0, gammaR: 0, hR }

  const el = (elevDeg * Math.PI) / 180
  const Ls = elevDeg >= 5                                            // Step 2
    ? (hR - hsKm) / Math.sin(el)
    : (2 * (hR - hsKm)) /
      (Math.sqrt(Math.sin(el) ** 2 + (2 * (hR - hsKm)) / EARTH_EFF_R) + Math.sin(el))

  const LG = Ls * Math.cos(el)                                       // Step 3
  if (r001 <= 0) return { A001: 0, LE: 0, gammaR: 0, hR, Ls, LG }

  const { k, alpha } = specificAttenuationCoeffs(fGHz, elevDeg, tauDeg)
  const gammaR = k * Math.pow(r001, alpha)                           // Steps 4-5

  // Step 6: horizontal reduction factor
  const r001f = 1 / (1 + 0.78 * Math.sqrt((LG * gammaR) / fGHz) - 0.38 * (1 - Math.exp(-2 * LG)))

  // Step 7: vertical adjustment factor
  const zeta = Math.atan2(hR - hsKm, LG * r001f)                     // radians
  const zetaDeg = (zeta * 180) / Math.PI
  const LR = zetaDeg > elevDeg
    ? (LG * r001f) / Math.cos(el)
    : (hR - hsKm) / Math.sin(el)
  const chi = Math.abs(latDeg) < 36 ? 36 - Math.abs(latDeg) : 0
  const v001 = 1 / (1 + Math.sqrt(Math.sin(el)) *
    (31 * (1 - Math.exp(-(elevDeg / (1 + chi)))) * (Math.sqrt(LR * gammaR) / (fGHz * fGHz)) - 0.45))

  const LE = LR * v001                                               // Step 8
  const A001 = gammaR * LE                                           // Step 9
  return { A001, LE, gammaR, hR, Ls, LG, r001f, v001, k, alpha }
}

/**
 * P.618-13 step 10: extrapolate from the 0.01% value to another exceedance
 * percentage p, valid for 0.001% <= p <= 5%.
 */
export function attenuationAtPercent({ A001, p, latDeg, elevDeg }) {
  if (A001 <= 0) return 0
  const absLat = Math.abs(latDeg)
  const el = (elevDeg * Math.PI) / 180
  let beta
  if (p >= 1 || absLat >= 36) beta = 0
  else if (elevDeg >= 25)     beta = -0.005 * (absLat - 36)
  else                        beta = -0.005 * (absLat - 36) + 1.8 - 4.25 * Math.sin(el)

  const expo = -(0.655 + 0.033 * Math.log(p) - 0.045 * Math.log(A001) - beta * (1 - p) * Math.sin(el))
  return A001 * Math.pow(p / 0.01, expo)
}

/**
 * Instantaneous attenuation for a rain rate happening right now.
 *
 * Note the distinction that matters: gamma_R = k*R^alpha is valid for any rain
 * rate, but the P.618 *statistics* (A0.01) are defined on a 1-minute
 * integration time. Our observed rain rates come from hourly reanalysis, which
 * smooths peaks, so an instantaneous figure derived from them UNDERSTATES real
 * fade. Conservative in the direction that matters.
 */
export function instantaneousFadeDb({ latDeg, hsKm = 0, elevDeg, fGHz, rainRateMmH, tauDeg = 45 }) {
  if (rainRateMmH <= 0) return 0
  const hR = rainHeightKm(latDeg)
  if (hR - hsKm <= 0) return 0
  const el = (elevDeg * Math.PI) / 180
  const Ls = elevDeg >= 5
    ? (hR - hsKm) / Math.sin(el)
    : (2 * (hR - hsKm)) /
      (Math.sqrt(Math.sin(el) ** 2 + (2 * (hR - hsKm)) / EARTH_EFF_R) + Math.sin(el))
  const LG = Ls * Math.cos(el)
  const gammaR = specificAttenuation(fGHz, elevDeg, rainRateMmH, tauDeg)
  // Same horizontal reduction as P.618 step 6 — a rain cell does not fill the
  // whole slant path, and ignoring that overstates fade badly at low elevation.
  const rf = 1 / (1 + 0.78 * Math.sqrt((LG * gammaR) / fGHz) - 0.38 * (1 - Math.exp(-2 * LG)))
  const LEff = Math.max(0, LG * rf / Math.max(1e-6, Math.cos(el)))
  return gammaR * Math.min(LEff, Ls)
}

// ─── Link budget ────────────────────────────────────────────────────────────

/**
 * Outage probability given available link margin and current fade.
 *
 * A hard threshold would be wrong: fade estimated from hourly-mean rain is
 * uncertain, and real links degrade gracefully as margin erodes. We map
 * (margin - fade) through a logistic whose width reflects that uncertainty.
 */
export function outageProbability(fadeDb, marginDb, softnessDb = 1.0) {
  const headroom = marginDb - fadeDb
  return 1 / (1 + Math.exp(headroom / softnessDb))
}
