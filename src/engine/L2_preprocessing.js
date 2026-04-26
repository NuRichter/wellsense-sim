// engine/L2_preprocessing.js — Layer 2
import { StandardScaler, mean, std } from '../utils/math.js';
import * as L1 from './L1_dataStream.js';

const REPRESENTATIVE = {
  WHP:      r => r.P_wh,
  WHT:      r => r.T_primary,
  FTHP:     r => r.P_fthp,
  Annular:  r => r.P_ann,
  FlowRate: r => r.vol_flow_rate,
  Choke:    r => r.mpos_actual,
  GL_Rate:  r => r.vol_flow_gas,
  GL_Press: r => r.P_inject,
  GOR:      r => r.GOR,
  BSW:      r => r.BSW_pct,
};
export const REP_KEYS = ['WHP', 'WHT', 'FTHP', 'Annular', 'FlowRate', 'Choke', 'GL_Rate', 'GL_Press', 'GOR', 'BSW'];

export const FEATURE_NAMES = [
  // [0..9] raw scaled
  'WHP_scaled','WHT_scaled','FTHP_scaled','Annular_scaled','FlowRate_scaled',
  'Choke_scaled','GL_Rate_scaled','GL_Press_scaled','GOR_scaled','BSW_scaled',
  // [10..12] log
  'log_GOR','log_FlowRate','log_GL_Rate',
  // [13..17] rolling
  'WHP_mean6h','WHP_std6h','FlowRate_mean24h','FlowRate_std24h','GL_mean6h',
  // [18..21] lag
  'WHP_lag1h','WHP_lag6h','FTHP_lag1h','FlowRate_lag6h',
  // [22..24] delta
  'delta_FTHP_WHP','delta_GL_WHP','delta_WHP_1h',
  // [25..26] ratio
  'ratio_GL_Flow','ratio_GOR_base',
  // [27] step
  'choke_step_flag',
];
export const FEATURE_INDEX = Object.fromEntries(FEATURE_NAMES.map((n, i) => [n, i]));

const scaler = new StandardScaler();
const rollingBuffer = { WHP: [], FlowRate: [], GL_Rate: [], FTHP: [] }; // window-based
const MAX_BUF = 24;

export function fitScaler() {
  const sample = [];
  const total = L1.getTotalRows();
  for (let i = 0; i < total; i++) {
    const row = L1.peekRow(i);
    sample.push(REP_KEYS.map(k => Number(REPRESENTATIVE[k](row)) || 0));
  }
  scaler.fit(sample);
}

function pushBuf(key, val) {
  rollingBuffer[key].push(val);
  if (rollingBuffer[key].length > MAX_BUF) rollingBuffer[key].shift();
}

function getLag(key, lag) {
  const buf = rollingBuffer[key];
  if (buf.length <= lag) return buf[0] ?? 0;
  return buf[buf.length - 1 - lag];
}

export function process(mergedRow) {
  // STEP 1 — extract 10 representative
  const rep10 = {};
  REP_KEYS.forEach(k => { rep10[k] = Number(REPRESENTATIVE[k](mergedRow)) || 0; });

  // Update rolling buffers
  pushBuf('WHP', rep10.WHP);
  pushBuf('FTHP', rep10.FTHP);
  pushBuf('FlowRate', rep10.FlowRate);
  pushBuf('GL_Rate', rep10.GL_Rate);

  // STEP 2 — 28 features
  const F = new Array(28).fill(0);

  // Raw scaled [0..9]
  REP_KEYS.forEach((k, j) => { F[j] = scaler.transformValue(j, rep10[k]); });

  // Log [10..12]
  F[10] = Math.log(1 + Math.max(0, rep10.GOR));
  F[11] = Math.log(1 + Math.max(0, rep10.FlowRate));
  F[12] = Math.log(1 + Math.max(0, rep10.GL_Rate));

  // Rolling [13..17]
  F[13] = mean(rollingBuffer.WHP.slice(-6));
  F[14] = std(rollingBuffer.WHP.slice(-6));
  F[15] = mean(rollingBuffer.FlowRate.slice(-24));
  F[16] = std(rollingBuffer.FlowRate.slice(-24));
  F[17] = mean(rollingBuffer.GL_Rate.slice(-6));

  // Lag [18..21]
  F[18] = getLag('WHP', 1);
  F[19] = getLag('WHP', 6);
  F[20] = getLag('FTHP', 1);
  F[21] = getLag('FlowRate', 6);

  // Delta [22..24]
  F[22] = rep10.FTHP - rep10.WHP;
  F[23] = rep10.GL_Press - rep10.WHP;
  F[24] = rep10.WHP - getLag('WHP', 1);

  // Ratio [25..26]
  F[25] = rep10.GL_Rate / Math.max(1e-6, rep10.FlowRate / 1000);
  F[26] = rep10.GOR / 850;

  // Step [27]
  const choke_prev = mergedRow._choke_prev ?? rep10.Choke;
  F[27] = Math.abs(rep10.Choke - choke_prev) > 5 ? 1 : 0;

  // Sanitize
  for (let i = 0; i < F.length; i++) {
    if (!Number.isFinite(F[i])) F[i] = 0;
  }

  return { rep10, features28: F };
}

export function getFeatureGroups() {
  return {
    'Raw (Standardized) — Zona 1-4':
      FEATURE_NAMES.slice(0, 10),
    'Log Transform':
      FEATURE_NAMES.slice(10, 13),
    'Rolling Statistics':
      FEATURE_NAMES.slice(13, 18),
    'Lag Features':
      FEATURE_NAMES.slice(18, 22),
    'Delta Features':
      FEATURE_NAMES.slice(22, 25),
    'Ratio Features':
      FEATURE_NAMES.slice(25, 27),
    'Step-Change Flag':
      FEATURE_NAMES.slice(27, 28),
  };
}
