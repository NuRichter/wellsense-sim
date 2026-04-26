// components/shared/scenarioPanel.js
import * as L1 from '../../engine/L1_dataStream.js';
import { emit, state } from '../../store/simulationStore.js';
import { tickets } from '../../store/ticketStore.js';
import * as PDF from '../../engine/pdfGenerator.js';

const BUTTONS = [
  { id: 'whpDrop',    label: '💥 WHP Drop',          fn: () => { L1.setSensorOverride('WHP', 'P_wh', 1050); setTimeout(() => L1.clearOverride('WHP'), 12000); } },
  { id: 'glFail',     label: '⚠️ GL Failure',        fn: () => { L1.setSensorOverride('GL_Rate', 'vol_flow_gas', 0.9); setTimeout(() => L1.clearOverride('GL_Rate'), 8000); } },
  { id: 'multiZone',  label: '🔴 Multi-Zone Alert',   fn: () => { L1.setAnomalyBoost(2.0); setTimeout(() => L1.setAnomalyBoost(0), 4000); } },
  { id: 'forceRecap', label: '📄 Force Daily Recap',  fn: () => forceDailyRecap() },
  { id: 'reset',      label: '🔁 Reset All',          fn: () => { L1.clearAllOverrides(); } },
];

function forceDailyRecap() {
  const dateStr = state.activeDate;
  const rtTicketsToday = tickets.filter(t => t.source === 'RT' && (t.timestamp_sim || '').startsWith(dateStr));
  const bdTicketsToday = tickets.filter(t => t.source === 'BD' && (t.timestamp_sim || '').startsWith(dateStr));

  // Pick scenario: prefer most recent BD migration today; otherwise NO_MIGRATION
  let scenario = 'NO_MIGRATION';
  const lastBD = bdTicketsToday[0];
  if (lastBD) {
    const f = lastBD.regime_from, t = lastBD.regime_to;
    if (f === 'STABLE' && t === 'MODERATE')   scenario = 'STABLE_TO_MODERATE';
    else if (f === 'STABLE' && t === 'HIGH_RISK')  scenario = 'STABLE_TO_HIGH_RISK';
    else if (f === 'MODERATE' && t === 'HIGH_RISK') scenario = 'MODERATE_TO_HIGH_RISK';
  }

  // Build 24-hour timeline from last 144 ticks of regimeBuffer
  const k = state.kmeansResult;
  const buf = state.regimeBuffer;
  const startIdx = Math.max(0, buf.length - 144);
  const dayLabels = [];
  for (let h = 0; h < 24; h++) {
    const tickInDay = h * 6;
    const bufIdx = startIdx + tickInDay;
    const lab = k?.pointLabels?.[bufIdx] || state.currentRegime || 'STABLE';
    dayLabels.push(lab);
  }
  const pdf = PDF.generateDailyRecapPDF({
    scenario, dateStr,
    todayRegime: state.currentRegime,
    yesterdayRegime: state.yesterdayRegime,
    silhouette: state.silhouetteScore,
    rtTicketsToday, bdTicketsToday,
    regimeTimelineDay: dayLabels,
  });
  PDF.openPDFInModal(pdf, `Recap Harian (Forced) · ${dateStr} · ${scenario.replace(/_/g, ' ')}`);
  emit('printJobIssued', { kind: 'BD_RECAP', scenario, dateStr });
}

export function mount(el, scope) {
  el.innerHTML = `
    <div class="surface p-3">
      <div class="text-sm font-semibold mb-2">Scenario Injection · Manual Mode</div>
      <div class="flex flex-wrap gap-2">
        ${BUTTONS.map(b => `<button data-id="${b.id}" class="px-3 py-1.5 text-xs rounded border hover:bg-slate-700"
          style="border-color:var(--color-border);background:#0B1120">${b.label}</button>`).join('')}
      </div>
      <div class="text-[10px] mt-2" style="color:var(--color-text-dim)">
        Auto-schedule aktif pada tick: 30 (WHP), 60 (GL), 90 (boost), 120 (BSW), 138 (📄 Daily Recap PDF · 23:00 WIT), 150 (force K-Means), 180 (Choke)
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
