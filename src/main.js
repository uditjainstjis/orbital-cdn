// Orbital CDN 3D Live Simulator — entry point

import * as THREE from 'three'
import { initInsights } from './insights.js'
import { initGlobe, getWorld, updateEarth, toggleClouds, toggleNightLights } from './globe.js'
import { initSatellites, updateSatellites, sats, satBodyMeshes, sunlitDCCount, toggleISL } from './sats.js'
import { initNetwork, setSelectedCity, toggleSAA } from './network.js'
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

// ─── Boot ─────────────────────────────────────────────────────────────────

const _raycaster  = new THREE.Raycaster()
const _mouse      = new THREE.Vector2()
let   _hoverReady = false   // enable hover only after first routing completes

async function main() {
  const container = document.getElementById('globe-container')

  // 1. Photorealistic Earth
  const world = initGlobe(container)

  // Wait one frame for globe.gl to mount the renderer
  await new Promise(r => requestAnimationFrame(r))

  // 2. Satellites + ISL mesh
  const scene = world.scene()
  initSatellites(scene, world)

  // 3. Ground network (gateways, cities, SAA)
  initNetwork(world)

  // 4. UI
  initInsights()
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

  // 7. Wiring: send button
  let lastData = null
  document.getElementById('send-btn').addEventListener('click', async () => {
    if (isRunning()) return
    clearDecisions()
    resetMetrics()
    setSendState(true)
    document.getElementById('btn-replay').disabled = true

    const data = runSimulation({
      city:    selectedCity,
      service: selectedService,
      policy,
      sats,
    })
    lastData = data

    // Clear existing arcs
    updateArcs([], world)

    await runSequence(data, world)
  })

  // 8. Skip / replay
  document.getElementById('btn-skip').addEventListener('click', () => {
    if (isRunning()) skipSequence()
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
  document.getElementById('toggle-night')?.addEventListener('change', e => toggleNightLights(e.target.checked))
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
