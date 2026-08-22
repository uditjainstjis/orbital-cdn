# Orbital CDN — 10-Slide Pitch Deck

**Instructions for the generator:** Build exactly 10 slides. Every slide is
**visual-first** — a diagram, chart, map or timeline is the primary element and
text is caption-scale. No slide may exceed ~40 words of body copy. Where a chart
is specified, use the real numbers given; do not invent data.

**Visual system.** Dark warm-graphite background (`#0e0f12`), cards `#1a1d22`.
One accent: brass `#d99a4e`. Semantics only for measured outcomes — sage
`#6fae7f` = good, brick `#c9736b` = bad, steel `#7d94b8` = neutral/orbital.
**No neon. No gradients. No glow.** Sans-serif display (Space Grotesk or
similar), monospace for all numerals (JetBrains Mono). Line icons, never emoji.

---

## Slide 1 — Title

**ORBITAL CDN**
*The routing layer for data centres that aren't on Earth.*

**Visual:** Full-bleed dark starfield with a thin wireframe Earth, a LEO shell
of small steel dots, and three brass diamonds (orbital data centres). One
amber path traces city → satellite → orbital DC → satellite → ground station.
Understated, technical, not a render-fest.

**Footer strip, monospace:** `180 satellites · SGP4 from live TLEs` ·
`4 orbital DCs` · `8 ground gateways` · `991 logged requests`

---

## Slide 2 — The Problem (and what a CDN actually is)

**Header:** Compute is moving to orbit. Nothing knows how to route to it.

**Visual A — "What is a CDN?" (left half, 3-step strip diagram):**

| | Without a CDN | With a CDN |
|---|---|---|
| Path | User → one distant origin server | User → nearest edge node |
| Distance | 12,000 km | 300 km |
| Result | 250 ms, everyone waits | 20 ms |

Caption: **A CDN is a delivery network — it keeps copies of content close to
users and picks the fastest route to one.** Cloudflare and Akamai do this with
~300 ground sites. *The map they route over has never moved.*

**Visual B — "Why orbit breaks it" (right half, 4 line icons in a row):**

| Constraint | Ground CDN | Orbital CDN |
|---|---|---|
| Node position | Fixed | **Moves 7.5 km/s** |
| Power | Grid, always on | **Eclipse — node goes dark** |
| Packet integrity | Stable | **Radiation flips bits (SAA)** |
| Link | Buried fibre | **Rain closes the Ka-band gateway** |

**Punchline bar:** Every existing CDN assumes the map is static. In orbit,
**the map is the variable.**

---

## Slide 3 — This Is Not Speculative

**Header:** Four of the largest companies on Earth committed to orbital compute
in the last 12 months.

**Visual: horizontal timeline, Nov 2025 → Aug 2026, one card per event.**

| Date | Who | What |
|---|---|---|
| Nov 2 2025 | **Starcloud + NVIDIA** | First data-centre-class GPU in orbit — an **H100**, running inference on Gemma. |
| Nov 4 2025 | **Google** | **Project Suncatcher** — TPUs in orbit. Two prototype satellites with Planet Labs by **early 2027**. TPUs survived a **5-year LEO radiation dose** in a particle accelerator. |
| Oct 2025 | **Jeff Bezos** | **Gigawatt-scale data centres in space within 10–20 years.** Blue Origin has been building the tech for over a year. |
| Dec 2025 | **Starcloud** | First LLM **trained** in orbit. |
| Jan 30 2026 | **SpaceX** | FCC filing for an orbital data-centre constellation of up to **1,000,000 satellites**, 500–2,000 km, targeting **100 GW** of compute. |
| 2025–26 | **China (ADA Space / Zhejiang Lab)** | **Three-Body Computing Constellation** — 12 satellites flying, 5 POPS, 100 Gbps laser links, **2,800 planned**. |
| Aug 2026 | **Starcloud** | Raises **$250 M**; NVIDIA **Blackwell** on the next launch, Oct 2026. |

**Scale callouts, oversized monospace:**
`8×` solar productivity in the right orbit vs. ground ·
`>99%` of the orbit sunlit ·
`$1 T` addressable orbital-compute market by 2030 (Futurum)

---

## Slide 4 — The Gap Nobody Is Filling

**Header:** Everyone is building the supply. **Nobody is building the control plane.**

**Visual: a two-column "solved / unsolved" split.**

**Being solved — hardware and power ($3 B+ invested)**
Rad-hard silicon · Solar arrays · Radiators · Laser links · Launch capacity

**Unsolved — the routing decision**
Which orbital DC serves this request, right now, given that it is eclipsed,
crossing the South Atlantic Anomaly, and its downlink gateway is in rain?

**The pull-quote (frame it, this is the whole thesis):**

> *"LEO adds 20–40 ms round-trip, plus Doppler shifts and handover delays,
> making orbital compute better suited for AI training and batch processing
> **rather than latency-sensitive inference**."*
> — the standard industry objection to orbital compute

**Response line, brass, large:**
That objection is a **routing problem**, not a physics problem.
It is the problem we built and measured.

---

## Slide 5 — What We Built

**Header:** A working control plane. Every request is a real decision.

**Visual: 3-tier architecture diagram, vertical, labelled links.**

```
 TIER 3   Origin city  ──uplink──▶  Ground gateway        [rain-aware]
             │
 TIER 2   LEO mesh · 180 satellites, SGP4 from live TLEs  [SAA-aware]
             │  inter-satellite laser links
 TIER 1   Orbital DC · sun-synchronous ~600 km            [eclipse-aware]
```

**The one equation on the slide — and the idea that makes it work:**

```
C(DC) = w_lat·distance + w_sol·eclipse + w_rad·SAA + learned penalty
        ─────────── every term converted to MILLISECONDS ───────────
```

Caption: **One currency.** Sunlight, radiation and rain are all priced in
latency-equivalent milliseconds, so the router can trade them against each
other instead of applying arbitrary thresholds.

**Four policy chips along the bottom:** `latency` `balanced` `reliable` `green`

---

## Slide 6 — The Physics, and Where It Honestly Loses

**Header:** Light is 47% faster in vacuum than in glass. That advantage has a
break-even distance — and we can draw it.

**Visual A (dominant): the break-even map.** World map, muted. Around each
terrestrial cloud region (us-east-1, eu-central-1, ap-southeast-1) draw a
geodesic ring at **4,472 km**. Inside the ring, fibre wins. Outside, orbit
wins. Plot the eight origin cities coloured by measured win rate.

| City | Distance to nearest cloud region | Orbital win rate |
|---|---|---|
| Lagos | 4,873 km | **100%** |
| Dubai | 4,000+ km | **100%** |
| São Paulo | 7,626 km | **100%** |
| Delhi | 4,145 km | **100%** |
| Tokyo | 5,322 km | 84% |
| Sydney | 6,305 km | 70% |
| New York | 325 km | **0%** |
| London | 637 km | **0%** |

**Visual B (small, right): speed-of-light bar comparison.**
Vacuum `299,792 km/s` vs fibre `~200,000 km/s` — a 33% gap that compounds on
every intercontinental hop.

**The credibility line — set this apart:**
The published LEO-vs-fibre crossover for a 550 km shell is **4,472 km**
(Chaudhry & Yanikomeroglu, arXiv:2203.00154). Our simulator, using **measured**
fibre baselines, lands its own crossover between **637 km and 4,145 km**.
**No parameter was fitted to that number.**

---

## Slide 7 — Adaptability: The System Learns From Its Own History

**Header:** Every request is logged. The next request is routed better because of it.

**Visual: a left-to-right loop diagram with a time-window selector on top.**

```
  [ 1H · 24H · 7D · 30D · ALL ]   ← user picks the period
        │
   991 logged requests
        ▼
   Summarise the window ──▶ Which gateway lost time to rain?
                            Which DC ran eclipsed?
                            Which policy won, per city?
        ▼
   Penalties fed back into the cost function
        ▼
   The next request routes around what actually went wrong
```

**Three stat cards from a real 7-day window:**

| | |
|---|---|
| **71%** | of requests beat terrestrial fibre |
| **62 ms** | mean saving on the ones that won |
| **80%** | served by a sunlit data centre |

**Caption:** Recommendations are **surfaced, not silently applied** — the
policy you chose keeps meaning what it says.

---

## Slide 8 — Results (Measured, Including the One That Didn't Work)

**Header:** 5,600 requests. 2,800 hours of real weather. Four routing arms,
identical inputs.

**Visual A — the headline chart.** Horizontal bar, failures per arm:

| Arm | Sees | Failures | Mean latency cost |
|---|---|---|---|
| **A · Blind** | nothing | **80** | — |
| **R · Reactive** | current conditions | **2** | baseline |
| **B · Predictive** | 1–12 h forecast | **0** | +0.2 ms |
| **C · Autopilot** | forecast + agent | **0** | **+5.3 ms** |

**Visual B — the finding, as a donut or 100% stacked bar:**
Of the 80 failures removed, **97.5% are removed by simply *observing* current
conditions.** Forecasting removes the last 2. **The autonomous agent adds
nothing — and costs 5.3 ms.**

**Callout box, brass border — this is the slide's real weapon:**
> We ship that negative result **inside the product**. Reporting only arms A
> and B would have let us claim *"predictive routing eliminated 100% of
> failures."* True, and materially misleading.

**Visual C — the policy frontier (small scatter, latency vs rain exposure):**

| Policy | p50 RTT | Rain exposure |
|---|---|---|
| latency | **61 ms** | 13.7% |
| balanced | 67 ms | 13.9% |
| reliable | 73 ms | **0.0%** |
| green | 78 ms | 5.5% |

Caption: 12 ms buys you **exactly zero** rain exposure. That is a real
engineering trade, not a marketing number.

---

## Slide 9 — Why You Can Trust These Numbers

**Header:** Grounded against sources we do not control.

**Visual: four "receipt" cards in a 2×2 grid, each with a line icon.**

| | |
|---|---|
| **ITU-R P.838-3 / P.618-13** | Rain attenuation implemented from the published standard. **28 of 28 coefficients validated to within 2%**, as a unit test in the repo. |
| **Real orbital mechanics** | 180 satellites propagated with **SGP4 from live CelesTrak TLEs** — not a decorative animation. |
| **Measured, not self-generated, baselines** | Fibre RTT from **WonderNetwork** inter-VPS measurements, cross-checked against **Microsoft Azure's published P50** backbone latency. |
| **Real weather** | **NASA POWER** hourly precipitation, four months, eight gateway sites. |

**Honest-bound strip along the bottom, muted:**
Across four months, only **1 of 8 gateways** exceeds the 6 dB link margin, in
19% of its hours. **The benefit of any weather-aware routing is bounded above
by that exposure** — and we say so in the product.

**Split legend:** everything on this slide is `MEASURED / EXTERNAL`. The routing
outcomes on slide 8 are `SIMULATED`, and the interface labels them that way.

---

## Slide 10 — Impact

**Header:** The constellations are launching. The control plane should exist
before they arrive.

**Visual A — market ramp, single clean line chart:**
`$1.77 B (2025)` → `$15–20 B (2030)` → `$105 B (2034)`, 67% CAGR.
Annotate: `$3 B+ already invested` · `$1 T addressable by 2030 (Futurum)`

**Visual B — who this serves, three line-icon columns:**

| Orbital DC operators | Ground network operators | Two-thirds of the planet |
|---|---|---|
| SpaceX, Google, Starcloud, Blue Origin, ADA Space need a scheduler that prices eclipse, radiation and rain. | Gateway operators need to know which pass to trust. | Lagos, São Paulo, Delhi, Dubai — **far from every cloud region, and the only users orbit actually helps.** |

**Closing line, large, brass:**
Cloudflare made the internet fast by moving content closer to people.
**The next 300 edge locations are going to be in orbit.**
Something has to route to them.

**Final strip, monospace:** `Live demo: orbital-cdn.vercel.app` ·
`Open source` · `Research paper + full design doc included`

---

## Appendix — Sources (for the generator; put on a final reference slide or omit)

- Google, *Project Suncatcher* — blog.google / research.google, Nov 4 2025
- SpaceNews / DCD — SpaceX FCC filing, 1M-satellite orbital data centre, Jan 30 2026
- Data Center Frontier / NVIDIA blog — Starcloud-1, first H100 in orbit, Nov 2 2025
- CNBC — Starcloud trains first AI model in space, Dec 10 2025
- TechCrunch / GeekWire — Starcloud raises $250 M, Aug 21 2026
- GeekWire / DCD / Tom's Hardware — Bezos on gigawatt orbital data centres, Oct 2025
- SpaceNews — China's Three-Body Computing Constellation, ADA Space / Zhejiang Lab
- IEEE Spectrum — *Why Thermodynamics Rules Future Orbital Data Centers*
- Futurum Group — orbital computing $1 T addressable market by 2030
- Chaudhry & Yanikomeroglu, *Laser Intersatellite Links in a Starlink Constellation*, arXiv:2203.00154
- ITU-R P.838-3, P.618-13, P.839-4
