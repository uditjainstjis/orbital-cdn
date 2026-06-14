# Orbital CDN — Live Simulator: Site Features & Architecture

> **Live URL**: https://orbital-cdn.vercel.app  
> **Repo**: github.com/uditjainstjis/orbital-cdn  
> **Stack**: Single self-contained `index.html` — zero dependencies, zero build step, raw Canvas2D + vanilla JS  
> **Context**: FAR AWAY Hackathon (Unstop), June 14 2026

---

## Overview

The Orbital CDN simulator is a fully interactive, physics-grounded visualization of a three-tier space-based content delivery network. Users select an origin city, a service type, and a routing policy, then trigger a packet routing simulation that animates across a live world map showing 72 real satellites, 3 orbital data centers, and 8 ground gateways — all moving in real time using Walker-Delta orbital mechanics.

Every routing decision is surfaced step-by-step with actual numerical reasoning, and a "Technical Deep Dive" modal exposes the full mathematical model behind each choice.

---

## Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  ◎ ORBITAL CDN / Live Simulator          ● LIVE SIM  72 SATS  3 DCs SUNLIT  │
├────────────────┬───────────────────────────────────┬─────────────┤
│  LEFT PANEL    │         WORLD MAP (Canvas)         │ RIGHT PANEL │
│  300px         │         fills remaining width      │  320px      │
│                │                                    │             │
│  1. Location   │  • 72 live satellites              │ Routing     │
│  2. Service    │  • ISL mesh lines                  │ Decisions   │
│  3. Policy     │  • 3 orbital DCs (golden)          │             │
│  4. Send btn   │  • 8 gateways (colored diamonds)   │ Live Metrics│
│                │  • SAA zone overlay                │ Policy Bars │
│                │  • Animated packet dot             │ Deep Dive   │
└────────────────┴───────────────────────────────────┴─────────────┘
```

Grid: `300px 1fr 320px` — fixed panels, elastic center canvas.  
Typography: Space Grotesk (UI) + JetBrains Mono (data/code).  
Color palette: deep-space dark (`#020408` bg, `#080e1a` surface, `#0c1424` card), cyan accent (`#00d4ff`), purple (`#7c3aed`), green (`#10b981`), amber (`#f59e0b`), red (`#ef4444`), blue (`#3b82f6`).

---

## Top Bar

| Element | Detail |
|---|---|
| **Logo** | `◎ ORBITAL CDN / Live Simulator` in JetBrains Mono |
| **LIVE SIM badge** | Pulsing green dot — decorative live indicator |
| **72 SATS badge** | Static count of satellites in the simulation |
| **DC SUNLIT badge** | Updates every 2 s — counts currently sunlit orbital DCs (0–3) |

---

## Left Panel — Control Flow

### Step 1 · Select Your Location

8-city 2-column grid. Clicking a city button:
- Highlights it with cyan border/glow (active state)
- Updates `selectedCity` (`{city, lat, lon}`)
- The world map immediately redraws the origin dot (larger white circle + label)

| City | Lat | Lon |
|---|---|---|
| 🇮🇳 Delhi | 28.6° | 77.2° |
| 🇺🇸 New York | 40.7° | −74.0° |
| 🇬🇧 London | 51.5° | −0.1° |
| 🇯🇵 Tokyo | 35.7° | 139.7° |
| 🇧🇷 São Paulo | −23.5° | −46.6° |
| 🇦🇺 Sydney | −33.9° | 151.2° |
| 🇳🇬 Lagos | 6.5° | 3.4° |
| 🇦🇪 Dubai | 25.2° | 55.3° |

### Step 2 · Request Type

4 service buttons (vertical list). Clicking updates `selectedService` (`{service, size, compute}`) and affects the processing delay term in RTT calculation.

| Service | Payload | Compute | Processing Delay |
|---|---|---|---|
| 🤖 LLM Inference | 2.4 KB | high | 42 ms |
| 📺 Video Stream | 4K CDN | medium | 16 ms |
| ⚡ Edge AI Inference | 1.1 KB | medium | 16 ms |
| 🔌 API Call | 0.3 KB | low | 6 ms |

Active service highlighted purple.

### Step 3 · Routing Policy

4 pill-shaped tab buttons. Switching policies:
1. Updates `policy` variable
2. Animates the 5 weight bars (CSS `width` transition, 500 ms cubic-bezier)
3. Updates the policy description text below

**Policy weight vectors** (each weight ∈ [0, 1]):

| Policy | w_lat | w_sol | w_rad | w_wx | w_eng |
|---|---|---|---|---|---|
| ⚡ Latency | 0.95 | 0.05 | 0.05 | 0.05 | 0.05 |
| ⚖️ Balanced | 0.50 | 0.50 | 0.50 | 0.40 | 0.40 |
| 🌱 Green | 0.20 | 0.90 | 0.20 | 0.30 | 0.85 |
| 🛡️ Reliable | 0.20 | 0.30 | 0.95 | 0.90 | 0.20 |

**Weight bars** (5 animated bars under the policy tabs):

| Bar | Color | Meaning |
|---|---|---|
| LAT | Cyan | Latency weight |
| SOL | Green | Solar/eclipse penalty weight |
| RAD | Red | SAA radiation penalty weight |
| WX | Blue | Weather penalty weight |
| ENG | Amber | Energy consumption weight |

### Send Button

Full-width gradient button (cyan → purple). On click:
- Disables itself (`⏳ Routing...`)
- Clears the decision panel
- Resets packet animation
- Runs the async 5-step simulation
- Re-enables as `▶ Send Another Request`

---

## Center Canvas — World Map

A `<canvas>` element that fills the remaining space between the two panels. All rendering is raw Canvas2D at 60 fps via `requestAnimationFrame`.

### Projection

Equirectangular (plate carrée):
```
x = ((lon + 180) / 360) * width
y = ((90 − lat) / 180) * height
```

### Background & Grid

- Deep ocean fill: `#040c18`
- 30° longitude lines + 30° latitude lines in very dark blue-grey (`rgba(22,32,53,0.7)`)

### Continent Polygons

6 simplified polygon approximations drawn as filled shapes (`rgba(18,32,55,0.95)` fill, dark stroke):
- North America
- South America
- Europe
- Africa
- Asia
- Australia

### SAA Zone Overlay

South Atlantic Anomaly bounding box: lat [−50°, 0°], lon [−80°, +10°].  
Rendered as a dashed red rectangle with red fill at 7% opacity and a `SAA ZONE` text label.  
Used in both the radiation model and routing decisions.

### Satellites (72 live)

Constellation: Walker-Delta, 6 orbital planes × 12 satellites/plane, 53° inclination, ~550 km altitude.

**Propagation per frame** (`updateSatellites()`):
```js
sat.anomaly += (360 / 90) * 0.016  // degrees per tick at ~90-min orbital period
lat = asin(sin(53°) × sin(anomaly))
lon = (raan + atan2(cos(53°)×sin(anomaly), cos(anomaly)) + time×0.018) % 360
```

**Satellite states and colors:**

| State | Color | Condition |
|---|---|---|
| Normal LEO sat | Cyan (55% opacity) | Default |
| SAA-exposed sat | Red (70% opacity) | `inSAA(lat, lon)` true |
| Eclipsed sat | Slate grey (45% opacity) | `isEclipsed(lon)` true |
| Orbital DC (sunlit) | Amber, radius 5px, ring | `isDC` + not eclipsed |
| Orbital DC (eclipsed) | Grey, radius 4px, no ring | `isDC` + eclipsed |

**DC positions**: Satellites at indices 12, 36, 60 (one per every 2 planes) are designated DCs named DC-1, DC-2, DC-3. Their names are rendered in 8px JetBrains Mono next to the dot.

**ISL mesh lines**: Two layers:
- Intra-plane links: adjacent satellites in the same plane (thin cyan, 0.4px)
- Cross-plane links: same slot in adjacent plane, but **only drawn for satellites below |lat| 60°** (disabled near poles for stability)
- Lines that would wrap across the antimeridian (x-distance > 40% of canvas width) are skipped

**Eclipse model** (`isEclipsed(lon)`):
```js
sunLon = (time × 0.4) % 360 − 180  // sun moves as time ticks
diff = |lon − sunLon|               // angular difference (wrapped)
eclipsed if diff > 130°             // cylindrical shadow approximation
```

**Battery dynamics**:
- Sunlit: battery += 0.002/tick (charging)
- Eclipse: battery -= 0.001/tick (discharging), floor 10%

### Gateways (8 ground stations)

Rendered as colored diamond shapes (4-point star). Color encodes weather:

| Weather | Color | Penalty |
|---|---|---|
| Clear | Green (`#10b981`) | 0.0 |
| Cloudy | Amber (`#f59e0b`) | 0.5 |
| Rain | Red (`#ef4444`) | 1.0 |

| Gateway | Lat | Lon | Weather |
|---|---|---|---|
| Singapore | 1.3° | 103.8° | clear |
| Mumbai | 19.1° | 72.9° | rain |
| Frankfurt | 50.1° | 8.7° | clear |
| Virginia | 38.9° | −77.0° | clear |
| Tokyo-GW | 35.7° | 139.6° | clear |
| Sao Paulo GW | −23.5° | −46.6° | cloudy |
| Sydney GW | −33.9° | 151.2° | clear |
| Lagos GW | 6.5° | 3.4° | cloudy |

### City Dots

All 8 cities rendered as white dots. Selected city: larger (radius 6), full white, with a second ring and city-name label.

### Packet Animation

After simulation runs, a `routePath` array of waypoints is built:
```
User location → Uplink satellite → [Relay hops] → Orbital DC
             → [Relay hops reversed] → GW satellite → Gateway → User location
```

Segment colors: white (user), cyan (uplink/downlink), green (ISL relays), amber (DC), green (gateway).

The packet dot travels at `routeProgress += 0.028/frame` (constant screen-space speed). It renders as a radial gradient glow (14px radius, white core, cyan fade-out) so it's highly visible against the dark map.

Segments that cross the antimeridian (x-distance > 50% width) are skipped to avoid visual glitching.

### Map Legend

Bottom-left corner, semi-transparent dark background box, 7 items:
- Orbital DC (sunlit) — amber
- DC (eclipsed) — grey
- LEO Satellite — cyan
- Sat in SAA zone — red
- Gateway (clear) — green
- Gateway (rain) — red
- Gateway (cloudy) — amber

---

## Right Panel — Simulation Output

### Decision Steps

Five steps appear sequentially during simulation, each sliding in from the right (`translateX(20px) → 0`, 400 ms ease). Each step has:
- Colored icon circle (background tinted to match step theme)
- Bold title
- Body text with HTML-formatted reasoning
- Highlighted monospace tag (colored border, matching background tint)

| Step | Icon | Theme | Content |
|---|---|---|---|
| 1 · Uplink | 📡 | Cyan | Nearest satellite to origin, vacuum speed fact, SAA warning if applicable |
| 2 · DC | 🛰️ | Amber | Chosen DC name, policy-specific reasoning, battery %, load %, eclipse/sunlit badge |
| 3 · ISL Path | ⚡ | Green | Hop count, SAA crossings, policy-specific path reasoning, link speed |
| 4 · Gateway | 🌍 | Green | Chosen gateway, weather status, site diversity note if rerouted |
| 5 · Complete | ✅ | Purple | Full RTT, ISL savings vs fiber, solar/battery status, latency stretch vs baseline |

### Live Metrics (bottom of right panel)

2×2 grid of metric boxes, all highlighted cyan after simulation:

| Box | Value | Label |
|---|---|---|
| Top-left | `{N} ms` | End-to-End RTT |
| Top-right | `{N} hops` | ISL Hops |
| Bottom-left | `YES / NO` | Solar-Powered |
| Bottom-right | `YES / NO` | SAA Avoided |

### Policy Comparison Bars

Appears after simulation runs. Shows estimated RTT for all 3 other policies on the same request, normalized to fill-width bars:

| Row | Color | Value |
|---|---|---|
| Latency | Cyan | Baseline RTT (fastest, no penalties) |
| Green | Green | Baseline × 1.15 (slight detour for sunlit DC) |
| Reliable | Red | Baseline × 1.22 (avoids SAA + weather, longer path) |

### Technical Deep Dive Button

`🔬 Technical Deep Dive` — hidden until first simulation completes. Click opens the full-screen modal.

---

## Deep Dive Modal

Full-screen overlay (`rgba(2,4,8,0.88)` + `backdrop-filter: blur(8px)`). Modal slides in with a scale animation (0.96 → 1.0, 300 ms). Click outside or `✕` to close.

Contains 8 technical sections, all populated from `lastSimData` — the complete state object captured at the end of each simulation run.

### §1 · Cost Function — Actual Values This Request

Formatted code block showing the full cost function with actual numerical substitutions for the current run:

```
Cost(P, DC, G) = w_lat·ΣL_e + w_eng·ΣE_e + w_cong·ΣQ_e
               + w_rad·ΣR_n + w_sol·S_DC + w_wx·W_G

w = { lat:0.5, eng:0.4, sol:0.5, rad:0.5, wx:0.4 }  ← actual policy weights

L_total = {baseDist} km / 299,792 km/s × 1000 = {X} ms one-way
RTT_prop = {X*2} ms

T_proc = {42|16|6} ms   ← service compute tier
W_penalty = {0|8|22} ms  ← weather at chosen gateway

RTT = prop + proc + wx = {rtt} ms
RTT_baseline = {baseline} ms   Stretch = +{stretch}%
```

Color-coded syntax: keywords in purple, values in cyan, comments in muted, highlights in amber, OK in green, bad in red.

### §2 · Vacuum vs Fiber — The Physics of the ISL Advantage

Two side-by-side physics cards:

**Left — Vacuum (Laser ISL)**:
- c = 299,792 km/s
- One-way for this request: `{propDelayVac} ms`

**Right — Fiber (Terrestrial Baseline)**:
- c/1.47 ≈ 203,940 km/s (silica refractive index)
- One-way would be: `{propDelayFib} ms`
- ISL saves: `{saving} ms` one-way

Code block:
```
d_breakeven ≈ 3,000 km  // below this, fewer hops = less ISL cost
d_this_request = {baseDist} km  → ISL wins by {saving} ms one-way ({saving*2} ms RTT)
C_ISL = 100 Gbps          // ADA Space Three-Body constellation (May 2025)
```

### §3 · DC Selection — All Candidates Scored

Scoring formula displayed, then a full table of all 3 DCs sorted by total score (ascending = winner first):

```
score(DC) = w_lat·dist_norm + w_sol·eclipse_flag + w_rad·saa_flag
```

Table columns: DC name, Status (sunlit/eclipse), Battery %, Load %, `dist_norm`, `eclipse` (0.0 or 1.0), `saa` (0.0 or 1.0), Total Score, CHOSEN badge.  
Winner row gets a subtle cyan background tint.

### §4 · ISL Path — Hop-by-Hop Breakdown

Code block stating Walker-Delta parameters, cross-plane ISL latitude cutoff, total hops, SAA crossings.

Then a visual hop list showing every node in the path with color-coded dots:
- White → User origin
- Cyan → Uplink satellite (SAT-N)
- Green → Relay hops (with SAA warning if applicable)
- Amber → Orbital DC (sunlit/eclipse status)
- Green → Return relay hops
- Cyan → Gateway satellite (SAT-N)
- Green → Ground gateway (with weather)

Second code block explaining:
```
E_hop = e_link · d_hop + e_point       // optical pointing + link energy
Q_e = ρ / (1 − ρ)                     // M/M/1 congestion model
```

### §5 · Gateway Selection — Site Diversity Analysis

Scoring formula:
```
score(GW) = w_lat·dist_norm + w_wx·weather_penalty
// Weather: clear=0.0, cloudy=0.5, rain=1.0
// Rain fade: ITU-R P.618 Ka-band attenuation model
```

Full table of all 8 gateways sorted by total score: Gateway name, Weather status, `dist_norm`, `wx_penalty`, Total Score, CHOSEN badge.

### §6 · Radiation Model — SAA & Space Weather

4-card grid:

| Card | Content |
|---|---|
| SAA | Van Allen belt dip explanation, bounding box coordinates, actual crossing count for this run |
| Radiation Penalty Term | `R_n = 𝟙[node n inside SAA] · severity(Kp)` formula, Kp index explanation, Google Suncatcher HBM DRAM reference |
| Eclipse Model | Cylindrical umbra explanation, current DC eclipse status |
| Solar/Eclipse Term | `S_n = 𝟙[eclipse] · (1 − battery_SoC)` formula, actual DC battery SoC and computed penalty |

### §7 · What Each Policy Would Have Done Differently

Code block comparing all 4 policies applied to the exact same request:
- Shows each policy's weight vector
- States what DC it would choose
- Shows SAA behavior
- Gives estimated RTT

Formatted with syntax highlighting (policy names in purple, RTT values in cyan, chosen policy result in green).

### §8 · Research Grounding & References

Code block listing every physical constant and parameter with its source:

```
c_vacuum  = 299,792 km/s    // NIST definition
c_fiber   = 203,940 km/s    // c / 1.47 (silica n ≈ 1.47)
C_ISL     = 100 Gbps        // ADA Space Three-Body constellation (May 2025)
C_FSO_lab = 1.6 Tbps        // Google Suncatcher free-space optical (lab, 2025)
inc_deg   = 53°             // Starlink shell inclination (Walker-Delta)
alt_km    = ~550 km         // Starlink operational altitude
elev_mask = 25°             // Starlink ground-station elevation mask

// Routing methodology:
// Hypatia (Kassing et al., IMC 2020) — LEO RTT validation methodology
// MegaCacheX (2025) — 3-tier space CDN architecture
// GRouting / GRLR / GDRL-SFCR — GNN+DRL learned routing lineage
// Google Suncatcher preprint (2025) — solar/radiation/optical physics
```

---

## Simulation Engine — JavaScript Functions

| Function | Purpose |
|---|---|
| `initSatellites()` | Creates the 72-satellite array with Walker-Delta parameters; marks 3 as DCs |
| `updateSatellites()` | Advances orbital mechanics per frame — updates `lat`, `lon`, `eclipsed`, `inSAA`, `battery` for every satellite |
| `isEclipsed(lon)` | Returns true if satellite longitude is in the cylindrical shadow zone (diff > 130° from sun) |
| `inSAA(lat, lon)` | Returns true if coordinates fall inside the SAA bounding box |
| `project(lat, lon, w, h)` | Equirectangular → pixel coordinates |
| `drawMap(w, h)` | Background, grid lines, continent polygons, SAA overlay |
| `drawSatellites(w, h)` | ISL mesh lines, then satellite dots (with DC/SAA/eclipse styling) |
| `drawGateways(w, h)` | Diamond shapes at gateway positions, weather-colored |
| `drawCities(w, h)` | City dots; selected city gets larger dot + ring + label |
| `drawRoute(w, h)` | Draws completed path segments + animated packet glow dot |
| `drawLegend(w, h)` | Bottom-left legend box |
| `render()` | Main animation loop — `clearRect` → `drawMap` → `drawSatellites` → `drawGateways` → `drawRoute` → `drawCities` → `drawLegend` → increment `time` → `requestAnimationFrame` |
| `findBestDC()` | Scores all 3 DCs by cost function, returns argmin |
| `findBestGateway()` | Scores all 8 gateways by cost function, returns argmin |
| `findNearestSat(lat, lon)` | Finds nearest non-DC satellite (Euclidean distance in lat/lon space) |
| `setWeightUI(w)` | Animates the 5 weight bars to new values |
| `addDecision(...)` | Creates a single decision step DOM element with slide-in animation |
| `runSimulation()` | Async 5-step flow: uplink → DC → ISL → gateway → complete; builds `routePath`; populates metrics; stores `lastSimData` |
| `buildDeepDive()` | Reads `lastSimData` and generates all 8 modal sections as HTML |

### `lastSimData` Object

Stored after each simulation run and consumed by `buildDeepDive()`:

```js
{
  city, service, policy,
  uplink,         // uplink satellite object
  dc,             // chosen DC object
  hopSats,        // array of intermediate relay waypoints
  saaCross,       // count of SAA-crossing hops
  gw,             // chosen gateway object
  gwSat,          // gateway-side downlink satellite
  nHops,          // relay hop count (2 or 3)
  rtt,            // total RTT in ms
  baseline,       // latency-only baseline RTT
  stretch,        // % overhead vs baseline
  propMs,         // one-way propagation delay
  procMs,         // processing delay
  wxMs,           // weather penalty delay
  baseDist,       // estimated path distance in km
  weights,        // policy weight vector
  allDCs,         // all 3 DCs with computed scores for this request
  allGWs,         // all 8 gateways with computed scores for this request
}
```

---

## RTT Calculation Model

```
baseDist  = 6000 + nHops × 1200  km   (estimated orbital arc distance)
propMs    = baseDist / 299,792 × 1000  ms  (one-way vacuum propagation)
procMs    = {42 | 16 | 6}  ms           (service compute tier)
wxMs      = {0 | 8 | 22}   ms           (clear | cloudy | rain gateway penalty)

RTT       = propMs × 2 + procMs + wxMs

baseline  = propMs × 1.6 + procMs      (latency-only, straight-line approximation)
stretch   = (RTT / baseline − 1) × 100 %
```

---

## Deployment

- **Platform**: Vercel (static hosting, no server)
- **Deploy method**: Connected to GitHub repo `uditjainstjis/orbital-cdn`, auto-deploys on push to main
- **Build**: None — Vercel serves `index.html` directly
- **Assets**: Zero external assets (fonts loaded from Google Fonts CDN via `@import`)

---

## Known Constraints / Design Decisions

- Weather values for gateways are **static** (set in the GATEWAYS array) — they don't change between runs. A future enhancement would pull live weather data.
- Relay hop positions are **interpolated with random jitter** (`±3.5°`) — not true shortest-path ISL routing. They're visually representative, not computationally optimal.
- Continent polygons are **rough approximations** (6–8 vertices each) for performance — not GeoJSON coastlines.
- Cross-plane ISLs are disabled above **|lat| 60°** matching real-world Starlink operational constraints.
- The site is **not responsive** below ~900px width — designed for desktop/hackathon demo use.
- No `prefers-reduced-motion` handling — the canvas animation runs unconditionally.
