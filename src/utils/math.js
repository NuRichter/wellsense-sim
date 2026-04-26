// utils/math.js — Math helpers
export const sigmoid = x => 1 / (1 + Math.exp(-x));
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
export const std = a => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length);
};
export const euclidean = (a, b) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
  return Math.sqrt(s);
};
export class StandardScaler {
  constructor() { this.mu = []; this.sd = []; this.fitted = false; }
  fit(data) {
    if (!data.length) return;
    const n = data[0].length;
    this.mu = new Array(n).fill(0);
    this.sd = new Array(n).fill(1);
    for (let j = 0; j < n; j++) {
      const col = data.map(r => r[j]).filter(v => Number.isFinite(v));
      this.mu[j] = mean(col);
      this.sd[j] = std(col) || 1;
    }
    this.fitted = true;
  }
  transformOne(row) {
    return row.map((v, j) => (v - this.mu[j]) / this.sd[j]);
  }
  transformValue(j, v) { return (v - this.mu[j]) / this.sd[j]; }
}
export function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}
