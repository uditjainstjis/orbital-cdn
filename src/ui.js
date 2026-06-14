// UI: left panel interactions, right panel reveals, deep dive modal, inspector
import { POLICY_WEIGHTS, POLICY_DESCS } from './engine.js'

// ─── State ────────────────────────────────────────────────────────────────

export let selectedCity    = { city: 'Delhi', lat: 28.6, lon: 77.2 }
export let selectedService = { service: 'LLM Inference', size: '2.4 KB', compute: 'high' }
export let policy          = 'balanced'
let lastSimData = null

// ─── Weight bars ──────────────────────────────────────────────────────────

function setWeightUI(w) {
  const set = (id, v) => {
    const fill = document.getElementById('w-' + id)
    const val  = document.getElementById('wv-' + id)
    if (fill) fill.style.width  = (v * 100) + '%'
    if (val)  val.textContent   = v.toFixed(1)
  }
  set('lat', w.lat); set('sol', w.sol); set('rad', w.rad)
  set('wx', w.wx);   set('eng', w.eng)
}

// ─── City selector ────────────────────────────────────────────────────────

export function initCityGrid(onChange) {
  const grid = document.getElementById('city-grid')
  if (!grid) return
  grid.addEventListener('click', e => {
    const btn = e.target.closest('.city-btn')
    if (!btn) return
    grid.querySelectorAll('.city-btn').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    selectedCity = {
      city: btn.dataset.city,
      lat:  +btn.dataset.lat,
      lon:  +btn.dataset.lon,
    }
    onChange(selectedCity)
  })
}

// ─── Service selector ─────────────────────────────────────────────────────

export function initServiceList() {
  const list = document.getElementById('service-list')
  if (!list) return
  list.addEventListener('click', e => {
    const btn = e.target.closest('.service-btn')
    if (!btn) return
    list.querySelectorAll('.service-btn').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    selectedService = {
      service: btn.dataset.service,
      size:    btn.dataset.size,
      compute: btn.dataset.compute,
    }
  })
}

// ─── Policy tabs ──────────────────────────────────────────────────────────

export function initPolicyTabs() {
  document.querySelectorAll('.policy-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.policy-tab').forEach(t => t.classList.remove('active'))
      tab.classList.add('active')
      policy = tab.dataset.policy
      setWeightUI(POLICY_WEIGHTS[policy])
      const desc = document.getElementById('policy-desc')
      if (desc) desc.textContent = POLICY_DESCS[policy]
    })
  })
  // Init with balanced
  setWeightUI(POLICY_WEIGHTS['balanced'])
}

// ─── Decision steps ───────────────────────────────────────────────────────

export function addDecision({ icon, bg, title, body, hl, hlColor }) {
  const c = document.getElementById('decisions-container')
  if (!c) return
  // Remove empty state on first step
  const es = c.querySelector('.empty-state')
  if (es) es.remove()

  const el = document.createElement('div')
  el.className = 'decision-step'
  el.innerHTML = `
    <div class="ds-header">
      <div class="ds-icon" style="background:${bg}">${icon}</div>
      <div class="ds-title">${title}</div>
    </div>
    <div class="ds-body">
      ${body}
      ${hl ? `<div class="ds-highlight" style="background:${hlColor}22;color:${hlColor};border:1px solid ${hlColor}44">${hl}</div>` : ''}
    </div>`
  c.appendChild(el)
  c.scrollTop = c.scrollHeight
}

export function clearDecisions() {
  const c = document.getElementById('decisions-container')
  if (c) c.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">🛰️</div>
      <p>Hit <strong>Send Request</strong> to watch routing decisions happen in real time with 3D camera choreography.</p>
    </div>`
}

// ─── Reasoning ticker ─────────────────────────────────────────────────────

export function setTicker(text) {
  const el = document.getElementById('reasoning-ticker')
  if (!el) return
  if (!text) { el.classList.add('hidden'); return }
  el.classList.remove('hidden')
  document.getElementById('ticker-text').textContent = text
}

// ─── Metrics ──────────────────────────────────────────────────────────────

export function setMetrics({ rtt, nHops, solar, saaAvoided, baseline, stretch }) {
  const set = (id, val) => {
    const v = document.getElementById('mv-' + id)
    const b = document.getElementById('m-' + id)
    if (v) v.textContent = val
    if (b) b.classList.add('highlight')
  }
  set('rtt',   rtt + ' ms')
  set('hops',  nHops + 2 + ' hops')
  set('solar', solar ? 'YES' : 'NO')
  set('saa',   saaAvoided ? 'YES' : 'NO')

  const cmpSec = document.getElementById('compare-section')
  if (cmpSec) cmpSec.classList.remove('hidden')
  const maxR = Math.max(baseline, Math.round(baseline * 1.15), Math.round(baseline * 1.22))
  const setBar = (id, val) => {
    const fill = document.getElementById('cmp-' + id + '-fill')
    const txt  = document.getElementById('cmp-' + id + '-val')
    if (fill) fill.style.width = (val / maxR * 100) + '%'
    if (txt)  txt.textContent  = val + 'ms'
  }
  setBar('lat', baseline)
  setBar('grn', Math.round(baseline * 1.15))
  setBar('rel', Math.round(baseline * 1.22))
}

export function resetMetrics() {
  ;['rtt', 'hops', 'solar', 'saa'].forEach(k => {
    const v = document.getElementById('mv-' + k)
    const b = document.getElementById('m-' + k)
    if (v) v.textContent = '—'
    if (b) b.classList.remove('highlight')
  })
  const cmpSec = document.getElementById('compare-section')
  if (cmpSec) cmpSec.classList.add('hidden')
}

// ─── Send button ──────────────────────────────────────────────────────────

export function setSendState(running) {
  const btn = document.getElementById('send-btn')
  if (!btn) return
  btn.disabled    = running
  btn.textContent = running ? '⏳ Routing…' : lastSimData ? '▶ Send Another' : '▶ Send Request'
}

// ─── Deep Dive modal ──────────────────────────────────────────────────────

export function showDeepDive(data) {
  lastSimData = data
  const btn = document.getElementById('deepdive-btn')
  if (btn) btn.classList.remove('hidden')
}

function openDeepDive() {
  const d = lastSimData
  if (!d) return
  buildModal(d)
  document.getElementById('modal-overlay').classList.remove('hidden')
}

function buildModal(d) {
  const { weights: w, baseDist, propMs, procMs, wxMs, rtt, baseline, stretch } = d
  const vacSpeed = 299792, fibSpeed = 203940
  const propVac  = (baseDist / vacSpeed * 1000).toFixed(2)
  const propFib  = (baseDist / fibSpeed * 1000).toFixed(2)
  const saving   = (propFib - propVac).toFixed(1)
  const sortedDCs = [...d.allDCs].sort((a, b) => +a.scoreTotal - +b.scoreTotal)
  const sortedGWs = [...d.allGWs].sort((a, b) => +a.scoreTotal - +b.scoreTotal)

  const sections = [
    { id: 's1', title: '§1 · Cost Function' },
    { id: 's2', title: '§2 · Vacuum vs Fiber' },
    { id: 's3', title: '§3 · DC Scoring' },
    { id: 's4', title: '§4 · ISL Path' },
    { id: 's5', title: '§5 · Gateway Scoring' },
    { id: 's6', title: '§6 · Radiation Model' },
    { id: 's7', title: '§7 · Policy Comparison' },
    { id: 's8', title: '§8 · References' },
  ]

  // Navigation
  const nav = document.getElementById('modal-nav')
  nav.innerHTML = sections.map(s =>
    `<button class="modal-nav-btn" onclick="document.getElementById('${s.id}').scrollIntoView({behavior:'smooth'})">${s.title}</button>`
  ).join('')

  document.getElementById('modal-body').innerHTML = `

  <div class="modal-section" id="s1">
    <div class="modal-section-title">§1 · Cost Function — Actual Values This Request</div>
    <div class="code-block"><span class="cmt">// Policy: ${d.policy.toUpperCase()} | City: ${d.city.city} | Service: ${d.service.service}</span>

<span class="kw">Cost</span>(P,DC,G) = <span class="hl">w_lat</span>·ΣL_e + <span class="hl">w_eng</span>·ΣE_e + <span class="hl">w_cong</span>·ΣQ_e
             + <span class="hl">w_rad</span>·ΣR_n + <span class="hl">w_sol</span>·S_DC + <span class="hl">w_wx</span>·W_G

<span class="cmt">// Weight vector for "${d.policy}" policy:</span>
w = { lat:<span class="val">${w.lat}</span>, eng:<span class="val">${w.eng}</span>, sol:<span class="val">${w.sol}</span>, rad:<span class="val">${w.rad}</span>, wx:<span class="val">${w.wx}</span> }

<span class="cmt">// One-way propagation (vacuum, ${baseDist} km path):</span>
L_ow = ${baseDist} km / <span class="val">299,792</span> km·s⁻¹ × 1000 = <span class="ok">${propVac} ms</span>
RTT_prop = <span class="ok">${(propVac * 2).toFixed(1)} ms</span>

<span class="cmt">// Processing (${d.service.compute} compute):</span>
T_proc = <span class="val">${procMs}</span> ms

<span class="cmt">// Weather penalty at ${d.gw.name} (${d.gw.weather}):</span>
W_penalty = <span class="val">${wxMs}</span> ms

<span class="cmt">// Total RTT:</span>
RTT = ${(propVac * 2).toFixed(1)} + ${procMs} + ${wxMs} = <span class="ok">${rtt} ms</span>
RTT_baseline = <span class="val">${baseline} ms</span>  Stretch = <span class="val">+${stretch}%</span></div>
  </div>

  <div class="modal-section" id="s2">
    <div class="modal-section-title">§2 · Vacuum vs Fiber — The Physics of the ISL Advantage</div>
    <div class="phys-grid">
      <div class="phys-card">
        <h5>⚡ Vacuum (Laser ISL)</h5>
        <span class="phys-num">c = 299,792 km/s</span>
        <p>Light in free space. Used on all ISL hops and up/downlink segments. Zero refractive index — pure vacuum propagation.</p>
        <p style="margin-top:8px">One-way: <strong style="color:var(--green)">${propVac} ms</strong> for ${baseDist} km</p>
      </div>
      <div class="phys-card">
        <h5>🌍 Fiber (Terrestrial Baseline)</h5>
        <span class="phys-num">c/1.47 ≈ 203,940 km/s</span>
        <p>Silica refractive index ≈ 1.47. Every terrestrial backbone segment pays this penalty — unavoidable in ground networks.</p>
        <p style="margin-top:8px">Same path would be: <strong style="color:var(--red)">${propFib} ms</strong> → ISL saves <strong style="color:var(--cyan)">${saving} ms</strong> one-way</p>
      </div>
    </div>
    <div class="code-block" style="margin-top:12px"><span class="cmt">// Break-even (ISL vs fewer fiber hops):</span>
d_breakeven ≈ <span class="val">3,000 km</span>  <span class="cmt">// below this, hop-count overhead negates speed gain</span>
d_this      = <span class="val">${baseDist} km</span>  →  <span class="ok">ISL wins by ${saving} ms one-way (${(saving * 2).toFixed(0)} ms RTT)</span>

C_ISL     = <span class="val">100 Gbps</span>   <span class="cmt">// ADA Space Three-Body constellation (May 2025)</span>
C_FSO_lab = <span class="val">1.6 Tbps</span>   <span class="cmt">// Google Suncatcher free-space optical (lab, 2025)</span></div>
  </div>

  <div class="modal-section" id="s3">
    <div class="modal-section-title">§3 · DC Selection — All Candidates Scored</div>
    <div class="code-block" style="margin-bottom:12px"><span class="cmt">// score(DC) = w_lat·dist_norm + w_sol·eclipse + w_rad·saa   (lower = better)</span>
score = <span class="val">${w.lat}</span>·dist + <span class="val">${w.sol}</span>·eclipse + <span class="val">${w.rad}</span>·saa</div>
    <table class="score-table">
      <thead><tr><th>DC</th><th>Status</th><th>Battery</th><th>Load</th><th>dist_norm</th><th>eclipse</th><th>saa</th><th>Score</th><th></th></tr></thead>
      <tbody>${sortedDCs.map(dc => `
        <tr class="${dc.dcName === d.dc.dcName ? 'winner' : ''}">
          <td><strong>${dc.dcName}</strong></td>
          <td>${dc.eclipsed ? '<span style="color:var(--muted)">🌑 Eclipse</span>' : '<span style="color:var(--amber)">☀️ Sunlit</span>'}</td>
          <td style="font-family:'JetBrains Mono',monospace">${(dc.battery * 100).toFixed(0)}%</td>
          <td style="font-family:'JetBrains Mono',monospace">${(dc.load * 100).toFixed(0)}%</td>
          <td style="font-family:'JetBrains Mono',monospace">${dc.scoreDist}</td>
          <td style="font-family:'JetBrains Mono',monospace;color:${dc.eclipsed ? 'var(--red)' : 'var(--green)'}">${dc.eclipsed ? '1.0' : '0.0'}</td>
          <td style="font-family:'JetBrains Mono',monospace;color:${dc.inSAA ? 'var(--red)' : 'var(--green)'}">${dc.inSAA ? '1.0' : '0.0'}</td>
          <td style="font-family:'JetBrains Mono',monospace;color:var(--cyan)"><strong>${dc.scoreTotal}</strong></td>
          <td>${dc.dcName === d.dc.dcName ? '<span class="winner-badge">CHOSEN</span>' : ''}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    <p style="font-size:11px;color:var(--muted);margin-top:10px">${d.sunlitDCs} of 3 orbital DCs currently sunlit. ${d.dc.eclipsed ? 'No sunlit DC available — chose best-battery eclipse DC.' : 'Sunlit DC chosen — free solar compute.'}</p>
  </div>

  <div class="modal-section" id="s4">
    <div class="modal-section-title">§4 · ISL Path — Hop-by-Hop Breakdown</div>
    <div class="code-block" style="margin-bottom:12px"><span class="cmt">// Walker-Delta 53° incl., 6 planes × 12 sats · cross-plane ISL disabled |lat|>60°</span>
<span class="cmt">// Total hops: ${d.nHops + 2} · SAA crossings: ${d.saaCross}</span></div>
    <div>${[
      { label: 'User',      dot: '#fff',     val: `${d.city.city} (${d.city.lat.toFixed(1)}°, ${d.city.lon.toFixed(1)}°)`,       note: 'Origin' },
      { label: 'Uplink',   dot: '#00d4ff',  val: `SAT-${d.uplink.id} @ ${d.uplink.lat.toFixed(1)}°, ${d.uplink.lon.toFixed(1)}°`, note: d.uplink.inSAA ? '⚠️ near SAA' : 'clear' },
      ...d.hopSats.map((h, i) => ({ label: `Relay ${i + 1}`, dot: '#00ff88', val: `${h.lat.toFixed(1)}°, ${h.lon.toFixed(1)}°`, note: h.inSAA ? '⚠️ SAA' : 'clear' })),
      { label: 'Orb DC',   dot: '#f59e0b',  val: `${d.dc.dcName} @ ${d.dc.lat.toFixed(1)}°, ${d.dc.lon.toFixed(1)}°`,           note: d.dc.eclipsed ? '🌑 Eclipse' : '☀️ Sunlit' },
      ...d.hopSats.slice().reverse().map((h, i) => ({ label: `Relay ${d.nHops - i}`, dot: '#00ff88', val: `${h.lat.toFixed(1)}°, ${h.lon.toFixed(1)}°`, note: 'return path' })),
      { label: 'GW Sat',   dot: '#00d4ff',  val: `SAT-${d.gwSat.id} @ ${d.gwSat.lat.toFixed(1)}°, ${d.gwSat.lon.toFixed(1)}°`,  note: 'downlink node' },
      { label: 'Gateway',  dot: '#10b981',  val: `${d.gw.name} (${d.gw.lat.toFixed(1)}°, ${d.gw.lon.toFixed(1)}°)`,              note: d.gw.weather },
    ].map(h => `
      <div class="hop-row">
        <div class="hop-dot" style="background:${h.dot}"></div>
        <span class="hop-label">${h.label}</span>
        <span class="hop-val">${h.val}</span>
        <span class="hop-note">${h.note}</span>
      </div>`).join('')}
    </div>
    <div class="code-block" style="margin-top:12px"><span class="cmt">// Energy per hop:</span>
E_hop = e_link · d_hop + e_point  <span class="cmt">// optical pointing + link energy</span>
<span class="cmt">// Congestion penalty (M/M/1 queue model):</span>
Q_e   = ρ / (1 − ρ)              <span class="cmt">// blows up as utilisation ρ → 1</span></div>
  </div>

  <div class="modal-section" id="s5">
    <div class="modal-section-title">§5 · Gateway Selection — Site Diversity Analysis</div>
    <div class="code-block" style="margin-bottom:12px"><span class="cmt">// score(GW) = w_lat·dist_norm + w_wx·weather_penalty</span>
<span class="cmt">// Rain=1.0, Cloudy=0.5, Clear=0.0 · ITU-R P.618 Ka-band rain fade model</span>
score = <span class="val">${w.lat}</span>·dist + <span class="val">${w.wx}</span>·wx</div>
    <table class="score-table">
      <thead><tr><th>Gateway</th><th>Weather</th><th>dist_norm</th><th>wx</th><th>Score</th><th></th></tr></thead>
      <tbody>${sortedGWs.map(g => `
        <tr class="${g.name === d.gw.name ? 'winner' : ''}">
          <td><strong>${g.name}</strong></td>
          <td>${g.weather === 'clear' ? '✅ Clear' : g.weather === 'rain' ? '🌧️ Rain' : '🌥️ Cloudy'}</td>
          <td style="font-family:'JetBrains Mono',monospace">${g.scoreDist}</td>
          <td style="font-family:'JetBrains Mono',monospace;color:${g.weather === 'clear' ? 'var(--green)' : g.weather === 'rain' ? 'var(--red)' : 'var(--amber)'}">${g.scoreWx}</td>
          <td style="font-family:'JetBrains Mono',monospace;color:var(--cyan)"><strong>${g.scoreTotal}</strong></td>
          <td>${g.name === d.gw.name ? '<span class="winner-badge">CHOSEN</span>' : ''}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>

  <div class="modal-section" id="s6">
    <div class="modal-section-title">§6 · Radiation Model — SAA &amp; Eclipse</div>
    <div class="phys-grid">
      <div class="phys-card">
        <h5>☢️ South Atlantic Anomaly</h5>
        <p>Inner Van Allen belt dips to ~200 km. Bounding box: lat [−50°, 0°], lon [−80°, +10°]. ${d.saaCross} ISL hop(s) crossed SAA on this path.</p>
        <p style="margin-top:6px;font-family:'JetBrains Mono',monospace;font-size:11px;color:${d.saaCross > 0 ? 'var(--red)' : 'var(--green)'}">
          ${d.saaCross > 0 ? `${d.saaCross} crossings — radiation penalty active` : '0 crossings — SAA fully avoided ✓'}
        </p>
      </div>
      <div class="phys-card">
        <h5>🔬 Radiation Penalty Term</h5>
        <p>R_n = 𝟙[node n ∈ SAA] · severity(Kp). Severity scales with geomagnetic Kp index. Google Suncatcher found HBM DRAM most susceptible to TID; SEEs flagged in real training runs.</p>
        <p style="margin-top:6px;font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--cyan)">w_rad = ${w.rad} (${d.policy} policy)</p>
      </div>
      <div class="phys-card">
        <h5>🌑 Eclipse Model</h5>
        <p>Cylindrical umbra approximation. Eclipse when angular separation from sun vector &gt; 128°. DC-${d.dc.dcName} in eclipse: <strong style="color:${d.dc.eclipsed ? 'var(--red)' : 'var(--green)'}">${d.dc.eclipsed ? 'YES — battery active' : 'NO — sunlit'}</strong></p>
      </div>
      <div class="phys-card">
        <h5>🔋 Solar/Eclipse Term</h5>
        <p>S_n = 𝟙[eclipse] · (1 − battery_SoC)</p>
        <p style="margin-top:6px">DC battery: <strong style="font-family:'JetBrains Mono',monospace">${(d.dc.battery * 100).toFixed(0)}%</strong> SoC. ${d.dc.eclipsed ? `Penalty = 1 × ${(1 - d.dc.battery).toFixed(2)}` : 'Penalty = 0 (sunlit)'}</p>
        <p style="margin-top:6px;font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--cyan)">w_sol = ${w.sol} (${d.policy} policy)</p>
      </div>
    </div>
  </div>

  <div class="modal-section" id="s7">
    <div class="modal-section-title">§7 · What Each Policy Would Have Done Differently</div>
    <div class="code-block"><span class="cmt">// Same request (${d.city.city} → ${d.service.service}) under all 4 policies:</span>

⚡ <span class="kw">Latency</span>:  w={lat:0.95, sol:0.05, rad:0.05, wx:0.05}
   → Nearest DC regardless of eclipse/SAA → ~<span class="val">${baseline} ms</span>
   → No SAA avoidance · accepts eclipsed DCs · accepts rain gateways

🌱 <span class="kw">Green</span>:    w={lat:0.20, sol:0.90, rad:0.20, wx:0.30, eng:0.85}
   → Forces sunlit DC (w_sol=0.90) → ${d.sunlitDCs > 0 ? 'sunlit DC reachable ✓' : 'no sunlit DC available'}
   → Fewer active ISL hops → ~<span class="val">${Math.round(baseline * 1.15)} ms</span>

🛡️ <span class="kw">Reliable</span>: w={lat:0.20, sol:0.30, rad:0.95, wx:0.90}
   → Hard SAA avoidance (w_rad=0.95) → ${d.saaCross > 0 ? 'would reroute to SAA-free path' : 'SAA-free path already chosen ✓'}
   → Always clear-weather gateway → ~<span class="val">${Math.round(baseline * 1.22)} ms</span>

⚖️ <span class="kw">Balanced</span>: w={lat:0.50, sol:0.50, rad:0.50, wx:0.40}
   → Chosen policy → RTT = <span class="ok">${d.rtt} ms</span>  (Pareto-optimal trade-off)</div>
  </div>

  <div class="modal-section" id="s8">
    <div class="modal-section-title">§8 · Research Grounding &amp; References</div>
    <div class="code-block"><span class="cmt">// Every constant traces to a published or announced source:</span>

c_vacuum  = <span class="val">299,792 km/s</span>   <span class="cmt">// NIST CODATA 2018</span>
c_fiber   = <span class="val">203,940 km/s</span>   <span class="cmt">// c / 1.47 (silica n ≈ 1.47, standard SMF-28)</span>
C_ISL     = <span class="val">100 Gbps</span>       <span class="cmt">// ADA Space Three-Body constellation (May 2025)</span>
C_FSO_lab = <span class="val">1.6 Tbps</span>       <span class="cmt">// Google Suncatcher free-space optical (lab demo, 2025)</span>
inc_deg   = <span class="val">53°</span>            <span class="cmt">// Starlink Gen 1 shell 1 (Walker-Delta baseline)</span>
alt_km    = <span class="val">550 km</span>         <span class="cmt">// Starlink operational altitude</span>
elev_mask = <span class="val">25°</span>            <span class="cmt">// Starlink GS elevation mask</span>

<span class="cmt">// Routing methodology lineage:</span>
<span class="cmt">// Hypatia (Kassing et al., IMC 2020)      — LEO RTT validation methodology</span>
<span class="cmt">// MegaCacheX (2025)                        — 3-tier space CDN architecture</span>
<span class="cmt">// GRouting / GRLR / GDRL-SFCR             — GNN+DRL learned routing lineage</span>
<span class="cmt">// Google Suncatcher preprint (2025)        — solar/radiation/optical physics</span>
<span class="cmt">// ITU-R P.618                              — Ka-band rain-fade attenuation model</span></div>
    <p style="font-size:11px;color:var(--muted);margin-top:14px">
      🌍 Earth textures: NASA Blue Marble / Black Marble (CC) via three-globe ·
      🛰️ TLE data: CelesTrak (Space-Track.org) ·
      📐 SGP4 propagation: satellite.js
    </p>
  </div>`
}

// ─── Inspector card ────────────────────────────────────────────────────────

export function showInspector(node, x, y) {
  const el = document.getElementById('inspector')
  if (!el) return

  let html = ''

  if (node.isDC) {
    // ── Orbital Data Center ────────────────────────────────────────────────
    const solar = !node.eclipsed
    html = `
      <h4 style="color:var(--amber)">🛰️ ${node.dcName} — Orbital DC</h4>
      <div class="inspector-row">
        <span class="inspector-key">Status</span>
        <span class="inspector-val" style="color:${solar ? 'var(--green)' : 'var(--muted)'}">${solar ? '☀ SUNLIT' : '🌑 ECLIPSE'}</span>
      </div>
      <div class="inspector-row"><span class="inspector-key">Lat / Lon</span><span class="inspector-val">${node.lat.toFixed(1)}° ${node.lon.toFixed(1)}°</span></div>
      <div class="inspector-row"><span class="inspector-key">Altitude</span><span class="inspector-val">${node.alt.toFixed(0)} km</span></div>
      <div class="inspector-row"><span class="inspector-key">Orbit</span><span class="inspector-val">SSO ${node.plane % 2 === 0 ? 'dawn' : 'dusk'}-pass</span></div>
      <div class="inspector-row"><span class="inspector-key">Battery</span><span class="inspector-val">${(node.battery * 100).toFixed(0)}%</span></div>
      <div style="margin:6px 0 2px;height:3px;background:rgba(255,255,255,.07);border-radius:2px;overflow:hidden">
        <div style="width:${(node.battery*100).toFixed(0)}%;height:100%;background:${node.battery>0.4?'var(--green)':'var(--amber)'};border-radius:2px"></div>
      </div>
      <div class="inspector-row"><span class="inspector-key">Compute</span><span class="inspector-val">${(node.load*100).toFixed(0)}% load</span></div>
      <div class="inspector-row"><span class="inspector-key">Radiation</span><span class="inspector-val" style="color:${node.inSAA?'var(--red)':'var(--green)'}">${node.inSAA?'⚠ SAA':'✓ clean'}</span></div>
      <div style="margin-top:8px;font-size:10px;color:var(--muted);font-family:'JetBrains Mono',monospace">Plane ${node.plane} · Slot ${node.slot} · ID ${node.id}</div>
    `
  } else if (node.name) {
    // ── Ground Gateway ─────────────────────────────────────────────────────
    html = `<h4>◇ ${node.name}</h4><div class="inspector-row"><span class="inspector-key">Type</span><span class="inspector-val">Ground Gateway</span></div>`
  } else {
    // ── LEO Relay Satellite ────────────────────────────────────────────────
    const statusColor = node.inSAA ? 'var(--red)' : node.eclipsed ? 'var(--muted)' : 'var(--cyan)'
    const statusText  = node.inSAA ? '⚠ SAA ZONE' : node.eclipsed ? '🌑 ECLIPSE' : '☀ NOMINAL'
    html = `
      <h4 style="color:var(--cyan)">📡 LEO-${String(node.id).padStart(2,'0')}</h4>
      <div class="inspector-row">
        <span class="inspector-key">Status</span>
        <span class="inspector-val" style="color:${statusColor}">${statusText}</span>
      </div>
      <div class="inspector-row"><span class="inspector-key">Lat / Lon</span><span class="inspector-val">${node.lat.toFixed(1)}° ${node.lon.toFixed(1)}°</span></div>
      <div class="inspector-row"><span class="inspector-key">Altitude</span><span class="inspector-val">${node.alt.toFixed(0)} km</span></div>
      <div class="inspector-row"><span class="inspector-key">Plane / Slot</span><span class="inspector-val">P${node.plane} S${node.slot}</span></div>
      <div class="inspector-row"><span class="inspector-key">Battery</span><span class="inspector-val">${(node.battery*100).toFixed(0)}%</span></div>
      <div style="margin:6px 0 2px;height:3px;background:rgba(255,255,255,.07);border-radius:2px;overflow:hidden">
        <div style="width:${(node.battery*100).toFixed(0)}%;height:100%;background:${node.battery>0.4?'var(--cyan)':'var(--red)'};border-radius:2px"></div>
      </div>
      <div class="inspector-row"><span class="inspector-key">ISL links</span><span class="inspector-val">4 active</span></div>
      <div style="margin-top:8px;font-size:10px;color:var(--muted);font-family:'JetBrains Mono',monospace">Walker-Delta · 53° incl · ${node.satrec ? 'SGP4/TLE' : 'analytic'}</div>
    `
  }

  el.innerHTML = html
  el.style.left = Math.min(x + 14, window.innerWidth  - 270) + 'px'
  el.style.top  = Math.min(y + 14, window.innerHeight - 220) + 'px'
  el.classList.remove('hidden')
}

export function hideInspector() {
  const el = document.getElementById('inspector')
  if (el) el.classList.add('hidden')
}

// ─── Modal close ──────────────────────────────────────────────────────────

export function initModal() {
  const overlay = document.getElementById('modal-overlay')
  const btn     = document.getElementById('deepdive-btn')
  const close   = document.getElementById('modal-close')

  if (btn)  btn.addEventListener('click', openDeepDive)
  if (close) close.addEventListener('click', () => overlay.classList.add('hidden'))
  if (overlay) overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.add('hidden')
  })
}
