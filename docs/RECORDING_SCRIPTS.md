# Orbital CDN — Read-Aloud Recording Scripts

**Twelve takes. None longer than 20 seconds.** Read one, stop, breathe, read the
next. Do not attempt a continuous run — I stitch these together, and six clean
short clips always beat one long take with a stumble at 0:58.

**Record audio and screen separately if you can.** If you can't, record audio
only for these takes and I'll lay it over the screen capture. Phone voice memo
in a quiet room beats a laptop mic every time.

**Say the numbers slowly.** Every figure below is real and checkable; rushing
them is what makes a demo sound like marketing.

Word counts are given so you can pace yourself — aim for about **2.4 words per
second**, which is unhurried conversational.

---

## TAKE 1 · The opening — 12s · 29 words

> A CDN keeps content close to you, and picks the fastest route to it.
> Every CDN ever built assumes its map is fixed.
> Put the nodes in orbit, and the map becomes the variable.

*Pause a full beat after "fixed." That's the pivot of the whole video.*

---

## TAKE 2 · Why now — 11s · 27 words

> In January, SpaceX filed with the FCC for up to a million compute satellites.
> Google is putting TPUs in orbit. Starcloud already has an H100 up there.

---

## TAKE 3 · The gap — 8s · 19 words

> Everyone is building the supply. Nobody is building the thing that decides
> which one of them answers your request.

---

## TAKE 4 · What we built — 10s · 24 words

> So we built it. Orbital CDN is a routing control plane for data centres that
> aren't on Earth. Here's one request.

---

## TAKE 5 · The route — 14s · 34 words
### Matched to the animation. It runs 13.4 seconds at 2× speed.

> Delhi. It picks an uplink satellite, scores four orbital data centres against
> a cost function, routes the laser hops across the mesh, and comes down through
> a ground gateway that isn't raining.

---

## TAKE 6 · The idea underneath — 15s · 36 words

> Every constraint is converted into milliseconds before anything is compared.
> Eclipse is twenty-five. Radiation over the South Atlantic Anomaly is forty.
> Rain is twenty-two. So they trade against distance, instead of tripping
> thresholds.

---

## TAKE 7 · Where it wins — 12s · 29 words

> That's what makes four routing policies the same engine with different
> weights. Latency. Balanced. Reliable. Green. Not four hand-written special
> cases.

---

## TAKE 8 · Where it loses — 16s · 39 words

> And it tells you where it loses. Lagos, four thousand eight hundred
> kilometres from the nearest cloud region, wins every single time. New York,
> three hundred and twenty five kilometres, wins nothing at all. That's not a
> bug. That's the physics.

*This is the most persuasive thing you will say. Slow down for it.*

---

## TAKE 9 · The adaptability brief — 17s · 41 words

> Every request the network serves is written to a log. Pick any window — one
> hour, seven days, everything — and it summarises what actually happened over
> exactly that period. Which gateway lost time to rain. Which data centre ran
> dark in eclipse.

---

## TAKE 10 · The loop closes — 14s · 34 words

> Those penalties feed straight back into the cost function. The next request
> routes around what actually went wrong. And they're surfaced as
> recommendations, never applied silently — the policy you chose keeps meaning
> what it says.

---

## TAKE 11 · The honest result — 20s · 48 words
### Read this one twice. It is the take that wins the round.

> Five thousand six hundred requests. Four routing arms, identical inputs.
> Blind routing fails eighty times. Simply observing current conditions removes
> ninety-seven and a half percent of those failures. Forecasting removes the
> last two. The autonomous agent removes nothing — and costs five milliseconds.

---

## TAKE 12 · The close — 10s · 24 words

> We ship that finding inside the product, because a result that undercuts your
> own feature is the only kind worth trusting. Orbital CDN.

---

# What I need on screen for each take

Record the screen separately, in these clips. Browser at 1512 wide or more,
bookmarks bar hidden, on **orbital-cdn.vercel.app** — not localhost.

| Take | Screen | Action |
|---|---|---|
| 1 | **Evidence** stage, still | Nothing. Let the break-even map sit there. I'll add a slow push-in. |
| 2 | *No website* | I'll build a title card with the three dates. Nothing to record. |
| 3 | **Evidence**, still | Cursor resting. Hard cut at the end of the line. |
| 4 | **Evidence → LIVE 3D** | Click **LIVE 3D**. Let the globe settle for two seconds. |
| 5 | **LIVE 3D** | Click **Send Request**, then **hands off the mouse** for the full animation. Record 20s so I have handles. |
| 6 | **Evidence**, left panel | Move the cursor slowly down the **LAT / SOL / RAD / WX / ENG** weight bars. Don't click. |
| 7 | **Evidence**, left panel | Click **Latency**, then **Green**, then back to **Balanced**. Watch the weight bars move. Two seconds between clicks. |
| 8 | **Evidence**, right panel | Cursor to **WHERE ORBITAL WINS**. Hold on the Lagos row, then on the New York row under *…AND WHERE IT LOSES*. |
| 9 | **Analytics** overlay | Click **Open full analytics**. Then click **1H**, pause, **24H**, pause, **7D**. The numbers visibly change — that's the shot. |
| 10 | **Analytics**, scrolled | Scroll slowly to **What the network learned**, then to **Adaptation from this window**. Stop on the penalty bars and the *Adaptive routing ON* toggle. |
| 11 | **Architecture** → Routing Policies | Open **Architecture**, click **Routing Policies** in the sidebar. Hold still on the policy table. |
| 12 | **Evidence**, full frame | Back to the landing view. Hold five seconds, motionless. |

---

# Before you record anything

| | |
|---|---|
| **Dismiss the intro card** | Load the site, close the card, reload. It must not appear on camera. |
| **Starting state** | Origin **Delhi** · Service **LLM Inference** · Policy **Balanced** · Speed **2×** |
| **Reload between takes** | The status bar shows a live request count. It climbs each time you hit Send, and continuity breaks between clips. |
| **Never click** | *Reset to seeded history* in Analytics. It wipes the log. |
| **Don't zoom the browser** | Zoom is done in editing. Browser zoom re-lays-out the page and fires the panel breakpoints on camera. |
| **Cursor discipline** | Move slowly, pause before every click. A darting cursor reads as nervous. |

---

# For the YouTube upload

- **Visibility:** Unlisted.
- **Title:** `Orbital CDN — a routing control plane for data centres in orbit`
- **Description, first two lines** (all that shows before "more"):
  > A CDN keeps content close to users. Every CDN assumes its map is fixed — in orbit, the map is the variable.
  > Live demo: orbital-cdn.vercel.app · Source: github.com/uditjainstjis/orbital-cdn
- **Turn off** end screens and cards. They cover the final frame.
- **Upload at 1080p or higher.** YouTube gives more bitrate to higher
  resolutions, and thin UI text is the first thing compression destroys.

---

# If a take goes wrong

Just read it again. Don't restart the sequence. Say the take number out loud
before each attempt — "take nine, second try" — so I can find the good one in
the audio file.
