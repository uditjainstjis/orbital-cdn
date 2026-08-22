# Orbital CDN — demo video

93-second product film, built with Remotion (React → mp4). 1920×1080, 30 fps.

```
npm install
npm run studio     # live preview while editing
npm run render     # writes out/orbital-cdn.mp4
```

**Structure.** `src/Main.tsx` holds the scene plan and timing; `src/Scenes.tsx` holds the
eight scenes; `src/lib.tsx` holds the design tokens, easing helpers and shared chrome.
Every number shown is taken from a measured result, not written for the film.

**One gotcha worth knowing.** `Backdrop` is absolutely positioned, so it paints *above*
ordinary in-flow content — positioned elements paint later than static ones regardless of
DOM order. Scene content therefore needs `position: relative; zIndex: 1`, or it renders
invisibly underneath the opaque background. `Rise` escapes this only because its transform
creates a stacking context.
