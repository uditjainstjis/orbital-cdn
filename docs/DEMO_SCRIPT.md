# Orbital CDN — Demo Video Script

**85 seconds. 205 words. Six beats.**

Everything below is on the live site — no slides, no mockups. The one hard
timing constraint is the routing animation: it runs **13.4 seconds** at the
default 2× speed, so beat 3's narration is written to that length exactly.
Do not slow it to 1× — that pushes it to 27 s, a third of the whole video.

---

## Before you hit record

| | |
|---|---|
| **Window** | 1512 × 850 or larger. Hide the bookmarks bar and any extensions. |
| **URL** | `orbital-cdn.vercel.app` — the deployed build, not localhost. Nobody should see a port number. |
| **Dismiss the intro card** | Load once, close it, reload. It should not appear on camera. |
| **Starting state** | Stage = **Evidence** · Origin = **Delhi** · Service = **LLM Inference** · Policy = **Balanced** |
| **Speed** | Leave at **2×**. It is the default for a reason. |
| **Do not touch** | The "Reset to seeded history" button in Analytics. It wipes the log. |
| **Cursor** | Move deliberately and pause before each click. A cursor that darts reads as nervous. |

---

## The script

### 1 · The problem — 0:00 → 0:12

> **"A CDN keeps content close to you and picks the fastest route to it.
> Every CDN ever built assumes its map is fixed. Put the nodes in orbit,
> and the map becomes the variable."**

| Audio lands on | Show |
|---|---|
| "A CDN keeps content close to you…" | **Evidence** stage, static. The break-even map fills the frame. Do not move the cursor yet. |
| "…assumes its map is fixed." | Slow zoom-in (post-production) toward the centre of the map. |
| "…the map becomes the variable." | Hold. The headline **"Where routing through orbit actually wins"** is legible. |

*Why this opening:* a judge who does not know what a CDN is has to be told in one sentence, and it has to be the first sentence.

---

### 2 · The gap — 0:12 → 0:20

> **"SpaceX filed for a million compute satellites in January. Google is
> putting TPUs up there. Nobody is building the router."**

| Audio lands on | Show |
|---|---|
| "SpaceX filed…" / "Google…" | **Cut away** to a full-frame title card with the three dates: `Jan 30 2026 — SpaceX, 1,000,000 satellites, FCC` · `Nov 2025 — Google Project Suncatcher` · `Nov 2025 — Starcloud, first H100 in orbit`. Warm graphite background, brass text, matching the site. |
| "Nobody is building the router." | Hard cut back to the site. |

*This is the only non-website shot in the video, and it is what makes the project read as timely rather than speculative.*

---

### 3 · It runs — 0:20 → 0:34  ·  13.4 s, matched to the animation

> **"So we built it. One request from Delhi. It picks an uplink, scores four
> orbital data centres against a cost function, routes the laser hops, and
> comes down through a gateway that isn't raining."**

| Audio lands on | Show |
|---|---|
| "So we built it." | Click **LIVE 3D** in the top bar. Globe appears. |
| "One request from Delhi." | Click **Send Request**. Animation starts. |
| "picks an uplink" | Beat 2 fires — *Uplink Satellite Selected* appears in the right panel. |
| "scores four orbital data centres" | Beat 3 — *Orbital DC Selected*. The caption bar under the globe is narrating in step. |
| "routes the laser hops" | Beat 4 — arcs draw across the mesh. |
| "comes down through a gateway that isn't raining" | Beats 6–8 — *Gateway* then *Request Complete*. |

**Let the last two seconds of the animation play with no narration.** The completed arc is the shot.

---

### 4 · The physics, and where it loses — 0:34 → 0:50

> **"Every constraint is priced in milliseconds — eclipse, radiation, rain —
> so they trade against distance instead of tripping thresholds. And it tells
> you where it loses. Lagos, 4,873 kilometres from a cloud region, wins every
> time. New York, 325 kilometres, wins nothing."**

| Audio lands on | Show |
|---|---|
| "priced in milliseconds" | Click **EVIDENCE**. Cut to the break-even map. |
| "eclipse, radiation, rain" | Cursor traces the **LAT / SOL / RAD / WX / ENG** weight bars in the left panel. |
| "where it loses" | Cursor moves to the right panel, **WHERE ORBITAL WINS**. |
| "Lagos, 4,873 kilometres… wins every time" | Zoom the right panel. The Lagos row: `4,873 km` → `100%`. |
| "New York, 325 kilometres, wins nothing" | Same zoom, the `…AND WHERE IT LOSES` rows: `New York 325 km → 0%`. |

*Say the distances out loud.* Admitting where it fails is what makes the rest believable, and the distance column is what makes the failure look like physics rather than a bug.

---

### 5 · It learns — 0:50 → 1:06

> **"Pick any window and it summarises what actually happened. Which gateway
> lost time to rain. Which data centre ran dark. Those penalties feed straight
> back into the next route — the system learns from its own history."**

| Audio lands on | Show |
|---|---|
| "Pick any window" | Click **Analytics**. Overlay opens. Click through **1H → 24H → 7D** so the numbers visibly change. |
| "summarises what actually happened" | Hold on the KPI row and the traffic chart. |
| "which gateway lost time to rain / ran dark" | Scroll to **What the network learned** — the insight rows naming Frankfurt and DC-1. |
| "feed straight back into the next route" | Keep scrolling to **Adaptation from this window** — the gateway and DC penalty bars, and the *Adaptive routing ON* toggle. |

*This beat is the round-2 brief, and it should be unmistakable that both halves are there: the window selector is the user-facing behaviour, the penalty tables are the product state behind it.*

---

### 6 · The honest result — 1:06 → 1:22

> **"Five thousand six hundred requests, four routing arms. Blind fails eighty
> times. Simply observing current conditions removes 97.5% of that. Forecasting
> removes the rest. The autonomous agent removes nothing — and costs five
> milliseconds. We ship that finding inside the product."**

| Audio lands on | Show |
|---|---|
| "four routing arms" | Click **Architecture** → **Routing Policies** in the sidebar, or the experiment panel if it is on screen. |
| "Blind fails eighty times" | Hold on the arms table: `A Blind 80` → `R Reactive 2` → `B Predictive 0` → `C Autopilot 0`. |
| "removes 97.5% of that" | Highlight or zoom the 97.5% line. |
| "The autonomous agent removes nothing — and costs five milliseconds" | Hold on `C Autopilot · 0 failures · +5.3 ms`. |
| "We ship that finding inside the product" | Pull back to show it rendered on the page, not in a slide. |

*This is the strongest thirty seconds in the video.* Every other team's demo claims their agent works. Publishing the measurement that says yours does not — in this regime — is the thing a technical judge will remember.

---

### Close — 1:22 → 1:26

> **"Orbital CDN. The routing layer, measured honestly."**

| Show |
|---|
| Cut to the **Evidence** stage, full frame. Logo and wordmark visible top-left. Hold two seconds on `orbital-cdn.vercel.app` in a lower third. Fade. |

---

## If you need it shorter

Cut **beat 2** (the announcements card) and tighten beat 5 to a single window
click. That lands at **62 seconds** and loses the least. Never cut beat 6.

## If you need it longer

Add fifteen seconds between beats 4 and 5 on grounding: open Analytics and
scroll to the table captioned *"nothing in this table is generated by this
simulator"* — measured fibre RTT against Azure's published medians, and the
independently published 4,472 km crossover the model lands next to without
being fitted to it.

---

## Recording notes

- **One take per beat, not one take overall.** Six clean clips cut together beat one heroic take with a stumble at 0:58.
- **Record the audio separately.** Screen-capture microphone audio is the single most common reason a hackathon demo sounds amateur.
- **No background music under the narration.** If you want music, bring it in under beat 2 and duck it to nothing by beat 3.
- **Do not zoom with the browser.** Zoom in post. Browser zoom re-lays-out the page and the panel breakpoints will fire on camera.
- **Watch the status bar.** It shows live request counts and timestamps; if you re-record beat 3 several times the count climbs, and continuity breaks between clips. Reload between takes.
