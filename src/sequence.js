// 8-beat cinematic sequencer — camera choreography + synced UI reveals
// Each beat: camera transition → animation → right-panel reveal

import { gwWeatherColor } from './network.js'

export let SPEED    = 2     // multiplier: 0.5 / 1 / 2 — defaults fast; a 24 s
                            // cinematic is 40% of the attention budget a judge has
export let skipping = false

let seqActive = false
let arcs      = []         // accumulating route arcs for globe.gl

// A pending sleep must keep hold of its resolver, not just its timer id.
// Skipping cancels the timer AND resolves the promise — cancelling alone would
// leave the awaiting sequence suspended forever, which deadlocks seqActive and
// permanently disables Send, Replay, Deep Dive and satellite hover.
const _sleepTimers = []

const sleep = ms => new Promise(r => {
  if (skipping) return r()
  const entry = { resolve: r }
  entry.id = setTimeout(() => {
    const i = _sleepTimers.indexOf(entry)
    if (i !== -1) _sleepTimers.splice(i, 1)
    r()
  }, ms / SPEED)
  _sleepTimers.push(entry)
})

function clearTimers() {
  // Take a copy first: each resolve() can synchronously queue another sleep.
  const pending = _sleepTimers.splice(0, _sleepTimers.length)
  pending.forEach(e => { clearTimeout(e.id); e.resolve() })
}

export function setSpeed(s) { SPEED = s }

export function isRunning() { return seqActive }

// ─── External callbacks (set by main.js) ──────────────────────────────────

let _addDecision = () => {}
let _setTicker   = () => {}
let _setMetrics  = () => {}
let _setArcs     = () => {}
let _onComplete  = () => {}

export function setCallbacks({ addDecision, setTicker, setMetrics, setArcs, onComplete }) {
  _addDecision = addDecision
  _setTicker   = setTicker
  _setMetrics  = setMetrics
  _setArcs     = setArcs
  _onComplete  = onComplete
}

// ─── Add a route arc and refresh globe.gl ─────────────────────────────────

function addArc(arc) {
  arcs.push(arc)
  _setArcs([...arcs])
}

// ─── Main cinematic run ────────────────────────────────────────────────────

export async function runSequence(data, world) {
  seqActive = true
  skipping  = false
  arcs      = []
  clearTimers()

  const {
    city, dc, uplink, hopSats, saaCross,
    gw, gwSat, nHops,
    rtt, baseline, stretch, propMs, procMs, wxMs,
    policy, weights: w,
  } = data

  const pov = (lat, lng, alt, dur) =>
    world.pointOfView({ lat, lng, altitude: alt }, dur / SPEED)

  // Disable auto-rotate during sequence
  world.controls().autoRotate = false

  // ── BEAT 1: Origin lock (2 s) ─────────────────────────────────────────
  _setTicker(`<i data-ic="origin"></i> Locking origin: ${city.city} at ${city.lat.toFixed(1)}°N, ${city.lon.toFixed(1)}°E`)
  pov(city.lat, city.lon, 1.4, 1800)
  await sleep(400)
  _addDecision({
    icon: '<i data-ic="origin"></i>', bg: 'rgba(0,212,255,0.15)', title: 'Origin Locked',
    body: `Request originates from <b>${city.city}</b> (${city.lat.toFixed(1)}°, ${city.lon.toFixed(1)}°). Ground terminal elevation mask ≥ 25°.`,
    hl: `${city.city} → Orbital CDN network`, hlColor: '#00d4ff',
    step: 1,
  })
  await sleep(1800)

  // ── BEAT 2: Uplink satellite (2 s) ───────────────────────────────────
  _setTicker(`<i data-ic="antenna"></i> Selecting uplink — nearest satellite at 25°+ elevation mask`)
  pov((city.lat + uplink.lat) / 2, (city.lon + uplink.lon) / 2, 0.9, 1600)
  await sleep(300)

  // Draw city → uplink arc
  addArc({
    startLat: city.lat, startLng: city.lon,
    endLat: uplink.lat, endLng: uplink.lon,
    color: '#00d4ff', alt: 0.18, animate: 1800,
  })

  _addDecision({
    icon: '<i data-ic="antenna"></i>', bg: 'rgba(0,212,255,0.15)', title: 'Uplink Satellite Selected',
    body: `Nearest satellite to <b>${city.city}</b> above 25° elevation mask. Vacuum laser: <b>c = 299,792 km/s</b> — 40% faster than fiber.`,
    hl: `SAT-${uplink.id} @ ${uplink.lat.toFixed(1)}°, ${uplink.lon.toFixed(1)}° ${uplink.inSAA ? '<i data-ic="warning"></i> near SAA' : ''}`,
    hlColor: '#00d4ff', step: 2,
  })
  await sleep(2200)

  // ── BEAT 3: DC selection (4 s) ───────────────────────────────────────
  _setTicker(`<i data-ic="satellite"></i> Scoring ${data.allDCs.length} orbital DCs against ${policy} cost function…`)
  // Pull back to see all DCs
  pov(dc.lat, dc.lon, 2.2, 2500)
  await sleep(800)

  const dcNote = policy === 'latency'
    ? 'Nearest DC selected (latency-first — ignoring solar/SAA).'
    : policy === 'green'
      ? (dc.eclipsed ? 'No sunlit DC scored best — this one is eclipsed and running on stored charge.' : '<i data-ic="sun"></i> Sunlit DC selected — compute runs on live solar, no battery draw.')
      : policy === 'reliable'
        ? (dc.inSAA ? '<i data-ic="warning"></i> All SAA-free DCs too far — accepted radiation risk.' : 'SAA-free DC chosen — hardware radiation safe.')
        : `${dc.eclipsed ? '<i data-ic="battery"></i> Battery' : '<i data-ic="sun"></i> Sunlit'} DC via balanced multi-objective cost.`

  _addDecision({
    icon: '<i data-ic="satellite"></i>', bg: 'rgba(245,158,11,0.15)', title: `Orbital DC Selected: ${dc.dcName}`,
    body: dcNote + ` Battery SoC ${(dc.battery * 100).toFixed(0)}%. Winning cost <b>${(+dc.cost).toFixed(1)} ms</b> of latency-equivalent penalty, against ${data.allDCs.length - 1} alternatives.`,
    hl: dc.eclipsed ? '<i data-ic="eclipse"></i> ECLIPSED — battery drain active' : '<i data-ic="sun"></i> SUNLIT — solar powered',
    hlColor: dc.eclipsed ? '#ef4444' : '#f59e0b', step: 3,
  })
  await sleep(3200)

  // ── BEAT 4: ISL traversal — hop by hop (7 s) ─────────────────────────
  _setTicker(`<i data-ic="bolt"></i> Routing ${nHops + 2} ISL hops at 100 Gbps laser links…`)

  // Uplink → first relay
  pov(uplink.lat, uplink.lon, 0.8, 1200)
  addArc({
    startLat: uplink.lat, startLng: uplink.lon,
    endLat: hopSats[0].lat, endLng: hopSats[0].lon,
    color: '#00ff88', alt: 0.25, animate: 1400,
  })
  await sleep(1400)

  // Relay hops
  for (let i = 0; i < hopSats.length - 1; i++) {
    pov(hopSats[i].lat, hopSats[i].lon, 0.85, 900)
    if (hopSats[i].inSAA) {
      _setTicker('<i data-ic="warning"></i> Hop entering SAA zone — radiation penalty applied to cost function')
    }
    addArc({
      startLat: hopSats[i].lat,    startLng: hopSats[i].lon,
      endLat:   hopSats[i+1].lat,  endLng:   hopSats[i+1].lon,
      color: hopSats[i].inSAA ? '#ef4444' : '#00ff88',
      alt: 0.28, animate: 1200,
    })
    await sleep(1200)
  }

  // Last relay → DC
  const lastHop = hopSats[hopSats.length - 1]
  pov((lastHop.lat + dc.lat) / 2, (lastHop.lon + dc.lon) / 2, 1.0, 900)
  addArc({
    startLat: lastHop.lat, startLng: lastHop.lon,
    endLat: dc.lat, endLng: dc.lon,
    color: '#f59e0b', alt: 0.25, animate: 1300,
  })
  await sleep(700)

  _addDecision({
    icon: '<i data-ic="bolt"></i>', bg: 'rgba(0,255,136,0.1)', title: `ISL Path: ${nHops + 2} hops`,
    body: policy === 'latency'
      ? 'Shortest hop count. Vacuum ISL 40% faster than terrestrial fiber for intercontinental distances.'
      : saaCross > 0 && policy === 'reliable'
        ? `SAA-crossing hops detected (${saaCross}) — rerouting around radiation zone.`
        : `Path minimises energy + SAA exposure. Cross-plane ISLs disabled above |lat| 60° (pole instability).`,
    hl: `100 Gbps laser ISL · ${saaCross} SAA crossing${saaCross !== 1 ? 's' : ''} ${policy !== 'latency' && saaCross === 0 ? 'avoided ✓' : ''}`,
    hlColor: '#00ff88', step: 4,
  })
  await sleep(600)

  // ── BEAT 5: Compute at DC (3 s) ──────────────────────────────────────
  _setTicker(`<i data-ic="server"></i> Computing at ${dc.dcName} — ${data.service.compute} compute service…`)
  pov(dc.lat, dc.lon, 0.6, 1500)
  await sleep(1500)
  _addDecision({
    icon: '<i data-ic="server"></i>', bg: 'rgba(124,58,237,0.15)', title: `Computing at ${dc.dcName}`,
    body: `Processing <b>${data.service.service}</b> (${data.service.size}) — ${procMs} ms inference delay.${dc.eclipsed ? ' Running on battery — eclipse active.' : ' Powered by direct solar radiation.'}`,
    hl: `T_proc = ${procMs} ms · ${dc.eclipsed ? '<i data-ic="battery"></i> Battery SoC ' + (dc.battery * 100).toFixed(0) + '%' : '<i data-ic="sun"></i> Solar 100%'}`,
    hlColor: '#7c3aed', step: 5,
  })
  await sleep(1800)

  // ── BEAT 6: Gateway selection (4 s) ──────────────────────────────────
  _setTicker(`<i data-ic="globe"></i> Evaluating ${data.allGWs.length} ground gateways — site diversity via weather avoidance…`)
  pov(gw.lat, gw.lon, 1.6, 2000)
  await sleep(700)

  const gwNote = gw.weather === 'clear'
    ? `<b>${gw.name}</b> has clear skies — Ka-band downlink at full capacity.`
    : `<b>${gw.name}</b> scored best despite ${gw.weather} — the ${gw.weather === 'rain' ? '22' : '8'} ms fade still beat the alternatives on total cost.`

  _addDecision({
    icon: '<i data-ic="globe"></i>', bg: 'rgba(16,185,129,0.15)', title: `Gateway: ${gw.name}`,
    body: gwNote,
    hl: `Weather: ${gw.weather === 'clear' ? '<i data-ic="check"></i> Clear skies' : gw.weather === 'rain' ? '<i data-ic="rain"></i> Rain — Ka-band fade' : '<i data-ic="cloud"></i> Cloudy — minor attenuation'}`,
    hlColor: gwWeatherColor(gw.weather), step: 6,
  })
  await sleep(3400)

  // ── BEAT 6b: What history contributed to this decision ───────────────
  // Adaptation has to be observable per request, not just claimed in a panel.
  if (data.adaptive && data.profile?.ready) {
    const p        = data.profile
    const gwPen    = p.gwPenalty[gw.name] ?? 0
    const worstGw  = Object.entries(p.gwPenalty).sort((a, b) => b[1] - a[1])[0]
    const avoided  = worstGw && worstGw[0] !== gw.name && worstGw[1] > 0.2
    const recommend = p.cityBest[city.city]

    _setTicker(`<i data-ic="brain"></i> Applying ${p.sampleN} requests of observed history to this route…`)
    _addDecision({
      icon: '<i data-ic="brain"></i>', bg: 'rgba(124,58,237,0.16)', title: 'Adaptation Applied',
      body: `Learned from <b>${p.sampleN}</b> logged requests. `
          + (avoided
              ? `<b>${worstGw[0]}</b> carries a <b>${worstGw[1].toFixed(2)}</b> observed rain-fade penalty, so it was down-weighted; <b>${gw.name}</b> won instead (penalty ${gwPen.toFixed(2)}).`
              : `<b>${gw.name}</b> carries an observed penalty of <b>${gwPen.toFixed(2)}</b> — low enough that history did not override the geometry here.`)
          + (recommend && recommend !== policy
              ? ` Over this window, <b>${recommend}</b> has delivered the best p95 for ${city.city}.`
              : ''),
      hl: recommend && recommend !== policy
            ? `Recommendation: try ${recommend} for ${city.city}`
            : `History confirmed the ${policy} choice`,
      hlColor: '#a78bfa', step: 7,
    })
    await sleep(2600)
  }

  // ── BEAT 7: Downlink + return (2.5 s) ────────────────────────────────
  _setTicker(`↩ Return path: ${dc.dcName} → ${gw.name} → ${city.city}`)
  pov((dc.lat + gw.lat) / 2, (dc.lon + gw.lon) / 2, 1.3, 1400)

  // DC → gateway arc (return path)
  addArc({
    startLat: dc.lat, startLng: dc.lon,
    endLat: gwSat.lat, endLng: gwSat.lon,
    color: '#f59e0b', alt: 0.3, animate: 1400,
  })
  await sleep(1400)

  addArc({
    startLat: gwSat.lat, startLng: gwSat.lon,
    endLat: gw.lat, endLng: gw.lon,
    color: '#10b981', alt: 0.12, animate: 1000,
  })
  await sleep(600)

  addArc({
    startLat: gw.lat, startLng: gw.lon,
    endLat: city.lat, endLng: city.lon,
    color: '#ffffff', alt: 0.06, animate: 900,
  })
  await sleep(1000)

  // ── BEAT 8: Hero shot + metrics (2.5 s) ──────────────────────────────
  _setTicker(null)  // hide ticker
  pov((city.lat + dc.lat) / 2 * 0.5, (city.lon + dc.lon) / 2, 2.4, 2000)
  await sleep(800)

  const propDelayVac = (data.baseDist / 299792 * 1000).toFixed(2)
  const propDelayFib = (data.baseDist / 203940 * 1000).toFixed(2)
  const saving       = (propDelayFib - propDelayVac).toFixed(1)

  _addDecision({
    icon: '<i data-ic="check"></i>', bg: 'rgba(0,212,255,0.12)', title: 'Request Complete',
    body: `Processed at ${dc.dcName}. Returned via ${gw.name}. Vacuum ISL saved ~${saving} ms vs terrestrial fiber.`,
    hl: `RTT ${rtt} ms · ${stretch <= 0 ? `${Math.abs(stretch)}% faster than fibre` : `${stretch}% slower than fibre`} · ${dc.eclipsed ? '<i data-ic="battery"></i> Battery' : '<i data-ic="sun"></i> Solar'}`,
    hlColor: '#00d4ff', step: 8,
  })

  await sleep(500)

  _setMetrics({
    rtt, nHops, solar: !dc.eclipsed, saaAvoided: data.saaCross === 0,
    baseline, stretch,
    counterfactual: data.counterfactual,
    activePolicy:   policy,
  })

  // Re-enable auto-rotate
  world.controls().autoRotate = true
  world.controls().autoRotateSpeed = 0.18
  seqActive = false
  _onComplete(data)
}

export function skipSequence() {
  if (!seqActive) return
  skipping = true
  clearTimers()   // resolves the in-flight sleep; later sleeps short-circuit on `skipping`
}
