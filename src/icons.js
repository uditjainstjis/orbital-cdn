// Line-icon set.
//
// Replaces every emoji in the interface. Emoji render differently on every
// platform, carry a colour palette we do not control, and read as filler —
// a consistent 1.5px stroke set on currentColor does not.
//
// All icons are 24x24 viewBox, stroke-based, and inherit colour and size from
// their container so they can sit inline with text or scale up in a header.

const P = 'stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"'

const PATHS = {
  // ── Navigation rail ──────────────────────────────────────────────────────
  routes:      `<circle cx="6" cy="18" r="2.4" ${P}/><circle cx="18" cy="6" r="2.4" ${P}/><path d="M8.2 16.2 15.8 8.2" ${P}/><path d="M4 8h3M17 20h3" ${P} opacity=".5"/>`,
  layers:      `<path d="M12 3 3 7.5l9 4.5 9-4.5z" ${P}/><path d="M3 12.5 12 17l9-4.5" ${P} opacity=".65"/><path d="M3 17 12 21.5l9-4.5" ${P} opacity=".4"/>`,
  analytics:   `<path d="M4 20V10M9.5 20V5M15 20v-7M20.5 20V8" ${P}/>`,
  infrastructure: `<rect x="3" y="4" width="18" height="5" rx="1.4" ${P}/><rect x="3" y="14" width="18" height="5" rx="1.4" ${P}/><path d="M7 6.5h.01M7 16.5h.01" ${P}/>`,
  insights:    `<circle cx="12" cy="12" r="8.5" ${P}/><path d="M12 8.2v4.4l2.8 1.7" ${P}/>`,
  settings:    `<circle cx="12" cy="12" r="3" ${P}/><path d="M12 2.6v3M12 18.4v3M21.4 12h-3M5.6 12h-3M18.6 5.4l-2.1 2.1M7.5 16.5l-2.1 2.1M18.6 18.6l-2.1-2.1M7.5 7.5 5.4 5.4" ${P}/>`,

  // ── Domain ───────────────────────────────────────────────────────────────
  satellite:   `<rect x="9.4" y="9.4" width="5.2" height="5.2" rx=".8" transform="rotate(45 12 12)" ${P}/><path d="M6.6 6.6 3.2 10M17.4 6.6 20.8 10M6.6 17.4 3.2 14M17.4 17.4l3.4-3.4" ${P}/>`,
  antenna:     `<path d="M12 21v-7" ${P}/><path d="M8.5 21h7" ${P}/><path d="M12 14a4.5 4.5 0 0 0 4.5-4.5" ${P}/><path d="M12 3.5a6 6 0 0 1 6 6" ${P} opacity=".75"/><path d="M12 7a2.5 2.5 0 0 1 2.5 2.5" ${P}/>`,
  globe:       `<circle cx="12" cy="12" r="8.6" ${P}/><path d="M3.4 12h17.2" ${P}/><path d="M12 3.4a13 13 0 0 1 0 17.2a13 13 0 0 1 0-17.2z" ${P}/>`,
  server:      `<rect x="3.2" y="4.4" width="17.6" height="6" rx="1.5" ${P}/><rect x="3.2" y="13.6" width="17.6" height="6" rx="1.5" ${P}/><path d="M6.8 7.4h.01M6.8 16.6h.01" ${P}/><path d="M15 7.4h3M15 16.6h3" ${P} opacity=".6"/>`,
  gateway:     `<path d="M12 3 3.6 7.6v8.8L12 21l8.4-4.6V7.6z" ${P}/><circle cx="12" cy="12" r="2.6" ${P}/>`,
  origin:      `<path d="M12 21s6.6-6 6.6-10.4A6.6 6.6 0 0 0 5.4 10.6C5.4 15 12 21 12 21z" ${P}/><circle cx="12" cy="10.4" r="2.3" ${P}/>`,
  link:        `<path d="M10 14a4 4 0 0 1 0-5.6l2.4-2.4a4 4 0 1 1 5.6 5.6L16.8 12.8" ${P}/><path d="M14 10a4 4 0 0 1 0 5.6l-2.4 2.4a4 4 0 1 1-5.6-5.6L7.2 11.2" ${P}/>`,

  // ── Environment ──────────────────────────────────────────────────────────
  sun:         `<circle cx="12" cy="12" r="4.2" ${P}/><path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2 5.5 5.5" ${P}/>`,
  eclipse:     `<circle cx="12" cy="12" r="8.4" ${P}/><path d="M12 3.6a8.4 8.4 0 0 0 0 16.8z" fill="currentColor" opacity=".55" stroke="none"/>`,
  rain:        `<path d="M7.4 15.6a4.2 4.2 0 0 1 .5-8.4 5.6 5.6 0 0 1 10.6 1.6 3.6 3.6 0 0 1-.7 6.8" ${P}/><path d="M9 18.4l-.9 2M13 18.4l-.9 2M17 18.4l-.9 2" ${P}/>`,
  cloud:       `<path d="M7.4 17.6a4.2 4.2 0 0 1 .5-8.4 5.6 5.6 0 0 1 10.6 1.6 3.6 3.6 0 0 1-.7 6.8z" ${P}/>`,
  radiation:   `<circle cx="12" cy="12" r="2.2" ${P}/><path d="M12 9.8 9.4 5.3a8 8 0 0 1 5.2 0z" ${P}/><path d="m10.1 13.2-4.6 2.5a8 8 0 0 1-2.5-4.6z" ${P}/><path d="m13.9 13.2 4.6 2.5a8 8 0 0 0 2.5-4.6z" ${P}/>`,
  battery:     `<rect x="2.6" y="7.6" width="16" height="8.8" rx="2" ${P}/><path d="M21.4 10.6v2.8" ${P}/><rect x="5" y="10" width="5" height="4" rx=".6" fill="currentColor" stroke="none" opacity=".75"/>`,
  signal:      `<path d="M4 20v-4M9.3 20v-8M14.7 20v-12M20 20V4" ${P}/>`,

  // ── Actions / status ─────────────────────────────────────────────────────
  bolt:        `<path d="M13.4 2.6 4.8 13.4h5.6L10.6 21.4 19.2 10.6h-5.6z" ${P}/>`,
  balance:     `<path d="M12 3.4v17.2M6.4 20.6h11.2" ${P}/><path d="M4 8.6h16" ${P}/><path d="M4 8.6 1.6 14a2.6 2.6 0 0 0 4.8 0z" ${P}/><path d="M20 8.6 17.6 14a2.6 2.6 0 0 0 4.8 0z" ${P}/>`,
  leaf:        `<path d="M4.6 19.4c0-8 5-13 15-13 0 10-5 14-11 14-2.4 0-4-1.6-4-1z" ${P}/><path d="M9 15c2.4-2.6 5-4.4 8-5.6" ${P} opacity=".65"/>`,
  shield:      `<path d="M12 2.8 4.6 6v6c0 4.6 3.1 8 7.4 9.2 4.3-1.2 7.4-4.6 7.4-9.2V6z" ${P}/><path d="m9.2 12 2 2 3.6-3.8" ${P}/>`,
  play:        `<path d="M7.6 4.8 19 12 7.6 19.2z" ${P}/>`,
  send:        `<path d="M21 3 10.5 13.5" ${P}/><path d="M21 3 14.4 21l-3.9-7.5L3 9.6z" ${P}/>`,
  replay:      `<path d="M3.4 12a8.6 8.6 0 1 0 2.6-6.1" ${P}/><path d="M3 3.4v4.4h4.4" ${P}/>`,
  skip:        `<path d="M5 5.4 13 12l-8 6.6z" ${P}/><path d="M15.6 5.4 19 5.4v13.2h-3.4z" ${P}/>`,
  close:       `<path d="M6 6l12 12M18 6 6 18" ${P}/>`,
  check:       `<path d="M4.8 12.6 9.6 17.4 19.2 6.6" ${P}/>`,
  cross:       `<path d="M6.6 6.6l10.8 10.8M17.4 6.6 6.6 17.4" ${P}/>`,
  warning:     `<path d="M12 3.6 21.2 19.4H2.8z" ${P}/><path d="M12 9.6v4.2M12 17h.01" ${P}/>`,
  chart:       `<rect x="3" y="3.6" width="18" height="16.8" rx="2" ${P}/><path d="M7.4 15.6V11M12 15.6V8M16.6 15.6v-3" ${P}/>`,
  blueprint:   `<path d="M4 20.4 12 3.6l8 16.8z" ${P}/><path d="M8.2 13.6h7.6" ${P} opacity=".6"/>`,
  microscope:  `<path d="M6.6 20.4h12.8" ${P}/><path d="M9.6 17.4a5.6 5.6 0 0 0 7.8-5.2" ${P}/><path d="m9.4 4.2 3.8 3.8-3 3-3.8-3.8z" ${P}/><path d="m11.4 10 2.4 2.4" ${P}/>`,
  brain:       `<path d="M9.6 4.2A3 3 0 0 0 6.8 7a2.8 2.8 0 0 0-1.6 5 3 3 0 0 0 1.4 4.6 2.8 2.8 0 0 0 3 3.2h.2V4.2z" ${P}/><path d="M14.4 4.2A3 3 0 0 1 17.2 7a2.8 2.8 0 0 1 1.6 5 3 3 0 0 1-1.4 4.6 2.8 2.8 0 0 1-3 3.2h-.2V4.2z" ${P}/>`,
  cpu:         `<rect x="6.4" y="6.4" width="11.2" height="11.2" rx="1.8" ${P}/><rect x="9.8" y="9.8" width="4.4" height="4.4" rx=".8" ${P}/><path d="M9.6 2.8v3.6M14.4 2.8v3.6M9.6 17.6v3.6M14.4 17.6v3.6M2.8 9.6h3.6M2.8 14.4h3.6M17.6 9.6h3.6M17.6 14.4h3.6" ${P}/>`,
  video:       `<rect x="2.8" y="6" width="13.2" height="12" rx="2" ${P}/><path d="m16 11 5.2-3.2v8.4L16 13z" ${P}/>`,
  api:         `<path d="M8.4 3.6v4M15.6 3.6v4" ${P}/><rect x="5" y="7.6" width="14" height="8.8" rx="2" ${P}/><path d="M8.4 16.4v4M15.6 16.4v4" ${P}/>`,
  download:    `<path d="M12 3.6v11.2" ${P}/><path d="M7.6 10.6 12 15l4.4-4.4" ${P}/><path d="M4 19.4h16" ${P}/>`,
  lock:        `<rect x="4.6" y="10.4" width="14.8" height="10" rx="2" ${P}/><path d="M8.2 10.4V7.6a3.8 3.8 0 0 1 7.6 0v2.8" ${P}/>`,
  book:        `<path d="M4 4.6h6a3 3 0 0 1 3 3v12a2.4 2.4 0 0 0-2.4-2.4H4z" ${P}/><path d="M20 4.6h-6a3 3 0 0 0-3 3v12a2.4 2.4 0 0 1 2.4-2.4H20z" ${P}/>`,
  wave:        `<path d="M2.6 9.6c2-2.4 4-2.4 6 0s4 2.4 6 0 4-2.4 6.8 0" ${P}/><path d="M2.6 15.6c2-2.4 4-2.4 6 0s4 2.4 6 0 4-2.4 6.8 0" ${P} opacity=".6"/>`,
  target:      `<circle cx="12" cy="12" r="8.4" ${P}/><circle cx="12" cy="12" r="4.2" ${P} opacity=".7"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>`,
  arrowRight:  `<path d="M4.4 12h15.2" ${P}/><path d="m14 6.4 5.6 5.6L14 17.6" ${P}/>`,
  arrowUp:     `<path d="M12 19.6V4.4" ${P}/><path d="m6.4 10 5.6-5.6L17.6 10" ${P}/>`,
  arrowDown:   `<path d="M12 4.4v15.2" ${P}/><path d="m6.4 14 5.6 5.6L17.6 14" ${P}/>`,
  chevronDown: `<path d="m6.4 9.6 5.6 5.6 5.6-5.6" ${P}/>`,
  logo:        `<circle cx="12" cy="12" r="4.4" ${P}/><ellipse cx="12" cy="12" rx="10.4" ry="4.6" transform="rotate(-28 12 12)" ${P} opacity=".8"/>`,
}

/**
 * Inline SVG string for an icon.
 * @param {string} name  key in PATHS
 * @param {number} size  px, default 16
 * @param {string} cls   optional extra class
 */
export function icon(name, size = 16, cls = '') {
  const body = PATHS[name]
  if (!body) return ''
  return `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" `
       + `aria-hidden="true" focusable="false">${body}</svg>`
}

export function hasIcon(name) { return !!PATHS[name] }
export const ICON_NAMES = Object.keys(PATHS)

// ─── Country marks ──────────────────────────────────────────────────────────
// Flag emoji do not render on Windows Chrome at all, and are inconsistent
// elsewhere. Two-letter codes in a chip are legible everywhere.

const CODES = {
  'Delhi': 'IN', 'New York': 'US', 'London': 'GB', 'Tokyo': 'JP',
  'Sao Paulo': 'BR', 'São Paulo': 'BR', 'Sydney': 'AU', 'Lagos': 'NG', 'Dubai': 'AE',
}

export function countryCode(city) { return CODES[city] ?? '' }
export function countryChip(city) {
  const c = countryCode(city)
  return c ? `<span class="cc">${c}</span>` : ''
}

// ─── Hydration ──────────────────────────────────────────────────────────────
// Markup across the app uses <i data-ic="name"></i> placeholders rather than
// calling icon() inline. That works identically inside plain HTML, single-
// quoted strings and template literals, so no call site has to care — and it
// avoids a name collision with the local `icon` variables that already exist
// in ui.js. A MutationObserver catches everything rendered later via innerHTML.

function hydrateIn(root) {
  const nodes = root.querySelectorAll?.('i[data-ic]')
  if (!nodes?.length) return
  nodes.forEach(el => {
    const name = el.dataset.ic
    const body = PATHS[name]
    if (!body) { el.remove(); return }
    const size = el.dataset.size || 16
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('class', 'ic ' + (el.className || ''))
    svg.setAttribute('width', size)
    svg.setAttribute('height', size)
    svg.setAttribute('viewBox', '0 0 24 24')
    svg.setAttribute('aria-hidden', 'true')
    svg.innerHTML = body
    el.replaceWith(svg)
  })
}

export function initIcons() {
  hydrateIn(document)
  new MutationObserver(muts => {
    for (const m of muts) {
      for (const n of m.addedNodes) {
        if (n.nodeType !== 1) continue
        if (n.matches?.('i[data-ic]')) { hydrateIn(n.parentNode || document); continue }
        hydrateIn(n)
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true })
}
