# Orbital CDN — Design

> The document to read before changing anything. It explains *why* the system is
> shaped the way it is, which invariants must survive your change, and which
> approaches were tried and rejected. Implementation detail that the code makes
> obvious is deliberately omitted; everything here is a decision, a constraint,
> or a scar.

**Live:** orbital-cdn.vercel.app · **Stack:** Vite · globe.gl · three.js ·
satellite.js — static site, no backend. Offline toolchain: Python, LightGBM.

---

## 1 · What this is, precisely

A routing and control plane for a hypothetical LEO content-delivery network,
plus the evidence that its central claim is true and the boundaries where it
isn't.

It is **not** a claim that space is faster. It is an instrument that locates the
distance beyond which orbital routing wins, prices the constraints that have no
terrestrial analogue, and reroutes around predicted weather before failure.

That distinction governs every design decision below. When a choice was between
*looking impressive* and *being checkable*, checkable won.

---

## 2 · Architectural spine

```
                       ┌─────────────────────────┐
   real TLEs  ────────▶│  sats.js  (SGP4)        │
   (CelesTrak)         │  positions, eclipse,SAA │
                       └───────────┬─────────────┘
                                   │ constellation state
   NASA POWER  ──▶ weather_trace   ▼
   (baked JSON)   ┌───────────────────────────────────────┐
                  │            engine.js                  │
   telemetry ────▶│  cost in latency-equivalent ms        │◀── predict/weather.js
   (learned ρ)    │  → chooses DC + gateway               │    (ITU fade, forecast)
                  └───────────┬───────────────────────────┘
                              │ decision + full reasoning
              ┌───────────────┼────────────────┐
              ▼               ▼                ▼
        sequence.js      telemetry.js     predict/agent.js
        (8-beat anim)    (event log)      (observe→act→verify)
              │               │                │
              └───────────────┴────────────────┘
                              ▼
                 crossover.js · dashboard.js · predict/ui.js
                 (evidence chart, analytics, autopilot panel)
```

**One-way dependency rule.** `engine.js` may import from `predict/`, but
`predict/` must never import from `sequence.js`, `dashboard.js` or `ui.js`.
Presentation depends on decision; decision never depends on presentation. The
one exception is `predict/agent.js` importing `gwCostMs` from `engine.js` — the
agent must score routes with *exactly* the function the router uses, and
duplicating it is how the two silently diverge (§9.3).

---

## 3 · Module map

| Module | LOC | Responsibility |
|---|---:|---|
| `engine.js` | 405 | Cost functions, path geometry, fibre baselines, policy counterfactuals |
| `sats.js` | 346 | SGP4 propagation, meshes, ISL graph, eclipse/SAA state |
| `telemetry.js` | 415 | Append-only event log, windowed aggregation, adaptive profile |
| `seed.js` | 222 | 30 days of synthetic history at first boot |
| `dashboard.js` | 508 | Analytics overlay: windows, KPIs, SVG charts, grounding table |
| `crossover.js` | 175 | The evidence chart — geodesic break-even rings |
| `sequence.js` | 305 | 8-beat routing cinematic |
| `ui.js` | 497 | Left/right panels, deep-dive modal, inspector |
| `insights.js` | 593 | Architecture essay page |
| `main.js` | 505 | Boot, stage switching, shell, event feed |
| `icons.js` | 139 | 48-icon stroke set + hydration |
| `globe.js` | 118 | Earth, atmosphere, clouds, sun vector |
| `network.js` | 176 | Gateways, cities, SAA polygon, time-varying weather |
| `predict/itu.js` | 204 | **ITU-R P.838-3 / P.618-13 / P.839-4** |
| `predict/weather.js` | 200 | Trace clock, feature construction, forecasting |
| `predict/agent.js` | 310 | Policy engine, gates, verification, calibration |
| `predict/experiment.js` | 228 | Paired four-arm evaluation |
| `predict/config.js` | 36 | **Every tunable constant** |
| `predict/gbm.js` | 41 | Tree-ensemble evaluator |
| `ml/*.py` | 363 | Weather ingestion, training, JSON export |

**Data artefacts:** `weather_trace.json` 141 KB · `fade_model.json` 71 KB ·
`land.json` 10 KB · `fade_model_metrics.json` 5 KB.

---

## 4 · The invariants

Break one of these and the system is wrong in a way tests may not catch.

### 4.1 Every cost term is in latency-equivalent milliseconds

Non-negotiable. Adding a bare `0..1` penalty to the cost function silently makes
it dominate half a planet of detour.

*This actually happened.* An early cost function mixed a distance normalised to
`[0,1]` with binary indicator penalties of magnitude 1. Under balanced weights,
one eclipse flag outweighed 20,000 km of detour, and the router dispatched Delhi
traffic to the antipodal hemisphere chasing sunlight. Expressing eclipse as
"worth 25 ms of detour at unit weight" made the trade explicit, auditable, and
explicable to a non-specialist.

### 4.2 `pathDistanceKm()` returns the complete out-and-back path

It already egresses to the DC and descends to the gateway. **Do not double it to
get RTT.** Doing so charged Sydney 45,000 km.

### 4.3 The downlink must have line of sight

The descent routes via a satellite actually above the gateway. A direct
`DC → gateway` slant range traverses the planetary interior whenever the DC is
on the far side.

### 4.4 `sleep()` must resolve its promise when cleared

In `sequence.js`, cancelling the timer alone leaves the awaiting sequence
suspended forever, which deadlocks `seqActive` and permanently disables Send,
Replay, Deep Dive and hover. **This is the single worst bug the project has
had** — spacebar bricked the entire UI with no recovery but reload.

### 4.5 Never `await requestAnimationFrame` unraced

rAF does not fire in a background tab. `main()` awaited one and the whole
application silently never booted for anyone who opened the link in a background
tab. Always race it with a timeout.

### 4.6 Prediction may never be a single point of failure

If the predictive layer throws, times out, or is disabled, `J ≡ 0` and the
deterministic engine is recovered unchanged. Routing must work with the ML
subsystem entirely absent.

### 4.7 Seeded history and live requests must use the same functions

`seed.js` calls `engine.js`'s own `dcCostMs`/`gwCostMs`. When it had its own
scoring it disagreed with the shipped router on **17.7%** of balanced DC picks —
meaning the dashboard was analysing a different model's decisions than the one
the user was driving.

---

## 5 · Physics layer (`predict/itu.js`)

### 5.1 Why analytic and not learned

Rain fade *given a rain rate* is a solved problem with an international
standard. Implementing ITU-R P.838-3 / P.618-13 / P.839-4 is more accurate than
any model we could train, and it is checkable by a reviewer.

**The validation is the credibility anchor.** `npm run test:itu` reproduces all
28 published Table 5 coefficients across 1–30 GHz within 2%. A mistyped constant
cannot pass silently. Write this test before touching the physics.

### 5.2 The trap in the coefficient fits

`k` is fitted in **log space and must be exponentiated**; `α` is **not**.
Transposing them yields plausible-magnitude output that is wrong everywhere.

### 5.3 The admissibility criterion

> A learned component is admissible only where it supplies information
> unavailable by direct observation or by an accepted analytic model.

Consequences, all of which are live in the code:

- Rain fade given rain rate → **analytic**, not learned.
- Future precipitation → **learned**, it is genuinely stochastic.
- Historical eclipse fraction → **excluded**. The engine already reads
  `dc.eclipsed` instantaneously; a windowed average of a deterministic quantity
  is strictly *less* informative than the flag one line above it, and charging
  both double-counts the same orbital geometry.

Systems that learn what they could compute acquire the appearance of
intelligence and the substance of noise.

### 5.4 Outage as a logistic, not a threshold

`Π = σ((A − M)/s)` with `M = 6 dB`, `s = 1 dB`. A hard threshold would assert a
precision that hourly-mean rain input does not support. The smooth transition
encodes estimator uncertainty honestly.

### 5.5 A bias we accept and state

P.618 statistics assume 1-minute integration; our observations are hourly
reanalysis means, which smooth peaks. Fade is therefore **under**-estimated —
conservative, biased *against* our own claims. Keep it that way.

---

## 6 · Cost model (`engine.js`)

```
C_DC(c,d) = w_lat·τ(c,d) + w_sol·25·[eclipsed] + w_rad·40·[inSAA]
          + w_lat·30·γ·ρ_lat(d) + w_rad·30·γ·ρ_rad(d)

C_GW(c,g) = w_lat·τ(c,g) + w_wx·fade_ms(g)
          + w_wx·30·γ·ρ_wx(g) + w_wx·J(g)
```

`τ(a,b) = 2·haversine(a,b)/c₀·1000`, adaptation gain `γ = 0.6`, and `J` is the
predicted-failure term. Every constant lives in `predict/config.js` — **add new
ones there, never inline.**

**Learned terms carry the coefficient of the objective they belong to.** Observed
tail latency is a latency cost (`w_lat`); observed SAA exposure is a radiation
cost (`w_rad`). An earlier version scaled learned *radiation* by `w_sol`, so the
reliable policy discounted it 3× and green amplified it 4.5×.

### 6.1 The policy frontier is emergent

`reliable` reaching *exactly* 0.0% rain exposure for +12 ms median was not
designed — it is what a 0.90 weather weight does. Preserve this: if you retune
weights, re-measure the frontier rather than asserting it.

---

## 7 · Adaptation and prediction

### 7.1 Adaptation must carry real information

The learned gateway penalty once collapsed in closed form to
`weatherMs(weather)/22` — algebraically identical to editing one constant —
because gateway weather was three frozen string literals. Weather now varies at
runtime in 6-hour blocks per site (`network.js gatewayWeather`), so the learned
value is genuinely historical.

**Test for this whenever you add a learned term:** if you can write the learned
value as a closed-form function of currently-observable state, it is decoration.

### 7.2 Forecasting: leakage discipline

Split by **time**, never randomly — consecutive hours are strongly dependent.
Train `[0,1756)`, validation `[1756,2196)`, test `[2196,2928)`. A second split
holds out **entire sites** to test transfer.

### 7.3 Calibration is the operative property

| Horizon | Persistence AUC / Brier | LightGBM AUC / Brier |
|---|---|---|
| +1h | 0.998 / 0.0294 | **0.999 / 0.0030** |
| +3h | 0.990 / 0.0290 | **0.991 / 0.0071** |
| +6h | **0.973** / 0.0307 | 0.949 / **0.0139** |
| +12h | **0.944** / 0.0329 | 0.892 / **0.0271** |

Persistence beats the model on *ranking* at long horizons. The model wins
*calibration* everywhere, 2–10× on Brier. Because the router **multiplies**
`p·Φ` rather than sorting by `p`, calibration is what matters. Do not swap in a
model with better AUC and worse Brier.

### 7.4 The mm/day trap

NASA POWER's hourly endpoint reports `PRECTOTCORR` in **mm/day** despite hourly
sampling. Divide by 24. Missing this inflates every rain rate 24× and makes
every downstream fade figure nonsense.

---

## 8 · The agent (`predict/agent.js`)

A **deterministic policy engine**, explicitly not a learned controller. It
reroutes iff *all* of:

```
trigger ∧ dwell ∧ cooldown ∧ Δcost ≥ δ ∧ Δrisk ≥ ε ∧ confidence ≥ κ_min
```

with `δ = 25 ms`, `ε = 0.15`, dwell 20 s, cooldown 15 s, switching cost 12 ms,
`κ_min = 0.60`.

**The gates are the design.** Dwell and cooldown make the switching sequence
non-Zeno by construction; the margin conditions impose hysteresis so a marginal
cost inversion cannot oscillate the route. An agent without these is worse than
no agent.

**Default authority is ASSIST, deliberately.** No operational satellite
programme delegates unsupervised reconfiguration to a predictive model. Claiming
full autonomy invites a question from a domain reviewer that cannot be won.

**Every decision is verified.** The stated risk is scored against what the
weather actually did, producing a Brier score and reliability bins. *A forecast
that is never scored is an assertion, not a prediction.*

---

## 9 · Evaluation (`predict/experiment.js`)

### 9.1 Pairing is mandatory

All arms see an identical request schedule against an identical weather
realisation. Without pairing, inter-arm variance is dominated by which arm ran
during a storm.

### 9.2 The four arms exist to decompose, not to win

| Arm | Sees | Failures | Mean RTT |
|---|---|---:|---:|
| A Blind | static label only | 80 | 4.0 ms |
| R Reactive | current fade | 2 | 3.7 ms |
| B Predictive | fade + forecast | **0** | 3.9 ms |
| C Autopilot | + standing route | **0** | 9.2 ms |

**Isolating R from B is the methodological crux.** It separates the value of
*observing* from *forecasting*. Reporting only A and B would license
"prediction eliminated 100% of failures" — true and materially misleading, since
a far simpler reactive controller captures 97.5% of it.

### 9.3 A bug that nearly shipped as a finding

`predictiveCostMs` returned `0` when no horizons were supplied, silently
discarding the observed-fade term. That made arm R **identical** to arm A, and
would have produced the published conclusion *"only forecasting helps"* — the
exact opposite of the truth.

**Lesson encoded as a rule:** when a control arm produces results identical to
another arm, treat it as a bug until proven otherwise. Identical is not
agreement; it is usually a wiring fault.

### 9.4 The environmental bound

Only **one of eight** gateways experiences fade above the 6 dB margin (19% of
hours, max 19.9 dB); three others under 0.6%; four never. The measurable benefit
of *any* weather-aware routing is bounded above by this exposure. State it.

---

## 10 · Presentation

### 10.1 The evidence chart leads, not the globe

Every satellite project ships globe.gl on black with cyan glow; at a glance we
were indistinguishable. The default stage is now `crossover.js` — geodesic rings
at the published 4,472 km break-even distance, with cities plotted at their
*measured* win rate. **The cities fall on the correct side of the line without
having been placed there.** The globe is one click away and auto-engages for the
routing cinematic.

Rings render as **ovals**, not circles: a true geodesic circle distorts in
equirectangular projection. The distortion is left in — a neat circle would mean
the maths was wrong.

### 10.2 Stage visibility is set in JS, not CSS

Two equal-specificity rules fought over `#globe-container` opacity and the wrong
one won, leaving the globe drawn over the chart. `showStage()` sets inline
`!important`. For the one interaction the demo hinges on, unambiguous beats
elegant.

### 10.3 Icons, not emoji

143 emoji replaced by a 48-icon stroke set. Markup uses `<i data-ic="name">`
placeholders hydrated by a `MutationObserver`, which works identically in plain
HTML, single-quoted strings and template literals — and avoids colliding with
the local `icon` variables already in `ui.js`. **Flag emoji are dropped
entirely**: they do not render on Windows Chrome.

### 10.4 The left panel never scrolls

A scrollbar on the primary control surface can put Send Request below the fold.
`overflow: hidden`, send button pinned, and content compacts in stages at 900 /
780 / 700 / 640 / 560 px. Verified at 805, 737 and 557 px.

### 10.5 Provenance is labelled

Seeded rows are marked `SIMULATED` with the deterministic seed shown. A reviewer
who finds the `synthetic` flag in the JSON export themselves reclassifies the
work from "simulator with seeded history" to "fabricated numbers", and that
reclassification is not recoverable.

---

## 11 · Testing and verification

| What | How |
|---|---|
| Physics | `npm run test:itu` — 28/28 published coefficients within 2% |
| Data pipeline | `npm run data:weather` — re-fetch, unit conversion asserted |
| Model | `npm run train:fade` — temporal + site-held-out splits, metrics emitted |
| Routing consistency | deep-dive tables scored with `dcCostMs`/`gwCostMs`; 0/32 mismatches |
| Adaptation efficacy | flip count across 32 origin/policy combinations |
| Experiment | deterministic under fixed seed |

**Measure, don't eyeball.** Layout claims are verified by reading bounding boxes;
routing claims by sweeping all 32 combinations.

### 11.1 A measurement gotcha that has cost hours, three times

**Chrome throttles background tabs.** In an unfocused tab: `requestAnimationFrame`
does not fire, timers are throttled, style recalculation is deferred, and
`innerHeight` can return stale values. This has produced three separate false
negatives in this project — an app that appeared not to boot, an element whose
inline `!important` appeared not to apply, and a viewport that reported the wrong
height.

**Verify visual state with a screenshot, never with `getComputedStyle`.**

---

## 12 · Rejected approaches

| Rejected | Why |
|---|---|
| Train fade prediction on UHF packet corpora | ITU P.838: `k` = 0.0000259 at 1 GHz vs 0.0916 at 20 GHz. Rain barely affects UHF; the data cannot contain the signal |
| ML for rain fade | Solved analytically by P.618/838/839; claiming ML invites an unwinnable question |
| FastAPI backend | Would be the demo's only runtime dependency. 71 KB of JSON runs in-browser |
| RL for routing | No trustworthy reward signal, no validation set, invites "did you benchmark against a classical solver?" |
| Full autonomy claim | Reframed as decision support with a human gate |
| Deep temporal models (LSTM/TCN) | GBM not yet exhausted; added complexity unjustified |
| LLM in the decision path | Structured factors are clearer and cannot hallucinate a satellite position |

---

## 13 · Extension points

**Adding a routing objective.** Add the constant to `predict/config.js` in
milliseconds, add the term to `dcCostMs`/`gwCostMs`, extend `POLICY_WEIGHTS`,
then re-measure the policy frontier. Do not assert the new trade-off.

**Adding a learned signal.** Apply §5.3. Then confirm it is not closed-form
reducible (§7.1). Then add the split to `ml/train_fade_risk.py` and check it
beats persistence *on Brier*, not AUC.

**Swapping the storage layer.** `telemetry.js` is a plain append-only event log;
moving to a real time-series store is a transport change, not a rewrite.

**Real backdated TLEs.** The clearest remaining gap. Replaying historical element
sets would make satellite positions in the seeded history genuinely real, leaving
only demand synthetic.

---

## 14 · Known limitations

- **Traffic is simulated** and labelled. Weather, physics and baselines are not.
- **1/8-scale constellation** — 180 satellites against the real shell's 1,584.
- **ISL range limit (~5,400 km) is not enforced** — a real omission at this scale.
- **SAA is a rectangle** over an oval that has bifurcated and drifts ~0.3°/yr.
- **Rain height uses a latitude parameterisation**, not the gridded isotherm map.
- **The agent adds nothing in this regime** (§9.2) — its value requires an
  environment where route changes carry real cost.
- **Mumbai's gateway coordinate is approximate** — no published site exists.

---

## 15 · The standard this project holds itself to

Three rules, in priority order:

1. **Every headline number must be checkable against something we did not
   produce.** Measured RTTs, published ITU tables, NASA reanalysis, an
   independently published crossover distance.
2. **Report the cases where the system loses.** 0% for London makes 100% for
   São Paulo believable. The concession is the argument.
3. **When a result looks too clean, it is a bug until proven otherwise.**
   §9.3 is the reason this rule exists.
