// Orbital CDN — Telemetry & Adaptation store
//
// This is the "product state" behind adaptive routing. Every request the
// network serves is recorded here; windowed aggregates over that record are
// what let the routing engine adapt instead of using fixed hand-set weights.
//
// Storage is localStorage (no backend by design — the simulator is a static
// site), but the shape is a plain append-only event log, so swapping in a
// real time-series store later is a transport change, not a rewrite.

const KEY      = 'ocdn.telemetry.v3'
const PROF_KEY = 'ocdn.adaptive.enabled'
const MAX      = 6000

// ─── Time windows ──────────────────────────────────────────────────────────

export const WINDOWS = [
  { id: '1h',  label: '1H',  ms: 1 * 3600e3,        bucket: 'minute' },
  { id: '24h', label: '24H', ms: 24 * 3600e3,       bucket: 'hour'   },
  { id: '7d',  label: '7D',  ms: 7 * 24 * 3600e3,   bucket: 'day'    },
  { id: '30d', label: '30D', ms: 30 * 24 * 3600e3,  bucket: 'day'    },
  { id: 'all', label: 'ALL', ms: Infinity,          bucket: 'day'    },
]

export function windowById(id) {
  return WINDOWS.find(w => w.id === id) || WINDOWS[1]
}

// ─── Event log ─────────────────────────────────────────────────────────────

let cache = null

function load() {
  if (cache) return cache
  try {
    const raw = localStorage.getItem(KEY)
    cache = raw ? JSON.parse(raw) : []
    if (!Array.isArray(cache)) cache = []
  } catch {
    cache = []
  }
  return cache
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache))
  } catch {
    // Quota exceeded — drop the oldest half and retry once.
    cache = cache.slice(Math.floor(cache.length / 2))
    try { localStorage.setItem(KEY, JSON.stringify(cache)) } catch { /* give up */ }
  }
}

export function allEvents() {
  return load()
}

export function eventCount() {
  return load().length
}

/** Flatten a runSimulation() result into a compact telemetry record. */
export function toRecord(data, { ts = Date.now(), synthetic = false, adaptive = false } = {}) {
  return {
    ts,
    city:     data.city.city,
    service:  data.service.service,
    compute:  data.service.compute,
    policy:   data.policy,
    dc:       data.dc.dcName,
    dcEcl:    !!data.dc.eclipsed,
    dcSAA:    !!data.dc.inSAA,
    gw:       data.gw.name,
    wx:       data.gw.weather,
    hops:     data.nHops,
    saa:      data.saaCross,
    rtt:      data.rtt,
    base:     data.baseline,
    prop:     Math.round(data.propMs * 10) / 10,
    proc:     data.procMs,
    wxMs:     data.wxMs,
    sunlit:   data.sunlitDCs,
    adaptive,
    synthetic,
  }
}

export function record(data, opts) {
  const ev = toRecord(data, opts)
  load().push(ev)
  if (cache.length > MAX) cache = cache.slice(cache.length - MAX)
  persist()
  return ev
}

/** Bulk-load historical records (used once, at first boot). */
export function seedEvents(events) {
  cache = load().concat(events).sort((a, b) => a.ts - b.ts)
  if (cache.length > MAX) cache = cache.slice(cache.length - MAX)
  persist()
  return cache.length
}

export function clearAll() {
  cache = []
  persist()
}

// ─── Adaptive mode flag ────────────────────────────────────────────────────

export function adaptiveEnabled() {
  try { return localStorage.getItem(PROF_KEY) !== 'off' } catch { return true }
}

export function setAdaptiveEnabled(on) {
  try { localStorage.setItem(PROF_KEY, on ? 'on' : 'off') } catch { /* ignore */ }
}

// ─── Windowing ─────────────────────────────────────────────────────────────

export function eventsInWindow(windowId, now = Date.now()) {
  const w    = windowById(windowId)
  const from = w.ms === Infinity ? -Infinity : now - w.ms
  return load().filter(e => e.ts >= from && e.ts <= now)
}

// ─── Stats helpers ─────────────────────────────────────────────────────────

function percentile(sorted, p) {
  if (!sorted.length) return 0
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[i]
}

function groupBy(events, keyFn) {
  const m = new Map()
  events.forEach(e => {
    const k = keyFn(e)
    if (!m.has(k)) m.set(k, [])
    m.get(k).push(e)
  })
  return m
}

function statsFor(events) {
  const rtts = events.map(e => e.rtt).sort((a, b) => a - b)
  const n    = events.length
  return {
    n,
    p50:    percentile(rtts, 50),
    p95:    percentile(rtts, 95),
    mean:   n ? Math.round(events.reduce((s, e) => s + e.rtt, 0) / n) : 0,
    solar:  n ? events.filter(e => !e.dcEcl).length / n : 0,
    saaHit: n ? events.filter(e => e.saa > 0).length / n : 0,
    saaTot: events.reduce((s, e) => s + e.saa, 0),
    wxMs:   events.reduce((s, e) => s + e.wxMs, 0),
    stretch: n
      ? events.reduce((s, e) => s + (e.base ? (e.rtt / e.base - 1) * 100 : 0), 0) / n
      : 0,
    // Share of requests where the orbital path beat terrestrial fibre, and by how much
    winRate: n ? events.filter(e => e.rtt < e.base).length / n : 0,
    savedMs: n
      ? events.reduce((s, e) => s + Math.max(0, e.base - e.rtt), 0) / n
      : 0,
  }
}

// ─── Bucketed time series ──────────────────────────────────────────────────

const BUCKET_MS = { minute: 60e3, hour: 3600e3, day: 24 * 3600e3 }

function timeSeries(events, bucket, from, to) {
  const size = BUCKET_MS[bucket]
  if (!events.length) return []
  const start = from === -Infinity ? Math.min(...events.map(e => e.ts)) : from
  const b0    = Math.floor(start / size)
  const b1    = Math.floor(to / size)
  const slots = new Map()
  for (let b = b0; b <= b1; b++) slots.set(b, [])
  events.forEach(e => {
    const b = Math.floor(e.ts / size)
    if (slots.has(b)) slots.get(b).push(e)
  })
  return [...slots.entries()].map(([b, evs]) => {
    const rtts = evs.map(e => e.rtt).sort((a, b2) => a - b2)
    return {
      t:      b * size,
      n:      evs.length,
      p50:    percentile(rtts, 50),
      p95:    percentile(rtts, 95),
      solar:  evs.length ? evs.filter(e => !e.dcEcl).length / evs.length : 0,
      saa:    evs.reduce((s, e) => s + e.saa, 0),
    }
  })
}

// ─── Main summary ──────────────────────────────────────────────────────────

/**
 * Summarise usage and outcome patterns over a selected time period.
 * Returns everything the summary UI and the adaptive profile need.
 */
export function summarize(windowId, now = Date.now()) {
  const w      = windowById(windowId)
  const events = eventsInWindow(windowId, now)
  const from   = w.ms === Infinity
    ? (events.length ? Math.min(...events.map(e => e.ts)) : now)
    : now - w.ms

  const overall = statsFor(events)

  const byPolicy  = [...groupBy(events, e => e.policy)].map(([k, v]) => ({ key: k, ...statsFor(v) }))
  const byCity    = [...groupBy(events, e => e.city)].map(([k, v]) => ({ key: k, ...statsFor(v) }))
  const byGateway = [...groupBy(events, e => e.gw)].map(([k, v]) => ({
    key: k, ...statsFor(v),
    rainShare: v.length ? v.filter(e => e.wx === 'rain').length / v.length : 0,
  }))
  const byDC      = [...groupBy(events, e => e.dc)].map(([k, v]) => ({
    key: k, ...statsFor(v),
    eclShare: v.length ? v.filter(e => e.dcEcl).length / v.length : 0,
  }))
  const byService = [...groupBy(events, e => e.service)].map(([k, v]) => ({ key: k, ...statsFor(v) }))

  const sortN = (a, b) => b.n - a.n
  ;[byPolicy, byCity, byGateway, byDC, byService].forEach(a => a.sort(sortN))

  // Adaptive-vs-fixed comparison, only meaningful once both exist in-window
  const adaptiveEvs = events.filter(e => e.adaptive)
  const fixedEvs    = events.filter(e => !e.adaptive)

  return {
    windowId,
    label:  w.label,
    bucket: w.bucket,
    from, to: now,
    events,
    overall,
    byPolicy, byCity, byGateway, byDC, byService,
    series: timeSeries(events, w.bucket, from, now),
    adaptiveSplit: {
      adaptive: statsFor(adaptiveEvs),
      fixed:    statsFor(fixedEvs),
    },
    insights: deriveInsights({ events, overall, byPolicy, byGateway, byDC, byCity }),
  }
}

// ─── Derived, human-readable patterns ──────────────────────────────────────

const pctS = v => `${(v * 100).toFixed(0)}%`

function deriveInsights({ events, overall, byPolicy, byGateway, byDC, byCity }) {
  const out = []
  if (events.length < 5) {
    out.push({
      kind: 'info',
      text: 'Not enough traffic in this window to establish a pattern. Widen the window or send more requests.',
    })
    return out
  }

  // 1. Which policy actually delivered the best tail latency
  const ranked = [...byPolicy].filter(p => p.n >= 3).sort((a, b) => a.p95 - b.p95)
  if (ranked.length >= 2) {
    const best  = ranked[0]
    const worst = ranked[ranked.length - 1]
    const delta = worst.p95 - best.p95
    if (delta > 2) {
      out.push({
        kind: 'win',
        text: `<b>${best.key}</b> held the best p95 at <b>${best.p95} ms</b> over ${best.n} requests — ${delta} ms tighter than <b>${worst.key}</b> (${worst.p95} ms).`,
      })
    }
  }

  // 2. Gateway that cost the most weather latency
  const wxWorst = [...byGateway].filter(g => g.n >= 3).sort((a, b) => (b.wxMs / b.n) - (a.wxMs / a.n))[0]
  if (wxWorst && wxWorst.wxMs > 0) {
    out.push({
      kind: 'warn',
      text: `<b>${wxWorst.key}</b> added <b>${Math.round(wxWorst.wxMs / wxWorst.n)} ms</b> of average weather penalty across ${wxWorst.n} requests — the largest rain-fade cost in this window.`,
    })
  }

  // 3. Eclipse exposure
  const eclWorst = [...byDC].filter(d => d.n >= 3).sort((a, b) => b.eclShare - a.eclShare)[0]
  if (eclWorst && eclWorst.eclShare > 0.15) {
    out.push({
      kind: 'warn',
      text: `<b>${eclWorst.key}</b> served <b>${(eclWorst.eclShare * 100).toFixed(0)}%</b> of its requests while eclipsed — battery-drawn, not solar. Green policy should be de-preferring it in this window.`,
    })
  }

  // 4. SAA exposure
  if (overall.saaTot > 0) {
    out.push({
      kind: 'warn',
      text: `<b>${overall.saaTot}</b> inter-satellite hops crossed the South Atlantic Anomaly (<b>${(overall.saaHit * 100).toFixed(0)}%</b> of requests affected) — each one a single-event-upset risk.`,
    })
  }

  // 5. Where orbital actually beats terrestrial fibre — the core value question
  const wins = [...byCity].filter(c => c.n >= 4).sort((a, b) => b.winRate - a.winRate)
  if (wins.length >= 2) {
    const top = wins[0], bot = wins[wins.length - 1]
    if (top.winRate - bot.winRate > 0.2) {
      out.push({
        kind: 'win',
        text: `Orbital beat terrestrial fibre for <b>${pctS(top.winRate)}</b> of <b>${top.key}</b> requests (saving <b>${Math.round(top.savedMs)} ms</b> on average) but only <b>${pctS(bot.winRate)}</b> for <b>${bot.key}</b> — the advantage is concentrated where cloud regions are far away.`,
      })
    }
  }

  // 6. Busiest origin
  const topCity = byCity[0]
  if (topCity && byCity.length > 1) {
    out.push({
      kind: 'info',
      text: `<b>${topCity.key}</b> was the busiest origin with <b>${topCity.n}</b> requests (p50 <b>${topCity.p50} ms</b>).`,
    })
  }

  // 7. Solar share headline
  out.push({
    kind: overall.solar > 0.6 ? 'win' : 'info',
    text: `<b>${(overall.solar * 100).toFixed(0)}%</b> of requests in this window were served by a sunlit data centre.`,
  })

  return out
}

// ─── Adaptive profile — the feedback loop ──────────────────────────────────

/**
 * Turn the selected window's observed outcomes into routing biases.
 * This is what makes the network adaptive: the same policy weights, but
 * corrected by what actually happened recently.
 *
 * Returns penalty multipliers keyed by gateway name and DC name, plus the
 * per-city policy that empirically won.
 */
export function adaptiveProfile(windowId, now = Date.now()) {
  const events = eventsInWindow(windowId, now)
  if (events.length < 8) return { ready: false, gwPenalty: {}, dcPenalty: {}, cityBest: {}, sampleN: events.length }

  const gwPenalty = {}
  groupBy(events, e => e.gw).forEach((v, k) => {
    // Observed mean weather latency, normalised into a 0-1 penalty.
    const meanWx = v.reduce((s, e) => s + e.wxMs, 0) / v.length
    gwPenalty[k] = Math.min(1, meanWx / 22)
  })

  const dcPenalty = {}
  groupBy(events, e => e.dc).forEach((v, k) => {
    const ecl = v.filter(e => e.dcEcl).length / v.length
    const saa = v.filter(e => e.dcSAA).length / v.length
    dcPenalty[k] = Math.min(1, ecl * 0.7 + saa * 0.3)
  })

  const cityBest = {}
  groupBy(events, e => e.city).forEach((v, k) => {
    const byPol = [...groupBy(v, e => e.policy)]
      .map(([p, evs]) => ({ p, n: evs.length, p95: percentile(evs.map(e => e.rtt).sort((a, b) => a - b), 95) }))
      .filter(x => x.n >= 3)
      .sort((a, b) => a.p95 - b.p95)
    if (byPol.length) cityBest[k] = byPol[0].p
  })

  return { ready: true, gwPenalty, dcPenalty, cityBest, sampleN: events.length }
}
