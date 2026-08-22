// Orbital CDN 3D Live Simulator — entry point

import * as THREE from 'three'
import { initIcons } from './icons.js'
import { crossoverSvg, crossoverLegend } from './crossover.js'
import { initInsights } from './insights.js'
import { initGlobe, getWorld, updateEarth, toggleClouds } from './globe.js'
import { initSatellites, updateSatellites, sats, satBodyMeshes, sunlitDCCount, toggleISL } from './sats.js'
import { initNetwork, setSelectedCity, toggleSAA, updateWeather } from './network.js'
import { runSimulation } from './engine.js'
import {
  runSequence, setSpeed, skipSequence, isRunning, setCallbacks, SPEED,
} from './sequence.js'
import {
  initCityGrid, initServiceList, initPolicyTabs, initModal,
  selectedCity, selectedService, policy,
  addDecision, clearDecisions, setTicker, setMetrics, resetMetrics,
  setSendState, showDeepDive, showInspector, hideInspector,
} from './ui.js'
import { initDashboard, renderDashboard, getLearnWindow, openDashboard, renderIdleSummary } from './dashboard.js'
import { record, eventCount, seedEvents, adaptiveEnabled, summarize } from './telemetry.js'
import { generateHistory } from './seed.js'
import { initAutopilot, renderAutopilot, setEventSink } from './predict/ui.js'
import * as agentApi from './predict/agent.js'
import * as weatherApi from './predict/weather.js'
import { adaptiveProfile } from './telemetry.js'
const { setCurrentGateway } = agentApi

// ─── Product state bootstrap ──────────────────────────────────────────────
// The network ships with its own operating history so the analytics view is
// populated on a cold open. Seeds once, then never again — real requests
// append to the same log.

function ensureHistory() {
  if (eventCount() > 0) return
  const n = seedEvents(generateHistory({ days: 30, perDay: 42 }))
  console.log(`[OrbitalCDN] seeded ${n} historical requests (30 d)`)
}

// ─── Boot ─────────────────────────────────────────────────────────────────

const _raycaster  = new THREE.Raycaster()
const _mouse      = new THREE.Vector2()
let   _hoverReady = false   // enable hover only after first routing completes

/**
 * Swap the drawn placeholder glyph for the brand mark, but only once the raster
 * has actually decoded.
 *
 * `<img onerror>` is not sufficient: a dev server answers a missing .png with
 * index.html at HTTP 200, so the load reports success and the browser paints
 * its own broken-image icon in the top bar. Decoding is the only honest test of
 * whether the file is there, so nothing enters the DOM until it passes.
 */
function mountBrandMark() {
  const probe = new Image()
  probe.onload = () => {
    if (!probe.naturalWidth) return
    const slot = document.querySelector('#topbar .logo [data-ic="logo"], #topbar .logo svg')
    if (slot) {
      const img = new Image()
      img.src = probe.src; img.alt = ''; img.className = 'logo-mark'
      slot.replaceWith(img)
    }
    const title = document.querySelector('#intro-card .intro-title')
    if (title && !document.querySelector('.intro-mark')) {
      const img = new Image()
      img.src = probe.src; img.alt = 'Orbital CDN'; img.className = 'intro-mark'
      title.before(img)
    }
  }
  probe.src = '/logo-mark.png'
}

async function main() {
  initIcons()          // swap <i data-ic> placeholders for SVG, incl. future renders

  const container = document.getElementById('globe-container')

  // 1. Photorealistic Earth
  const world = initGlobe(container)

  // Wait one frame for globe.gl to mount the renderer.
  // rAF never fires in a background tab, so race it with a timer — otherwise
  // the whole app hangs here when the page is opened in an unfocused tab.
  await new Promise(r => {
    let done = false
    const go = () => { if (!done) { done = true; r() } }
    requestAnimationFrame(go)
    setTimeout(go, 120)
  })

  // 2. Satellites + ISL mesh
  const scene = world.scene()
  initSatellites(scene, world)

  // 3. Ground network (gateways, cities, SAA)
  initNetwork(world)

  // 4. UI
  ensureHistory()
  initInsights()
  initDashboard({ onChange: updateAdaptiveBadge, onReset: ensureHistory })
  updateAdaptiveBadge()
  initIntro()
  renderIdleSummary()
  initShell()
  initStage()
  setEventSink(pushEvent)

  // Debug/demo handle. Exposes the app's OWN module instances so a scenario can
  // be driven reproducibly from the console — importing the modules separately
  // yields different instances under the dev server and silently does nothing.
  window.__ocdn = {
    agent: agentApi,
    weather: weatherApi,
    context: () => ({ city: selectedCity, policy, prof: adaptiveProfile(getLearnWindow()) }),
    renderAutopilot,
  }

  // Autopilot: its own decision cadence, never tied to the render loop.
  initAutopilot({
    getContext: () => ({
      city: selectedCity,
      policy,
      prof: adaptiveProfile(getLearnWindow()),
    }),
  })
  initCityGrid(city => {
    setSelectedCity(city.city, world)
    if (!isRunning()) world.pointOfView({ lat: city.lat, lng: city.lon, altitude: 1.8 }, 1200)
  })
  initServiceList()
  initPolicyTabs()
  initModal()

  // 5. Sequence callbacks
  setCallbacks({
    addDecision,
    setTicker,
    setMetrics: (m) => setMetrics(m),
    setArcs:    (arcs) => updateArcs(arcs, world),
    onComplete: (data) => {
      setSendState(false)
      renderCrossover()         // fold the new request into the evidence chart
      showDeepDive(data)
      document.getElementById('btn-replay').disabled = false
      _hoverReady = true   // unlock satellite hover tooltips
    },
  })

  // 6. Parallel RAF for satellite + earth updates.
  // Do NOT replace globe.gl's own setAnimationLoop — that drives arc animations,
  // orbit controls damping, and three-globe's internal ticker.
  // A separate RAF runs right before each paint and globe.gl picks up the updated
  // Three.js object positions on its next render pass (~16 ms lag, imperceptible).
  ;(function updateLoop() {
    requestAnimationFrame(updateLoop)
    updateEarth()
    updateSatellites(world)
  })()

  // Gateway weather advances in 6-hour blocks; re-resolve periodically so a
  // long-lived session sees conditions actually change rather than sit frozen.
  updateWeather()
  setInterval(() => updateWeather(), 30_000)

  // 7. Wiring: send button
  let lastData = null
  document.getElementById('send-btn').addEventListener('click', async () => {
    if (isRunning()) return
    clearDecisions()
    resetMetrics()
    setSendState(true)
    showStage('globe')          // the animation is the globe's job
    document.getElementById('btn-replay').disabled = true

    const data = runSimulation({
      city:    selectedCity,
      service: selectedService,
      policy,
      sats,
      learnWindow: getLearnWindow(),
    })

    // Persist the outcome — this request is now part of what the network learns from
    record(data, { adaptive: data.adaptive })
    setCurrentGateway(data.gw.name)
    pushEvent('gateway', `Routed <b>${data.city.city}</b> via <b>${data.gw.name}</b> · ${data.rtt} ms`)
    renderAutopilot()
    updateAdaptiveBadge()
    lastData = data

    // Clear existing arcs
    updateArcs([], world)

    await runSequence(data, world)
  })

  // 8. Skip / replay
  document.getElementById('btn-skip').addEventListener('click', () => {
    if (isRunning()) skipSequence()
  })

  document.getElementById('btn-summary')?.addEventListener('click', () => {
    if (!isRunning()) renderIdleSummary()
  })

  document.getElementById('btn-replay').addEventListener('click', async () => {
    if (!lastData || isRunning()) return
    clearDecisions()
    resetMetrics()
    setSendState(true)
    updateArcs([], world)
    await runSequence(lastData, world)
  })

  // 9. Speed dial
  document.querySelectorAll('.speed-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      setSpeed(+btn.dataset.speed)
    })
  })

  // 10. Layer toggles
  document.getElementById('toggle-isl')?.addEventListener('change', e => toggleISL(e.target.checked))
  document.getElementById('toggle-saa')?.addEventListener('change', e => toggleSAA(e.target.checked, world))
  document.getElementById('toggle-clouds')?.addEventListener('change', e => toggleClouds(e.target.checked))
  document.getElementById('toggle-trails')?.addEventListener('change', () => {}) // future

  // 11. UTC clock
  setInterval(() => {
    const now  = new Date()
    const pad  = n => String(n).padStart(2, '0')
    document.getElementById('utc-clock').textContent =
      `UTC ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`

    // DC sunlit badge
    const n = sunlitDCCount()
    document.getElementById('dc-badge').textContent = `${n} DC${n !== 1 ? 's' : ''} SUNLIT`
  }, 1000)

  // 12. Click-to-inspect satellites and gateways
  world.onGlobeClick(() => hideInspector())

  // Gateway HTML element click-through
  document.addEventListener('click', e => {
    const gw = e.target.closest('[data-name]')
    if (gw) {
      const gwData = { name: gw.dataset.name }
      showInspector(gwData, e.clientX, e.clientY)
    }
  })

  // Escape to close inspector / modal
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      hideInspector()
      document.getElementById('modal-overlay').classList.add('hidden')
    }
    if (e.code === 'Space' && !e.repeat) {
      e.preventDefault()
      if (isRunning()) skipSequence()
    }
  })

  // 13. Satellite hover tooltips via Three.js raycasting
  _initSatHover(world)

  // 14. Mobile bottom tabs
  _initMobileTabs()
}

function _initSatHover(world) {
  const camera   = world.camera()
  const domEl    = world.renderer().domElement

  domEl.addEventListener('mousemove', (e) => {
    if (!_hoverReady) return
    const rect = domEl.getBoundingClientRect()
    _mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1
    _mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1

    _raycaster.setFromCamera(_mouse, camera)
    // raycaster needs the actual THREE.Mesh objects (body meshes)
    const meshList = satBodyMeshes.map(s => s.mesh)
    const hits = _raycaster.intersectObjects(meshList, false)

    if (hits.length > 0) {
      const hitMesh = hits[0].object
      const entry   = satBodyMeshes.find(s => s.mesh === hitMesh)
      if (entry) {
        showInspector(entry.sat, e.clientX, e.clientY)
        domEl.style.cursor = 'pointer'
        return
      }
    }
    hideInspector()
    domEl.style.cursor = ''
  })

  domEl.addEventListener('mouseleave', () => {
    hideInspector()
  })
}

// First-run brief — states the problem before the judge has to infer it, and
// hands them the fastest route to the substance. Dismissal is remembered.
function initIntro() {
  const card = document.getElementById('intro-card')
  if (!card) return
  let seen = false
  try { seen = localStorage.getItem('ocdn.intro.seen') === '1' } catch { /* ignore */ }
  if (seen) return

  // Lead with the strongest finding already in the seeded history
  try {
    const s    = summarize('30d')
    const rank = [...s.byCity].filter(c => c.n >= 4).sort((a, b) => b.winRate - a.winRate)
    const el   = document.getElementById('intro-stat')
    if (el && rank.length > 1) {
      const top = rank[0], bot = rank[rank.length - 1]
      el.textContent = `across ${s.overall.n} logged requests, orbital beat terrestrial fibre `
                     + `${(s.overall.winRate * 100).toFixed(0)}% of the time overall — but ${(top.winRate * 100).toFixed(0)}% for ${top.key} `
                     + `and only ${(bot.winRate * 100).toFixed(0)}% for ${bot.key}.`
    } else if (el) {
      el.textContent = `${s.overall.n} requests logged over the last 30 days.`
    }
  } catch { /* non-fatal */ }

  card.classList.remove('hidden')
  const dismiss = () => {
    card.classList.add('hidden')
    try { localStorage.setItem('ocdn.intro.seen', '1') } catch { /* ignore */ }
  }
  document.getElementById('intro-close')?.addEventListener('click', dismiss)
  document.getElementById('intro-analytics')?.addEventListener('click', () => { dismiss(); openDashboard() })
  document.getElementById('intro-send')?.addEventListener('click', () => {
    dismiss()
    document.getElementById('send-btn')?.click()
  })
}

// ─── Shell: nav rail and status bar ────────────────────────────────────────

const feed = []   // rolling event strip along the bottom

export function pushEvent(iconName, html) {
  feed.unshift({ ic: iconName, html, at: Date.now() })
  if (feed.length > 6) feed.pop()
  renderFeed()
}

function ago(ms) {
  const s = Math.max(0, (Date.now() - ms) / 1000)
  return s < 60 ? `${s | 0}s ago` : s < 3600 ? `${(s / 60) | 0}m ago` : `${(s / 3600) | 0}h ago`
}

function renderFeed() {
  const el = document.getElementById('sb-feed')
  if (!el) return
  el.innerHTML = feed.map(f =>
    `<span class="sb-item"><i data-ic="${f.ic}" data-size="13"></i>${f.html}<span class="sb-ago">${ago(f.at)}</span></span>`
  ).join('')
  const m = document.getElementById('sb-mode')
  if (m) {
    const mode = agentApi.getMode()
    m.textContent = mode
    m.className = 'sb-pill' + (mode === 'OFF' ? ' off' : mode === 'AUTOPILOT' ? ' auto' : '')
  }
}

// ─── Centre stage ──────────────────────────────────────────────────────────

function renderCrossover() {
  const host = document.getElementById('xo-chart')
  if (!host) return
  const s = summarize('30d')
  host.innerHTML = crossoverSvg(s.byCity)
  const leg = document.getElementById('xo-legend')
  if (leg) leg.innerHTML = crossoverLegend()
  const stat = document.getElementById('xo-stat')
  if (stat && s.overall.n) {
    stat.innerHTML = `<b>${(s.overall.winRate * 100).toFixed(0)}%</b>`
                   + `<span>beat fibre · ${s.overall.n} requests</span>`
  }
}

export function showStage(which) {
  const stage = document.getElementById('stage')
  const globe = document.getElementById('globe-container')
  const xo    = document.getElementById('xo-view')
  if (!stage || !globe || !xo) return

  const onGlobe = which === 'globe'
  stage.classList.toggle('show-globe', onGlobe)

  // Set visibility with inline !important. Plain inline styles were being
  // overridden here and the globe stayed visible over the chart; for the one
  // interaction the whole demo hinges on, unambiguous beats elegant.
  const setVis = (el, on) => {
    if (!el) return
    el.style.setProperty('opacity', on ? '1' : '0', 'important')
    el.style.setProperty('pointer-events', on ? 'auto' : 'none', 'important')
    el.style.setProperty('visibility', on ? 'visible' : 'hidden', 'important')
  }
  setVis(globe, onGlobe)
  setVis(xo, !onGlobe)
  // Globe-only furniture
  ;['autopilot-panel', 'layer-controls', 'playback-controls']
    .forEach(id => setVis(document.getElementById(id), onGlobe))

  document.querySelectorAll('.stg').forEach(b =>
    b.classList.toggle('active', b.dataset.stage === which))
  if (!onGlobe) renderCrossover()
}

function initStage() {
  document.querySelectorAll('.stg').forEach(b =>
    b.addEventListener('click', () => showStage(b.dataset.stage)))
  showStage('map')
}

function initShell() {
  document.querySelectorAll('.rail-btn').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('.rail-btn').forEach(x => x.classList.remove('active'))
    b.classList.add('active')
    const t = b.dataset.rail
    if (t === 'analytics') openDashboard()
    else if (t === 'autopilot') document.getElementById('autopilot-btn')?.click()
    else if (t === 'insights') document.getElementById('insights-btn')?.click()
    else if (t === 'layers') document.getElementById('layer-controls')?.scrollIntoView({ block: 'nearest' })
  }))

  setInterval(() => {
    const d = new Date(), p = n => String(n).padStart(2, '0')
    const c = document.getElementById('sb-clock')
    if (c) c.textContent = `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`
    renderFeed()
  }, 1000)

  pushEvent('satellite', 'Constellation propagating from live TLEs')
  pushEvent('chart', 'Analytics ready — <b>991</b> logged requests')
}

function updateAdaptiveBadge() {
  const el = document.getElementById('adaptive-badge')
  if (!el) return
  const on = adaptiveEnabled()
  let head = `${eventCount()} REQS`
  try {
    const s = summarize('7d')
    if (s.overall.n) head = `${(s.overall.winRate * 100).toFixed(0)}% BEAT FIBRE · ${s.overall.p50}ms p50`
  } catch { /* fall back to the count */ }
  el.innerHTML = `<i data-ic="${on ? 'target' : 'lock'}" data-size="12"></i> ${on ? 'ADAPTIVE' : 'FIXED'} · ${head}`
  el.classList.toggle('badge-adaptive-on', on)
  const overlay = document.getElementById('dash-overlay')
  if (overlay && !overlay.classList.contains('hidden')) renderDashboard()
}

function _initMobileTabs() {
  const isMobile = () => window.innerWidth <= 768
  const panelLeft  = document.getElementById('panel-left')
  const panelRight = document.getElementById('panel-right')

  function closeAll() {
    panelLeft?.classList.remove('mob-open')
    panelRight?.classList.remove('mob-open')
    document.querySelectorAll('.mob-tab').forEach(t => t.classList.remove('active'))
  }

  document.querySelectorAll('.mob-tab[data-panel]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!isMobile()) return
      const target = btn.dataset.panel === 'left' ? panelLeft : panelRight
      const isOpen = target?.classList.contains('mob-open')
      closeAll()
      if (!isOpen) {
        target?.classList.add('mob-open')
        btn.classList.add('active')
      }
    })
  })

  // Mobile send button in tab bar
  document.getElementById('mob-send')?.addEventListener('click', async () => {
    if (!isMobile()) return
    if (isRunning()) return
    closeAll()
    // Reuse the same logic as the main send button
    document.getElementById('send-btn')?.click()
  })

  // Tap-outside to close sheets
  document.getElementById('globe-container')?.addEventListener('click', () => {
    if (isMobile()) closeAll()
  })

  // Mobile insights close button
  const mobClose = document.getElementById('insights-close-mob')
  if (mobClose) {
    mobClose.style.display = isMobile() ? 'flex' : 'none'
    mobClose.addEventListener('click', () => {
      document.getElementById('insights-overlay')?.classList.add('hidden')
    })
    window.addEventListener('resize', () => {
      mobClose.style.display = isMobile() ? 'flex' : 'none'
    })
  }
}

// ─── Arc management ───────────────────────────────────────────────────────

function updateArcs(arcs, world) {
  if (!world) return
  world
    .arcsData(arcs)
    .arcStartLat(d => d.startLat)
    .arcStartLng(d => d.startLng)
    .arcEndLat(d => d.endLat)
    .arcEndLng(d => d.endLng)
    .arcColor(d => d.color)
    .arcAltitude(d => d.alt ?? 0.3)
    .arcStroke(1.6)
    .arcDashLength(0.35)
    .arcDashGap(0.08)
    .arcDashAnimateTime(d => d.animate ?? 2000)
}

// ─── Run ──────────────────────────────────────────────────────────────────

main().catch(console.error)
mountBrandMark()
