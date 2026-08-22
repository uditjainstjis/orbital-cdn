# Orbital CDN — Features & Architecture

> **Live**: https://orbital-cdn.vercel.app  
> **Repo**: github.com/uditjainstjis/orbital-cdn  
> **Stack**: Vite + globe.gl + three.js + satellite.js — static site, no backend  
> **Constellation**: 180 satellites (9 planes x 20, 53 deg, 550 km) + 4 orbital data centres at 640 km  

---

## What it is

A routing simulator for a space-based content delivery network. You pick an origin city, a
request type and a routing policy; the engine chooses an orbital data centre and a ground
gateway, computes the end-to-end latency from the real geometry of the path, and plays the
decision back as a camera sequence with the reasoning shown step by step.

Satellite positions come from real Starlink TLEs fetched from CelesTrak and propagated with
SGP4 (`satellite.js`), falling back to an analytic Walker-Delta model when the network is
unavailable. Eclipse state and South Atlantic Anomaly transit are computed per satellite per
frame and both feed the routing cost function.

## The finding

Every request the network serves is logged, and the analytics view summarises outcomes over a
selected window. The headline result is measured, not asserted:

**Orbital routing beats long-haul terrestrial fibre for ~66% of requests overall — but the
advantage is concentrated where cloud regions are far away.** Sao Paulo wins ~100% of the time,
Lagos ~89%, Delhi ~90%; London and New York win almost never, because they already sit next to
eu-central-1 and us-east-1.

The terrestrial baseline is modelled from great-circle distance to the nearest real cloud
region with a 1.42 route-winding factor, light at 204,190 km/s in silica, switching cost, and
last-mile access latency. It lands close to real measured RTTs (Delhi to Singapore 79 ms,
London to Frankfurt 21 ms, New York to us-east-1 15 ms), so the comparison is checkable.

## Adaptive routing

The routing cost function is expressed entirely in latency-equivalent milliseconds, so policy
weights trade like against like:

```
C(DC) = w_lat * reach_ms + w_sol * 25 * eclipsed + w_rad * 40 * inSAA + w_sol * 30 * gain * learned
C(GW) = w_lat * reach_ms + w_wx  * fade_ms       + w_wx  * 30 * gain * learned
```

The `learned` terms are not authored constants. They are recomputed from the request log over
whichever window is selected in the analytics view, so the router's behaviour is a function of
what the network actually observed. Toggling adaptive routing off drops both terms to zero and
recovers the fixed-policy engine.

Honest limitation: the gateway half of the loop carries real signal (a persistently rain-degraded
gateway accumulates a large penalty and gets routed around). The data-centre half is weak,
because averaged over days every DC spends a similar fraction of its orbit in eclipse — there is
little to learn. That is a property of the physics, not a tuning choice, and the analytics view
shows the learned values as they are rather than inflating them.

## Product state

`src/telemetry.js` is an append-only event log in `localStorage`, capped at 6,000 records, with
quota-exceeded recovery. Every request writes one flat record. The store backs:

- windowed aggregation over 1H / 24H / 7D / 30D / ALL with per-window bucket granularity
- p50 / p95 / mean latency, solar-served share, SAA hop counts, fibre win rate and mean saving
- breakdowns by policy, origin city, gateway and data centre
- derived findings rendered as prose
- the adaptive profile that feeds back into routing
- JSON export of the selected window

The shape is a plain event log, so moving to a real time-series store is a transport change.

## Seeded history

`src/seed.js` generates 30 days of operating history on first boot, so the analytics view is
populated on a cold open. **This data is simulated and labelled as such in the UI.** It is
produced by the same path geometry and fibre baseline the live engine uses, driven by three
time-varying inputs: diurnal demand per city, orbital eclipse against sub-solar longitude, and
weather fronts that persist for hours. The generator is seeded deterministically (`20260614`),
so every viewer sees identical history. Live requests you send are recorded separately and are
distinguished from seeded rows in the analytics header.

## Layout

- Left panel — origin, request type, routing policy with live weight bars
- Centre — 3D Earth, 180 satellites, ISL mesh, SAA overlay, gateways, animated route arcs
- Right panel — step-by-step routing decisions, live metrics, real per-policy comparison
- `Network Analytics` — the windowed summary and the adaptation panel
- `Architecture & Insights` — the model, the cost function, and references

## Running it

```
npm install
npm run dev      # http://localhost:5173
npm run build
```

---

_`index.old.html` is a dead single-file predecessor kept only for history. It is not built or
served, and it does not describe this application._
