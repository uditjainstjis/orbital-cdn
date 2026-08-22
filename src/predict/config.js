// Central configuration for the predictive and agentic layers.
// Everything tunable lives here rather than as literals scattered through the
// engine, so a reviewer can see the whole set of assumptions in one screen.

export const PREDICT = {
  // An outage is worth this much latency-equivalent cost. A failed request is
  // far worse than a slow one; this is the exchange rate between the two, kept
  // in milliseconds so it trades directly against every other routing term.
  FAILURE_COST_MS: 900,

  // How far ahead the router looks when costing a route. Longer horizons are
  // less certain, so the weight tapers.
  HORIZON_WEIGHTS: { 1: 1.0, 3: 0.55, 6: 0.25, 12: 0.1 },

  // Below this confidence the predictive term is damped toward zero and the
  // agent may only recommend, never act.
  MIN_CONFIDENCE_TO_ACT: 0.6,
}

export const AGENT = {
  TICK_MS: 4000,               // decision cadence, decoupled from the render loop

  // Anti-thrash. Without these an agent oscillates between two gateways and
  // makes the network worse than leaving it alone.
  MIN_HOLD_MS: 20000,          // a route must be in place this long before it may change
  COOLDOWN_MS: 15000,          // after acting, wait before acting again
  MIN_IMPROVEMENT_MS: 25,      // expected cost improvement required to justify a move
  MIN_RISK_DROP: 0.15,         // and the predicted risk must fall by at least this much
  ACTION_COST_MS: 12,          // moving is not free; charged against the improvement

  // Trigger thresholds
  GATEWAY_RISK_TRIGGER: 0.45,  // predicted degradation probability that wakes the agent
  LINK_OUTAGE_TRIGGER: 0.30,
}

export const MODES = { OFF: 'OFF', ASSIST: 'ASSIST', AUTOPILOT: 'AUTOPILOT' }
