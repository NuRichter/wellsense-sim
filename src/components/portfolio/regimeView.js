// components/portfolio/regimeView.js — combined scatter + timeline + migration log + silhouette
import { state, on } from '../../store/simulationStore.js';
import { tickets } from '../../store/ticketStore.js';

let scatterChart;

const REGIME_COLOR = {
  OPTIMAL:  '#16A34A',
  DEGRADED: '#D97706',
  CRITICAL: '#DC2626',
};

export function mount(el) {
  el.innerHTML = `
    <div class="grid grid-cols-3 gap-4 mb-4">
      <div class="surface p-3">
        <div class="text-xs" style="color:var(--color-text-dim)">Today's Regime</div>
        <div id="todayRegimeVal" class="text-2xl font-bold mt-1">--</div>
      </div>
      <div class="surface p-3">
        <div class="text-xs" style="color:var(--color-text-dim)">Yesterday's Regime</div>
        <div id="yestRegimeVal" class="text-lg font-semibold mt-1">--</div>
      </div>
      <div class="surface p-3">
        <div class="text-xs" style="color:var(--color-text-dim)">Silhouette Score</div>
        <div id="silVal" class="text-2xl font-mono mt-1">--</div>
        <div class="text-[10px]" style="color:var(--color-text-dim)">Higher = better cluster separation</div>
      </div>
    </div>

    <div class="surface p-3 mb-4">
      <div class="flex items-center justify-between mb-2">
        <div class="text-sm font-semibold">Operating Regime Clustering · Scatter</div>
        <div class="text-xs" style="color:var(--color-text-dim)">X = WHP (psi) · Y = GL Rate (MMSCFD) · 1 dot = 1 hourly snapshot</div>
      </div>
      <div style="height:340px"><canvas id="regimeScatter"></canvas></div>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div class="surface p-3">
        <div class="text-sm font-semibold mb-2">Regime Migration Log</div>
        <div id="migrationLog" class="text-xs space-y-1 scroll-thin" style="max-height:240px;overflow-y:auto"></div>
      </div>
      <div class="surface p-3">
        <div class="text-sm font-semibold mb-2">Regime Timeline · per Hour</div>
        <div id="timelineBar" class="flex flex-wrap gap-0.5"></div>
        <div class="text-[10px] mt-2" style="color:var(--color-text-dim)">PoC adaptation: per-jam snapshot · Production: per-sumur daily</div>
      </div>
    </div>
  `;

  const ctx = el.querySelector('#regimeScatter').getContext('2d');
  scatterChart = new Chart(ctx, {
    type: 'scatter',
    data: { datasets: [
      { label: 'OPTIMAL',  data: [], backgroundColor: '#16A34A', pointRadius: 4 },
      { label: 'DEGRADED', data: [], backgroundColor: '#D97706', pointRadius: 4 },
      { label: 'CRITICAL', data: [], backgroundColor: '#DC2626', pointRadius: 4 },
      { label: 'Centroids', data: [], backgroundColor: 'transparent', borderColor: '#fff', pointStyle: 'crossRot', pointRadius: 10, borderWidth: 2 },
    ]},
    options: {
      animation: false, responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#94A3B8' } },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const d = ctx.raw;
              if (d.tick != null) return `Tick #${d.tick} · P(LPO)=${d.pLpo?.toFixed?.(3) || 'n/a'}`;
              return `WHP=${ctx.parsed.x.toFixed(0)} · GL=${ctx.parsed.y.toFixed(2)}`;
            },
          },
        },
      },
      scales: {
        x: { title: { display: true, text: 'WHP (psi)', color: '#94A3B8' }, ticks: { color: '#94A3B8' }, grid: { color: '#1E293B' } },
        y: { title: { display: true, text: 'GL Rate (MMSCFD)', color: '#94A3B8' }, ticks: { color: '#94A3B8' }, grid: { color: '#1E293B' } },
      },
    },
  });

  function refresh() {
    const k = state.kmeansResult;
    el.querySelector('#todayRegimeVal').textContent = state.currentRegime || '--';
    if (state.currentRegime) el.querySelector('#todayRegimeVal').style.color = REGIME_COLOR[state.currentRegime];
    el.querySelector('#yestRegimeVal').textContent = state.yesterdayRegime || '--';
    el.querySelector('#silVal').textContent = state.silhouetteScore != null ? state.silhouetteScore.toFixed(3) : '--';

    if (k && k.ok) {
      // Reset datasets
      scatterChart.data.datasets[0].data = [];
      scatterChart.data.datasets[1].data = [];
      scatterChart.data.datasets[2].data = [];
      scatterChart.data.datasets[3].data = [];

      const buf = state.regimeBuffer;
      const repKeys = ['WHP', 'WHT', 'FTHP', 'Annular', 'FlowRate', 'Choke', 'GL_Rate', 'GL_Press', 'GOR', 'BSW'];
      const whpIdx = repKeys.indexOf('WHP');
      const glIdx = repKeys.indexOf('GL_Rate');

      const lastN = Math.min(24, buf.length);
      buf.forEach((entry, i) => {
        const isRecent = i >= buf.length - lastN;
        const x = entry.rep10[whpIdx];
        const y = entry.rep10[glIdx];
        const lab = k.pointLabels[i];
        const idx = lab === 'OPTIMAL' ? 0 : lab === 'DEGRADED' ? 1 : 2;
        scatterChart.data.datasets[idx].data.push({
          x, y, tick: entry.tick, pLpo: entry.P_LPO,
          backgroundColor: isRecent ? REGIME_COLOR[lab] : REGIME_COLOR[lab] + '4D',
        });
      });

      // Centroids (raw)
      k.centroidsRaw.forEach((c) => {
        scatterChart.data.datasets[3].data.push({ x: c[whpIdx], y: c[glIdx] });
      });
      scatterChart.update('none');
    }

    // Migration log from BD tickets
    const mlEl = el.querySelector('#migrationLog');
    const bdTix = tickets.filter(t => t.source === 'BD');
    if (!bdTix.length) {
      mlEl.innerHTML = `<div style="color:var(--color-text-dim)">No regime migrations yet.</div>`;
    } else {
      mlEl.innerHTML = bdTix.map(t => `
        <div class="font-mono text-[11px]">
          ${t.timestamp_sim} · <strong style="color:${REGIME_COLOR[t.regime_from] || '#888'}">${t.regime_from}</strong>
          → <strong style="color:${REGIME_COLOR[t.regime_to] || '#888'}">${t.regime_to}</strong>
          · Tiket <span style="color:var(--color-text-dim)">${t.ticket_id}</span>
        </div>
      `).join('');
    }

    // Timeline bar
    const tl = el.querySelector('#timelineBar');
    if (k && k.ok && k.pointLabels) {
      tl.innerHTML = k.pointLabels.map((lab, i) =>
        `<div class="tooltip" data-tip="Hour #${i + 1} · ${lab}" style="width:14px;height:24px;background:${REGIME_COLOR[lab]};border-radius:2px"></div>`
      ).join('');
    } else {
      tl.innerHTML = `<div class="text-xs" style="color:var(--color-text-dim)">Collecting hourly snapshots...</div>`;
    }
  }

  on('regimeUpdate', refresh);
  on('stateChange', refresh);
  on('ticketsChanged', refresh);
  refresh();
}
