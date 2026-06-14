import Globe from 'globe.gl'
import * as THREE from 'three'

// Textures bundled with three-globe (via unpkg)
const T = {
  day:    '//unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
  night:  '//unpkg.com/three-globe/example/img/earth-night.jpg',
  bump:   '//unpkg.com/three-globe/example/img/earth-topology.png',
  clouds: '//unpkg.com/three-globe/example/img/earth-water.png',
  stars:  '//unpkg.com/three-globe/example/img/night-sky.png',
}

let world, cloudMesh, nightMesh, atmMesh

export function initGlobe(container) {
  world = Globe()
    .globeImageUrl(T.day)
    .bumpImageUrl(T.bump)
    .backgroundImageUrl(T.stars)
    .showAtmosphere(true)
    .atmosphereColor('deepskyblue')
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

  const scene = world.scene()
  const GLOBE_R = world.getGlobeRadius()
  const loader = new THREE.TextureLoader()

  // Night lights / city lights on dark side
  loader.load(T.night, tex => {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        nightMap: { value: tex },
        sunDir:   { value: new THREE.Vector3(1, 0, 0) },
      },
      vertexShader: /* glsl */`
        varying vec2 vUv;
        varying vec3 vWorldNormal;
        void main() {
          vUv = uv;
          vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        uniform sampler2D nightMap;
        uniform vec3 sunDir;
        varying vec2 vUv;
        varying vec3 vWorldNormal;
        void main() {
          float cosA  = dot(vWorldNormal, normalize(sunDir));
          float night = smoothstep(0.05, -0.2, cosA);
          vec4 c = texture2D(nightMap, vUv);
          // Boost city lights contrast
          vec3 lit = c.rgb * 1.8;
          gl_FragColor = vec4(lit, night * 0.92);
        }
      `,
      transparent: true,
      depthWrite:  false,
    })
    nightMesh = new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_R * 1.001, 64, 64),
      mat
    )
    nightMesh.renderOrder = 1
    nightMesh.name = 'nightLights'
    scene.add(nightMesh)
  })

  // Drifting cloud sphere
  loader.load(T.clouds, tex => {
    cloudMesh = new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_R * 1.013, 64, 64),
      new THREE.MeshPhongMaterial({
        map:         tex,
        transparent: true,
        opacity:     0.28,
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
          gl_FragColor = vec4(0.18, 0.52, 1.0, glow * 0.65);
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

  if (nightMesh) nightMesh.material.uniforms.sunDir.value.copy(sunDir)

  // Slowly drift clouds (one full rotation every ~6 hours)
  if (cloudMesh) cloudMesh.rotation.y += 0.000072
}

// Layer visibility toggles
export function toggleClouds(v)      { if (cloudMesh)  cloudMesh.visible  = v }
export function toggleNightLights(v) { if (nightMesh)  nightMesh.visible  = v }
export function toggleAtmosphere(v)  { if (atmMesh)    atmMesh.visible    = v }
