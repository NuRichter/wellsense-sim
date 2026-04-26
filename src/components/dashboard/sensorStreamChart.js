// components/dashboard/sensorStreamChart.js — multi-zona overview chart
import { state, on, ZONA_META } from '../../store/simulationStore.js';

let chart;

const Z_REPS = {
  1: 'WHP',
  2: 'FlowRate',
  3: 'GL_Rate',
  4: 'GOR',
};

export function mount(el, scope) {
  el.innerHTML = `
    <div class="surface p-3 mb-3">
      <div class="flex items-center justify-between mb-2">
        <div class="text-sm font-semibold">Sensor Stream Overview · Representative per Zona (last 60 ticks)</div>
        <div class="text-xs" style="color:var(--color-text-dim)">All values normalized · click sensor card untuk detail sub-signals</div>
      </div>
      <div style="height:200px"><canvas id="streamChart"></canvas></div>
    </div>
  `;
  const ctx = el.querySelector('#streamChart').getContext('2d');
  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: Object.entries(Z_REPS).map(([z, k]) => ({
        label: `Zona ${z} · ${k}`,
        data: [],
        borderColor: ZONA_META[+z].color,
        backgroundColor: 'transparent',
        yAxisID: 'y' + z,
      })),
    },
    options: {
      animation: false, responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#94A3B8', font: { size: 10 } } } },
      scales: {
        x: { display: false },
        y1: { display: false, position: 'left' },
        y2: { display: false, position: 'left' },
        y3: { display: false, position: 'left' },
        y4: { display: false, position: 'left' },
      },
      elements: { point: { radius: 0 }, line: { borderWidth: 1.5, tension: 0.25 } },
    },
  });

  if (scope) scope.track(chart);

  function refresh() {
    const len = state.sensorHistory.WHP.length;
    chart.data.labels = Array.from({ length: len }, (_, i) => i);
    Object.entries(Z_REPS).forEach(([z, k], idx) => {
      chart.data.datasets[idx].data = [...state.sensorHistory[k]];
    });
    chart.update('none');
  }
  const sub = scope ? scope.on : on;
  sub('stateChange', refresh);
  refresh();
}
