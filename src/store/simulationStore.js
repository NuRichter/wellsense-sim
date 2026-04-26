// store/simulationStore.js
const _bus = new EventTarget();

export const state = {
  tick: 0,
  speed: 1,
  isRunning: false,
  startedAt: null,
  totalRows: 144,
  activeDate: '2026-04-27',

  currentRow: {},
  representative10: {},
  features28: [],
  P_LPO: 0.05,
  P_LPO_history: [],     // for chart
  ifScore: 0.0,
  isOutlier: false,
  smoteWeight: 1.5,
  warmupProgress: { filled: 0, total: 24 },

  sensorStatus: {
    WHP: 'normal', WHT: 'normal', FTHP: 'normal', Annular: 'normal',
    FlowRate: 'normal', Choke: 'normal', GL_Rate: 'normal',
    GL_Press: 'normal', GOR: 'normal', BSW: 'normal',
  },
  sensorHistory: {  // last N rep values per sensor for charts
    WHP: [], WHT: [], FTHP: [], Annular: [],
    FlowRate: [], Choke: [], GL_Rate: [],
    GL_Press: [], GOR: [], BSW: [],
  },
  stageStatus: {
    L1: 'idle', L2: 'idle', L3a_IF: 'idle', L3a_LSTM: 'idle', L3b: 'idle', L4: 'idle',
  },
  regimeBuffer: [],     // [N][11] — rep10 + P_LPO
  currentRegime: null,
  yesterdayRegime: null,
  silhouetteScore: null,
  kmeansResult: null,    // { assignments, centroids, silhouette }

  selectedSensor: 'WHP',
  role: 'Well Operator',
  lastAnomalyFlags: [],   // last 100 boolean flags

  // RBAC tier mapping
  roleTier: { 'Well Operator': 1, 'Well Engineer': 2, 'Production Engineer': 3 },
};

export const SENSOR_META = {
  WHP:      { zona: 1, unit: 'psi',     label: 'WHP',      desc: 'Wellhead Pressure',     subSignals: ['P_wh', 'I_raw'] },
  WHT:      { zona: 1, unit: '°C',      label: 'WHT',      desc: 'Wellhead Temperature',  subSignals: ['T_primary', 'T_backup', 'R_meas_1', 'R_meas_2'] },
  FTHP:     { zona: 1, unit: 'psi',     label: 'FTHP',     desc: 'Flowing Tubing HP',     subSignals: ['P_fthp'] },
  Annular:  { zona: 1, unit: 'psi',     label: 'Annular',  desc: 'Annular Pressure',      subSignals: ['P_ann', 'masp'] },
  FlowRate: { zona: 2, unit: 'BPD',     label: 'FlowRate', desc: 'Coriolis Flow Meter',   subSignals: ['mass_flow_rate', 'vol_flow_rate', 'density_fluid', 'T_coriolis', 'phase_shift'] },
  Choke:    { zona: 2, unit: '%',       label: 'Choke',    desc: 'Choke Valve Position',  subSignals: ['mpos_actual', 'pos_setpoint', 'drive_signal'] },
  GL_Rate:  { zona: 3, unit: 'MMSCFD',  label: 'GL Rate',  desc: 'Gas-Lift Rate',         subSignals: ['mass_flow_gas', 'vol_flow_gas', 'density_gas', 'T_injection'] },
  GL_Press: { zona: 3, unit: 'psi',     label: 'GL Press', desc: 'Gas-Lift Pressure',     subSignals: ['P_inject'] },
  GOR:      { zona: 4, unit: 'scf/bbl', label: 'GOR',      desc: 'Gas-Oil Ratio',         subSignals: ['GOR', 'Q_oil', 'Q_gas', 'Q_water'] },
  BSW:      { zona: 4, unit: '%',       label: 'BSW',      desc: 'Basic Sediment & Water', subSignals: ['BSW_pct', 'watercut_raw', 'f_resonance'] },
};

export const ZONA_META = {
  1: { name: 'Wellhead / Pressure-Temp', color: '#60A5FA' },
  2: { name: 'Flow & Process',           color: '#34D399' },
  3: { name: 'Gas-Lift Manifold',        color: '#FB923C' },
  4: { name: 'Multiphase & Analytical',  color: '#A78BFA' },
};

export function emit(event, detail = {}) {
  _bus.dispatchEvent(new CustomEvent(event, { detail }));
}
export function on(event, handler) {
  _bus.addEventListener(event, handler);
  return () => _bus.removeEventListener(event, handler);
}

// localStorage persistence (lightweight)
export function persistTickPtr() {
  try { localStorage.setItem('ws_tick_ptr', String(state.tick)); } catch (_) {}
}
export function restoreTickPtr() {
  try {
    const v = parseInt(localStorage.getItem('ws_tick_ptr') || '0', 10);
    if (!Number.isNaN(v)) state.tick = v;
  } catch (_) {}
}
