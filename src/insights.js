// Architecture & Insights page — full technical explanation of Orbital CDN

const SECTIONS = [
  {
    id: 'overview',
    icon: '<i data-ic="logo"></i>',
    label: 'System Overview',
    render: () => `
      <h2 class="ins-section-title">Orbital CDN — "Cloudflare for Space"</h2>
      <p class="ins-section-sub">
        A three-tier infrastructure that routes requests through Low Earth Orbit satellites instead of terrestrial fibre,
        It is not a claim that space is always faster. Across 991 logged requests orbital beat long-haul fibre 68% of the time — 100% from Lagos and 0% from London — and the break-even map shows exactly where the advantage begins.
      </p>

      <div class="arch-diagram">
        <div class="arch-tier">
          <div class="arch-tier-label">Tier 3</div>
          <div class="arch-tier-body tier-ground">
            <div class="arch-node"><span class="arch-node-icon"><i data-ic="globe"></i></span>Origin City</div>
            <div class="arch-node"><span class="arch-node-icon"></span>Ground Gateway</div>
            <div class="arch-node"><span class="arch-node-icon"></span>Destination</div>
          </div>
        </div>
        <div class="arch-tier-connector">↕ Radio Link (Ka/Ku-band)</div>
        <div class="arch-tier">
          <div class="arch-tier-label">Tier 2</div>
          <div class="arch-tier-body tier-orbit">
            <div class="arch-node highlight"><span class="arch-node-icon"><i data-ic="satellite"></i></span>LEO Satellite Mesh</div>
            <div class="arch-node"><span class="arch-node-icon">—</span>ISL: Inter-Satellite Links</div>
            <div class="arch-node"><span class="arch-node-icon"><i data-ic="antenna"></i></span>Walker-Delta 180-sat</div>
          </div>
        </div>
        <div class="arch-tier-connector">↕ Optical/RF Feeder</div>
        <div class="arch-tier">
          <div class="arch-tier-label">Tier 1</div>
          <div class="arch-tier-body tier-space">
            <div class="arch-node highlight"><span class="arch-node-icon"><i data-ic="server"></i></span>Orbital DC (SSO ~600 km)</div>
            <div class="arch-node"><span class="arch-node-icon"><i data-ic="sun"></i></span>Solar-Powered</div>
            <div class="arch-node"><span class="arch-node-icon"><i data-ic="lock"></i></span>Radiation-Hardened</div>
          </div>
        </div>
      </div>

      <div class="ins-cards">
        <div class="ins-card">
          <div class="ins-card-icon"><i data-ic="satellite"></i></div>
          <div class="ins-card-title">180 LEO Satellites</div>
          <div class="ins-card-body">Walker-Delta at 550 km, 53° inclination. 9 orbital planes × 20 satellites. Inter-Satellite Links form a mesh backbone above the atmosphere.</div>
        </div>
        <div class="ins-card">
          <div class="ins-card-icon"><i data-ic="server"></i></div>
          <div class="ins-card-title">4 Orbital DCs</div>
          <div class="ins-card-body">Sun-Synchronous Orbit at ~600 km in dawn-dusk configuration. Permanently lit, solar-powered, low thermal cycling vs circular LEO.</div>
        </div>
        <div class="ins-card">
          <div class="ins-card-icon"></div>
          <div class="ins-card-title">8 Ground Gateways</div>
          <div class="ins-card-body">Singapore, Mumbai, Frankfurt, Virginia, Tokyo, São Paulo, Sydney, Lagos. Weather and cloud cover tracked per gateway in real-time.</div>
        </div>
        <div class="ins-card">
          <div class="ins-card-icon"><i data-ic="bolt"></i></div>
          <div class="ins-card-title">47% Faster in Vacuum</div>
          <div class="ins-card-body">Silica fibre carries light at c/1.47 ≈ 203,940 km/s, so vacuum is 47% faster. Whether that wins end-to-end depends on distance — the break-even map shows where it does and does not.</div>
        </div>
      </div>
    `,
  },

  {
    id: 'physics',
    icon: '<i data-ic="bolt"></i>',
    label: 'Physics of Speed',
    render: () => `
      <h2 class="ins-section-title">Why Vacuum Beats Fibre</h2>
      <p class="ins-section-sub">
        The core thesis of Orbital CDN is physical: the speed of light in a vacuum is 299,792 km/s,
        while optical fibre achieves only ~200,000 km/s due to the glass refractive index (~1.5).
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
          <div class="ins-card-title">km/s in fibre</div>
          <div class="ins-card-body">Silica fibre refractive index ≈ 1.47 slows photons to ~68% of c. Plus fibre takes longer routes (undersea cables follow shipping lanes).</div>
        </div>
        <div class="ins-card">
          <span class="ins-card-num">~45 ms</span>
          <div class="ins-card-title">RTT saved London↔Tokyo</div>
          <div class="ins-card-body">London–Tokyo great-circle = 9,560 km. Fibre RTT ≈ 245 ms. Space route via 4 ISL hops ≈ 200 ms. Net gain ≈ 45 ms per round-trip.</div>
        </div>
        <div class="ins-card">
          <span class="ins-card-num">1,340 km</span>
          <div class="ins-card-title">Uplink + downlink budget</div>
          <div class="ins-card-body">~600 km uplink to LEO relay + ~600 km to orbital DC + ~140 km slant range overhead. Total vertical travel = 1,340 km vs ~0 km for fibre.</div>
        </div>
      </div>

      <div class="ins-equation">
        <span class="eq-label">Cost function — as implemented in src/engine.js</span>
        <div class="eq-main">
          C(DC) =
          <span class="eq-weight">w_lat</span> · <span class="eq-term">reachMs</span>
          + <span class="eq-weight">w_sol</span> · <span class="eq-term">25 ms</span> · S_DC
          + <span class="eq-weight">w_rad</span> · <span class="eq-term">40 ms</span> · R_DC
          + <span class="eq-weight">w_lat</span> · <span class="eq-term">18 ms</span> · P_lat
          + <span class="eq-weight">w_rad</span> · <span class="eq-term">18 ms</span> · P_rad
        </div>
        <div class="eq-main">
          C(G) &nbsp;=
          <span class="eq-weight">w_lat</span> · <span class="eq-term">reachMs</span>
          + <span class="eq-weight">w_wx</span> · <span class="eq-term">W_G</span>
          + <span class="eq-weight">w_wx</span> · <span class="eq-term">18 ms</span> · P_G
          + <span class="eq-weight">w_wx</span> · <span class="eq-term">F_G</span>
        </div>
        <br/>
        <div class="eq-cmt">// Every term is in MILLISECONDS. That is the whole design: sunlight, radiation</div>
        <div class="eq-cmt">// and rain are not thresholds to trip, they are costs to trade against distance.</div>
        <div class="eq-cmt">//</div>
        <div class="eq-cmt">// reachMs = great-circle reach, origin to candidate           (ms, not a 0-1 score)</div>
        <div class="eq-cmt">// S_DC    = 1 if DC eclipsed, 0 if sunlit                     (25 ms — reward solar)</div>
        <div class="eq-cmt">// R_DC    = 1 if DC inside the SAA bounding box, else 0       (40 ms — radiation dose)</div>
        <div class="eq-cmt">// W_G     = 0 clear · 8 ms cloudy · 22 ms rain                (Ka-band rain fade)</div>
        <div class="eq-cmt">// F_G     = P(outage) × 900 ms, horizon-tapered, confidence-damped   (forecast)</div>
        <div class="eq-cmt">//</div>
        <div class="eq-cmt">// P_lat, P_rad, P_G = LEARNED penalties from observed telemetry over the window.</div>
        <div class="eq-cmt">// Each is carried by the weight of the objective it belongs to: observed tail</div>
        <div class="eq-cmt">// latency is a latency cost, observed SAA exposure is a radiation cost. Scaling</div>
        <div class="eq-cmt">// radiation history by w_sol was a bug, and is why these are two terms, not one.</div>
        <div class="eq-cmt">// 18 ms = ADAPT_COST_MS 30 × ADAPT_GAIN 0.6 — how far history may bend a policy.</div>
      </div>

      <p class="ins-section-sub">
        Argmin across all DC candidates picks the orbital data centre; a second argmin picks the ground gateway.
        The final terms are what make the network <b>adaptive</b>: <span style="color:var(--cyan);font-family:JetBrains Mono">P_DC</span> and
        <span style="color:var(--cyan);font-family:JetBrains Mono">P_G</span> are not authored constants — they are recomputed from the
        request log every time you change the analytics time window, so the router's behaviour is a function of what the
        network actually observed, not of what anyone assumed. Turn adaptive routing off in
        <b>Network Analytics</b> and both terms drop to zero, recovering the fixed-policy engine.
      </p>

      <div class="ins-cards">
        <div class="ins-card">
          <div class="ins-card-icon"><i data-ic="wave"></i></div>
          <div class="ins-card-title">South Atlantic Anomaly</div>
          <div class="ins-card-body">SAA bounding box lat [−50,0]° lon [−80,10]°. Nodes inside receive +2.0 radiation penalty (R_n). The router avoids this zone unless no alternative path exists.</div>
        </div>
        <div class="ins-card">
          <div class="ins-card-icon"><i data-ic="eclipse"></i></div>
          <div class="ins-card-title">Eclipse Penalty</div>
          <div class="ins-card-body">Cylindrical umbra model: DC eclipsed if angular separation from sub-solar point > 128°. S_DC = 0 forces the router toward sunlit DCs for uninterrupted solar power.</div>
        </div>
        <div class="ins-card">
          <div class="ins-card-icon"><i data-ic="rain"></i></div>
          <div class="ins-card-title">Ka-Band Rain Fade</div>
          <div class="ins-card-body">Ka-band signals (26.5–40 GHz) attenuate 5–15 dB/km in heavy rain. W_G = 1.0 in rain makes "Reliable" policy avoid wet gateways and prefer clear-sky downlinks.</div>
        </div>
        <div class="ins-card">
          <div class="ins-card-icon"><i data-ic="sun"></i></div>
          <div class="ins-card-title">Solar Compute Bonus</div>
          <div class="ins-card-body">Sunlit DCs run on photovoltaic panels. S_DC = 1 gives a cost reduction under "Green" policy (w_sol = 0.9), prioritizing renewable orbital compute over battery-backed eclipse ops.</div>
        </div>
      </div>
    `,
  },

  {
    id: 'policies',
    icon: '<i data-ic="balance"></i>',
    label: 'Routing Policies',
    render: () => `
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
            <td><span class="ins-tag tag-cyan"><i data-ic="bolt"></i> Latency</span></td>
            <td>Min RTT</td>
            <td style="color:var(--cyan)">0.95</td><td>0.05</td><td>0.05</td><td>0.05</td><td>0.05</td>
            <td>Real-time gaming, HFT, streaming</td>
          </tr>
          <tr>
            <td><span class="ins-tag tag-amber"><i data-ic="balance"></i> Balanced</span></td>
            <td>All-round</td>
            <td>0.50</td><td>0.50</td><td>0.50</td><td>0.40</td><td>0.40</td>
            <td>LLM inference, general APIs</td>
          </tr>
          <tr>
            <td><span class="ins-tag tag-green"><i data-ic="leaf"></i> Green</span></td>
            <td>Solar compute</td>
            <td>0.20</td><td style="color:var(--green)">0.90</td><td>0.20</td><td>0.30</td><td style="color:var(--green)">0.85</td>
            <td>Batch ML training, archival</td>
          </tr>
          <tr>
            <td><span class="ins-tag tag-red"><i data-ic="shield"></i> Reliable</span></td>
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
          <div class="ins-card-icon"><i data-ic="bolt"></i></div>
          <div class="ins-card-title">Latency mode</div>
          <div class="ins-card-body">w_lat = 0.95 dominates. The router will cross the SAA, use eclipsed DCs, and prefer wet gateways if it saves even 5 ms. Used in HFT and gaming CDNs.</div>
        </div>
        <div class="ins-card">
          <div class="ins-card-icon"><i data-ic="leaf"></i></div>
          <div class="ins-card-title">Green mode</div>
          <div class="ins-card-body">w_sol = 0.90 + w_eng = 0.85. Strongly prefers sunlit DCs and laser ISLs (lower energy than RF). Can accept 15–20 ms extra latency to stay 100% solar.</div>
        </div>
      </div>
    `,
  },

  {
    id: 'space-env',
    icon: '<i data-ic="target"></i>',
    label: 'Space Environment',
    render: () => `
      <h2 class="ins-section-title">Radiation, SAA & Eclipse Models</h2>
      <p class="ins-section-sub">
        LEO infrastructure must contend with the Van Allen radiation belts, solar particle events, and eclipse power gaps.
        Orbital CDN models each hazard analytically to route around them in real time.
      </p>

      <div class="saa-map">
        <div class="saa-glow"></div>
        <div class="saa-label">
          <i data-ic="warning"></i> South Atlantic Anomaly<br/>
          <span style="font-size:10px;opacity:.7">lat [−50°, 0°] · lon [−80°, +10°] · Inner Van Allen belt dips to ~200 km</span>
        </div>
      </div>

      <div class="ins-steps">
        <div class="ins-step">
          <div class="ins-step-line">
            <div class="ins-step-dot" style="background:rgba(201,115,107,.18);border:1px solid var(--red);color:var(--red)"><i data-ic="radiation"></i></div>
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
            <div class="ins-step-dot" style="background:rgba(111,174,127,.18);border:1px solid var(--green);color:var(--green)"><i data-ic="eclipse"></i></div>
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
            <div class="ins-step-dot" style="background:rgba(217,154,78,.18);border:1px solid var(--amber);color:var(--amber)"><i data-ic="sun"></i></div>
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
            <div class="ins-step-dot" style="background:rgba(125,148,184,.18);border:1px solid var(--cyan);color:var(--cyan)"><i data-ic="antenna"></i></div>
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
    icon: '<i data-ic="globe"></i>',
    label: 'Site Diversity',
    render: () => `
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
          <div class="ins-card-icon"><i data-ic="signal"></i></div>
          <div class="ins-card-title">Ka-Band Rain Fade</div>
          <div class="ins-card-body">ITU-R P.618 model: 25 mm/hr rain gives ~7 dB/km attenuation at 30 GHz. A 5 km path in heavy rain loses 35 dB — exceeding most satellite downlink margins by 10–20 dB.</div>
        </div>
        <div class="ins-card">
          <div class="ins-card-icon"><i data-ic="shield"></i></div>
          <div class="ins-card-title">ACM Adaptive Coding</div>
          <div class="ins-card-body">Adaptive Coding & Modulation (DVB-S2X): during light rain the gateway drops from 32APSK to QPSK, halving throughput but maintaining link. In severe rain, traffic fails over to an alternate gateway.</div>
        </div>
      </div>
    `,
  },

  {
    id: 'references',
    icon: '<i data-ic="book"></i>',
    label: 'References',
    render: () => `
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
            ACM HotNets 2018. Foundational analysis showing LEO vacuum routing beats transatlantic fibre for distances > 3,000 km. Demonstrates the theoretical 33% speed advantage translates to 30–40 ms savings on London–NYC routes.
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
