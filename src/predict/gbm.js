// Minimal gradient-boosted-tree evaluator.
//
// The model is trained offline with LightGBM (ml/train_fade_risk.py) and
// exported as compact JSON. Evaluating it here rather than calling a service
// keeps the app a static site: no backend to deploy, no cold start, no network
// dependency during a demo, and inference in microseconds.
//
// Node form, matching the exporter:
//   split  -> [featureIndex, threshold, defaultLeft, leftChild, rightChild]
//   leaf   -> a bare number
//
// LightGBM's binary objective sums raw tree outputs and applies a logistic.

/** Walk one tree. */
function evalTree(node, x) {
  while (Array.isArray(node)) {
    const [f, thr, defLeft, left, right] = node
    const v = x[f]
    // Missing values follow the split's default direction, as in training.
    node = (v === undefined || v === null || Number.isNaN(v))
      ? (defLeft ? left : right)
      : (v <= thr ? left : right)
  }
  return node
}

const sigmoid = z => 1 / (1 + Math.exp(-z))

/** Probability from an ensemble of trees. */
export function predictProba(trees, x) {
  let raw = 0
  for (let i = 0; i < trees.length; i++) raw += evalTree(trees[i], x)
  return sigmoid(raw)
}

/** Build the ordered feature vector the model expects, from a named object. */
export function vectorise(featureNames, obj) {
  const x = new Array(featureNames.length)
  for (let i = 0; i < featureNames.length; i++) x[i] = obj[featureNames[i]]
  return x
}
