// engine/orchestrator.js — Master Controller
import * as L1 from './L1_dataStream.js';
import * as L2 from './L2_preprocessing.js';
import * as L2_smote from './L2_smote.js';
import * as L2_seq from './L2_sequenceFormatter.js';
import * as M1 from './M1_isolationForest.js';
import * as M2 from './M2_lstmSimulator.js';
import * as M3 from './M3_kmeans.js';
import * as L4 from './L4_hitlStateMachine.js';
import * as PDF from './pdfGenerator.js';
import { state, emit, persistTickPtr, SENSOR_META } from '../store/simulationStore.js';
import { tickToSimTime } from '../utils/timeFormatter.js';
import { FEATURE_NAMES } from './L2_preprocessing.js';
import { tickets } from '../store/ticketStore.js';

const HISTORY_LEN = 60;
let timer = null;
let prevChokePos = 0;

// Tick interval at 1× speed = 1.5 seconds (visible animation)
const BASE_INTERVAL_MS = 1500;

export async function bootstrap() {
  await L1.loadAllCSV(state.activeDate);
  state.totalRows = L1.getTotalRows();
  // Fit scaler from full dataset
  L2.fitScaler();
  // Pre-fit Isolation Forest using all rows' features (warmup-free baseline)
  const allFeatures = [];
  for (let i = 0; i < state.totalRows; i++) {
    const row = L1.peekRow(i);
    const { features28 } = L2.process(row);
    allFeatures.push(features28);
  }
  // Reset rolling buffers (they got populated during fit)
  M1.fit(allFeatures);
  // Reset sequence buffer & LSTM hidden state
  L2_seq.reset();
  M2.reset();
  L1.resetTickPointer();
  state.tick = 0;
  state.startedAt = Date.now();
  emit('bootstrapped');
}

function detectStageStatus() {
  state.stageStatus = {
    L1: 'done', L2: 'done', L3a_IF: 'done', L3a_LSTM: 'done',
    L3b: state.kmeansResult ? 'done' : 'idle', L4: 'done',
  };
}

function classifySensorStatus(rep10) {
  // Heuristic rules vs baseline ranges
  const s = state.sensorStatus;
  const set = (k, v) => { s[k] = v; };
  // Reset to normal first
  Object.keys(s).forEach(k => set(k, 'normal'));

  if (rep10.WHP < 1100) set('WHP', 'critical');
  else if (rep10.WHP < 1180) set('WHP', 'warning');

  if (rep10.WHT > 84) set('WHT', 'critical');
  else if (rep10.WHT > 80) set('WHT', 'warning');

  if (rep10.FTHP < 1080) set('FTHP', 'warning');

  if (rep10.Annular > 460) set('Annular', 'warning');
  else if (rep10.Annular > 480) set('Annular', 'critical');

  if (rep10.FlowRate < 14000) set('FlowRate', 'critical');
  else if (rep10.FlowRate < 16000) set('FlowRate', 'warning');

  if (Math.abs(rep10.Choke - prevChokePos) > 5) set('Choke', 'warning');
  prevChokePos = rep10.Choke;

  if (rep10.GL_Rate < 1.4) set('GL_Rate', 'critical');
  else if (rep10.GL_Rate < 1.8) set('GL_Rate', 'warning');

  if (rep10.GL_Press < 1300) set('GL_Press', 'critical');
  else if (rep10.GL_Press < 1380) set('GL_Press', 'warning');

  if (rep10.GOR > 1300) set('GOR', 'critical');
  else if (rep10.GOR > 1100) set('GOR', 'warning');

  if (rep10.BSW > 25) set('BSW', 'critical');
  else if (rep10.BSW > 18) set('BSW', 'warning');
}

function topZoneFromContributors(contribs) {
  // Map feature name to its dominant zone
  const zoneMap = {
    delta_FTHP_WHP: 1, WHP_std6h: 1, delta_GL_WHP: 1, delta_WHP_1h: 1,
    WHP_scaled: 1, FTHP_scaled: 1, WHP_mean6h: 1, Annular_scaled: 1, WHT_scaled: 1,
    WHP_lag1h: 1, WHP_lag6h: 1,
    FlowRate_std24h: 2, ratio_GL_Flow: 2, choke_step_flag: 2,
    FlowRate_mean24h: 2, log_FlowRate: 2, FlowRate_scaled: 2, FlowRate_lag6h: 2, Choke_scaled: 2,
    GL_Rate_scaled: 3, GL_Press_scaled: 3, GL_mean6h: 3, log_GL_Rate: 3,
    BSW_scaled: 4, GOR_scaled: 4, ratio_GOR_base: 4, log_GOR: 4,
  };
  const zoneScore = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const c of contribs) {
    const z = zoneMap[c.feature];
    if (z) zoneScore[z] += Math.abs(c.contribution);
  }
  let topZone = 1, top = 0;
  for (const [z, v] of Object.entries(zoneScore)) {
    if (v > top) { top = v; topZone = +z; }
  }
  return L4.ZONE_NAME[topZone];
}

async function step() {
  // Stage L1 — animate
  state.stageStatus.L1 = 'active'; emit('stageChange');
  const mergedRow = L1.getNextRow();
  if (!mergedRow) return;
  state.currentRow = mergedRow;
  state.stageStatus.L1 = 'done';

  // Stage L2
  state.stageStatus.L2 = 'active'; emit('stageChange');
  mergedRow._choke_prev = prevChokePos;
  const { rep10, features28 } = L2.process(mergedRow);
  state.representative10 = rep10;
  state.features28 = features28;
  L2_seq.pushToSequence(features28);
  state.warmupProgress = L2_seq.getWarmupProgress();
  state.stageStatus.L2 = 'done';

  // Update sensor history (for charts)
  for (const k of Object.keys(rep10)) {
    state.sensorHistory[k].push(rep10[k]);
    if (state.sensorHistory[k].length > HISTORY_LEN) state.sensorHistory[k].shift();
  }
  classifySensorStatus(rep10);

  // Stage L3a — IF
  state.stageStatus.L3a_IF = 'active'; emit('stageChange');
  const ifOut = M1.score(features28, state.smoteWeight);
  state.ifScore = ifOut.ifScore;
  state.isOutlier = ifOut.isOutlier;
  // Imputation if outlier
  const { vec: featForLSTM } = M1.imputeIfOutlier(features28, ifOut.isOutlier);
  state.stageStatus.L3a_IF = 'done';

  // Stage L3a — LSTM
  state.stageStatus.L3a_LSTM = 'active'; emit('stageChange');
  // Replace last seq entry with imputed if needed (effectively we already pushed the original;
  // for fidelity, pop and replace)
  if (ifOut.isOutlier) {
    const seq = L2_seq.getSequence();
    if (seq) {
      seq[seq.length - 1] = featForLSTM;
    }
  }
  const seq = L2_seq.getSequence();
  const lstmOut = M2.forward(seq);
  state.P_LPO = lstmOut.P_LPO;
  state.P_LPO_history.push(lstmOut.P_LPO);
  if (state.P_LPO_history.length > HISTORY_LEN) state.P_LPO_history.shift();
  state.lstmContributors = lstmOut.contributors;
  state.stageStatus.L3a_LSTM = 'done';

  // Track anomaly flags (for SMOTE)
  state.lastAnomalyFlags.push(state.P_LPO >= 0.5);
  if (state.lastAnomalyFlags.length > 100) state.lastAnomalyFlags.shift();

  // L4 — RT ticket
  state.stageStatus.L4 = 'active'; emit('stageChange');
  if (state.P_LPO >= 0.65 && !lstmOut.warmup) {
    L4.createRTTicket({
      P_LPO: state.P_LPO,
      sensor_snapshot: { ...rep10 },
      top_contributors: lstmOut.contributors,
      primary_zone: topZoneFromContributors(lstmOut.contributors),
      sim_time: tickToSimTime(state.tick, state.activeDate),
    });
  }
  state.stageStatus.L4 = 'done';

  // Push to regime buffer
  state.regimeBuffer.push({ rep10: Object.values(rep10), P_LPO: state.P_LPO, tick: state.tick });
  if (state.regimeBuffer.length > 144) state.regimeBuffer.shift();

  // BD Track every 6 ticks (1 sim hour)
  if (state.tick > 0 && state.tick % 6 === 0) {
    runBDTrack();
  }

  // Auto schedule scenario injections
  applyAutoScenarios(state.tick);

  // Tick advance
  state.tick++;
  persistTickPtr();

  emit('tickAdvanced', { tick: state.tick });
  emit('stateChange');
}

function runBDTrack() {
  state.stageStatus.L3b = 'active'; emit('stageChange');
  // Update SMOTE weight based on recent anomaly flags
  state.smoteWeight = L2_smote.computeSmoteWeight(state.lastAnomalyFlags);

  setTimeout(() => {
    const result = M3.runKMeans(state.regimeBuffer);
    if (result.ok) {
      state.kmeansResult = result;
      state.silhouetteScore = result.silhouette;
      state.yesterdayRegime = result.yesterdayRegime;
      const prevToday = state.currentRegime;
      state.currentRegime = result.todayRegime;
      const migration = M3.detectMigration(result.todayRegime, prevToday || result.yesterdayRegime);
      if (migration) {
        L4.createBDTicket({
          migration,
          snapshot: { ...state.representative10 },
          sim_time: tickToSimTime(state.tick, state.activeDate),
        });
      }
      // Daily recap PDF — fire at tick 138 (= 23:00) of each sim day
      const tickOfDay = state.tick % 144;
      if (tickOfDay === 138) {
        scheduleDailyRecap(migration, result);
      }
    } else {
      state.kmeansResult = result;
    }
    state.stageStatus.L3b = 'done';
    emit('regimeUpdate');
    emit('stateChange');
  }, 0);
}

function scheduleDailyRecap(migration, kmeansResult) {
  setTimeout(() => {
    try {
      // Determine scenario
      let scenario = 'NO_MIGRATION';
      if (migration?.scenario) scenario = migration.scenario;

      // Filter tickets created today
      const dateStr = state.activeDate;
      const todayStart = state.tick - (state.tick % 144);
      const rtTicketsToday = tickets.filter(t =>
        t.source === 'RT' && (t.timestamp_sim || '').startsWith(dateStr));
      const bdTicketsToday = tickets.filter(t =>
        t.source === 'BD' && (t.timestamp_sim || '').startsWith(dateStr));

      // Build per-hour regime timeline (last 24 hourly snapshots = last 24 BD cycles)
      // The regimeBuffer holds per-tick rep; BD K-Means assignments cover all entries.
      // We need 24 representative regime labels for the day (one per hour).
      // Approximate by sampling pointLabels at every 6th index from the day's slice.
      const buf = state.regimeBuffer;
      const startIdx = Math.max(0, buf.length - 144);
      const dayLabels = [];
      for (let h = 0; h < 24; h++) {
        const tickInDay = h * 6;
        const bufIdx = startIdx + tickInDay;
        const lab = kmeansResult?.pointLabels?.[bufIdx] || 'STABLE';
        dayLabels.push(lab);
      }

      const pdf = PDF.generateDailyRecapPDF({
        scenario,
        dateStr,
        todayRegime: state.currentRegime,
        yesterdayRegime: state.yesterdayRegime,
        silhouette: state.silhouetteScore,
        rtTicketsToday,
        bdTicketsToday,
        regimeTimelineDay: dayLabels,
      });
      PDF.openPDFInModal(pdf, `Recap Harian · ${dateStr} · ${scenario.replace(/_/g, ' ')}`);
      emit('printJobIssued', { kind: 'BD_RECAP', scenario, dateStr });
    } catch (e) {
      console.warn('Daily recap PDF generation failed:', e);
    }
  }, 300);
}

// AUTO scenario schedule — fires at exact ticks
const AUTO_OVERRIDES_ACTIVE = {};
function applyAutoScenarios(tick) {
  // Cleanup expired
  for (const [k, end] of Object.entries(AUTO_OVERRIDES_ACTIVE)) {
    if (tick >= end) {
      L1.clearOverride(k);
      delete AUTO_OVERRIDES_ACTIVE[k];
    }
  }
  if (tick === 30)  { L1.setSensorOverride('WHP', 'P_wh', 1050);          AUTO_OVERRIDES_ACTIVE.WHP = tick + 6; }
  if (tick === 60)  { L1.setSensorOverride('GL_Rate', 'vol_flow_gas', 0.8); AUTO_OVERRIDES_ACTIVE.GL_Rate = tick + 5; }
  if (tick === 90)  { L1.setAnomalyBoost(2.5); setTimeout(() => L1.setAnomalyBoost(0), BASE_INTERVAL_MS / state.speed); }
  if (tick === 120) { L1.setSensorOverride('BSW', 'BSW_pct', 28);         AUTO_OVERRIDES_ACTIVE.BSW = tick + 8; }
  if (tick === 150) { runBDTrack(); }
  if (tick === 180) {
    L1.setSensorOverride('Choke', 'mpos_actual', (v, t) => v + 6 * Math.sin(t * 0.9));
    AUTO_OVERRIDES_ACTIVE.Choke = tick + 6;
  }
}

export function start() {
  if (state.isRunning) return;
  state.isRunning = true;
  state.startedAt = state.startedAt || Date.now();
  emit('runStateChange');
  loop();
}
export function pause() {
  state.isRunning = false;
  if (timer) clearTimeout(timer);
  timer = null;
  emit('runStateChange');
}
export function setSpeed(s) { state.speed = s; emit('runStateChange'); }
export function singleStep() { step(); }

function loop() {
  if (!state.isRunning) return;
  step().then(() => {
    if (!state.isRunning) return;
    timer = setTimeout(loop, BASE_INTERVAL_MS / state.speed);
  });
}
