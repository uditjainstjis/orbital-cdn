#!/usr/bin/env node
//
// Turn the brand logo into every asset the site needs.
//
//   node tools/make-logo.mjs <source-image>
//
// The source is a square badge on a dark navy field with a starfield. Three
// different jobs need three different crops of it, and doing them by hand once
// per logo revision is how a favicon ends up one version behind the header:
//
//   public/logo-full.png   the whole lockup, mark + wordmark — README, deck, docs
//   public/logo-mark.png   the badge alone on transparency — the top bar
//   public/favicon-*.png   the badge at tab sizes, plus apple-touch-icon
//
// Background removal is a flood fill from the four corners rather than a colour
// key: the field is a gradient with stars in it, so keying one navy value leaves
// the stars behind as speckle and eats the darker parts of the badge.

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const src = process.argv[2]
if (!src || !existsSync(src)) {
  console.error('usage: node tools/make-logo.mjs <source-image>')
  process.exit(1)
}

const OUT = resolve('public')
mkdirSync(OUT, { recursive: true })
const magick = (...a) => execFileSync('magick', a.map(String), { stdio: 'inherit' })

// The full lockup, trimmed of its outer margin and capped so the repo does not
// carry a multi-megabyte PNG.
magick(src, '-resize', '1024x1024>', '-strip', `${OUT}/logo-full.png`)

// The badge alone. Fuzzy flood fill inward from every corner clears the field
// including its stars; -trim then crops to what survived.
magick(src,
  '-alpha', 'set', '-bordercolor', 'none', '-border', '1',
  '-fuzz', '22%',
  '-fill', 'none', '-draw', 'alpha 0,0 floodfill',
  '-fill', 'none', '-draw', 'alpha 0,%[fx:h-1] floodfill',
  '-fill', 'none', '-draw', 'alpha %[fx:w-1],0 floodfill',
  '-fill', 'none', '-draw', 'alpha %[fx:w-1],%[fx:h-1] floodfill',
  '-trim', '+repage',
  // Drop the wordmark: the interface sets that in its own typeface, and a
  // raster wordmark at 22px would be mush next to live text.
  '-gravity', 'north', '-crop', '100%x78%+0+0', '+repage', '-trim', '+repage',
  '-resize', '512x512', '-strip', `${OUT}/logo-mark.png`)

for (const s of [16, 32, 48, 180, 512]) {
  const name = s === 180 ? 'apple-touch-icon.png' : `favicon-${s}.png`
  // Tab strips are light as often as dark, so the icon keeps a dark plate
  // rather than relying on transparency it cannot control.
  magick(`${OUT}/logo-mark.png`,
    '-background', '#0e0f12', '-gravity', 'center',
    '-resize', `${Math.round(s * 0.86)}x${Math.round(s * 0.86)}`,
    '-extent', `${s}x${s}`, '-strip', `${OUT}/${name}`)
}
magick(`${OUT}/favicon-16.png`, `${OUT}/favicon-32.png`, `${OUT}/favicon-48.png`, `${OUT}/favicon.ico`)

console.log('\nwrote:')
for (const f of ['logo-full.png', 'logo-mark.png', 'favicon.ico', 'favicon-16.png',
                 'favicon-32.png', 'favicon-48.png', 'favicon-512.png', 'apple-touch-icon.png']) {
  console.log('  public/' + f)
}
