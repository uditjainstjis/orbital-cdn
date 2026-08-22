import Globe from 'globe.gl'
import * as THREE from 'three'
import { PALETTE } from './palette.js'

// Textures bundled with three-globe (via unpkg)
const T = {
  day:    '//unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
  bump:   '//unpkg.com/three-globe/example/img/earth-topology.png',
  clouds: '//unpkg.com/three-globe/example/img/earth-water.png',
  stars:  '//unpkg.com/three-globe/example/img/night-sky.png',
}

let world, cloudMesh, atmMesh

/**
 * Recolour the Blue Marble into the instrument palette.
 *
 * Every satellite demo ships this exact texture — saturated blue oceans, tan
 * land, a specular highlight and a starfield — and two other teams in this
 * hackathon shipped it too. It is also the only surface here that had not
 * followed the rest of the interface into warm graphite, so clicking LIVE 3D
 * felt like leaving the product.
 *
 * Done in the fragment shader rather than on a canvas deliberately: the texture
 * is served cross-origin from unpkg, so reading its pixels would taint the
 * canvas and throw. Patching the shader needs no pixel access, costs nothing
 * per frame, and keeps every coastline and mountain range the texture encodes —
 * only the hue is replaced. Land still reads as land because the mapping is
 * driven by luminance, which is what distinguishes ocean from continent from
 * ice cap in the source image.
 */
function graphiteEarth(w) {
  const mat = typeof w.globeMaterial === 'function' ? w.globeMaterial() : null
  if (!mat) return

  const rgb = h => {
    const n = parseInt(h.slice(1), 16)
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]
  }
  const v3 = c => `vec3(${rgb(c).map(x => x.toFixed(4)).join(', ')})`

  mat.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#include <map_fragment>
       {
         float l = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
         vec3 c = mix(${v3(PALETTE.bgDeep)}, ${v3(PALETTE.card)},  smoothstep(0.02, 0.20, l));
         c      = mix(c, ${v3(PALETTE.terrain)},                          smoothstep(0.16, 0.44, l));
         c      = mix(c, ${v3(PALETTE.terrainHi)},                          smoothstep(0.52, 0.86, l));
         diffuseColor.rgb = c;
       }`
    )
  }
  mat.needsUpdate = true
}

export function initGlobe(container) {
  world = Globe()
    .globeImageUrl(T.day)
    .bumpImageUrl(T.bump)
    .backgroundColor(PALETTE.bgDeep)
    .showAtmosphere(true)
    .atmosphereColor(PALETTE.info)
    .atmosphereAltitude(0.22)
    (container)

  const ctrl = world.controls()
  ctrl.autoRotate = true
  ctrl.autoRotateSpeed = 0.28
  ctrl.enableDamping = true
  ctrl.dampingFactor = 0.08
  ctrl.zoomSpeed = 0.7
  ctrl.minDistance = 120
  ctrl.maxDistance = 700

  world.pointOfView({ lat: 18, lng: 15, altitude: 2.6 })

  graphiteEarth(world)

  const scene = world.scene()
  const GLOBE_R = world.getGlobeRadius()
  const loader = new THREE.TextureLoader()

  // Drifting cloud sphere
  loader.load(T.clouds, tex => {
    cloudMesh = new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_R * 1.013, 64, 64),
      new THREE.MeshPhongMaterial({
        map:         tex,
        transparent: true,
        opacity:     0.10,
        depthWrite:  false,
      })
    )
    cloudMesh.renderOrder = 2
    cloudMesh.name = 'clouds'
    world.scene().add(cloudMesh)
  })

  // Fresnel atmosphere glow (blue rim)
  atmMesh = new THREE.Mesh(
    new THREE.SphereGeometry(GLOBE_R * 1.09, 48, 48),
    new THREE.ShaderMaterial({
      uniforms: {},
      vertexShader: /* glsl */`
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vViewDir   = normalize(-mvPos.xyz);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: /* glsl */`
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          float rim  = 1.0 - max(0.0, dot(vNormal, vViewDir));
          float glow = pow(rim, 5.0) * 1.1;
          gl_FragColor = vec4(0.49, 0.58, 0.72, glow * 0.45);
        }
      `,
      transparent: true,
      side:        THREE.FrontSide,
      blending:    THREE.AdditiveBlending,
      depthWrite:  false,
    })
  )
  atmMesh.renderOrder = 3
  atmMesh.name = 'fresnelAtm'
  scene.add(atmMesh)

  return world
}

export function getWorld() { return world }

export function updateEarth() {
  if (!world) return
  const now = new Date()

  // Compute real sun direction from UTC hour
  const utcH   = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600
  // At noon UTC, sun is at lon≈0; advances 15°/hr westward
  const sunLon  = (180 - utcH * 15 + 360) % 360 - 180  // radians below
  const sunDecl = -23.44 * Math.cos((2 * Math.PI / 365) * (now.getUTCMonth() * 30.4 + 10))
  const phi     = (90 - sunDecl) * Math.PI / 180
  const theta   = (sunLon + 180) * Math.PI / 180
  const sunDir  = new THREE.Vector3(
    -Math.sin(phi) * Math.cos(theta),
     Math.cos(phi),
     Math.sin(phi) * Math.sin(theta),
  ).normalize()


  // Slowly drift clouds (one full rotation every ~6 hours)
  if (cloudMesh) cloudMesh.rotation.y += 0.000072
}

// Layer visibility toggles
export function toggleClouds(v)      { if (cloudMesh)  cloudMesh.visible  = v }
export function toggleAtmosphere(v)  { if (atmMesh)    atmMesh.visible    = v }
