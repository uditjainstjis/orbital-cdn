@.claude/STATE.md

# Orbital CDN — hard facts

- `index.old.html` and `FEATURES.md` describe a **dead** predecessor (single-file
  Canvas2D). They are not this app. Do not treat them as documentation.
- `sleep()` in `src/sequence.js` must always resolve its promise when cleared.
  Cancelling the timer alone deadlocks `seqActive` and disables the whole UI.
- Never `await requestAnimationFrame` unraced — it never fires in a background tab.
- Every term in the routing cost function is in **latency-equivalent milliseconds**.
  Adding a bare 0-1 penalty silently makes it dominate half a planet of detour.
- `pathDistanceKm()` returns the **complete out-and-back** path. Do not double it.
