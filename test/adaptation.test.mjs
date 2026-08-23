// Tests for the round-2 deliverable: summarising usage and outcome patterns
// over a selected time period, and the product state that supports it.
//
// The brief asked for both halves — the user-facing summary AND the state
// behind it. These tests exercise the state: that the window selector actually
// partitions the log, that aggregates are computed only over the selected
// period, and that the penalties fed back into routing are derived from that
// window rather than from the whole history.

import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

// telemetry.js persists to localStorage. In Node that reference throws, which
// the module already catches and degrades to an in-memory cache — exactly the
// behaviour we want under test, so no shim is needed.
import {
  WINDOWS, windowById, seedEvents, clearAll, eventsInWindow,
  summarize, adaptiveProfile, eventCount,
} from '../src/telemetry.js'

const HOUR = 3600e3
const NOW  = 1_760_000_000_000   // fixed instant; no Date.now() in assertions

/** A minimal but complete telemetry row, at `hoursAgo` before NOW. */
function ev(hoursAgo, over = {}) {
  return {
    ts: NOW - hoursAgo * HOUR,
    city: 'Delhi', service: 'llm', compute: 'high', policy: 'balanced',
    dc: 'DC-1', dcEcl: false, dcSAA: false,
    gw: 'Mumbai', wx: 'clear',
    hops: 3, saa: 0, rtt: 70, base: 92, prop: 40, proc: 20, wxMs: 0,
    sunlit: 3, adaptive: false, synthetic: true,
    ...over,
  }
}

beforeEach(() => clearAll())

// ─── The window selector is the user-facing control ─────────────────────────

test('every advertised window is selectable and ordered shortest to longest', () => {
  const ids = WINDOWS.map(w => w.id)
  assert.deepEqual(ids, ['1h', '24h', '7d', '30d', 'all'])
  const finite = WINDOWS.filter(w => w.ms !== Infinity).map(w => w.ms)
  assert.deepEqual(finite, [...finite].sort((a, b) => a - b))
})

test('an unknown window id falls back rather than throwing', () => {
  assert.equal(windowById('not-a-window').id, '24h')
})

test('a window selects exactly the events inside it', () => {
  seedEvents([ev(0.5), ev(5), ev(50), ev(400), ev(1000)])

  assert.equal(eventsInWindow('1h',  NOW).length, 1, '1H must hold only the 30-minute-old row')
  assert.equal(eventsInWindow('24h', NOW).length, 2)
  assert.equal(eventsInWindow('7d',  NOW).length, 3)
  assert.equal(eventsInWindow('30d', NOW).length, 4)
  assert.equal(eventsInWindow('all', NOW).length, 5, 'ALL must hold everything')
})

test('events in the future of the selected instant are excluded', () => {
  seedEvents([ev(-2), ev(1)])
  assert.equal(eventsInWindow('24h', NOW).length, 1,
    'a row stamped after `now` must not appear in a window ending at `now`')
})

// ─── Aggregates are computed over the window, not the whole log ─────────────

test('summary statistics reflect only the selected period', () => {
  seedEvents([
    ...Array.from({ length: 5 }, () => ev(0.2, { rtt: 60, base: 100 })),  // recent, winning
    ...Array.from({ length: 5 }, () => ev(500, { rtt: 150, base: 100 })), // old, losing
  ])

  const recent = summarize('1h',  NOW)
  const whole  = summarize('all', NOW)

  assert.equal(recent.overall.n, 5)
  assert.equal(whole.overall.n, 10)
  assert.equal(recent.overall.winRate, 1, 'every request in the last hour beat its baseline')
  assert.ok(whole.overall.winRate < recent.overall.winRate,
    'widening the window must pull in the older losses')
})

test('an empty window summarises to zero rather than crashing or reporting NaN', () => {
  seedEvents([ev(1000)])
  const s = summarize('1h', NOW)
  assert.equal(s.overall.n, 0)
  for (const [k, v] of Object.entries(s.overall)) {
    if (typeof v === 'number') assert.ok(Number.isFinite(v), `overall.${k} is ${v}`)
  }
})

test('breakdowns partition the window without losing or duplicating rows', () => {
  seedEvents([
    ev(1, { city: 'Delhi',  gw: 'Mumbai',    dc: 'DC-1' }),
    ev(2, { city: 'Lagos',  gw: 'Frankfurt', dc: 'DC-2' }),
    ev(3, { city: 'Lagos',  gw: 'Frankfurt', dc: 'DC-1' }),
  ])
  const s = summarize('24h', NOW)
  for (const key of ['byCity', 'byGateway', 'byDC', 'byPolicy', 'byService']) {
    const total = s[key].reduce((a, r) => a + r.n, 0)
    assert.equal(total, s.overall.n, `${key} counts sum to ${total}, not ${s.overall.n}`)
  }
})

test('breakdowns are ordered by volume so the busiest row reads first', () => {
  seedEvents([ev(1, { city: 'Delhi' }), ev(1, { city: 'Lagos' }), ev(1, { city: 'Lagos' })])
  assert.equal(summarize('24h', NOW).byCity[0].key, 'Lagos')
})

test('gateway rain share and DC eclipse share are measured, not assumed', () => {
  seedEvents([
    ev(1, { gw: 'Mumbai',    wx: 'rain'  }),
    ev(1, { gw: 'Mumbai',    wx: 'clear' }),
    ev(1, { gw: 'Frankfurt', dc: 'DC-3', dcEcl: true  }),
    ev(1, { gw: 'Frankfurt', dc: 'DC-3', dcEcl: false }),
  ])
  const s  = summarize('24h', NOW)
  const gw = s.byGateway.find(r => r.key === 'Mumbai')
  const dc = s.byDC.find(r => r.key === 'DC-3')
  assert.equal(gw.rainShare, 0.5)
  assert.equal(dc.eclShare, 0.5)
})

// ─── The product state that feeds back into routing ─────────────────────────

test('the adaptive profile is derived from the selected window', () => {
  // A gateway that rained heavily long ago but has been clear recently must not
  // be penalised when the user is looking at the last hour.
  seedEvents([
    ...Array.from({ length: 30 }, () => ev(400, { gw: 'Frankfurt', wx: 'rain', wxMs: 22 })),
    ...Array.from({ length: 30 }, () => ev(0.3, { gw: 'Frankfurt', wx: 'clear', wxMs: 0 })),
  ])
  const recent = adaptiveProfile('1h',  NOW)
  const whole  = adaptiveProfile('all', NOW)

  const pRecent = recent.gwPenalty?.Frankfurt ?? 0
  const pWhole  = whole.gwPenalty?.Frankfurt  ?? 0
  assert.ok(pWhole > pRecent,
    `history-wide penalty ${pWhole} should exceed the recent-window penalty ${pRecent}; ` +
    'if they match, the profile is ignoring the window selection')
})

test('penalties stay in the unit interval so they cannot dominate the cost function', () => {
  seedEvents(Array.from({ length: 200 }, () =>
    ev(1, { gw: 'Frankfurt', wx: 'rain', wxMs: 22, dcSAA: true, saa: 9, rtt: 900 })))
  const p = adaptiveProfile('24h', NOW)
  for (const bag of ['gwPenalty', 'dcLatPenalty', 'dcRadPenalty']) {
    for (const [k, v] of Object.entries(p[bag] ?? {})) {
      assert.ok(v >= 0 && v <= 1, `${bag}.${k} = ${v} is outside [0,1]`)
    }
  }
})

test('a profile with too little evidence declines to claim it is ready', () => {
  seedEvents([ev(1)])
  assert.equal(adaptiveProfile('24h', NOW).ready, false,
    'one request is not enough evidence to start steering routing')
})

test('the log is append-only and survives repeated reads', () => {
  seedEvents([ev(1), ev(2)])
  const before = eventCount()
  summarize('24h', NOW); adaptiveProfile('24h', NOW); eventsInWindow('7d', NOW)
  assert.equal(eventCount(), before, 'reading the log must not mutate it')
})
