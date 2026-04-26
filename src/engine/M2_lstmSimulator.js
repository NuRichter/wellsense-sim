// engine/M2_lstmSimulator.js — LSTM 2-Layer
import { sigmoid } from '../utils/math.js';
import { FEATURE_INDEX } from './L2_preprocessing.js';
import { getAnomalyBoost } from './L1_dataStream.js';

const FEATURE_WEIGHTS = {
  // Zona 1 — Wellhead
  delta_FTHP_WHP:   -0.18,
  WHP_std6h:        +0.13,
  delta_GL_WHP:     -0.10,
  delta_WHP_1h:     -0.08,
  WHP_scaled:       -0.06,
  FTHP_scaled:      -0.05,
  WHP_mean6h:       -0.05,
  Annular_scaled:   -0.04,
  WHP_lag1h:        -0.04,
  WHT_scaled:       -0.03,
  WHP_lag6h:        -0.03,
  // Zona 2 — Flow
  FlowRate_std24h:  +0.16,
  ratio_GL_Flow:    -0.14,
  choke_step_flag:  +0.09,
  FlowRate_mean24h: -0.04,
  log_FlowRate:     -0.04,
  FlowRate_scaled:  -0.05,
  FlowRate_lag6h:   -0.03,
  Choke_scaled:     +0.04,
  // Zona 3 — Gas-Lift
  GL_Rate_scaled:   -0.15,
  GL_Press_scaled:  -0.12,
  GL_mean6h:        -0.06,
  log_GL_Rate:      -0.05,
  // Zona 4 — Multiphase
  BSW_scaled:       +0.10,
  GOR_scaled:       +0.08,
  ratio_GOR_base:   +0.07,
  log_GOR:          +0.06,
};

let hiddenState1 = 0.0;
let hiddenState2 = 0.0;
let prevP = 0.05;

export function forward(seq24x28) {
  if (!seq24x28) return { P_LPO: 0.05, warmup: true, hiddenState1, hiddenState2, contributors: [] };

  const timeWeight = t => Math.exp(-0.05 * (23 - t));

  let rawScore = 0;
  const contribs = {};
  for (let t = 0; t < 24; t++) {
    for (const [fname, w] of Object.entries(FEATURE_WEIGHTS)) {
      const fIdx = FEATURE_INDEX[fname];
      if (fIdx == null) continue;
      const c = timeWeight(t) * w * seq24x28[t][fIdx];
      rawScore += c;
      contribs[fname] = (contribs[fname] || 0) + c;
    }
  }

  // p_lpo_prev persistence (simulated as carry-forward bias)
  rawScore += 0.20 * (prevP - 0.5) * 24;

  hiddenState1 = 0.7 * hiddenState1 + 0.3 * rawScore;
  hiddenState2 = 0.8 * hiddenState2 + 0.2 * sigmoid(hiddenState1);

  const logit = hiddenState2 + getAnomalyBoost();
  const P_LPO = Math.min(0.99, Math.max(0.05, sigmoid(logit * 2.5)));
  prevP = P_LPO;

  // Top contributors (absolute magnitude)
  const contributors = Object.entries(contribs)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 5)
    .map(([f, v]) => ({ feature: f, contribution: v }));

  return { P_LPO, warmup: false, hiddenState1, hiddenState2, contributors };
}

export function reset() {
  hiddenState1 = 0; hiddenState2 = 0; prevP = 0.05;
}
