// Ground network: gateways, cities, SAA zone
// Gateways render via globe.gl htmlElementsData; SAA via polygonsData.

// `wetness` is a climatological base rate, not a fixed condition. Actual
// weather at each gateway is resolved per 6-hour block by gatewayWeather()
// below, so a gateway's state genuinely changes over time. This matters: if
// weather were a frozen literal, the "learned" rain penalty would converge to
// a constant and the adaptive loop would be an obfuscated hardcoded weight.
// Real teleport / gateway sites, not city-centre pins. Satellite ground
// stations are sited well outside the cities they serve — using the city
// centre misplaces the downlink by tens to hundreds of km, which matters when
// the whole model turns on path geometry.
//
// Sources per site are noted inline. Mumbai has no published coordinate
// (Starlink has nine proposed Indian gateways, none with public lat/lon), so
// it remains a city-centre approximation and is labelled as such.
export const GATEWAYS = [
  // Seletar Teleport, Singtel — en.wikipedia.org/wiki/Seletar_Teleport
  { name: 'Singapore',    lat:   1.3972, lon: 103.8343, wetness: 0.42, weather: 'clear', site: 'Seletar Teleport (Singtel)' },
  // No published coordinate — city-centre approximation
  { name: 'Mumbai',       lat:  19.1,    lon:  72.9,    wetness: 0.55, weather: 'clear', site: 'approximate — no published site' },
  // Usingen teleport, ~45 km NW of Frankfurt — dishycentral.com Starlink dataset
  { name: 'Frankfurt',    lat:  50.3363, lon:   8.5372, wetness: 0.28, weather: 'clear', site: 'Usingen' },
  // Boydton VA — dishycentral.com Starlink dataset
  { name: 'Virginia',     lat:  36.6676, lon: -78.3904, wetness: 0.24, weather: 'clear', site: 'Boydton, VA' },
  // Hitachinaka, ~110 km NE of Tokyo — dishycentral.com Starlink dataset
  { name: 'Tokyo GW',     lat:  36.3967, lon: 140.5333, wetness: 0.30, weather: 'clear', site: 'Hitachinaka' },
  // Santana de Parnaiba, ~35 km NW of Sao Paulo — dishycentral.com dataset
  { name: 'Sao Paulo GW', lat: -23.4439, lon: -46.9178, wetness: 0.38, weather: 'clear', site: 'Santana de Parnaiba' },
  // Optus Satellite Station, Belrose NSW — oztowers.com.au site register
  { name: 'Sydney GW',    lat: -33.7173, lon: 151.2115, wetness: 0.22, weather: 'clear', site: 'Belrose (Optus)' },
  // Lekki, ~55 km E of Lagos — dishycentral.com Starlink dataset
  { name: 'Lagos GW',     lat:   6.4698, lon:   3.5852, wetness: 0.46, weather: 'clear', site: 'Lekki' },
]

// ─── Time-varying weather ──────────────────────────────────────────────────

const WX_BLOCK_MS = 6 * 3600e3   // fronts persist ~6 h, they do not flicker per request

/** Deterministic per-(gateway, 6h block) hash → the same history for every viewer. */
function wxHash(name, block) {
  let h = 2166136261 ^ block
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  h ^= h >>> 13
  return ((h >>> 0) % 100000) / 100000
}

/**
 * Weather at one gateway at one instant.
 * Rain probability scales with the site's climatological wetness — heavy
 * rain-fade outages are occasional even at a wet teleport, so a Ka-band link
 * is clear most of the time and Mumbai rains roughly 3x as often as Sydney.
 */
export function gatewayWeather(gw, ts = Date.now()) {
  const h      = wxHash(gw.name, Math.floor(ts / WX_BLOCK_MS))
  const pRain  = gw.wetness * 0.34
  const pCloud = 0.26
  return h < pRain ? 'rain' : h < pRain + pCloud ? 'cloudy' : 'clear'
}

/** Refresh every gateway's current condition. Called from the frame loop. */
export function updateWeather(ts = Date.now()) {
  GATEWAYS.forEach(gw => { gw.weather = gatewayWeather(gw, ts) })
  return GATEWAYS
}

export const CITIES = [
  { city: 'Delhi',     lat:  28.6, lon:  77.2 },
  { city: 'New York',  lat:  40.7, lon: -74.0 },
  { city: 'London',    lat:  51.5, lon:  -0.1 },
  { city: 'Tokyo',     lat:  35.7, lon: 139.7 },
  { city: 'Sao Paulo', lat: -23.5, lon: -46.6 },
  { city: 'Sydney',    lat: -33.9, lon: 151.2 },
  { city: 'Lagos',     lat:   6.5, lon:   3.4 },
  { city: 'Dubai',     lat:  25.2, lon:  55.3 },
]

// SAA bounding box as a globe.gl polygon (GeoJSON-like)
// GeoJSON Polygon coordinates: [outerRing, ...holes]
// Each ring = array of [lon, lat] positions (GeoJSON is lon-first)
// Published extent at ~500 km altitude: -50 to 0 deg latitude, -90 to +40 deg
// longitude. Source: NASA GSFC "Ask an Astrophysicist" (1996), via
// en.wikipedia.org/wiki/South_Atlantic_Anomaly. The previous box here spanned
// only -80..+10 and clipped 40 deg of the real longitude extent.
//
// Caveat kept deliberately: this is a rectangle over an oval whose minimum-field
// region has since split into two lobes, and the anomaly drifts west ~0.3 deg/yr,
// so a 1996 extent is approximate for 2026. It over-includes the corners.
export const SAA_POLYGON = [{
  name: 'SAA',
  polygon: [[-90, -50], [40, -50], [40, 0], [-90, 0], [-90, -50]],
}]

let selectedCityName = 'Delhi'

// ─── globe.gl layer setup ───────────────────────────────────────────────────

export function initNetwork(world) {
  // SAA zone
  world
    .polygonsData(SAA_POLYGON)
    .polygonGeoJsonGeometry(d => ({
      type: 'Polygon',
      coordinates: [[...d.polygon]], // outer ring wrapped in coordinates array
    }))
    .polygonCapColor(() => 'rgba(239,68,68,0.10)')
    .polygonSideColor(() => 'rgba(239,68,68,0.05)')
    .polygonStrokeColor(() => 'rgba(239,68,68,0.5)')
    .polygonAltitude(0.018)
    .polygonLabel(() => '⚠️ South Atlantic Anomaly — inner Van Allen belt dips to ~200 km.<br/>Published extent 50°S–0°, 90°W–40°E (NASA GSFC). Fermi spends ~15% of its time inside it.')

  // Gateways as HTML markers
  world
    .htmlElementsData(GATEWAYS)
    .htmlLat(d => d.lat)
    .htmlLng(d => d.lon)
    .htmlAltitude(0.005)
    .htmlElement(d => {
      const el   = document.createElement('div')
      const col  = d.weather === 'clear'  ? '#10b981'
                 : d.weather === 'rain'   ? '#ef4444'
                 : '#f59e0b'
      el.className    = 'gw-marker'
      el.dataset.name = d.name
      el.style.cssText = `
        width:12px; height:12px;
        background:${col};
        clip-path:polygon(50% 0%,100% 50%,50% 100%,0% 50%);
        box-shadow:0 0 8px ${col};
        cursor:pointer;
        transition:transform .2s;
      `
      el.title = `${d.name} — ${d.weather}`
      return el
    })

  // Cities as points with labels
  world
    .labelsData(CITIES)
    .labelLat(d => d.lat)
    .labelLng(d => d.lon)
    .labelAltitude(0.008)
    .labelText(d => d.city === selectedCityName ? d.city : '')
    .labelSize(1.5)
    .labelColor(() => 'rgba(255,255,255,0.95)')
    .labelDotRadius(d => d.city === selectedCityName ? 0.45 : 0.28)
    .labelDotOrientation(() => 'right')

  // Additional points for all cities (unlabelled dots)
  world
    .pointsData(CITIES)
    .pointLat(d => d.lat)
    .pointLng(d => d.lon)
    .pointAltitude(0.0)
    .pointRadius(d => d.city === selectedCityName ? 0.55 : 0.3)
    .pointColor(d => d.city === selectedCityName ? '#ffffff' : 'rgba(255,255,255,0.45)')
    .pointsMerge(false)
}

export function setSelectedCity(cityName, world) {
  selectedCityName = cityName
  // Refresh labels and points
  world.labelsData([...CITIES])
  world.pointsData([...CITIES])
}

export function toggleSAA(visible, world) {
  world.polygonsData(visible ? SAA_POLYGON : [])
}

export function gwWeatherColor(weather) {
  return weather === 'clear' ? '#10b981' : weather === 'rain' ? '#ef4444' : '#f59e0b'
}
