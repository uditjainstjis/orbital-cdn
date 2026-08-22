// The design system, as executable tests.
//
// A palette is only a system while something enforces it. This file is that
// something: it fails the build if a stray colour literal reappears, if the
// JavaScript palette drifts from the CSS one, or if a decorative gradient
// creeps back in. Five overlapping palettes had accumulated in this project
// before anyone noticed, precisely because nothing was checking.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'
import { PALETTE, SEMANTIC } from '../src/palette.js'

const ROOT = new URL('..', import.meta.url).pathname

function sourceFiles(dir = join(ROOT, 'src'), acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) { sourceFiles(p, acc); continue }
    if (['.js', '.mjs', '.css', '.html'].includes(extname(name))) acc.push(p)
  }
  return acc
}
const FILES = [...sourceFiles(), join(ROOT, 'index.html')]
const rel = p => p.slice(ROOT.length)

// ─── Retired palettes must stay retired ─────────────────────────────────────

const RETIRED = {
  '0,212,255':   'legacy neon cyan',
  '124,58,237':  'legacy purple',
  '00d4ff':      'legacy neon cyan',
  '00ff88':      'legacy neon green',
  '7c3aed':      'legacy purple',
  'f59e0b':      'tailwind amber',
  'ef4444':      'tailwind red',
  '10b981':      'tailwind emerald',
  '4ade80':      'tailwind green',
  'deepskyblue': 'a browser colour keyword, which is not a decision',
}

test('no retired palette literal survives anywhere in src', () => {
  const hits = []
  for (const f of FILES) {
    const lines = readFileSync(f, 'utf8').split('\n')
    lines.forEach((line, i) => {
      for (const [lit, why] of Object.entries(RETIRED)) {
        if (line.includes(lit)) hits.push(`${rel(f)}:${i + 1}  ${lit} (${why})`)
      }
    })
  }
  assert.deepEqual(hits, [], `retired colours reappeared:\n  ${hits.join('\n  ')}`)
})

// ─── Gradients ──────────────────────────────────────────────────────────────

test('the only gradient in the codebase is the functional edge-fade mask', () => {
  const hits = []
  for (const f of FILES) {
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      if (!/linear-gradient|radial-gradient/.test(line)) return
      // A mask is a transparency ramp, not decoration; it is allowed.
      if (line.includes('mask-image')) return
      hits.push(`${rel(f)}:${i + 1}  ${line.trim().slice(0, 90)}`)
    })
  }
  assert.deepEqual(hits, [], `decorative gradients reappeared:\n  ${hits.join('\n  ')}`)
})

test('no zero-offset coloured halo is used as depth', () => {
  const css = readFileSync(join(ROOT, 'src/style.css'), 'utf8')
  const hits = []
  css.split('\n').forEach((line, i) => {
    // box-shadow: 0 0 <blur> <colour> — a glow. `inset` rings are a border
    // substitute and legitimate; real depth carries an offset.
    if (/box-shadow:\s*0\s+0\s+\d/.test(line) && !line.includes('inset')) {
      hits.push(`style.css:${i + 1}  ${line.trim().slice(0, 90)}`)
    }
  })
  assert.deepEqual(hits, [], `glows reappeared:\n  ${hits.join('\n  ')}`)
})

// ─── The two-file palette contract ──────────────────────────────────────────
//
// three.js and globe.gl are evaluated outside CSS and cannot read a custom
// property, so the palette necessarily exists twice. This is the check that
// keeps the constellation and the chrome from drifting apart again.

test('every palette.js hex has the identical value in the CSS :root block', () => {
  const css  = readFileSync(join(ROOT, 'src/style.css'), 'utf8')
  const root = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')))

  const cssVars = {}
  for (const m of root.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    cssVars[m[1]] = m[2].toLowerCase()
  }

  const pairs = [
    ['bg', 'bg'], ['bgDeep', 'bg-deep'], ['panel', 'panel'], ['card', 'card'],
    ['cardHi', 'card-hi'], ['text', 'text'], ['text2', 'text-2'], ['muted', 'muted'],
    ['faint', 'faint'], ['accent', 'accent'], ['accentHi', 'accent-hi'],
    ['accentInk', 'accent-ink'], ['pos', 'pos'], ['neg', 'neg'], ['info', 'info'],
  ]
  for (const [jsKey, cssKey] of pairs) {
    assert.ok(PALETTE[jsKey], `palette.js is missing ${jsKey}`)
    assert.equal(cssVars[cssKey], PALETTE[jsKey].toLowerCase(),
      `--${cssKey} is ${cssVars[cssKey]} in CSS but ${PALETTE[jsKey]} in palette.js`)
  }
})

test('every semantic role resolves to a colour that is actually in the palette', () => {
  const allowed = new Set(Object.values(PALETTE).map(c => c.toLowerCase()))
  for (const [role, colour] of Object.entries(SEMANTIC)) {
    assert.ok(allowed.has(colour.toLowerCase()),
      `semantic role "${role}" uses ${colour}, which is not a palette token`)
  }
})

// ─── Contrast ───────────────────────────────────────────────────────────────

const srgb = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
  return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b)
}
const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

test('body text steps clear WCAG AA on the card surface', () => {
  for (const key of ['text', 'text2', 'muted']) {
    const ratio = contrast(PALETTE[key], PALETTE.card)
    assert.ok(ratio >= 4.5,
      `--${key} (${PALETTE[key]}) is ${ratio.toFixed(2)}:1 on --card, below the 4.5:1 floor`)
  }
})

test('semantic hues clear AA where they are used as text', () => {
  for (const key of ['pos', 'neg', 'info', 'accent']) {
    const ratio = contrast(PALETTE[key], PALETTE.card)
    assert.ok(ratio >= 4.5,
      `--${key} (${PALETTE[key]}) is ${ratio.toFixed(2)}:1 on --card, below the 4.5:1 floor`)
  }
})

test('the primary action button clears AA for its own ink', () => {
  const ratio = contrast(PALETTE.accentInk, PALETTE.accent)
  assert.ok(ratio >= 4.5,
    `--accent-ink on --accent is ${ratio.toFixed(2)}:1, below the 4.5:1 floor`)
})

// ─── Craft-floor bans that are mechanically checkable ───────────────────────

test('no emoji stands in for an icon', () => {
  // Icons are drawn, from the project's own 48-glyph stroke set in src/icons.js.
  const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u
  const hits = []
  for (const f of FILES) {
    if (f.endsWith('icons.js')) continue
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      if (emoji.test(line)) hits.push(`${rel(f)}:${i + 1}  ${line.trim().slice(0, 70)}`)
    })
  }
  assert.deepEqual(hits, [], `emoji used as iconography:\n  ${hits.join('\n  ')}`)
})

test('no kicker or eyebrow label sits above a heading', () => {
  const hits = []
  for (const f of FILES) {
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      if (/class="[^"]*(eyebrow|kicker)/.test(line)) hits.push(`${rel(f)}:${i + 1}`)
    })
  }
  assert.deepEqual(hits, [], `kickers reappeared at:\n  ${hits.join('\n  ')}`)
})
