import * as satellite from 'satellite.js'
import * as THREE from 'three'

export const PLANES = 6
export const SATS_PER_PLANE = 12
const INC_DEG = 53
const LEO_ALT_KM = 550
const DC_ALT_KM  = 620   // Orbital DCs at slightly higher SSO-ish orbit
const EARTH_R_KM = 6371

// DC positions: planes 0, 2, 4 → slot 0
const DC_PLANE_SLOTS = [[0, 0], [2, 0], [4, 0]]

export let sats = []
export let satBodyMeshes = []   // {mesh, sat} pairs for raycasting
let satGroup, islSegments, islPositions

// Pre-allocated temp vectors — avoids GC pressure in 60fps loop
const _vR   = new THREE.Vector3()
const _vT   = new THREE.Vector3()
const _vB   = new THREE.Vector3()
const _vRef = new THREE.Vector3()
const _vPos = new THREE.Vector3()
const _mat4 = new THREE.Matrix4()

const startMs = Date.now()

// ─── Initialise ──────────────────────────────────────────────────────────────

export function initSatellites(scene, world) {
  sats = []
  for (let p = 0; p < PLANES; p++) {
    for (let s = 0; s < SATS_PER_PLANE; s++) {
      const isDC     = DC_PLANE_SLOTS.some(([dp, ds]) => dp === p && ds === s)
      const dcIndex  = DC_PLANE_SLOTS.findIndex(([dp, ds]) => dp === p && ds === s)
      sats.push({
        id:       p * SATS_PER_PLANE + s,
        plane:    p,
        slot:     s,
        raan0:    (p / PLANES) * 360,   // right ascension at t=0
        anomaly0: (s / SATS_PER_PLANE) * 360,
        lat:      0, lon: 0,
        alt:      isDC ? DC_ALT_KM : LEO_ALT_KM,
        isDC,
        dcName:   isDC ? `DC-${dcIndex + 1}` : null,
        eclipsed: false,
        inSAA:    false,
        battery:  0.7 + Math.random() * 0.3,
        load:     0.1 + Math.random() * 0.4,
        satrec:   null,
        mesh:     null,
      })
    }
  }

  _buildMeshes(scene, world)
  _buildISLLines(scene)
  _fetchTLEs()
}

// ─── Three.js Objects ─────────────────────────────────────────────────────────

function _buildMeshes(scene, world) {
  satGroup = new THREE.Group()
  satGroup.name = 'satellites'
  scene.add(satGroup)
  satBodyMeshes = []

  sats.forEach(sat => {
    const group = new THREE.Group()

    if (sat.isDC) {
      // ── Orbital DC: large bus + big solar wings + ring + aura ──────────────
      const bodyMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 0.75, 0.75),
        new THREE.MeshBasicMaterial({ color: 0xf59e0b })
      )
      group.add(bodyMesh)

      const pGeo = new THREE.PlaneGeometry(2.5, 0.7)
      const pMatL = new THREE.MeshBasicMaterial({ color: 0xd97706, transparent: true, opacity: 0.82, side: THREE.DoubleSide })
      const pMatR = pMatL.clone()
      const panelL = new THREE.Mesh(pGeo, pMatL)
      panelL.position.set(-2.15, 0, 0)
      const panelR = new THREE.Mesh(pGeo, pMatR)
      panelR.position.set(2.15, 0, 0)
      group.add(panelL, panelR)

      // Solar-cell grid lines on panels (thin cross lines give texture)
      const lGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-1.25, 0, 0.001), new THREE.Vector3(1.25, 0, 0.001),
        new THREE.Vector3(0, -0.35, 0.001), new THREE.Vector3(0, 0.35, 0.001),
      ])
      const lMat = new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.45 })
      const linesL = new THREE.LineSegments(lGeo, lMat)
      linesL.position.set(-2.15, 0, 0)
      const linesR = new THREE.LineSegments(lGeo.clone(), lMat.clone())
      linesR.position.set(2.15, 0, 0)
      group.add(linesL, linesR)

      // Glow ring
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(1.0, 1.6, 32),
        new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.22, side: THREE.DoubleSide })
      )
      ring.rotation.x = Math.PI / 2
      group.add(ring)

      // Soft aura sphere
      group.add(new THREE.Mesh(
        new THREE.SphereGeometry(2.0, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.05 })
      ))

      sat.bodyMesh   = bodyMesh
      sat.panelMeshes = [panelL, panelR]
    } else {
      // ── LEO Relay Satellite: compact bus + solar wings ──────────────────────
      const bodyMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 0.18, 0.18),
        new THREE.MeshBasicMaterial({ color: 0x00d4ff, transparent: true, opacity: 0.95 })
      )
      group.add(bodyMesh)

      const pGeo = new THREE.PlaneGeometry(0.68, 0.20)
      const pMatL = new THREE.MeshBasicMaterial({ color: 0x1a6da8, transparent: true, opacity: 0.88, side: THREE.DoubleSide })
      const pMatR = pMatL.clone()
      const panelL = new THREE.Mesh(pGeo, pMatL)
      panelL.position.set(-0.57, 0, 0)
      const panelR = new THREE.Mesh(pGeo, pMatR)
      panelR.position.set(0.57, 0, 0)
      group.add(panelL, panelR)

      sat.bodyMesh    = bodyMesh
      sat.panelMeshes = [panelL, panelR]
    }

    sat.mesh = group
    satGroup.add(group)
    satBodyMeshes.push({ mesh: sat.bodyMesh, sat })
  })
}

function _buildISLLines(scene) {
  // Upper bound: PLANES*SATS_PER_PLANE intra-plane + PLANES*SATS_PER_PLANE cross-plane
  const maxEdges = PLANES * SATS_PER_PLANE * 2
  const geo = new THREE.BufferGeometry()
  islPositions = new Float32Array(maxEdges * 2 * 3)
  geo.setAttribute('position', new THREE.BufferAttribute(islPositions, 3))

  islSegments = new THREE.LineSegments(
    geo,
    new THREE.LineBasicMaterial({ color: 0x00d4ff, transparent: true, opacity: 0.13 })
  )
  islSegments.name = 'islMesh'
  islSegments.frustumCulled = false
  scene.add(islSegments)
}

// ─── Per-Frame Update ─────────────────────────────────────────────────────────

export function updateSatellites(world) {
  if (!satGroup || !world) return
  const now = new Date()
  const elapsedSec = (Date.now() - startMs) / 1000

  sats.forEach(sat => {
    if (sat.satrec) {
      // Real TLE propagation via satellite.js SGP4
      const pv = satellite.propagate(sat.satrec, now)
      if (pv && pv.position) {
        const gmst = satellite.gstime(now)
        const geo  = satellite.eciToGeodetic(pv.position, gmst)
        sat.lat    = satellite.degreesLat(geo.latitude)
        sat.lon    = satellite.degreesLong(geo.longitude)
        sat.alt    = geo.height   // km
      }
    } else {
      // Walker-Delta analytic propagation
      const DEG_PER_SEC = 360 / (90 * 60)   // ~90-min orbital period
      const anomaly = (sat.anomaly0 + elapsedSec * DEG_PER_SEC) % 360
      const raan    = sat.raan0 + elapsedSec * 0.00417   // Earth rotation ~0.25°/min → 0.00417°/s
      const INC     = INC_DEG * Math.PI / 180
      const anom    = anomaly  * Math.PI / 180

      sat.lat = Math.asin(Math.sin(INC) * Math.sin(anom)) * 180 / Math.PI
      const lonOff = Math.atan2(Math.cos(INC) * Math.sin(anom), Math.cos(anom)) * 180 / Math.PI
      sat.lon = ((raan + lonOff) % 360 + 360) % 360 - 180
    }

    sat.eclipsed = _isEclipsed(sat.lon, now)
    sat.inSAA    = _inSAA(sat.lat, sat.lon)

    // Battery dynamics
    if (!sat.eclipsed) sat.battery = Math.min(1, sat.battery + 0.00008)
    else               sat.battery = Math.max(0.1, sat.battery - 0.00004)

    // Update Three.js mesh position + orientation
    if (sat.mesh && sat.bodyMesh) {
      const altGlobeR = sat.alt / EARTH_R_KM
      const pos = world.getCoords(sat.lat, sat.lon, altGlobeR)
      _vPos.set(pos.x, pos.y, pos.z)
      sat.mesh.position.copy(_vPos)

      // Orient group: +X = orbital tangent, +Y = radial outward, +Z = binormal
      _vR.copy(_vPos).normalize()
      if (Math.abs(_vR.y) < 0.99) _vRef.set(0, 1, 0)
      else                         _vRef.set(1, 0, 0)
      _vT.crossVectors(_vRef, _vR).normalize()
      _vB.crossVectors(_vR, _vT)
      _mat4.makeBasis(_vT, _vR, _vB)
      sat.mesh.quaternion.setFromRotationMatrix(_mat4)

      // Color by state
      if (!sat.isDC) {
        const bColor = sat.inSAA ? 0xef4444 : sat.eclipsed ? 0x475569 : 0x00d4ff
        const pColor = sat.inSAA ? 0xcc2222 : sat.eclipsed ? 0x334155 : 0x1a6da8
        const bOp = sat.inSAA || sat.eclipsed ? 0.5 : 0.95
        const pOp = sat.inSAA || sat.eclipsed ? 0.35 : 0.88
        sat.bodyMesh.material.color.setHex(bColor)
        sat.bodyMesh.material.opacity = bOp
        sat.panelMeshes.forEach(p => { p.material.color.setHex(pColor); p.material.opacity = pOp })
      } else {
        const bColor = sat.eclipsed ? 0x6b7280 : 0xf59e0b
        const pColor = sat.eclipsed ? 0x4b5563 : 0xd97706
        sat.bodyMesh.material.color.setHex(bColor)
        sat.panelMeshes.forEach(p => p.material.color.setHex(pColor))
      }
    }
  })

  _updateISL(world)
}

function _updateISL(world) {
  if (!islSegments || !islPositions) return
  let idx = 0

  for (const sat of sats) {
    // Intra-plane link: sat → next slot in same plane
    const nextSlot = (sat.slot + 1) % SATS_PER_PLANE
    const next     = sats.find(s => s.plane === sat.plane && s.slot === nextSlot)
    if (next) {
      const lonDiff = Math.abs(((sat.lon - next.lon + 540) % 360) - 180)
      if (lonDiff < 80) {  // skip antimeridian wrap
        const a = world.getCoords(sat.lat,  sat.lon,  sat.alt  / EARTH_R_KM)
        const b = world.getCoords(next.lat, next.lon, next.alt / EARTH_R_KM)
        islPositions[idx++]=a.x; islPositions[idx++]=a.y; islPositions[idx++]=a.z
        islPositions[idx++]=b.x; islPositions[idx++]=b.y; islPositions[idx++]=b.z
      }
    }

    // Cross-plane link: same slot, adjacent plane (disabled near poles)
    if (Math.abs(sat.lat) < 58) {
      const nextPlane = (sat.plane + 1) % PLANES
      const cross     = sats.find(s => s.plane === nextPlane && s.slot === sat.slot)
      if (cross) {
        const lonDiff = Math.abs(((sat.lon - cross.lon + 540) % 360) - 180)
        if (lonDiff < 55) {
          const a = world.getCoords(sat.lat,   sat.lon,   sat.alt   / EARTH_R_KM)
          const b = world.getCoords(cross.lat, cross.lon, cross.alt / EARTH_R_KM)
          islPositions[idx++]=a.x; islPositions[idx++]=a.y; islPositions[idx++]=a.z
          islPositions[idx++]=b.x; islPositions[idx++]=b.y; islPositions[idx++]=b.z
        }
      }
    }
  }

  // Zero out remaining buffer
  for (let i = idx; i < islPositions.length; i++) islPositions[i] = 0
  islSegments.geometry.attributes.position.needsUpdate = true
  islSegments.geometry.setDrawRange(0, idx / 3)
}

// ─── TLE Fetch ───────────────────────────────────────────────────────────────

async function _fetchTLEs() {
  try {
    const url = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle'
    const res  = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) throw new Error('HTTP ' + res.status)
    const txt   = await res.text()
    const lines = txt.trim().split('\n').map(l => l.trim())
    if (lines.length < 6) throw new Error('Empty TLE response')

    // Parse TLE triplets
    const sets = []
    for (let i = 0; i + 2 < lines.length; i += 3) {
      if (lines[i + 1].startsWith('1 ') && lines[i + 2].startsWith('2 ')) {
        sets.push([lines[i], lines[i + 1], lines[i + 2]])
      }
    }

    // Sample N = sats.length evenly across the full catalog
    const step = Math.max(1, Math.floor(sets.length / sats.length))
    sats.forEach((sat, i) => {
      const [, l1, l2] = sets[(i * step) % sets.length] || []
      if (l1 && l2) {
        try { sat.satrec = satellite.twoline2satrec(l1, l2) }
        catch { /* bad TLE, keep Walker-Delta */ }
      }
    })
    const loaded = sats.filter(s => s.satrec).length
    console.log(`[OrbitalCDN] TLEs loaded: ${loaded}/${sats.length} from CelesTrak`)
  } catch (e) {
    console.log('[OrbitalCDN] TLE fetch failed, using Walker-Delta model:', e.message)
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _isEclipsed(lon, now) {
  const utcH   = now.getUTCHours() + now.getUTCMinutes() / 60
  const sunLon = (180 - utcH * 15 + 360) % 360 - 180
  const diff   = Math.abs(((lon - sunLon + 540) % 360) - 180)
  return diff > 128
}

function _inSAA(lat, lon) {
  return lat >= -50 && lat <= 0 && lon >= -80 && lon <= 10
}

// ─── Public Queries ───────────────────────────────────────────────────────────

export function getDCs() {
  return sats.filter(s => s.isDC)
}

export function findNearestSat(lat, lon) {
  return sats
    .filter(s => !s.isDC)
    .reduce((best, s) => {
      const d = (s.lat - lat) ** 2 + (s.lon - lon) ** 2
      return (!best || d < best._d) ? { ...s, _d: d } : best
    }, null)
}

export function toggleISL(visible) {
  if (islSegments) islSegments.visible = visible
}

// Return sunlit DC count for badge update
export function sunlitDCCount() {
  return sats.filter(s => s.isDC && !s.eclipsed).length
}
