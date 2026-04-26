// engine/M1_isolationForest.js — Sensor noise filter (20 trees)
import { FEATURE_NAMES } from './L2_preprocessing.js';

const N_TREES = 20;
const SUB_SAMPLE = 200;
const MAX_DEPTH = 10;

let trees = [];
let c_n = 0;
let prevFeatureVector = null;

function buildTree(samples, depth = 0) {
  if (depth >= MAX_DEPTH || samples.length <= 1) {
    return { isLeaf: true, size: samples.length, depth };
  }
  const fIdx = Math.floor(Math.random() * 28);
  let lo = Infinity, hi = -Infinity;
  for (const s of samples) {
    if (s[fIdx] < lo) lo = s[fIdx];
    if (s[fIdx] > hi) hi = s[fIdx];
  }
  if (lo === hi) return { isLeaf: true, size: samples.length, depth };
  const split = lo + Math.random() * (hi - lo);
  const left = [], right = [];
  for (const s of samples) (s[fIdx] < split ? left : right).push(s);
  if (!left.length || !right.length) return { isLeaf: true, size: samples.length, depth };
  return {
    isLeaf: false, fIdx, split, depth,
    left: buildTree(left, depth + 1),
    right: buildTree(right, depth + 1),
  };
}

function pathLen(node, x, depth = 0) {
  if (node.isLeaf) {
    const sz = Math.max(1, node.size);
    return depth + (sz > 1 ? 2 * (Math.log(sz - 1) + 0.5772) - 2 * (sz - 1) / sz : 0);
  }
  return x[node.fIdx] < node.split
    ? pathLen(node.left, x, depth + 1)
    : pathLen(node.right, x, depth + 1);
}

export function fit(allFeatureVectors) {
  trees = [];
  if (!allFeatureVectors.length) return;
  const n = Math.min(SUB_SAMPLE, allFeatureVectors.length);
  for (let t = 0; t < N_TREES; t++) {
    const sub = [];
    for (let k = 0; k < n; k++) {
      sub.push(allFeatureVectors[Math.floor(Math.random() * allFeatureVectors.length)]);
    }
    trees.push(buildTree(sub));
  }
  c_n = 2 * (Math.log(n - 1) + 0.5772) - 2 * (n - 1) / n;
}

export function score(featureVector28, smoteWeight = 1.5) {
  if (!trees.length) return { ifScore: 0, isOutlier: false, smoteWeight, threshold: 0.02 };
  let total = 0;
  for (const t of trees) total += pathLen(t, featureVector28);
  const avgPath = total / trees.length;
  const sc = Math.pow(2, -avgPath / Math.max(1e-6, c_n));
  // Map raw IF score (typically ~0.4-0.6) to bounded indicator scale
  // We expect "anomaly" when sc > ~0.55; rescale into 0..1
  const rescaled = Math.max(0, Math.min(1, (sc - 0.45) / 0.25));
  const threshold = 0.55 - 0.05 * (smoteWeight - 1.0);  // higher smoteWeight = lower threshold = more sensitive
  const isOutlier = sc > threshold;
  return { ifScore: rescaled, ifRaw: sc, isOutlier, smoteWeight, threshold };
}

export function imputeIfOutlier(featureVector28, isOutlier) {
  if (isOutlier && prevFeatureVector) {
    const out = [...prevFeatureVector];
    prevFeatureVector = featureVector28;
    return { vec: out, imputed: true };
  }
  prevFeatureVector = featureVector28;
  return { vec: featureVector28, imputed: false };
}

export function reset() { trees = []; prevFeatureVector = null; }
