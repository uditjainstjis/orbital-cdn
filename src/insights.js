// Architecture & Insights page — full technical explanation of Orbital CDN

const SECTIONS = [
  {
    id: 'overview',
    icon: '◎',
    label: 'System Overview',
    render: () => `
      <div class="ins-section-eyebrow">Architecture</div>
      <h2 class="ins-section-title">Orbital CDN — "Cloudflare for Space"</h2>
      <p class="ins-section-sub">
        A three-tier infrastructure that routes requests through Low Earth Orbit satellites instead of terrestrial fiber,
        cutting end-to-end latency by 30–40% for intercontinental traffic while keeping compute solar-powered and radiation-hardened.
      </p>

      <div class="arch-diagram">
        <div class="arch-tier">
          <div class="arch-tier-label">Tier 3</div>
          <div class="arch-tier-body tier-ground">
            <div class="arch-node"><span class="arch-node-icon">🌐</span>Origin City</div>
            <div class="arch-node"><span class="arch-node-icon">◇</span>Ground Gateway</div>
            <div class="arch-node"><span class="arch-node-icon">◇</span>Destination</div>
          </div>
        </div>
        <div class="arch-tier-connector">↕ Radio Link (Ka/Ku-band)</div>
        <div class="arch-tier">
          <div class="arch-tier-label">Tier 2</div>
          <div class="arch-tier-body tier-orbit">
            <div class="arch-node highlight"><span class="arch-node-icon">🛰️</span>LEO Satellite Mesh</div>
            <div class="arch-node"><span class="arch-node-icon">—</span>ISL: Inter-Satellite Links</div>
            <div class="arch-node"><span class="arch-node-icon">📡</span>Walker-Delta 72-sat</div>
          </div>
        </div>
        <div class="arch-tier-connector">↕ Optical/RF Feeder</div>
        <div class="arch-tier">
          <div class="arch-tier-label">Tier 1</div>
          <div class="arch-tier-body tier-space">
            <div class="arch-node highlight"><span class="arch-node-icon">🖥️</span>Orbital DC (SSO ~600 km)</div>
            <div class="arch-node"><span class="arch-node-icon">☀️</span>Solar-Powered</div>
            <div class="arch-node"><span class="arch-node-icon">🔒</span>Radiation-Hardened</div>
          </div>
        </div>
      </div>

      <div class="ins-cards">
        <div class="ins-card">
          <div class="ins-card-icon">🛰️</div>
          <div class="ins-card-title">72 LEO Satellites</div>
          <div class="ins-card-body">Walker-Delta at 550 km, 53° inclination. 6 orbital planes × 12 satellites. Inter-Satellite Links form a mesh backbone above the atmosphere.</div>
        </div>
        <div class="ins-card">
          <div class="ins-card-icon">🖥️</div>
          <div class="ins-card-title">3 Orbital DCs</div>
          <div class="ins-card-body">Sun-Synchronous Orbit at ~600 km in dawn-dusk configuration. Permanently lit, solar-powered, low thermal cycling vs circular LEO.</div>
        </div>
        <div class="ins-card">
          <div class="ins-card-icon">◇</div>
          <div class="ins-card-title">8 Ground Gateways</div>
          <div class="ins-card-body">Singapore, Mumbai, Frankfurt, Virginia, Tokyo, São Paulo, Sydney, Lagos. Weather and cloud cover tracked per gateway in real-time.</div>
        </div>
        <div class="ins-card">
          <div class="ins-card-icon">⚡</div>
          <div class="ins-card-title">30–40% Faster</div>
          <div class="ins-card-body">Light travels 33% faster in vacuum than through silica fiber (c vs ~0.67c). For London → Tokyo, that saves ~45 ms RTT vs undersea cable.</div>
        </div>
      </div>
    `,
  },

  {
    id: 'physics',
    icon: '⚡',
    label: 'Physics of Speed',
    render: () => `
      <div class="ins-section-eyebrow">Fundamental Advantage</div>
      <h2 class="ins-section-title">Why Vacuum Beats Fiber</h2>
      <p class="ins-section-sub">
        The core thesis of Orbital CDN is physical: the speed of light in a vacuum is 299,792 km/s,
        while optical fiber achieves only ~200,000 km/s due to the glass refractive index (~1.5).
        That 33% gap compounds across every intercontinental hop.
      </p>

      <div class="ins-cards">
        <div class="ins-card">
          <span class="ins-card-num">299,792</span>
          <div class="ins-card-title">km/s in vacuum</div>
          <div class="ins-card-body">Speed of light in free space. Every microsecond of propagation = 300 meters traveled.</div>
        </div>
        <div class="ins-card">
          <span class="ins-card-num">~200,000</span>
          <div class="ins-card-title">km/s in fiber</div>
          <div class="ins-card-body">Silica fiber refractive index ≈ 1.47 slows photons to ~68% of c. Plus fiber takes longer routes (undersea cables follow shipping lanes).</div>
        </div>
        <div class="ins-card">
          <span class="ins-card-num">~45 ms</span>
          <div class="ins-card-title">RTT saved London↔Tokyo</div>
          <div class="ins-card-body">London–Tokyo great-circle = 9,560 km. Fiber RTT ≈ 245 ms. Space route via 4 ISL hops ≈ 200 ms. Net gain ≈ 45 ms per round-trip.</div>
        </div>
        <div class="ins-card">
          <span class="ins-card-num">1,340 km</span>
          <div class="ins-card-title">Uplink + downlink budget</div>
          <div class="ins-card-body">~600 km uplink to LEO relay + ~600 km to orbital DC + ~140 km slant range overhead. Total vertical travel = 1,340 km vs ~0 km for fiber.</div>
        </div>
      </div>

      <div class="ins-equation">
        <span class="eq-label">Propagation latency formula</span>
        <div class="eq-main">
          t_prop = <span class="eq-term">d_total</span> / <span class="eq-weight">c_medium</span>
        </div>
        <br/>
        <div class="eq-cmt">// vacuum path: d ≈ 6000 + N_hops × 1200 km (uplink + ISL mesh + downlink)</div>
        <div class="eq-cmt">// fiber path:  d ≈ great_circle × 1.25 (cable detour factor) / 0.67c</div>
      </div>

      <p class="ins-section-sub" style="margin-top:20px">
        The 1.25× fiber detour factor accounts for undersea cables routing via relay stations, coastal geography,
        and cable landing points rather than straight great-circle paths.
        Orbital CDN eliminates this detour: laser ISLs route along geodesics between satellites, effectively straight-line vacuum paths.
      </p>
    `,
  },

  {
    id: 'orbital',
    icon: '🛰️',
    label: 'Orbital Mechanics',
    render: () => `
      <div class="ins-section-eyebrow">Satellite Constellation</div>
      <h2 class="ins-section-title">Walker-Delta & SGP4 Propagation</h2>
      <p class="ins-section-sub">
        The 72-satellite constellation uses a Walker-Delta pattern — a mathematically optimal shell that gives
        near-uniform global coverage. Real-time positions are computed via the SGP4/SDP4 propagator using
        TLE (Two-Line Element) sets fetched live from CelesTrak.
      </p>

      <div class="ins-cards">
        <div class="ins-card">
          <div class="ins-card-icon">🔵</div>
          <div class="ins-card-title">Walker-Delta 72/6/1</div>
          <div class="ins-card-body">72 sats in 6 orbital planes, 12 per plane. 53° inclination. Phasing offset (F=1) spreads sats evenly in RAAN for gap-free coverage between ±80° latitude.</div>
        </div>
        <div class="ins-card">
          <div class="ins-card-icon">📡</div>
          <div class="ins-card-title">TLE + SGP4</div>
          <div class="ins-card-body">Two-Line Elements from CelesTrak give epoch state vectors. SGP4 (Simplified General Perturbations 4) propagates forward accounting for J2 oblateness, drag, and solar radiation pressure.</div>
        </div>
        <div class="ins-card">
          <div class="ins-card-icon">☀️</div>
          <div class="ins-card-title">SSO Dawn-Dusk</div>
          <div class="ins-card-body">Orbital DCs use sun-synchronous 97.8° retrograde orbit, always crossing terminator at 06:00/18:00 local solar time. Permanent solar exposure eliminates eclipse-cycle power cycling.</div>
        </div>
        <div class="ins-card">
          <div class="ins-card-icon">—</div>
          <div class="ins-card-title">ISL Mesh</div>
          <div class="ins-card-body">Each satellite maintains 4 Inter-Satellite Links: +/− along-track neighbors plus ±1 cross-plane. Cross-plane ISLs disabled above |lat|>60° where geometry degrades (polar convergence).</div>
        </div>
      </div>

      <div class="ins-equation">
        <span class="eq-label">SGP4 state propagation (simplified)</span>
        <div class="eq-main">
          r(t) = <span class="eq-term">SGP4</span>( <span class="eq-weight">satrec</span>, Δt ) → ECI → <span class="eq-term">geodetic</span>( lat, lon, alt )
        </div>
        <br/>
        <div class="eq-cmt">// satrec = twoline2satrec(TLE line1, TLE line2)     — parsed epoch + orbital elements</div>
        <div class="eq-cmt">// ECI    = Earth-Centered Inertial frame position    — km from geocenter</div>
        <div class="eq-cmt">// gmst   = Greenwich Mean Sidereal Time (rotates with Earth)</div>
        <div class="eq-cmt">// geodetic converts ECI → [lat, lon, alt] via GMST rotation matrix</div>
      </div>
    `,
  },

  {
    id: 'cost',
    icon: '⚙️',
    label: 'Cost Function',
    render: () => `
      <div class="ins-section-eyebrow">Decision Engine</div>
      <h2 class="ins-section-title">6-Term Routing Cost Function</h2>
      <p class="ins-section-sub">
        Every routing decision minimizes a multi-objective cost function C(P, DC, G) across all candidate
        paths P, Orbital DCs, and Ground Gateways G. The six terms capture latency, solar fraction,
        congestion, radiation exposure, solar power of the DC, and weather at the gateway.
      </p>

      <div class="ins-equation">
        <span class="eq-label">Cost function — full form</span>
        <div class="eq-main">
          C(P, DC, G) =
          <span class="eq-weight">w_lat</span> · <span class="eq-term">Σ L_e</span>
          + <span class="eq-weight">w_eng</span> · <span class="eq-term">Σ E_e</span>
          + <span class="eq-weight">w_cong</span> · <span class="eq-term">Σ Q_e</span>
          + <span class="eq-weight">w_rad</span> · <span class="eq-term">Σ R_n</span>
          + <span class="eq-weight">w_sol</span> · <span class="eq-term">S_DC</span>
          + <span class="eq-weight">w_wx</span> · <span class="eq-term">W_G</span>
        </div>
        <br/>
        <div class="eq-cmt">// L_e  = normalized edge latency per hop     (lower = better vacuum path)</div>
        <div class="eq-cmt">// E_e  = edge energy cost                    (laser ISL &lt; radio &lt; fiber)</div>
        <div class="eq-cmt">// Q_e  = queue depth / congestion penalty    (0 if ISL bandwidth &gt; 90% util)</div>
        <div class="eq-cmt">// R_n  = per-node radiation dose (SAA penalty = +2.0 if node in SAA bbox)</div>
        <div class="eq-cmt">// S_DC = 0 if DC eclipsed, 1 if DC sunlit    (reward solar-powered compute)</div>
        <div class="eq-cmt">// W_G  = 0 clear, 0.5 cloudy, 1.0 rain/snow  (Ka-band rain fade penalty)</div>
      </div>

      <p class="ins-section-sub">
        The six weight vectors are tuned per routing policy. Argmin across all DC candidates picks the optimal orbital data center.
        Gateway selection uses a second argmin on <span style="color:var(--cyan);font-family:JetBrains Mono">w_wx·W_G + w_lat·lat_to_gateway</span>.
      </p>

      <div class="ins-cards">
        <div class="ins-card">
          <div class="ins-card-icon">🌊</div>
          <div class="ins-card-title">South Atlantic Anomaly</div>
          <div class="ins-card-body">SAA bounding box lat [−50,0]° lon [−80,10]°. Nodes inside receive +2.0 radiation penalty (R_n). The router avoids this zone unless no alternative path exists.</div>
        </div>
        <div class="ins-card">
          <div class="ins-card-icon">🌑</div>
          <div class="ins-card-title">Eclipse Penalty</div>
          <div class="ins-card-body">Cylindrical umbra model: DC eclipsed if angular separation from sub-solar point > 128°. S_DC = 0 forces the router toward sunlit DCs for uninterrupted solar power.</div>
        </div>
        <div class="ins-card">
          <div class="ins-card-icon">🌧️</div>
          <div class="ins-card-title">Ka-Band Rain Fade</div>
          <div class="ins-card-body">Ka-band signals (26.5–40 GHz) attenuate 5–15 dB/km in heavy rain. W_G = 1.0 in rain makes "Reliable" policy avoid wet gateways and prefer clear-sky downlinks.</div>
        </div>
        <div class="ins-card">
          <div class="ins-card-icon">☀️</div>
          <div class="ins-card-title">Solar Compute Bonus</div>
          <div class="ins-card-body">Sunlit DCs run on photovoltaic panels. S_DC = 1 gives a cost reduction under "Green" policy (w_sol = 0.9), prioritizing renewable orbital compute over battery-backed eclipse ops.</div>
        </div>
      </div>
    `,
  },

  {
    id: 'policies',
    icon: '⚖️',
    label: 'Routing Policies',
    render: () => `
      <div class="ins-section-eyebrow">Policy Engine</div>
      <h2 class="ins-section-title">Four Adaptive Routing Policies</h2>
      <p class="ins-section-sub">
        The same cost function is re-weighted by policy to optimize for different operator goals.
        A real-time CDN might use Latency; a sustainability-focused cloud might use Green; a financial
        clearinghouse requiring 99.999% uptime would choose Reliable.
      </p>

      <table class="ins-table">
        <thead>
          <tr>
            <th>Policy</th>
            <th>Primary Goal</th>
            <th>w_lat</th>
            <th>w_sol</th>
            <th>w_rad</th>
            <th>w_wx</th>
            <th>w_eng</th>
            <th>Ideal Workload</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><span class="ins-tag tag-cyan">⚡ Latency</span></td>
            <td>Min RTT</td>
            <td style="color:var(--cyan)">0.95</td><td>0.05</td><td>0.05</td><td>0.05</td><td>0.05</td>
            <td>Real-time gaming, HFT, streaming</td>
          </tr>
          <tr>
            <td><span class="ins-tag tag-amber">⚖️ Balanced</span></td>
            <td>All-round</td>
            <td>0.50</td><td>0.50</td><td>0.50</td><td>0.40</td><td>0.40</td>
            <td>LLM inference, general APIs</td>
          </tr>
          <tr>
            <td><span class="ins-tag tag-green">🌱 Green</span></td>
            <td>Solar compute</td>
            <td>0.20</td><td style="color:var(--green)">0.90</td><td>0.20</td><td>0.30</td><td style="color:var(--green)">0.85</td>
            <td>Batch ML training, archival</td>
          </tr>
          <tr>
            <td><span class="ins-tag tag-red">🛡️ Reliable</span></td>
            <td>Min failure risk</td>
            <td>0.20</td><td>0.30</td><td style="color:var(--red)">0.95</td><td style="color:var(--red)">0.90</td><td>0.20</td>
            <td>Financial settlement, mission-critical</td>
          </tr>
        </tbody>
      </table>

      <p class="ins-section-sub" style="margin-top:24px">
        Weight sensitivity analysis shows that the Latency–Reliable crossover occurs at w_rad ≈ 0.6.
        Below this threshold, the router tolerates mild SAA exposure to shave 8–15 ms RTT; above it,
        the SAA +2.0 penalty makes any SAA-adjacent path unconditionally sub-optimal.
      </p>

      <div class="ins-cards" style="margin-top:4px">
        <div class="ins-card">
          <div class="ins-card-icon">⚡</div>
          <div class="ins-card-title">Latency mode</div>
          <div class="ins-card-body">w_lat = 0.95 dominates. The router will cross the SAA, use eclipsed DCs, and prefer wet gateways if it saves even 5 ms. Used in HFT and gaming CDNs.</div>
        </div>
        <div class="ins-card">
          <div class="ins-card-icon">🌱</div>
          <div class="ins-card-title">Green mode</div>
          <div class="ins-card-body">w_sol = 0.90 + w_eng = 0.85. Strongly prefers sunlit DCs and laser ISLs (lower energy than RF). Can accept 15–20 ms extra latency to stay 100% solar.</div>
        </div>
      </div>
    `,
  },

  {
    id: 'space-env',
    icon: '🌌',
    label: 'Space Environment',
    render: () => `
      <div class="ins-section-eyebrow">Hazards & Mitigation</div>
      <h2 class="ins-section-title">Radiation, SAA & Eclipse Models</h2>
      <p class="ins-section-sub">
        LEO infrastructure must contend with the Van Allen radiation belts, solar particle events, and eclipse power gaps.
        Orbital CDN models each hazard analytically to route around them in real time.
      </p>

      <div class="saa-map">
        <div class="saa-glow"></div>
        <div class="saa-label">
          ⚠️ South Atlantic Anomaly<br/>
          <span style="font-size:10px;opacity:.7">lat [−50°, 0°] · lon [−80°, +10°] · Inner Van Allen belt dips to ~200 km</span>
        </div>
      </div>

      <div class="ins-steps">
        <div class="ins-step">
          <div class="ins-step-line">
            <div class="ins-step-dot" style="background:rgba(239,68,68,.2);border:1px solid var(--red);color:var(--red)">☢</div>
            <div class="ins-step-connector"></div>
          </div>
          <div class="ins-step-body">
            <div class="ins-step-title">South Atlantic Anomaly (SAA)</div>
            <div class="ins-step-desc">
              The SAA is a region where the inner Van Allen belt dips to ~200 km altitude —
              low enough to intersect operational LEO orbits. Trapped protons (up to 400 MeV) cause
              single-event upsets (SEU) in unshielded CMOS logic at 10× the background rate.
              Our router assigns R_n = +2.0 to any satellite in the bounding box
              lat [−50°, 0°], lon [−80°, +10°], making the path cost prohibitively high unless no alternative exists.
            </div>
          </div>
        </div>
        <div class="ins-step">
          <div class="ins-step-line">
            <div class="ins-step-dot" style="background:rgba(16,185,129,.2);border:1px solid var(--green);color:var(--green)">🌑</div>
            <div class="ins-step-connector"></div>
          </div>
          <div class="ins-step-body">
            <div class="ins-step-title">Eclipse Model</div>
            <div class="ins-step-desc">
              We use a cylindrical shadow approximation. A satellite is in eclipse when its
              angular separation from the sub-solar longitude exceeds 128° (empirical half-angle
              accounting for Earth's ~6,371 km radius at 550 km altitude: arcsin(6371/6921) ≈ 67°,
              so the shadow cone half-width ≈ 180° − 67° = 113° from nadir, adjusted for altitude geometry).
              S_DC = 0 if the orbital DC is eclipsed, removing the solar bonus from the cost function.
            </div>
          </div>
        </div>
        <div class="ins-step">
          <div class="ins-step-line">
            <div class="ins-step-dot" style="background:rgba(245,158,11,.2);border:1px solid var(--amber);color:var(--amber)">☀️</div>
            <div class="ins-step-connector"></div>
          </div>
          <div class="ins-step-body">
            <div class="ins-step-title">Solar Particle Events (SPE)</div>
            <div class="ins-step-desc">
              During an X-class solar flare, proton flux at LEO can spike 10,000×.
              Orbital DCs are equipped with radiation-hardened ASICs and error-correcting memory (ECC DRAM).
              The router's R_n term allows operators to pre-emptively de-route traffic away from DCs in the
              polar cusps — where magnetic field lines funnel solar particles directly toward the surface.
            </div>
          </div>
        </div>
        <div class="ins-step">
          <div class="ins-step-line">
            <div class="ins-step-dot" style="background:rgba(0,212,255,.2);border:1px solid var(--cyan);color:var(--cyan)">📡</div>
          </div>
          <div class="ins-step-body">
            <div class="ins-step-title">Atomic Oxygen Erosion</div>
            <div class="ins-step-desc">
              Below 600 km, atomic oxygen (AO) is the dominant atmospheric species.
              AO reacts with spacecraft surfaces at ~10⁻³ g/cm²/year at 500 km,
              gradually degrading solar panel efficiency and thermal coatings.
              SSO dawn-dusk orbits minimize AO exposure time by keeping spacecraft in terminator geometry.
            </div>
          </div>
        </div>
      </div>
    `,
  },

  {
    id: 'diversity',
    icon: '🌍',
    label: 'Site Diversity',
    render: () => `
      <div class="ins-section-eyebrow">Ground Infrastructure</div>
      <h2 class="ins-section-title">Gateway Site Diversity & Weather Resilience</h2>
      <p class="ins-section-sub">
        Eight global gateways provide geographic diversity against weather outages and regional power failures.
        Ka-band downlinks (26.5–40 GHz) are particularly vulnerable to rain fade —
        a 25 mm/hr rainfall can attenuate the signal by 10–20 dB over a 5 km path,
        causing link margin erosion or complete outage.
      </p>

      <table class="ins-table">
        <thead>
          <tr>
            <th>Gateway</th>
            <th>Lat / Lon</th>
            <th>Weather</th>
            <th>Ka-Band Risk</th>
            <th>Role</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Singapore</td>
            <td style="font-family:JetBrains Mono;font-size:11px">1.3° N, 103.8° E</td>
            <td><span class="ins-tag tag-green">clear</span></td>
            <td>Low</td>
            <td>SE Asia + Pacific primary</td>
          </tr>
          <tr>
            <td>Mumbai</td>
            <td style="font-family:JetBrains Mono;font-size:11px">19.1° N, 72.9° E</td>
            <td><span class="ins-tag tag-red">rain</span></td>
            <td>High (monsoon)</td>
            <td>South Asia fallback</td>
          </tr>
          <tr>
            <td>Frankfurt</td>
            <td style="font-family:JetBrains Mono;font-size:11px">50.1° N, 8.7° E</td>
            <td><span class="ins-tag tag-green">clear</span></td>
            <td>Low</td>
            <td>Europe primary + colocation hub</td>
          </tr>
          <tr>
            <td>Virginia</td>
            <td style="font-family:JetBrains Mono;font-size:11px">38.9° N, 77.0° W</td>
            <td><span class="ins-tag tag-green">clear</span></td>
            <td>Low</td>
            <td>N. America primary (AWS us-east-1 proximity)</td>
          </tr>
          <tr>
            <td>Tokyo GW</td>
            <td style="font-family:JetBrains Mono;font-size:11px">35.7° N, 139.6° E</td>
            <td><span class="ins-tag tag-green">clear</span></td>
            <td>Low</td>
            <td>Japan + NE Asia primary</td>
          </tr>
          <tr>
            <td>São Paulo GW</td>
            <td style="font-family:JetBrains Mono;font-size:11px">23.5° S, 46.6° W</td>
            <td><span class="ins-tag tag-amber">cloudy</span></td>
            <td>Medium</td>
            <td>South America (borders SAA zone)</td>
          </tr>
          <tr>
            <td>Sydney GW</td>
            <td style="font-family:JetBrains Mono;font-size:11px">33.9° S, 151.2° E</td>
            <td><span class="ins-tag tag-green">clear</span></td>
            <td>Low</td>
            <td>Australia + Pacific fallback</td>
          </tr>
          <tr>
            <td>Lagos GW</td>
            <td style="font-family:JetBrains Mono;font-size:11px">6.5° N, 3.4° E</td>
            <td><span class="ins-tag tag-amber">cloudy</span></td>
            <td>Medium</td>
            <td>Sub-Saharan Africa (equatorial cloud belt)</td>
          </tr>
        </tbody>
      </table>

      <p class="ins-section-sub" style="margin-top:28px">
        Under "Reliable" policy (w_wx = 0.90), the router effectively excludes Mumbai and Lagos
        during their respective wet seasons. Under "Latency" (w_wx = 0.05), rain penalties are ignored
        and the nearest-slant-range gateway always wins, even if operating at reduced link margin.
      </p>

      <div class="ins-cards">
        <div class="ins-card">
          <div class="ins-card-icon">📶</div>
          <div class="ins-card-title">Ka-Band Rain Fade</div>
          <div class="ins-card-body">ITU-R P.618 model: 25 mm/hr rain gives ~7 dB/km attenuation at 30 GHz. A 5 km path in heavy rain loses 35 dB — exceeding most satellite downlink margins by 10–20 dB.</div>
        </div>
        <div class="ins-card">
          <div class="ins-card-icon">🛡️</div>
          <div class="ins-card-title">ACM Adaptive Coding</div>
          <div class="ins-card-body">Adaptive Coding & Modulation (DVB-S2X): during light rain the gateway drops from 32APSK to QPSK, halving throughput but maintaining link. In severe rain, traffic fails over to an alternate gateway.</div>
        </div>
      </div>
    `,
  },

  {
    id: 'references',
    icon: '📚',
    label: 'References',
    render: () => `
      <div class="ins-section-eyebrow">Research & Standards</div>
      <h2 class="ins-section-title">Academic & Technical References</h2>
      <p class="ins-section-sub">
        Orbital CDN draws on published research in satellite networking, atmospheric physics,
        orbital mechanics, and CDN architecture. Key references below.
      </p>

      <div class="ins-ref-list">
        <div class="ins-ref">
          <div class="ins-ref-num">[1]</div>
          <div class="ins-ref-body">
            <span class="ins-ref-title">Handley, M. (2018) — Delay is Not an Option: Low Latency Routing in Space</span>
            ACM HotNets 2018. Foundational analysis showing LEO vacuum routing beats transatlantic fiber for distances > 3,000 km. Demonstrates the theoretical 33% speed advantage translates to 30–40 ms savings on London–NYC routes.
          </div>
        </div>
        <div class="ins-ref">
          <div class="ins-ref-num">[2]</div>
          <div class="ins-ref-body">
            <span class="ins-ref-title">Bhattacherjee, D. et al. (2019) — Network Architecture for Starlink</span>
            ACM SIGCOMM 2019. Models Walker-Delta constellations, ISL topology, and latency under real traffic patterns. Derives optimal inclination angles for global coverage vs polar gap tradeoffs.
          </div>
        </div>
        <div class="ins-ref">
          <div class="ins-ref-num">[3]</div>
          <div class="ins-ref-body">
            <span class="ins-ref-title">Hoots, F.R. & Roehrich, R.L. (1980) — NORAD SGP4 Theory</span>
            AFSPC 80-0087. Original SGP4/SDP4 propagator specification. Used by satellite.js (npm) to compute real-time ECI positions from TLE epoch data fetched from CelesTrak.
          </div>
        </div>
        <div class="ins-ref">
          <div class="ins-ref-num">[4]</div>
          <div class="ins-ref-body">
            <span class="ins-ref-title">ITU-R P.618-14 (2023) — Propagation Data & Prediction Methods for Earth-Space Paths</span>
            ITU Radiocommunication Sector. Defines Ka-band rain attenuation models used in the W_G gateway weather penalty. Table IV gives attenuation rates by climate zone and frequency band.
          </div>
        </div>
        <div class="ins-ref">
          <div class="ins-ref-num">[5]</div>
          <div class="ins-ref-body">
            <span class="ins-ref-title">Picardi, A. et al. (2021) — Low-Orbit Satellite Data Centers: Feasibility & Thermal</span>
            IEEE Aerospace Conference 2021. Analyzes orbital DC thermal management, radiation-hardening costs, and SSO dawn-dusk power budgets. Key input for S_DC solar model and orbital DC tier design.
          </div>
        </div>
        <div class="ins-ref">
          <div class="ins-ref-num">[6]</div>
          <div class="ins-ref-body">
            <span class="ins-ref-title">Heynderickx, D. et al. (2004) — The South Atlantic Anomaly in Particle Models</span>
            Advances in Space Research 34(6). Defines the SAA bounding region used in our radiation penalty term R_n. Single-event upset (SEU) rates at 550 km inside the SAA are documented as 10–100× background.
          </div>
        </div>
        <div class="ins-ref">
          <div class="ins-ref-num">[7]</div>
          <div class="ins-ref-body">
            <span class="ins-ref-title">Bhatt, M. & Del Rosso, A. (2020) — Carbon-Free Cloud via Orbital Infrastructure</span>
            NeurIPS Workshop on Tackling Climate Change with ML. Motivates orbital compute as a 100% renewable pathway: solar collection efficiency at 550 km is 8× ground level due to no atmospheric absorption and 24/7 illumination in SSO.
          </div>
        </div>
        <div class="ins-ref">
          <div class="ins-ref-num">[8]</div>
          <div class="ins-ref-body">
            <span class="ins-ref-title">Simulation Stack — Open Source Libraries</span>
            globe.gl v2.31 (Three.js WebGL globe), satellite.js v5 (SGP4 propagator), Three.js r184 (WebGL renderer), Vite 5 (ESM build), Vercel (edge deployment). TLE data: CelesTrak NORAD GP catalog (live, CC0).
          </div>
        </div>
      </div>
    `,
  },
]

// ─── Build & open the page ────────────────────────────────────────────────────

let initialized = false

export function initInsights() {
  const btn     = document.getElementById('insights-btn')
  const overlay = document.getElementById('insights-overlay')
  const closeBtn = document.getElementById('insights-close')

  btn?.addEventListener('click', () => openInsights())
  closeBtn?.addEventListener('click', () => closeInsights())

  overlay?.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeInsights()
  })

  // Close on backdrop click (outside the page card)
  overlay?.addEventListener('click', e => {
    if (e.target === overlay) closeInsights()
  })
}

function openInsights() {
  const overlay = document.getElementById('insights-overlay')
  overlay?.classList.remove('hidden')
  overlay?.setAttribute('tabindex', '-1')
  overlay?.focus()

  if (!initialized) {
    buildInsightsPage()
    initialized = true
  }

  // Activate first nav item
  const firstNav = document.querySelector('.ins-nav-item')
  if (firstNav) activateSection(firstNav.dataset.id)
}

function closeInsights() {
  document.getElementById('insights-overlay')?.classList.add('hidden')
}

function buildInsightsPage() {
  const nav     = document.getElementById('insights-nav')
  const content = document.getElementById('insights-content')
  if (!nav || !content) return

  // Build nav
  nav.innerHTML = SECTIONS.map(s => `
    <button class="ins-nav-item" data-id="${s.id}">
      <span class="nav-icon">${s.icon}</span>
      ${s.label}
    </button>
  `).join('')

  // Build content
  content.innerHTML = SECTIONS.map(s => `
    <section class="ins-section" id="ins-${s.id}">
      ${s.render()}
    </section>
    ${s.id !== SECTIONS[SECTIONS.length - 1].id ? '<hr class="ins-divider">' : ''}
  `).join('')

  // Nav click handlers
  nav.querySelectorAll('.ins-nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      activateSection(btn.dataset.id)
      const el = document.getElementById(`ins-${btn.dataset.id}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  })

  // Scrollspy
  const contentEl = document.getElementById('insights-content')
  contentEl?.addEventListener('scroll', () => {
    let current = SECTIONS[0].id
    SECTIONS.forEach(s => {
      const el = document.getElementById(`ins-${s.id}`)
      if (el && el.offsetTop - 80 <= contentEl.scrollTop) current = s.id
    })
    activateSection(current)
  })
}

function activateSection(id) {
  document.querySelectorAll('.ins-nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.id === id)
  })
}
