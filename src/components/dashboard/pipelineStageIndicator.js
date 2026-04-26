// components/dashboard/pipelineStageIndicator.js
import { state, on } from '../../store/simulationStore.js';

const STAGES_RT = [
  { key: 'L1',       label: 'L1 · DAQ',           color: 'var(--color-l1)' },
  { key: 'L2',       label: 'L2 · Merge + 28F',   color: 'var(--color-l2)' },
  { key: 'L3a_IF',   label: 'L3a · IF',           color: 'var(--color-l3a-if)' },
  { key: 'L3a_LSTM', label: 'L3a · LSTM',         color: 'var(--color-l3a-lstm)' },
  { key: 'L4',       label: 'L4 · HITL',          color: 'var(--color-l4)' },
];
const STAGES_BD = [
  { key: 'L1',  label: 'L1 · DAQ',         color: 'var(--color-l1)' },
  { key: 'L2',  label: 'L2 · Regime Buf',  color: 'var(--color-l2)' },
  { key: 'L3b', label: 'L3b · K-Means',    color: 'var(--color-l3b-km)' },
  { key: 'L4',  label: 'L4 · HITL',        color: 'var(--color-l4)' },
];

function pillHTML(s, status) {
  const cls = status === 'active' ? 'stage-active' : status === 'done' ? 'stage-done' : 'stage-idle';
  const dot = status === 'active' ? '▶' : status === 'done' ? '✓' : '○';
  return `<span class="stage-pill ${cls}" style="border-color:${s.color};color:${s.color}">
    <span style="font-weight:700">${dot}</span>${s.label}
  </span>`;
}

function arrowHTML(active) {
  return `<span class="flow-arrow ${active ? 'active' : ''}" style="color:var(--color-text-dim);font-size:14px">→</span>`;
}

export function mount(el, scope) {
  function render() {
    const ss = state.stageStatus;
    const rt = STAGES_RT.map((s, i) => {
      const status = ss[s.key] || 'idle';
      const next = STAGES_RT[i + 1] ? ss[STAGES_RT[i + 1].key] : 'idle';
      return pillHTML(s, status) + (i < STAGES_RT.length - 1 ? arrowHTML(status === 'done' || next === 'active') : '');
    }).join('');
    const bd = STAGES_BD.map((s, i) => {
      const status = ss[s.key] || 'idle';
      const next = STAGES_BD[i + 1] ? ss[STAGES_BD[i + 1].key] : 'idle';
      return pillHTML(s, status) + (i < STAGES_BD.length - 1 ? arrowHTML(status === 'done' || next === 'active') : '');
    }).join('');
    el.innerHTML = `
      <div class="surface px-4 py-3 mb-4">
        <div class="text-xs mb-2" style="color:var(--color-text-dim)">
          <strong style="color:var(--color-text)">RT Track</strong> · Real-Time Anomaly Detection (per tick = 10 menit)
        </div>
        <div class="flex flex-wrap items-center gap-2 mb-3">${rt}</div>
        <div class="text-xs mb-2 mt-1" style="color:var(--color-text-dim)">
          <strong style="color:var(--color-text)">BD Track</strong> · Operating Regime Clustering (per 6 tick = 1 jam sim)
        </div>
        <div class="flex flex-wrap items-center gap-2">${bd}</div>
      </div>
    `;
  }
  const sub = scope ? scope.on : on;
  sub('stageChange', render);
  sub('stateChange', render);
  sub('regimeUpdate', render);
  render();
}
