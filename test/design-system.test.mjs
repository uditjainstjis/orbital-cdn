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
import { PALETTE, SEMANTIC, SCENE, hex, shade } from '../src/palette.js'

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

// Each retired colour is listed ONCE, as hex, and matched in both notations.
// The first version of this test listed some colours as hex and others as bare
// comma triples, and matched by substring — so seven survivors written as
// `rgba(239, 68, 68, .5)` passed clean. A guard that only catches the spelling
// you happened to think of is worse than no guard, because it reports success.
const RETIRED = {
  '00d4ff': 'legacy neon cyan',
  '00ff88': 'legacy neon green',
  '7c3aed': 'legacy purple',
  '9d8df1': 'legacy violet',
  'a78bfa': 'legacy violet',
  'f59e0b': 'tailwind amber',
  'ef4444': 'tailwind red',
  'f87171': 'tailwind red',
  '10b981': 'tailwind emerald',
  '4ade80': 'tailwind green',
  '6ee7b7': 'tailwind emerald',
  'fcd34d': 'tailwind yellow',
  'c4b5fd': 'tailwind violet',
  '6ea8fe': 'legacy blue',
  'ff6b6b': 'legacy red',
  'ff9e3d': 'interim amber',
}

/** Both spellings of one colour: `#aabbcc` and `rgb(170, 187, 204)`. */
function patternsFor(hex) {
  const [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16))
  return [
    new RegExp(hex, 'i'),
    new RegExp(`\\b${r}\\s*,\\s*${g}\\s*,\\s*${b}\\b`),
  ]
}

test('no retired palette literal survives, in hex or in rgb() notation', () => {
  const hits = []
  for (const f of FILES) {
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      for (const [hex, why] of Object.entries(RETIRED)) {
        for (const re of patternsFor(hex)) {
          if (re.test(line)) { hits.push(`${rel(f)}:${i + 1}  ${hex} (${why})`); break }
        }
      }
    })
  }
  assert.deepEqual(hits, [], `retired colours reappeared:\n  ${hits.join('\n  ')}`)
})

test('every colour literal in the codebase is a palette value', () => {
  // A colour that is not retired is not therefore approved. This catches the
  // next off-palette near-white before it becomes a sixth palette.
  const allowed = new Set([...Object.values(PALETTE).map(c => c.slice(1).toLowerCase()),
                           '000', 'fff', '000000', 'ffffff'])
  const hits = []
  for (const f of FILES) {
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      for (const m of line.matchAll(/#([0-9a-fA-F]{6})\b/g)) {
        if (!allowed.has(m[1].toLowerCase())) hits.push(`${rel(f)}:${i + 1}  #${m[1]}`)
      }
    })
  }
  assert.deepEqual(hits, [], `off-palette colours:\n  ${hits.join('\n  ')}`)
})

test('no zero-offset coloured glow hides in a JavaScript template string', () => {
  // The CSS rule below only reads style.css. Eight glows lived in network.js,
  // written into an inline style, and went unnoticed for exactly that reason.
  const hits = []
  for (const f of FILES.filter(x => x.endsWith('.js'))) {
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      if (/box-shadow:\s*0\s+0\s+\d/.test(line) && !line.includes('inset')) {
        hits.push(`${rel(f)}:${i + 1}  ${line.trim().slice(0, 80)}`)
      }
    })
  }
  assert.deepEqual(hits, [], `glows in JS:\n  ${hits.join('\n  ')}`)
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
  for (const key of ['text', 'text2', 'muted', 'faint']) {
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


// ─── The palette must actually be imported, not merely maintained ───────────

test('palette.js is imported by every module that renders a colour', () => {
  const renderers = ['sats.js', 'globe.js', 'network.js', 'sequence.js', 'ui.js', 'dashboard.js']
  const missing = renderers.filter(name => {
    const src = readFileSync(join(ROOT, 'src', name), 'utf8')
    return !/from '\.\/palette\.js'/.test(src)
  })
  assert.deepEqual(missing, [],
    `these render colours without importing the palette: ${missing.join(', ')}`)
})

test('no three.js colour integer is typed by hand outside palette.js', () => {
  // The CSS and hex sweeps cannot see `0xd99a4e`. The globe is the largest
  // painted area on screen and was the last thing to leave the old palette.
  const hits = []
  for (const f of FILES.filter(x => x.endsWith('.js') && !x.endsWith('palette.js'))) {
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      for (const m of line.matchAll(/0x[0-9a-fA-F]{6}\b/g)) hits.push(`${rel(f)}:${i + 1}  ${m[0]}`)
    })
  }
  assert.deepEqual(hits, [], `hand-typed scene colours:\n  ${hits.join('\n  ')}`)
})

test('every scene colour derives from a palette token', () => {
  const derived = new Set()
  for (const c of Object.values(PALETTE)) {
    derived.add(hex(c))
    for (let k = 0.40; k <= 0.76; k += 0.01) derived.add(shade(c, Math.round(k * 100) / 100))
  }
  for (const [role, value] of Object.entries(SCENE)) {
    assert.ok(derived.has(value),
      `SCENE.${role} = 0x${value.toString(16)} is not a palette token or a shade of one`)
  }
})
