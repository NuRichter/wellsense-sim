// engine/M3_kmeans.js — Operating Regime Clustering (BD Track)
import { euclidean, mean } from '../utils/math.js';
import { REP_KEYS } from './L2_preprocessing.js';

const K = 3;
const MAX_ITER = 50;
const TOL = 1e-6;

// Gas-lift weighting: GL_Rate (idx 6) and GL_Press (idx 7) ×2.0
const GL_RATE_IDX = REP_KEYS.indexOf('GL_Rate');
const GL_PRESS_IDX = REP_KEYS.indexOf('GL_Press');

function applyWeights(point) {
  const p = [...point];
  p[GL_RATE_IDX] *= 2.0;
  p[GL_PRESS_IDX] *= 2.0;
  return p;
}

function kMeansPlusPlus(data, k) {
  const centroids = [data[Math.floor(Math.random() * data.length)]];
  for (let c = 1; c < k; c++) {
    const dists = data.map(p => {
      let m = Infinity;
      for (const ct of centroids) {
        const d = euclidean(p, ct);
        if (d * d < m) m = d * d;
      }
      return m;
    });
    const sum = dists.reduce((a, b) => a + b, 0);
    if (sum === 0) { centroids.push(data[Math.floor(Math.random() * data.length)]); continue; }
    let r = Math.random() * sum, idx = 0;
    for (let i = 0; i < dists.length; i++) {
      r -= dists[i];
      if (r <= 0) { idx = i; break; }
    }
    centroids.push([...data[idx]]);
  }
  return centroids.map(c => [...c]);
}

function silhouette(data, assignments, k) {
  if (data.length < 3) return 0;
  let total = 0;
  for (let i = 0; i < data.length; i++) {
    const ci = assignments[i];
    const sameCluster = [], otherClusters = Array.from({ length: k }, () => []);
    for (let j = 0; j < data.length; j++) {
      if (i === j) continue;
      const d = euclidean(data[i], data[j]);
      if (assignments[j] === ci) sameCluster.push(d);
      else otherClusters[assignments[j]].push(d);
    }
    const a = sameCluster.length ? mean(sameCluster) : 0;
    let b = Infinity;
    for (let c = 0; c < k; c++) {
      if (c === ci || !otherClusters[c].length) continue;
      const m = mean(otherClusters[c]);
      if (m < b) b = m;
    }
    if (!Number.isFinite(b)) b = a;
    total += (b - a) / Math.max(a, b, 1e-9);
  }
  return total / data.length;
}

export function runKMeans(regimeBuffer) {
  if (!regimeBuffer || regimeBuffer.length < 3) {
    return { ok: false, reason: 'Collecting data...', n: regimeBuffer?.length || 0 };
  }
  // regimeBuffer: [{ rep10:[10], P_LPO:n }]
  const rawPoints = regimeBuffer.map(e => e.rep10);
  const points = rawPoints.map(applyWeights);
  const lpoArr = regimeBuffer.map(e => e.P_LPO);

  let centroids = kMeansPlusPlus(points, K);
  let assignments = new Array(points.length).fill(0);
  let iter = 0, shift = Infinity;

  while (iter < MAX_ITER && shift > TOL) {
    // Assign
    for (let i = 0; i < points.length; i++) {
      let best = 0, bd = Infinity;
      for (let c = 0; c < K; c++) {
        const d = euclidean(points[i], centroids[c]);
        if (d < bd) { bd = d; best = c; }
      }
      assignments[i] = best;
    }
    // Update
    const newCentroids = Array.from({ length: K }, () => new Array(points[0].length).fill(0));
    const counts = new Array(K).fill(0);
    for (let i = 0; i < points.length; i++) {
      const c = assignments[i];
      counts[c]++;
      for (let j = 0; j < points[i].length; j++) newCentroids[c][j] += points[i][j];
    }
    for (let c = 0; c < K; c++) {
      if (counts[c] > 0) {
        for (let j = 0; j < newCentroids[c].length; j++) newCentroids[c][j] /= counts[c];
      } else {
        newCentroids[c] = [...centroids[c]];
      }
    }
    shift = 0;
    for (let c = 0; c < K; c++) {
      const d = euclidean(centroids[c], newCentroids[c]);
      if (d > shift) shift = d;
    }
    centroids = newCentroids;
    iter++;
  }

  // Label clusters: highest mean P_LPO → CRITICAL; lowest GL efficiency (smallest GL_Rate centroid) → DEGRADED; rest → OPTIMAL
  const clusterLpoMean = [];
  const clusterGLMean = [];
  for (let c = 0; c < K; c++) {
    const members = lpoArr.filter((_, i) => assignments[i] === c);
    clusterLpoMean.push(members.length ? mean(members) : 0);
    // Use unweighted GL_Rate centroid value (divide back by 2)
    clusterGLMean.push(centroids[c][GL_RATE_IDX] / 2);
  }
  const labels = new Array(K).fill('STABLE');
  let critical = clusterLpoMean.indexOf(Math.max(...clusterLpoMean));
  labels[critical] = 'HIGH_RISK';
  // among non-critical, find lowest GL → MODERATE
  let degradedIdx = -1, lowestGL = Infinity;
  for (let c = 0; c < K; c++) {
    if (c === critical) continue;
    if (clusterGLMean[c] < lowestGL) { lowestGL = clusterGLMean[c]; degradedIdx = c; }
  }
  if (degradedIdx >= 0) labels[degradedIdx] = 'MODERATE';

  const sil = silhouette(points, assignments, K);

  // Migration: today vs yesterday majority cluster
  const lastN = Math.min(24, regimeBuffer.length);
  const todaySlice = assignments.slice(-lastN);
  const todayMaj = majorityLabel(todaySlice, labels);
  let yesterdayMaj = null;
  if (regimeBuffer.length >= 48) {
    const ySlice = assignments.slice(-48, -24);
    yesterdayMaj = majorityLabel(ySlice, labels);
  }

  return {
    ok: true,
    iter,
    centroids,             // weighted-space centroids
    centroidsRaw: centroids.map(c => {
      const r = [...c];
      r[GL_RATE_IDX] /= 2;
      r[GL_PRESS_IDX] /= 2;
      return r;
    }),
    assignments,
    labels,                // per-cluster label string
    pointLabels: assignments.map(a => labels[a]),
    silhouette: sil,
    todayRegime: todayMaj,
    yesterdayRegime: yesterdayMaj,
    clusterLpoMean,
    clusterGLMean,
  };
}

function majorityLabel(slice, labels) {
  const counts = {};
  for (const a of slice) {
    const lab = labels[a];
    counts[lab] = (counts[lab] || 0) + 1;
  }
  let best = null, bv = -1;
  for (const k of Object.keys(counts)) if (counts[k] > bv) { bv = counts[k]; best = k; }
  return best;
}

export function detectMigration(today, yesterday) {
  if (!yesterday || !today || today === yesterday) return null;
  if (yesterday === 'STABLE'   && today === 'MODERATE')   return { kind: 'WARNING',    tier: 2, from: yesterday, to: today, scenario: 'STABLE_TO_MODERATE' };
  if (yesterday === 'STABLE'   && today === 'HIGH_RISK')  return { kind: 'CRITICAL',   tier: 3, from: yesterday, to: today, scenario: 'STABLE_TO_HIGH_RISK' };
  if (yesterday === 'MODERATE' && today === 'HIGH_RISK')  return { kind: 'ESCALATION', tier: 3, from: yesterday, to: today, scenario: 'MODERATE_TO_HIGH_RISK' };
  return null;
}
