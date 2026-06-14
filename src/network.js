// Ground network: gateways, cities, SAA zone
// Gateways render via globe.gl htmlElementsData; SAA via polygonsData.

export const GATEWAYS = [
  { name: 'Singapore',   lat:   1.3, lon: 103.8, weather: 'clear'  },
  { name: 'Mumbai',      lat:  19.1, lon:  72.9, weather: 'rain'   },
  { name: 'Frankfurt',   lat:  50.1, lon:   8.7, weather: 'clear'  },
  { name: 'Virginia',    lat:  38.9, lon: -77.0, weather: 'clear'  },
  { name: 'Tokyo GW',    lat:  35.7, lon: 139.6, weather: 'clear'  },
  { name: 'Sao Paulo GW',lat: -23.5, lon: -46.6, weather: 'cloudy' },
  { name: 'Sydney GW',   lat: -33.9, lon: 151.2, weather: 'clear'  },
  { name: 'Lagos GW',    lat:   6.5, lon:   3.4, weather: 'cloudy' },
]

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
export const SAA_POLYGON = [{
  name: 'SAA',
  // polygon is already one ring wrapped in the coordinates array
  polygon: [[-80, -50], [10, -50], [10, 0], [-80, 0], [-80, -50]],
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
    .polygonLabel(() => '⚠️ South Atlantic Anomaly — Inner Van Allen Belt dips to ~200 km')

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
