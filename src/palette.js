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
  faint:   '#6b7079',

  accent:    '#d99a4e',   // brass — brand, primary action, solar
  accentHi:  '#eab26a',
  accentInk: '#17130c',

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
