// Orbital CDN — Network Analytics
//
// The user-facing half of adaptive routing: summarise usage and outcome
// patterns over a selected time period, and show exactly what the routing
// engine learned from that period.
//
// Charts are hand-rolled SVG — no charting dependency, no extra bundle weight.

import {
  WINDOWS, summarize, adaptiveProfile, adaptiveEnabled, setAdaptiveEnabled,
  allEvents, eventCount, clearAll,
} from './telemetry.js'

let currentWindow = '7d'
let onDataChange  = () => {}
let onReset       = () => {}

// ─── Formatting ────────────────────────────────────────────────────────────

const pct  = v => `${(v * 100).toFixed(0)}%`
const ms   = v => `${Math.round(v)} ms`
const num  = v => v.toLocaleString('en-US')

function fmtTick(t, bucket) {
  const d = new Date(t)
  if (bucket === 'minute') return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  if (bucket === 'hour')   return d.toLocaleTimeString('en-GB', { hour: '2-digit' }) + 'h'
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

function fmtRange(from, to) {
  const f = new Date(from), t = new Date(to)
  const o = { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }
  return `${f.toLocaleString('en-GB', o)} → ${t.toLocaleString('en-GB', o)} UTC`
}

// ─── SVG charts ────────────────────────────────────────────────────────────

/** Combined volume (bars) + p50/p95 latency (lines) over the window. */
function chartTraffic(series, bucket) {
  if (!series.length) return `<div class="dash-empty">No traffic in this window.</div>`

  const W = 900, H = 260, PL = 52, PR = 46, PT = 18, PB = 30
  const iw = W - PL - PR, ih = H - PT - PB

  // Scale to complete buckets only — a clipped edge bucket must not set the axis
  const full   = series.filter(s => !s.partial)
  const maxN   = Math.max(1, ...(full.length ? full : series).map(s => s.n))
  const rtts   = series.filter(s => s.n > 0)
  const maxRtt = Math.max(1, ...rtts.map(s => s.p95))
  const minRtt = Math.min(...rtts.map(s => s.p50), maxRtt)
  const lo     = Math.max(0, minRtt - 10), hi = maxRtt + 10

  const x  = i => PL + (series.length === 1 ? iw / 2 : (i / (series.length - 1)) * iw)
  const yN = v => PT + ih - (v / maxN) * ih
  const yR = v => PT + ih - ((v - lo) / (hi - lo || 1)) * ih

  const bw = Math.max(2, Math.min(26, iw / series.length - 3))

  const bars = series.map((s, i) => {
    const h = s.n ? Math.max(2, PT + ih - yN(s.n)) : 0
    return `<rect x="${(x(i) - bw / 2).toFixed(1)}" y="${(PT + ih - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="url(#dashBar)"${s.partial ? ' opacity="0.4" stroke="rgba(0,212,255,0.35)" stroke-dasharray="2 2"' : ''}>
      <title>${fmtTick(s.t, bucket)} — ${s.n} requests${s.partial ? ' (partial bucket — clipped by the window edge)' : ''}</title></rect>`
  }).join('')

  const linePts = (key) => rtts.length
    ? series.map((s, i) => s.n ? `${x(i).toFixed(1)},${yR(s[key]).toFixed(1)}` : null)
        .filter(Boolean).join(' ')
    : ''

  const p50Line = linePts('p50')
  const p95Line = linePts('p95')

  const gridY = [0, 0.25, 0.5, 0.75, 1].map(f => {
    const y = PT + ih - f * ih
    return `<line x1="${PL}" y1="${y}" x2="${W - PR}" y2="${y}" stroke="rgba(22,42,72,0.6)" stroke-width="1"/>
            <text x="${PL - 8}" y="${y + 4}" class="ax" text-anchor="end">${Math.round(f * maxN)}</text>
            <text x="${W - PR + 8}" y="${y + 4}" class="ax ax-r">${Math.round(lo + f * (hi - lo))}</text>`
  }).join('')

  const step  = Math.max(1, Math.ceil(series.length / 9))
  const ticks = series.map((s, i) => i % step === 0
    ? `<text x="${x(i).toFixed(1)}" y="${H - 8}" class="ax" text-anchor="middle">${fmtTick(s.t, bucket)}</text>`
    : '').join('')

  return `
  <svg viewBox="0 0 ${W} ${H}" class="dash-svg" preserveAspectRatio="xMidYMid meet">
    <defs>
      <linearGradient id="dashBar" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#00d4ff" stop-opacity="0.75"/>
        <stop offset="100%" stop-color="#00d4ff" stop-opacity="0.14"/>
      </linearGradient>
    </defs>
    ${gridY}${bars}
    ${p95Line ? `<polyline points="${p95Line}" fill="none" stroke="#ef4444" stroke-width="1.6" stroke-dasharray="4 3" opacity="0.85"/>` : ''}
    ${p50Line ? `<polyline points="${p50Line}" fill="none" stroke="#f59e0b" stroke-width="2.2"/>` : ''}
    ${ticks}
    <text x="${PL - 8}" y="${PT - 6}" class="ax-title" text-anchor="end">REQS</text>
    <text x="${W - PR + 8}" y="${PT - 6}" class="ax-title">ms</text>
  </svg>
  <div class="dash-legend">
    <span><i class="sw" style="background:#00d4ff"></i>Requests</span>
    <span><i class="sw" style="background:#f59e0b"></i>p50 RTT</span>
    <span><i class="sw sw-d" style="background:#ef4444"></i>p95 RTT</span>
    ${series.some(s => s.partial) ? '<span style="opacity:.7">faded bars = partial bucket at the window edge</span>' : ''}
  </div>`
}

/** Horizontal share bar for a categorical breakdown. */
function chartShare(rows, total, color) {
  if (!rows.length) return `<div class="dash-empty">No data.</div>`
  return `<div class="share-list">` + rows.map(r => `
    <div class="share-row">
      <span class="share-key">${r.key}</span>
      <div class="share-track"><div class="share-fill" style="width:${total ? (r.n / total) * 100 : 0}%;background:${color}"></div></div>
      <span class="share-n">${r.n}</span>
      <span class="share-x">${r.p50 ? ms(r.p50) : '—'}</span>
    </div>`).join('') + `</div>`
}

/** Where the orbital path actually beats terrestrial fibre, per origin. */
function chartWinRate(rows) {
  const eligible = rows.filter(r => r.n >= 3).sort((a, b) => b.winRate - a.winRate)
  if (!eligible.length) return `<div class="dash-empty">Not enough data.</div>`
  return `<div class="share-list">` + eligible.map(r => {
    const col = r.winRate > 0.5 ? 'var(--green)' : r.winRate > 0.2 ? 'var(--amber)' : 'var(--red)'
    return `
    <div class="share-row win-row">
      <span class="share-key">${r.key}</span>
      <div class="share-track"><div class="share-fill" style="width:${r.winRate * 100}%;background:${col}"></div></div>
      <span class="share-n" style="color:${col}">${pct(r.winRate)}</span>
      <span class="share-x">${r.savedMs >= 1 ? '−' + ms(r.savedMs) : '—'}</span>
    </div>`
  }).join('') + `</div>
  <p class="dash-note" style="margin-top:12px">Share of requests where the orbital path was faster than long-haul fibre to the nearest
  terrestrial cloud region (us-east-1 / eu-central-1 / ap-southeast-1), and the mean latency saved.</p>`
}

// ─── Sections ──────────────────────────────────────────────────────────────

function kpis(s) {
  const cards = [
    { v: num(s.overall.n),        l: 'Requests served',   c: 'var(--cyan)'   },
    { v: ms(s.overall.p50),       l: 'p50 end-to-end RTT',c: 'var(--amber)'  },
    { v: ms(s.overall.p95),       l: 'p95 tail RTT',      c: 'var(--red)'    },
    { v: pct(s.overall.solar),    l: 'Solar-served',      c: 'var(--green)'  },
    { v: num(s.overall.saaTot),   l: 'SAA hops crossed',  c: 'var(--purple)' },
    { v: pct(s.overall.winRate),  l: 'Beat fibre',        c: 'var(--blue)'   },
  ]
  return `<div class="kpi-grid">` + cards.map(c => `
    <div class="kpi-card">
      <span class="kpi-val" style="color:${c.c}">${c.v}</span>
      <span class="kpi-label">${c.l}</span>
    </div>`).join('') + `</div>`
}

function insightList(items) {
  const icon = k => k === 'win' ? '✅' : k === 'warn' ? '⚠️' : 'ℹ️'
  return `<div class="insight-list">` + items.map(i => `
    <div class="insight-row insight-${i.kind}"><span>${icon(i.kind)}</span><p>${i.text}</p></div>`
  ).join('') + `</div>`
}

function adaptivePanel(s) {
  const prof = adaptiveProfile(currentWindow)
  const on   = adaptiveEnabled()

  if (!prof.ready) {
    return `<div class="adapt-box">
      <div class="adapt-head">
        <div><h3>Adaptation from this window</h3>
        <p class="adapt-sub">Needs ≥8 requests in the selected period. Currently ${prof.sampleN}.</p></div>
        ${adaptToggle(on)}
      </div></div>`
  }

  const gw = Object.entries(prof.gwPenalty).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const dc = Object.keys(prof.dcLatPenalty)
    .map(k => [k, (prof.dcLatPenalty[k] ?? 0), (prof.dcRadPenalty[k] ?? 0)])
    .sort((a, b) => (b[1] + b[2]) - (a[1] + a[2]))
  const cb = Object.entries(prof.cityBest)

  const bar = (v, color) => `<div class="pen-track"><div class="pen-fill" style="width:${v * 100}%;background:${color}"></div></div>`

  return `<div class="adapt-box">
    <div class="adapt-head">
      <div>
        <h3>Adaptation from this window</h3>
        <p class="adapt-sub">Learned from <b>${prof.sampleN}</b> requests in the last
        <b>${prof.widened ? WINDOWS.find(w => w.id === prof.usedWindow)?.label : s.label}</b>${prof.widened
          ? ` — the ${s.label} window held too few requests to learn from, so it widened automatically`
          : ''}. The gateway and DC penalties are applied to the next request you send; the per-origin policy is surfaced as a recommendation only, so the control you selected keeps meaning what it says.</p>
      </div>
      ${adaptToggle(on)}
    </div>
    <div class="adapt-cols">
      <div>
        <div class="adapt-label">Gateway penalty · observed rain-fade</div>
        ${gw.map(([k, v]) => `<div class="pen-row"><span>${k}</span>${bar(v, 'var(--blue)')}<b>${v.toFixed(2)}</b></div>`).join('')}
      </div>
      <div>
        <div class="adapt-label">DC penalty · observed tail latency + SAA exposure</div>
        ${dc.map(([k, l, r]) => `<div class="pen-row"><span>${k}</span>${bar(Math.min(1, l + r), 'var(--amber)')}<b>${(l + r).toFixed(2)}</b></div>`).join('')}
      </div>
      <div>
        <div class="adapt-label">Best policy per origin · recommendation, not auto-applied</div>
        ${cb.length
          ? cb.map(([k, v]) => `<div class="pen-row pen-row-t"><span>${k}</span><b class="pol-chip">${v}</b></div>`).join('')
          : '<p class="adapt-sub">Not enough per-city coverage yet.</p>'}
      </div>
    </div>
  </div>`
}

function adaptToggle(on) {
  return `<label class="adapt-toggle ${on ? 'on' : ''}">
    <input type="checkbox" id="adapt-switch" ${on ? 'checked' : ''}>
    <span class="adapt-knob"></span>
    <span class="adapt-text">Adaptive routing ${on ? 'ON' : 'OFF'}</span>
  </label>`
}

function comparePanel(s) {
  const a = s.adaptiveSplit.adaptive, f = s.adaptiveSplit.fixed
  const MIN = 8
  if (a.n < MIN || f.n < MIN) {
    return `<p class="dash-note">Needs at least <b>${MIN}</b> requests on each side before a comparison means anything.
      Currently <b>${a.n}</b> adaptive vs <b>${f.n}</b> fixed-policy in this window —
      send a few with the toggle on, then a few with it off.</p>`
  }
  const row = (label, av, fv, fmt, better) => {
    const win = better === 'low' ? av < fv : av > fv
    return `<tr><td>${label}</td><td class="${win ? 'good' : ''}">${fmt(av)}</td><td>${fmt(fv)}</td>
      <td class="${win ? 'good' : 'bad'}">${win ? '▼' : '▲'} ${fmt(Math.abs(av - fv))}</td></tr>`
  }
  return `<table class="dash-table">
    <thead><tr><th>Metric</th><th>Adaptive</th><th>Fixed policy</th><th>Δ</th></tr></thead>
    <caption class="dash-caption">${a.n} adaptive vs ${f.n} fixed-policy requests in this window.</caption>
    <tbody>
      ${row('p50 RTT', a.p50, f.p50, ms, 'low')}
      ${row('p95 RTT', a.p95, f.p95, ms, 'low')}
      ${row('Solar-served', a.solar, f.solar, pct, 'high')}
    </tbody></table>`
}

// ─── Render ────────────────────────────────────────────────────────────────

export function renderDashboard() {
  const host = document.getElementById('dash-content')
  if (!host) return
  const s = summarize(currentWindow)

  host.innerHTML = `
    <div class="dash-headline">
      <div>
        <h2>Network Analytics</h2>
        <p class="dash-range">${s.overall.n ? fmtRange(s.from, s.to) : 'No requests in this period'} · ${num(eventCount())} total records in store</p>
        <p class="dash-prov">
          <span class="prov-chip prov-sim">SIMULATED</span>
          <b>${num(s.seeded)}</b> seeded from the orbital model (deterministic seed 20260614 — every viewer sees identical history)
          · <b>${num(s.live)}</b> live request${s.live === 1 ? '' : 's'} you generated in this browser.
          Both are produced by the same physics; live rows are the ones that carry your policy choices.
        </p>
      </div>
      <div class="win-tabs" id="win-tabs">
        ${WINDOWS.map(w => `<button class="win-tab ${w.id === currentWindow ? 'active' : ''}" data-win="${w.id}">${w.label}</button>`).join('')}
      </div>
    </div>

    ${kpis(s)}

    <div class="dash-card">
      <div class="dash-card-head"><h3>Traffic &amp; latency over the selected period</h3>
        <span class="dash-card-sub">bucketed by ${s.bucket}</span></div>
      ${chartTraffic(s.series, s.bucket)}
    </div>

    <div class="dash-card">
      <div class="dash-card-head"><h3>What the network learned</h3></div>
      ${insightList(s.insights)}
    </div>

    ${adaptivePanel(s)}

    <div class="dash-card">
      <div class="dash-card-head"><h3>Where orbital beats terrestrial fibre</h3>
        <span class="dash-card-sub">win rate · mean saving</span></div>
      ${chartWinRate(s.byCity)}
    </div>

    <div class="dash-grid-2">
      <div class="dash-card">
        <div class="dash-card-head"><h3>By routing policy</h3><span class="dash-card-sub">count · p50</span></div>
        ${chartShare(s.byPolicy, s.overall.n, 'var(--cyan)')}
      </div>
      <div class="dash-card">
        <div class="dash-card-head"><h3>By origin city</h3><span class="dash-card-sub">count · p50</span></div>
        ${chartShare(s.byCity, s.overall.n, 'var(--green)')}
      </div>
      <div class="dash-card">
        <div class="dash-card-head"><h3>By ground gateway</h3><span class="dash-card-sub">count · p50</span></div>
        ${chartShare(s.byGateway, s.overall.n, 'var(--blue)')}
      </div>
      <div class="dash-card">
        <div class="dash-card-head"><h3>By orbital data centre</h3><span class="dash-card-sub">count · p50</span></div>
        ${chartShare(s.byDC, s.overall.n, 'var(--amber)')}
      </div>
    </div>

    <div class="dash-card">
      <div class="dash-card-head"><h3>Adaptive vs fixed policy</h3>
        <span class="dash-card-sub">same window</span></div>
      ${comparePanel(s)}
    </div>

    <div class="dash-actions">
      <button class="dash-btn" id="dash-export">⬇ Export window as JSON</button>
      <button class="dash-btn dash-btn-danger" id="dash-clear">Reset to seeded history</button>
    </div>
  `

  // Window selector
  host.querySelectorAll('.win-tab').forEach(b => {
    b.addEventListener('click', () => {
      currentWindow = b.dataset.win
      renderDashboard()
      onDataChange()
    })
  })

  // Adaptive switch
  const sw = host.querySelector('#adapt-switch')
  if (sw) sw.addEventListener('change', () => {
    setAdaptiveEnabled(sw.checked)
    renderDashboard()
    onDataChange()
  })

  host.querySelector('#dash-export')?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ window: currentWindow, from: s.from, to: s.to, events: s.events }, null, 2)],
      { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `orbital-cdn-telemetry-${currentWindow}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  })

  host.querySelector('#dash-clear')?.addEventListener('click', () => {
    // Drops live requests and restores the seeded 30 days. Never leaves the
    // dashboard empty — an empty analytics view is indistinguishable from a
    // broken one to anyone evaluating this in under a minute.
    clearAll()
    onReset()
    renderDashboard()
    onDataChange()
  })
}

export function getLearnWindow() { return currentWindow }

export function openDashboard() {
  const overlay = document.getElementById('dash-overlay')
  if (!overlay) return
  overlay.classList.remove('hidden')
  renderDashboard()
}

export function initDashboard({ onChange, onReset: reset } = {}) {
  onDataChange = onChange || (() => {})
  onReset      = reset || (() => {})
  const overlay = document.getElementById('dash-overlay')
  const open    = openDashboard
  const close   = () => overlay.classList.add('hidden')

  document.getElementById('dash-btn')?.addEventListener('click', open)
  document.getElementById('dash-close')?.addEventListener('click', close)
  overlay?.addEventListener('click', e => { if (e.target === overlay) close() })
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) close()
  })
}

export { allEvents }
