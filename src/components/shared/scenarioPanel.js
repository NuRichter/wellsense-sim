// components/shared/scenarioPanel.js
import * as L1 from '../../engine/L1_dataStream.js';
import { emit } from '../../store/simulationStore.js';

const BUTTONS = [
  { id: 'whpDrop',    label: '💥 WHP Drop',          fn: () => { L1.setSensorOverride('WHP', 'P_wh', 1050); setTimeout(() => L1.clearOverride('WHP'), 12000); } },
  { id: 'glFail',     label: '⚠️ GL Failure',        fn: () => { L1.setSensorOverride('GL_Rate', 'vol_flow_gas', 0.9); setTimeout(() => L1.clearOverride('GL_Rate'), 8000); } },
  { id: 'multiZone',  label: '🔴 Multi-Zone Alert',   fn: () => { L1.setAnomalyBoost(2.0); setTimeout(() => L1.setAnomalyBoost(0), 4000); } },
  { id: 'forceKM',    label: '📊 Force K-Means',      fn: () => { import('../../engine/orchestrator.js').then(m => { /* runBDTrack is internal; trigger via tick proxy */ }); emit('forceKMeans'); } },
  { id: 'reset',      label: '🔁 Reset All',          fn: () => { L1.clearAllOverrides(); } },
];

export function mount(el) {
  el.innerHTML = `
    <div class="surface p-3">
      <div class="text-sm font-semibold mb-2">Scenario Injection · Manual Mode</div>
      <div class="flex flex-wrap gap-2">
        ${BUTTONS.map(b => `<button data-id="${b.id}" class="px-3 py-1.5 text-xs rounded border hover:bg-slate-700"
          style="border-color:var(--color-border);background:#0B1120">${b.label}</button>`).join('')}
      </div>
      <div class="text-[10px] mt-2" style="color:var(--color-text-dim)">
        Auto-schedule aktif: tick 30 (WHP), 60 (GL), 90 (boost), 120 (BSW), 150 (force K-Means), 180 (Choke)
      </div>
    </div>
  `;
  el.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      const b = BUTTONS.find(x => x.id === btn.dataset.id);
      if (b) b.fn();
    });
  });
}
