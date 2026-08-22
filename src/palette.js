// The palette, as JavaScript.
//
// CSS custom properties cover everything in the DOM, but three.js materials and
// globe.gl accessors are evaluated outside CSS and cannot read `var(--accent)`.
// Without a shared module those layers drift: the last time they diverged the
// chrome was warm graphite while the constellation was still neon cyan, and the
// page read as two products stacked on top of each other.
//
// So the hex values live here and the stylesheet mirrors them in `:root`. Both
// must be edited together. Nothing else in the codebase may hardcode a colour.

export const PALETTE = {
  bg:      '#0e0f12',
  bgDeep:  '#08090b',
  panel:   '#16181c',
  card:    '#1a1d22',
  cardHi:  '#21242a',

  text:    '#e9e7e4',
  text2:   '#b6bac1',
  muted:   '#8d939d',
  faint:   '#828892',

  accent:    '#d99a4e',   // brass — brand, primary action, solar
  accentHi:  '#eab26a',
  accentInk: '#17130c',

  // Terrain — the two upper stops of the globe's luminance ramp. The lower two
  // stops are bgDeep and card, so ocean shares its colour with the page ground
  // and the planet reads as part of the same instrument rather than a photo.
  terrain:   '#413c34',   // land
  terrainHi: '#6a655c',   // ice and high albedo

  pos:  '#6fae7f',        // measured good
  neg:  '#c9736b',        // measured bad
  info: '#7d94b8',        // gateways, adaptation, the agent
}

// Named by what the colour *means* in the simulation, not by what it looks
// like. A reader changing the palette should never have to know that a ground
// station happens to be steel blue.
export const SEMANTIC = {
  satellite:   PALETTE.info,      // constellation and inter-satellite links
  datacentre:  PALETTE.accent,    // orbital DCs, sunlit
  eclipsed:    PALETTE.neg,       // battery-drawn, de-preferred
  gateway:     PALETTE.info,      // ground stations
  saa:         PALETTE.neg,       // South Atlantic Anomaly
  uplink:      PALETTE.accent,    // city -> orbit
  isl:         PALETTE.info,      // orbit -> orbit
  downlink:    PALETTE.pos,       // orbit -> ground, delivered
  win:         PALETTE.pos,       // orbital beat fibre
  loss:        PALETTE.neg,       // fibre won
  clear:       PALETTE.pos,       // weather at a gateway
  cloud:       PALETTE.accent,
  rain:        PALETTE.neg,
}

// ─── The three.js scene ─────────────────────────────────────────────────────
//
// Materials take a number, not a CSS string, so the scene needs its own view of
// the same palette. Everything here is derived from PALETTE above rather than
// re-typed, which is the only reason the constellation and the chrome cannot
// drift apart again — they did once, and the globe stayed neon for a full pass
// after every panel had gone warm.

/** '#d99a4e' -> 0xd99a4e */
export const hex = c => parseInt(c.slice(1), 16)

/** Darken toward black by `k` (0 = black, 1 = unchanged). Solar panels and
 *  unlit hardware are the same colour with less light on them. */
export function shade(c, k) {
  const n = hex(c)
  const f = v => Math.round(v * k)
  return (f((n >> 16) & 255) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255)
}

export const SCENE = {
  dcBody:      hex(PALETTE.accent),          // orbital data centre, sunlit
  dcPanel:     shade(PALETTE.accent, 0.72),
  dcRing:      hex(PALETTE.accentHi),
  dcDark:      hex(PALETTE.faint),           // eclipsed: battery-drawn
  dcDarkPanel: shade(PALETTE.faint, 0.72),

  satBody:     hex(PALETTE.info),            // satellite, nominal
  satPanel:    shade(PALETTE.info, 0.60),
  satSAA:      hex(PALETTE.neg),             // crossing the anomaly
  satSAAPanel: shade(PALETTE.neg, 0.72),
  satDark:     shade(PALETTE.muted, 0.62),   // eclipsed
  satDarkPanel: shade(PALETTE.muted, 0.42),

  isl:         hex(PALETTE.info),            // inter-satellite links
}
