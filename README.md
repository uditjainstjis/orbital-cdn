# Orbital CDN

**A routing and control plane for a content-delivery network whose edge nodes are in low Earth orbit.**

**[orbital-cdn.vercel.app](https://orbital-cdn.vercel.app)** · static site, no backend

---

A CDN keeps copies of content close to users and picks the fastest route to
one. Every CDN that exists assumes its map is fixed. In orbit the map is the
variable: nodes move at 7.5 km/s, they lose power in eclipse, radiation
corrupts packets over the South Atlantic Anomaly, and rain closes the ground
gateway a request has to come down through.

This is the layer that decides, per request, **which orbital data centre serves
it and which gateway it lands at** — given all four of those constraints at the
moment the request arrives.

Since November 2025, SpaceX has filed with the FCC for up to a million compute
satellites, Google has put TPUs on the Suncatcher roadmap, and Starcloud has run
an NVIDIA H100 in orbit. The standard objection to all of it is that orbit suits
*training*, not latency-sensitive inference. That objection is a routing
problem, and this is an attempt to measure it honestly rather than assert it away.

---

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # 27 tests, no dependencies beyond Node's own runner
npm run build
```

Requires Node 18+. `npm test` needs no browser and no network.

---

## What is actually modelled

| Layer | Implementation | Source |
|---|---|---|
| Orbits | 180 satellites propagated with **SGP4** from live CelesTrak TLEs; Walker-Delta fallback when offline | `src/sats.js` |
| Rain fade | **ITU-R P.838-3 / P.618-13 / P.839-4**, full chain | `src/predict/itu.js` |
| Weather | **NASA POWER** hourly precipitation, 4 months, 8 gateway sites | `ml/fetch_weather.py` |
| Fibre baseline | **Measured** WonderNetwork inter-VPS RTT, cross-checked against Azure's published P50 backbone medians | `src/engine.js` |
| Forecasting | LightGBM, trained offline, exported to JSON and evaluated in-browser | `ml/train_fade_risk.py`, `src/predict/gbm.js` |
| Routing | Cost minimisation over data centres and gateways | `src/engine.js` |

### The one idea the design rests on

Every constraint is converted into **latency-equivalent milliseconds** before
anything is compared:

```
C(DC) = w_lat·reach + w_sol·eclipse + w_rad·SAA + learned penalties
```

Sunlight, radiation and rain are not thresholds to trip — they are costs to
trade against distance, in a single unit. That is what makes four routing
policies (`latency`, `balanced`, `reliable`, `green`) the *same* engine with
different weights rather than four hand-written special cases.

---

## Results

Measured over 5,600 requests spanning 2,800 hours of real weather, four
arms with identical inputs:

| Arm | What it sees | Failures | Mean latency |
|---|---|---|---|
| A · Blind | nothing | 80 | — |
| R · Reactive | current conditions | 2 | baseline |
| B · Predictive | 1–12 h forecast | **0** | +0.2 ms |
| C · Autopilot | forecast + agent | **0** | **+5.3 ms** |

**Of the 80 failures removed, observation alone removes 97.5%.** Forecasting
removes the last two. The autonomous agent removes nothing and costs 5.3 ms.

That negative result is reported inside the product. Publishing only arms A
and B would have licensed the claim *"predictive routing eliminated 100% of
failures"* — literally true, and materially misleading.

### The forecaster does not win the way you would expect

| Horizon | Persistence AUC / Brier | LightGBM AUC / Brier |
|---|---|---|
| +1 h | 0.998 / 0.0294 | **0.999** / **0.0030** |
| +6 h | **0.973** / 0.0307 | 0.949 / **0.0139** |
| +12 h | **0.944** / 0.0329 | 0.892 / **0.0271** |

Persistence is hard to beat at *ranking* imminent fade and we lose to it at 6
and 12 hours. What the learned model wins is **calibration** — Brier improves
2–10× at every horizon. Because the router *multiplies* a probability by a
cost rather than sorting by it, calibration and not discrimination is the
operative property.

### External validation

The published LEO-vs-fibre crossover for a 550 km shell is **4,472 km**
(Chaudhry & Yanikomeroglu, [arXiv:2203.00154](https://arxiv.org/abs/2203.00154)).
Using measured fibre baselines this simulator loses at London (637 km) and New
York (325 km) and wins from Delhi (4,145 km) outward — placing its own crossover
in the same region. **No parameter was fitted to that figure.**

### The bound we do not hide

Across the four-month weather record, only **one of eight gateways** exceeds
the 6 dB link margin, in 19% of its hours. The measurable benefit of any
weather-aware routing is bounded above by that exposure. This is stated in the
product and in the paper.

---

## Adaptability

Every served request is appended to a telemetry log. Selecting a period
(`1H / 24H / 7D / 30D / ALL`) summarises usage and outcomes over exactly that
window, and the penalties derived from it feed back into the cost function for
the next request.

Recommendations are **surfaced, not silently applied** — the policy you chose
keeps meaning what it says. `src/telemetry.js` is the product state;
`src/dashboard.js` is the user-facing surface. Both are covered by
`test/adaptation.test.mjs`.

---

## Architecture

```
index.html ──▶ src/main.js            stage routing, keyboard, lifecycle
                 │
                 ├── engine.js         cost model, policy weights, simulation
                 │     ├── network.js  cities, gateways, weather
                 │     ├── sats.js     SGP4 propagation, three.js scene
                 │     └── predict/    itu.js · weather.js · gbm.js · agent.js
                 │
                 ├── telemetry.js      append-only event log  ← product state
                 ├── dashboard.js      windowed analytics     ← user-facing
                 ├── crossover.js      break-even map (SVG, no dependency)
                 └── palette.js        the single source of colour
```

**Everything with a number in it is a pure function**, which is why the test
suite needs no browser: `dcCostMs`, `gwCostMs`, `predictiveCostMs`,
`haversine`, `pathDistanceKm`, `summarize`, `adaptiveProfile` and the whole ITU
chain are all input → output.

Rendering is separate from deciding. `engine.js` never touches the DOM;
`sats.js` never decides a route.

### Scaling

The static-site build is a demonstration surface, not the scaling claim. What
would actually scale:

- **Routing is O(|DC| × |GW|) per request** — 4 × 8 here, and a real
  constellation changes those constants, not the complexity class. The
  decision is a `reduce` over candidates with no global state.
- **The forecaster is a static artefact.** LightGBM trains offline and exports
  to JSON; inference is tree traversal, so it runs at the edge or in the
  browser with no model server.
- **Telemetry is an append-only event log** behind a five-function interface.
  It is backed by `localStorage` here because the site has no backend; moving
  to a real time-series store is a transport change, not a rewrite.
- **Windowed aggregation is the only read pattern**, which is the access shape
  time-series databases are built for.

The honest limit: this is a **simulator**, and it says so on every screen that
shows a simulated number.

---

## Testing

```bash
npm test
```

27 tests, zero dependencies, using Node's built-in runner.

- `src/predict/itu.test.mjs` — validates **28 of 28** published ITU-R P.838-3
  coefficients to within 2%.
- `test/engine.test.mjs` — geodesy against published distances, and a
  regression test for **every cost-model bug that has shipped**: the round-trip
  double-count, the unit mismatch between penalty terms, learned radiation
  being scaled by the wrong weight, and the predictive cost that returned zero
  and made a reactive router indistinguishable from a blind one.
- `test/adaptation.test.mjs` — window selection, aggregate correctness, and
  that penalties are derived from the selected period.

Writing these found a real data-loss bug: `persist()` treated *any* storage
exception as quota exhaustion and responded by discarding half the log, so in
any browser with site data blocked every recorded request silently destroyed
half the user's telemetry. Fixed in `src/telemetry.js`.

---

## Documentation

| | |
|---|---|
| [`DESIGN.md`](DESIGN.md) | Why the system is shaped this way, which invariants must survive a change, and what was tried and rejected |
| [`paper/orbital_cdn.tex`](paper/orbital_cdn.tex) | The physics, cost model, forecaster and agent, written up formally |
| [`FEATURES.md`](FEATURES.md) | Feature inventory |

---

## Stack

Vite · three.js · globe.gl · satellite.js — no backend, no framework, no CSS
library. Offline toolchain: Python, LightGBM.
