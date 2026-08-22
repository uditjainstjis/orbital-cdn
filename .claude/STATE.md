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

## Live / refuted
- LIVE: dev server `npx vite --port 5178`. Build clean.
- NOT YET DONE: push + Vercel deploy (needs Udit's go-ahead), README/FEATURES rewrite.
- REFUTED: `FEATURES.md` describes the dead `index.old.html`, not this app.

## Standing orders
- Do not claim a ceiling; attack it with an agent first.
- Every number a decision turns on gets read first-hand, not via an agent summary.
