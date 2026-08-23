# Orbital CDN — STATE
_Updated 2026-08-22. Canonical. Not a log._

## Objective (locked)
Ship an adaptive-telemetry layer on orbital-cdn: every request persisted, a time-range
summary of usage/outcome patterns, feeding back into routing.
**Done when:** live on the public URL, works in a fresh browser, demoable in 60 s.

## Context
Zoom hackathon. Round 1 finished outside top 20; scraped into round 2 at a bad rank.
Round-2 brief, verbatim: *"Improve the part of your existing MVP most related to
adaptability so that it can summarize usage or outcome patterns over a selected time
period. The work should include both user-facing behavior and the product state needed
to support it."* Submission = repo + live URL. <24 h.

## Governing numbers (measured, from the seeded 30-day history)
- 991 requests, p50 **74 ms**, p95 **145 ms**, 92 % solar-served
- Beat terrestrial fibre on **66 %** of requests, mean saving **35 ms**
- Win rate by origin: Sao Paulo **100 %**, Dubai 93 %, Delhi 90 %, Lagos 89 %,
  Tokyo 78 %, Sydney 72 % — **London 3 %, New York 5 %**
- Policy p50: latency **63 ms** < reliable 78 < balanced 79 < green 80
- Fibre baselines match real measured RTTs: Delhi→SG 79 ms, NY→us-east-1 15 ms,
  London→Frankfurt 21 ms, Sao Paulo→us-east-1 138 ms

**The thesis, and it is measured not asserted:** orbital wins exactly where cloud
regions are far away, and loses where they are close.

## What shipped this session
- `src/telemetry.js` — append-only event log (localStorage), windowed aggregation
  (1H/24H/7D/30D/ALL), derived insights, `adaptiveProfile()`
- `src/seed.js` — 30 days of history at first boot, deterministic seed, driven by
  diurnal demand + orbital eclipse + persistent weather fronts
- `src/dashboard.js` — analytics overlay: window selector, 6 KPIs, SVG traffic/latency
  chart, breakdowns, fibre win-rate panel, adaptive-vs-fixed table, JSON export
- `src/engine.js` — cost function rewritten into **latency-equivalent ms**; real
  great-circle path geometry; learned penalties bias DC + gateway choice; real
  `comparePolicies()` counterfactual
- First-run intro card stating the problem, leading with the strongest finding

## Bugs found and fixed (all were real, all verified)
1. **Skip deadlock** — `sleep()` stored only the timer id, so `clearTimeout` killed the
   resolver; spacebar or ⏭ permanently bricked Send/Replay/DeepDive/hover. Now the
   resolver is held and called on clear. *This is the most likely reason round 1 died.*
2. **rAF hang in background tabs** — `main()` awaited a frame that never fires unfocused;
   the whole app silently never booted. Now raced with a 120 ms timer.
3. **Geography ignored** — RTT was `6000 + nHops*1200`; all 8 cities returned identical
   latency. Now real haversine path geometry.
4. **Fake policy comparison** — hardcoded 1.15x / 1.22x multipliers. Now genuinely
   re-runs the request under each policy against the same constellation state.
5. **Unit mismatch in cost function** — binary eclipse penalty outweighed half a planet
   of detour; "balanced" routed Delhi to the far side of Earth. All terms now in ms.
6. **Round-trip double-count** — path already ran out to the DC and back to the gateway,
   then was doubled again. Sydney was charged 45,000 km.
7. **Insights page contradicted the code** — claimed 72 sats / 6 planes (real: 180 / 9)
   and published a cost function with two terms (`w_eng`, `w_cong`) that never existed.

## Adaptive loop — measured, after the second review
- Learned gateway penalties (0.06-0.31) no longer track current weather (0.00 this
  block) — the closed-form `weatherMs/22` collapse is gone; weather now varies at
  runtime in 6-hour blocks per gateway (`network.js gatewayWeather`).
- DC signals split by objective: tail-latency penalty 0 → 0.563, SAA penalty 0 → 0.245.
  Historical eclipse share was REMOVED — the engine reads `dc.eclipsed` instantaneously,
  so a windowed average of it is strictly less information, double-charged.
- Window selector now changes routing: 7D vs 30D differs in 4/32, 24H vs 7D in 5/32.
  Before this change 7D/30D/ALL were byte-identical in 96/96.
- Adaptive on vs off: **6/32 route flips**, mean RTT 115 ms vs 118 ms, max 215 ms (sane).
- Seed now calls the engine's own `dcCostMs`/`gwCostMs`. Previously it scored in
  normalised units and disagreed with the shipped router on 17.7% of balanced DC picks.
- Policy Pareto frontier (n=739-1158): latency p50 65 ms / 13.7% rain · balanced 67 ·
  reliable 70 ms with **0.0% rain exposure** · green 78 ms, longest paths for solar.

## Grounding — externally checkable, not self-generated
The fibre baseline is no longer modelled. It is **measured third-party data**:
WonderNetwork ICMP between VPS nodes (sampled 2026-08-22), cross-checked against
Azure's published 30-day P50 backbone medians (Jul 2026). Shown in a Grounding
panel alongside what the physics model *would* have predicted, so the gap is visible.

| origin | km to region | measured | Azure P50 | my model |
|---|---|---|---|---|
| New York | 325 | 7.5 | 8 | 15 |
| London | 637 | 14.4 | 17 | 21 |
| Delhi | 4,145 | 92.1 | 53 | 79 |
| Dubai | 4,836 | 122.2 | 100 | 91 |
| Lagos | 4,873 | 118.5 | — | 92 |
| Tokyo | 5,322 | 66.4 | 72 | 99 |
| Sydney | 6,305 | 92.7 | 95 | 116 |
| Sao Paulo | 7,626 | 113.1 | 118 | 138 |

**The validation that matters:** published LEO-vs-fibre crossover for a 550 km shell
is **4,472 km** (Chaudhry & Yanikomeroglu, arXiv:2203.00154); Handley (HotNets '18)
says ~3,000 km for a higher shell. This sim independently lands in the same region —
loses at London (637 km) and New York (325 km), wins from Delhi (4,145 km) up.

Other corrections from the grounding pass:
- SAA box was -80..+10 lon; published extent is **-90..+40** (NASA GSFC). Fixed.
- Gateways were city-centre pins; now **real teleport coordinates** (Seletar,
  Usingen, Boydton, Hitachinaka, Santana de Parnaiba, Belrose, Lekki). Mumbai has
  no published coordinate and is labelled approximate.
- Constellation is honestly described as a **1/8-scale model** of Starlink's
  authorised Gen1 shell 1 (1,584 sats, 72x22, 550 km/53.0°, FCC 21-48).
- Fibre constants checked: n=1.468 is exact; route factor 1.42 alone is optimistic
  (published rule of thumb 2.1, best-achievable 1.3) but the composite model lands
  at effective stretch ~1.84-1.96 long-haul vs measured median 2.05.

## Live / refuted
- LIVE: dev server `npx vite --port 5178`. Build clean.
- NOT YET DONE: push + Vercel deploy (needs Udit's go-ahead), README/FEATURES rewrite.
- REFUTED: `FEATURES.md` describes the dead `index.old.html`, not this app.

## Standing orders
- Do not claim a ceiling; attack it with an agent first.
- Every number a decision turns on gets read first-hand, not via an agent summary.

## Predictive layer + autonomous ops (branch `predictive-ops`, 2026-08-22)

**Rejected from the supplied spec, with reasons:**
- *Train on TinyGS to predict Ka-band gateway rain degradation.* TinyGS is LoRa at ~437 MHz.
  ITU-R P.838-3 Table 5: rain coefficient k = **0.0000259 at 1 GHz vs 0.0916 at 20 GHz**. The
  dataset physically cannot contain the signal the spec wants learned from it.
- *ML for rain fade.* Solved analytically by ITU-R P.618/838/839 — implemented exactly instead.
- *FastAPI backend.* Would break the static deploy and add the demo's only runtime dependency.
  Model is exported to JSON (71 KB) and evaluated in-browser.
- Not built: SatNOGS/Space-Track adapters, IMERG auth pipeline, historical-TLE reconstruction,
  LSTM/TCN, spacecraft-anomaly model, LLM explanation layer.

**Built:**
- `src/predict/itu.js` — P.838-3 + P.618-13 + P.839-4. `npm run test:itu` reproduces all
  **28 published Table 5 coefficients** at 1/12/19/20/25/28/30 GHz within 2%.
- `src/predict/weather_trace.json` — **real** NASA POWER hourly precipitation, 8 real teleport
  sites, 2,928 h each (Apr–Jul 2026). Unit trap: POWER hourly `PRECTOTCORR` is **mm/day**, /24.
- `src/predict/fade_model.json` — LightGBM, trained offline, time-split + unseen-site split.
- `src/predict/{gbm,weather,agent,experiment,ui,config}.js`

**Measured — model (held-out, time-split):**
| horizon | persistence AUC / Brier | LightGBM AUC / Brier |
|---|---|---|
| +1h  | 0.998 / 0.0294 | 0.999 / **0.0030** |
| +3h  | 0.990 / 0.0290 | 0.991 / **0.0071** |
| +6h  | 0.973 / 0.0307 | 0.949 / **0.0139** |
| +12h | 0.944 / 0.0329 | 0.892 / **0.0271** |

Persistence wins ranking at long horizons; the model wins **calibration** everywhere (2–10x
Brier). Calibration is what a router needs because it multiplies P(outage) by a cost.

**Measured — paired 4-arm experiment (5,600 requests, 2,800 recorded hours, identical schedule):**
- A CURRENT (blind): **80 failures**, mean 4.0 ms
- R REACTIVE (sees fade now): **2 failures**, mean 3.7 ms
- B PREDICTIVE (sees forecast): **0 failures**, mean 3.9 ms
- C AUTOPILOT (sticky + agent): **0 failures**, mean 9.2 ms, 9 reroutes (7 proactive)

**The honest finding: most of the benefit is from OBSERVING, not forecasting** — 78 of 80
failures removed by reacting to current fade; forecasting removes the last 2.
**Negative result:** the agent matches predictive routing on failures but costs +5.3 ms mean
latency, because hysteresis on a sticky route buys nothing when re-selection is free.

**Bugs found and fixed during this work:**
- `predictiveCostMs` returned 0 when no horizons were supplied, silently discarding the
  observed-fade term — this made the REACTIVE control arm identical to CURRENT and would have
  shipped as a false finding.
- The A/B/C agent arm used one global sticky gateway for all 8 origins; now per-origin.
- Agent tick re-rendered the overlay and wiped experiment results; result is now cached.
- Autopilot panel overlapped the left control column, hiding the policy weight bars.

**Only Singapore produces fade above the 6 dB margin in this trace** (19% of hours, max 19.9 dB);
Mumbai/Tokyo/Lagos a handful; Frankfurt/Virginia/Sao Paulo/Sydney never. That bounds how much
any weather-aware routing can help, and it is why the experiment runs the full trace.

## Visual differentiation pass (2026-08-22)
**Problem Udit raised:** other teams at the same hackathon ship the identical
globe.gl-on-black-with-cyan-glow look. At a 3-second glance we were indistinguishable.

**Response — two moves, not a restyle:**
1. **Centre view is now the crossover chart** (`src/crossover.js`), not the globe. Geodesic
   rings at the published **4,472 km** break-even distance around each cloud region, with the
   8 cities plotted at their *measured* win rate. The cities land on the correct side of the
   line without being placed there. This is the one picture no other team can draw.
   Coastlines: Natural Earth 110m, RDP-simplified to **813 points / 10 KB**, cropped 80N–58S.
   Globe is one click away (`EVIDENCE | LIVE 3D`) and auto-engages for the routing cinematic.
2. **Instrument palette** — warm graphite ground, signal amber as the single accent, green/red
   reserved strictly for measured outcomes. Corner ticks, hairlines, tabular numerals, no bloom.
   79 uses of `--cyan` meant this was a token change, not a rewrite.

Also: **all 143 emoji removed**, replaced by a 48-icon stroke set (`src/icons.js`) hydrated
from `<i data-ic>` placeholders via MutationObserver. Flag emoji dropped entirely (they do not
render on Windows Chrome) in favour of two-letter country chips.

**Gotcha worth remembering:** `getComputedStyle` is unreliable in a backgrounded Chrome tab —
style recalc is throttled, so it reported opacity 1 on elements whose inline `!important` said
0. Verify visual state with a screenshot, not a computed-style read. This is the third time
background-tab throttling has produced a false negative in this project.
