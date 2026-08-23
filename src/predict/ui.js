// Autopilot UI: always-visible agent panel, risk timeline, incident controls,
// and a detail overlay with the decision log, calibration and model metrics.

import { GATEWAYS } from '../network.js'
import {
  forecastGateway, injectRain, clearInjections, activeInjections,
  HORIZONS_H, FADE_THRESHOLD_DB, LINK, TRACE_META, MODEL_VERSION,
  setWeatherSpeed, getWeatherSpeed, traceCursor,
} from './weather.js'
import {
  getMode, setMode, step, decisions, clearDecisions, verifyPending,
  calibration, agentState, setCurrentGateway, pendingProposal,
  approvePending, rejectPending, evaluateRoutes, inspectNetwork,
} from './agent.js'
import { MODES, AGENT } from './config.js'
import METRICS from './fade_model_metrics.json' with { type: 'json' }
import { runExperiment } from './experiment.js'

let emit = () => {}
export function setEventSink(fn) { emit = fn || (() => {}) }

let ctx = { city: null, policy: 'balanced', prof: null }
let tickTimer = null
let lastExperiment = null   // survives the agent's periodic overlay re-render

export function setAgentContext(next) { ctx = { ...ctx, ...next } }

const pct = v => `${(v * 100).toFixed(0)}%`
const riskColour = r => r > 0.6 ? 'var(--red)' : r > 0.3 ? 'var(--amber)' : 'var(--green)'

// ─── Always-visible panel ───────────────────────────────────────────────────

export function renderAutopilot() {
  const host = document.getElementById('autopilot-body')
  if (!host) return

  const mode = getMode()
  const st = agentState()
  const fcs = GATEWAYS.map(gw => ({ gw, f: forecastGateway(gw) }))
  const cur = fcs.find(x => x.gw.name === st.currentGateway) ?? null
  const worst = [...fcs].sort((a, b) => (b.f.risk[3] ?? 0) - (a.f.risk[3] ?? 0))[0]
  const log = decisions()
  const last = log[log.length - 1]
  const pend = pendingProposal()

  const timeline = (f) => HORIZONS_H.map(h => {
    const r = f.risk[h] ?? 0
    return `<div class="tl-col" title="+${h}h: ${pct(r)}">
      <div class="tl-bar"><div class="tl-fill" style="height:${Math.max(3, r * 100)}%;background:${riskColour(r)}"></div></div>
      <span class="tl-lbl">+${h}h</span></div>`
  }).join('')

  host.innerHTML = `
    <div class="ap-modes">
      ${[MODES.OFF, MODES.ASSIST, MODES.AUTOPILOT].map(m => `
        <button class="ap-mode ${m === mode ? 'on' : ''}" data-mode="${m}">${m}</button>`).join('')}
    </div>

    ${cur ? `
      <div class="ap-cur">
        <span class="ap-cur-lbl">SERVING VIA</span>
        <b>${cur.gw.name}</b>
        <span class="ap-fade">${cur.f.fadeNowDb.toFixed(1)} dB fade · ${cur.f.rainNowMmH.toFixed(1)} mm/h</span>
      </div>
      <div class="ap-timeline">${timeline(cur.f)}</div>
      <div class="ap-note">Predicted P(fade &gt; ${FADE_THRESHOLD_DB} dB) at ${LINK.fGHz} GHz</div>
    ` : `<div class="ap-note">Send a request to establish a route.</div>`}

    ${worst && (worst.f.risk[3] ?? 0) > 0.25 ? `
      <div class="ap-alert">
        <i data-ic="warning"></i> <b>${worst.gw.name}</b> — ${pct(worst.f.risk[3])} risk at +3h
      </div>` : ''}

    ${pend ? `
      <div class="ap-pending">
        <div class="ap-pending-t">PROPOSAL — approval required</div>
        <div class="ap-pending-b">Move <b>${pend.from}</b> → <b>${pend.to}</b><br/>
          saves <b>${pend.improvementMs} ms</b> of expected cost, risk −${pct(pend.riskDrop)}</div>
        <div class="ap-pending-a">
          <button class="ap-btn ap-ok" id="ap-approve">Approve</button>
          <button class="ap-btn" id="ap-reject">Dismiss</button>
        </div>
      </div>` : ''}

    ${last ? `
      <div class="ap-last">
        <span class="ap-ev ap-ev-${(last.event || '').toLowerCase()}">${last.event}</span>
        ${last.event === 'REROUTE' || last.event === 'PROPOSED'
          ? `${last.from} → ${last.to}` : (last.reason || '')}
        ${last.verified ? `<span class="ap-verdict ${last.verified.beneficial ? 'good' : 'bad'}">
            ${last.verified.beneficial ? '<i data-ic="check" data-size="12"></i> degradation confirmed' : '<i data-ic="cross"></i> no degradation'}</span>` : ''}
      </div>` : ''}

    <div class="ap-foot">
      <button class="ap-link" id="ap-open">Decisions &amp; model →</button>
      <span class="ap-clock" title="Weather trace replays faster than wall-clock so a forecast horizon is watchable">wx ×${Math.round(3600 / getWeatherSpeed())}</span>
    </div>
  `

  host.querySelectorAll('.ap-mode').forEach(b => b.addEventListener('click', () => {
    setMode(b.dataset.mode); renderAutopilot()
  }))
  host.querySelector('#ap-approve')?.addEventListener('click', () => { approvePending(); renderAutopilot() })
  host.querySelector('#ap-reject')?.addEventListener('click', () => { rejectPending(); renderAutopilot() })
  host.querySelector('#ap-open')?.addEventListener('click', openOverlay)
}

// ─── Detail overlay ─────────────────────────────────────────────────────────

function metricsTable() {
  const rows = []
  for (const [h, list] of Object.entries(METRICS.horizon_metrics)) {
    const p = list.find(m => m.model === 'persistence')
    const g = list.find(m => m.model === 'lightgbm')
    const l = list.find(m => m.model === 'logistic')
    rows.push(`<tr>
      <td>+${h}</td>
      <td>${p?.roc_auc ?? '—'}</td><td>${p?.brier ?? '—'}</td>
      <td>${l?.roc_auc ?? '—'}</td><td>${l?.brier ?? '—'}</td>
      <td class="${g && p && g.brier < p.brier ? 'good' : ''}">${g?.roc_auc ?? '—'}</td>
      <td class="${g && p && g.brier < p.brier ? 'good' : ''}">${g?.brier ?? '—'}</td>
      <td>${METRICS.unseen_site_metrics[h]?.roc_auc ?? '—'}</td>
    </tr>`)
  }
  return `<table class="dash-table">
    <thead><tr><th>Horizon</th><th colspan="2">Persistence</th><th colspan="2">Logistic</th>
      <th colspan="2">LightGBM</th><th>Unseen site</th></tr>
      <tr><th></th><th>AUC</th><th>Brier</th><th>AUC</th><th>Brier</th><th>AUC</th><th>Brier</th><th>AUC</th></tr></thead>
    <tbody>${rows.join('')}</tbody></table>`
}

function calibrationPanel() {
  const c = calibration()
  if (!c.n) return `<p class="dash-note">No verified decisions yet. Decisions are scored against what the
    weather actually did ${AGENT ? 3 : 3} trace-hours later — run the demo scenario or let the agent act.</p>`
  return `
    <div class="kpi-grid" style="margin-bottom:14px">
      <div class="kpi-card"><span class="kpi-val" style="color:var(--cyan)">${c.n}</span><span class="kpi-label">Verified decisions</span></div>
      <div class="kpi-card"><span class="kpi-val" style="color:var(--amber)">${c.brier}</span><span class="kpi-label">Brier score</span></div>
      <div class="kpi-card"><span class="kpi-val" style="color:var(--green)">${pct(c.beneficialShare)}</span><span class="kpi-label">Reroutes that were warranted</span></div>
    </div>
    <table class="dash-table"><thead><tr><th>Predicted risk</th><th>n</th><th>Mean predicted</th><th>Observed</th></tr></thead>
      <tbody>${c.bins.filter(b => b.n).map(b => `<tr><td>${b.range}</td><td>${b.n}</td>
        <td>${pct(b.predicted)}</td><td>${pct(b.observed)}</td></tr>`).join('')}</tbody></table>
    <p class="dash-note" style="margin-top:10px">Calibration asks whether a stated 70% actually happens 70% of the
      time. For a router that multiplies P(outage) by a cost, this matters more than accuracy.</p>`
}

function experimentHtml(r) {
  const A = r.arms.CURRENT, R = r.arms.REACTIVE, B = r.arms.PREDICTIVE, C = r.arms.AUTOPILOT
  const h = r.headline
  const row = (name, a) => `<tr><td>${name}</td>
    <td>${a.failures}</td><td>${pct(a.failureRate)}</td>
    <td>${a.meanRtt.toFixed(1)} ms</td><td>${a.p95Rtt.toFixed(1)} ms</td>
    <td>${a.reroutes || '—'}</td><td>${a.proactiveReroutes || '—'}</td></tr>`

  return `
    <div class="kpi-grid" style="margin-bottom:14px">
      <div class="kpi-card"><span class="kpi-val" style="color:var(--red)">${h.totalFailuresBaseline}</span>
        <span class="kpi-label">Failures with no weather awareness</span></div>
      <div class="kpi-card"><span class="kpi-val" style="color:var(--amber)">${h.avoidedByObserving}</span>
        <span class="kpi-label">Avoided by observing fade</span></div>
      <div class="kpi-card"><span class="kpi-val" style="color:var(--green)">${h.avoidedByForecasting}</span>
        <span class="kpi-label">Avoided by forecasting</span></div>
      <div class="kpi-card"><span class="kpi-val" style="color:var(--cyan)">${h.residual}</span>
        <span class="kpi-label">Remaining failures</span></div>
    </div>
    <table class="dash-table"><thead><tr><th>Arm</th><th>Failures</th><th>Rate</th>
      <th>Mean RTT</th><th>p95 RTT</th><th>Reroutes</th><th>Proactive</th></tr></thead>
      <tbody>
        ${row('A · CURRENT — blind to live weather', A)}
        ${row('R · REACTIVE — sees fade now', R)}
        ${row('B · PREDICTIVE — sees forecast', B)}
        ${row('C · AUTOPILOT — sticky route + agent', C)}
      </tbody></table>
    <p class="dash-note" style="margin-top:12px">
      <b>The honest reading.</b> Most of the benefit comes from <b>observing</b>, not forecasting:
      reacting to current fade removes <b>${h.avoidedByObserving}</b> of ${h.totalFailuresBaseline} failures.
      Forecasting removes the remaining <b>${h.avoidedByForecasting}</b>, for
      ${h.rttCostOfForecast >= 0 ? '+' : ''}${h.rttCostOfForecast.toFixed(2)} ms of mean latency — real, but a
      far smaller marginal gain than a predictive system is usually sold on.
    </p>
    <p class="dash-note" style="margin-top:8px">
      <b>A negative result worth stating.</b> The agent (arm C) reaches the same zero failures as plain predictive
      routing while costing <b>${h.rttCostOfAgent.toFixed(1)} ms</b> more mean latency, because a sticky route with
      hysteresis stays on a suboptimal gateway between moves. Here, re-selecting a gateway every request is free,
      so hysteresis buys nothing. Its value belongs to the case this model does not yet represent — where changing
      route has a cost of its own, such as session affinity or cache warmth.
      <b>${pct(h.proactiveShare)}</b> of its ${h.agentReroutes} moves were made before the abandoned gateway
      actually failed.
    </p>
    <p class="dash-note" style="margin-top:8px">${r.schedule.requests} requests over ${r.schedule.hours}
      recorded hours — identical schedule and identical weather in all four arms.</p>`
}

function decisionLog() {
  const log = [...decisions()].reverse().slice(0, 25)
  if (!log.length) return `<p class="dash-note">No agent decisions recorded yet.</p>`
  return `<div class="ap-log">` + log.map(e => `
    <div class="ap-log-row">
      <span class="ap-ev ap-ev-${(e.event || '').toLowerCase()}">${e.event}</span>
      <span class="ap-log-body">
        ${e.event === 'REROUTE' || e.event === 'PROPOSED' || e.event === 'REJECTED'
          ? `<b>${e.from}</b> → <b>${e.to}</b> · saves ${e.improvementMs} ms · risk −${pct(e.riskDrop ?? 0)} · conf ${e.confidence}`
          : e.reason}
        ${e.verified ? `<span class="ap-verdict ${e.verified.beneficial ? 'good' : 'bad'}">
          ${e.verified.beneficial
            ? `confirmed — fade reached ${e.verified.futureFadeDb} dB`
            : `not confirmed — fade only ${e.verified.futureFadeDb} dB`}</span>` : ''}
      </span>
      <span class="ap-log-t">${new Date(e.ts).toLocaleTimeString('en-GB')}</span>
    </div>`).join('') + `</div>`
}

function gatewayBoard() {
  const rows = GATEWAYS.map(gw => ({ gw, f: forecastGateway(gw) }))
    .sort((a, b) => (b.f.risk[3] ?? 0) - (a.f.risk[3] ?? 0))
  return `<table class="dash-table"><thead><tr>
      <th>Gateway</th><th>Site</th><th>Rain</th><th>Fade</th><th>Now</th>
      ${HORIZONS_H.map(h => `<th>+${h}h</th>`).join('')}<th>Conf</th></tr></thead>
    <tbody>${rows.map(({ gw, f }) => `<tr>
      <td>${gw.name}</td><td class="muted-cell">${gw.site ?? '—'}</td>
      <td>${f.rainNowMmH.toFixed(1)}</td>
      <td>${f.fadeNowDb.toFixed(1)} dB</td>
      <td style="color:${riskColour(f.outageNow)}">${pct(f.outageNow)}</td>
      ${HORIZONS_H.map(h => `<td style="color:${riskColour(f.risk[h])}">${pct(f.risk[h])}</td>`).join('')}
      <td class="muted-cell">${f.confidence.toFixed(2)}</td></tr>`).join('')}</tbody></table>`
}

export function renderOverlay() {
  const host = document.getElementById('ap-overlay-body')
  if (!host) return
  const inj = activeInjections()

  host.innerHTML = `
    <div class="dash-headline">
      <div>
        <h2>Orbital Autopilot</h2>
        <p class="dash-range">Predict → plan → act → verify → learn · agent tick ${AGENT.TICK_MS / 1000}s</p>
        <p class="dash-prov">
          <span class="prov-chip prov-sim">REPLAY</span>
          Weather is a replay of <b>real recorded observations</b> — ${TRACE_META.source},
          ${TRACE_META.period}, ${TRACE_META.hours} hourly samples per site.
          Fade is computed with <b>ITU-R P.838-3 / P.618-13</b>, not learned.
          The only trained component is the forecaster (<b>${MODEL_VERSION}</b>), which sees
          observations up to now and never the future it is scored against.
        </p>
      </div>
    </div>

    <div class="dash-card">
      <div class="dash-card-head"><h3>Scenario injection</h3>
        <span class="dash-card-sub">adds a real rain cell on top of the recorded trace</span></div>
      <div class="ap-scenarios">
        <button class="dash-btn" data-inject="Singapore"><i data-ic="rain"></i> Heavy rain — Singapore</button>
        <button class="dash-btn" data-inject="Frankfurt"><i data-ic="rain"></i> Heavy rain — Frankfurt</button>
        <button class="dash-btn" data-inject="Virginia"><i data-ic="rain"></i> Heavy rain — Virginia</button>
        <button class="dash-btn dash-btn-danger" id="ap-clear-inj">Clear injections</button>
      </div>
      ${inj.length ? `<p class="dash-note" style="margin-top:10px">Active: ${inj.map(i =>
        `<b>${i.gateway}</b> ${i.nowMmH} mm/h`).join(' · ')}</p>` : ''}
    </div>

    <div class="dash-card">
      <div class="dash-card-head"><h3>Gateway risk board</h3>
        <span class="dash-card-sub">P(fade &gt; ${FADE_THRESHOLD_DB} dB) by horizon</span></div>
      ${gatewayBoard()}
    </div>

    <div class="dash-card">
      <div class="dash-card-head"><h3>Does prediction actually help?</h3>
        <span class="dash-card-sub">paired A/B/C on one identical trace</span></div>
      <div id="ap-exp">${lastExperiment ? experimentHtml(lastExperiment) : `
        <button class="dash-btn" id="ap-run-exp"><i data-ic="play"></i> Run experiment (2800 h · 5600 requests · 4 arms)</button>
        <p class="dash-note" style="margin-top:10px">All four arms see the same requests against the same
        recorded weather. A request fails when fade at its gateway exceeds the ${LINK.marginDb} dB link margin —
        the same physical rule everywhere, so the difference is the routing, not the luck.</p>`}</div>
    </div>

    <div class="dash-card">
      <div class="dash-card-head"><h3>Prediction vs reality</h3>
        <span class="dash-card-sub">every action is scored against what happened</span></div>
      ${calibrationPanel()}
    </div>

    <div class="dash-card">
      <div class="dash-card-head"><h3>Agent decision log</h3>
        <span class="dash-card-sub">auditable, most recent first</span></div>
      ${decisionLog()}
      <div class="dash-actions"><button class="dash-btn dash-btn-danger" id="ap-clear-log">Clear decision log</button></div>
    </div>

    <div class="dash-card">
      <div class="dash-card-head"><h3>Forecast model — held-out performance</h3>
        <span class="dash-card-sub">time-split, never random</span></div>
      ${metricsTable()}
      <p class="dash-note" style="margin-top:12px">
        Trained on ${METRICS.data_source}, ${METRICS.period}. Split by <b>time</b>
        (train ${METRICS.split.train_hours}h, val ${METRICS.split.val_hours}h, test ${METRICS.split.test_hours}h)
        because consecutive hours are heavily correlated and a random split would leak.
        The last column holds out <b>entire gateways</b> to test generalisation to a site never seen.
      </p>
      <p class="dash-note" style="margin-top:8px">
        <b>The honest reading:</b> persistence is a strong baseline on ranking and beats the model
        on AUC at long horizons. What the learned model wins is <b>calibration</b> — Brier improves
        several-fold at every horizon. That is the property a router needs, because it multiplies
        the probability by a cost rather than just sorting by it.
      </p>
    </div>
  `

  host.querySelector('#ap-run-exp')?.addEventListener('click', (ev) => {
    ev.target.disabled = true
    ev.target.textContent = 'running…'
    setTimeout(() => {
      lastExperiment = runExperiment({ hours: 2800, requestsPerHour: 2, startHour: 24 })
      const box = document.getElementById('ap-exp')
      if (box) box.innerHTML = experimentHtml(lastExperiment)
    }, 30)
  })

  host.querySelectorAll('[data-inject]').forEach(b => b.addEventListener('click', () => {
    injectRain(b.dataset.inject, { peakMmH: 28, durationH: 8, rampH: 1.5 })
    renderOverlay(); renderAutopilot()
  }))

  host.querySelector('#ap-clear-inj')?.addEventListener('click', () => {
    clearInjections(); renderOverlay(); renderAutopilot()
  })
  host.querySelector('#ap-clear-log')?.addEventListener('click', () => {
    clearDecisions(); renderOverlay(); renderAutopilot()
  })
}

function openOverlay() {
  document.getElementById('ap-overlay')?.classList.remove('hidden')
  renderOverlay()
}
function closeOverlay() { document.getElementById('ap-overlay')?.classList.add('hidden') }

// ─── Boot ───────────────────────────────────────────────────────────────────

export function initAutopilot({ getContext } = {}) {
  document.getElementById('ap-overlay-close')?.addEventListener('click', closeOverlay)
  document.getElementById('ap-overlay')?.addEventListener('click', e => {
    if (e.target.id === 'ap-overlay') closeOverlay()
  })
  document.getElementById('autopilot-btn')?.addEventListener('click', openOverlay)

  renderAutopilot()

  // Agent runs on its own cadence, deliberately decoupled from the render loop.
  clearInterval(tickTimer)
  tickTimer = setInterval(() => {
    try {
      const c = getContext ? getContext() : ctx
      if (c?.city) {
        const d = step({ city: c.city, policy: c.policy, prof: c.prof })
        if (d?.event === 'REROUTE') emit('warning', `Autopilot rerouted <b>${d.from}</b> to <b>${d.to}</b>`)
        else if (d?.event === 'PROPOSED') emit('brain', `Proposal: move <b>${d.from}</b> to <b>${d.to}</b>`)
      }
      verifyPending()
      renderAutopilot()
      const ov = document.getElementById('ap-overlay')
      if (ov && !ov.classList.contains('hidden')) renderOverlay()
    } catch (e) {
      // The agent must never take the app down with it.
      console.warn('[OrbitalCDN] agent tick failed:', e.message)
    }
  }, AGENT.TICK_MS)
}

export { setCurrentGateway, inspectNetwork, evaluateRoutes }
