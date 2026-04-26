// components/dashboard/sensorDetailPanel.js — sub-signals chart, LPO gauge, IF score, feature table
import { state, on, SENSOR_META, ZONA_META } from '../../store/simulationStore.js';
import { FEATURE_NAMES, getFeatureGroups } from '../../engine/L2_preprocessing.js';
import * as L1 from '../../engine/L1_dataStream.js';

let detailChart, gaugeChart, lpoChart;

const ZONE_COLOR = id => ZONA_META[SENSOR_META[id].zona].color;

export function mount(el) {
  el.innerHTML = `
    <div class="surface p-3 mb-3">
      <div class="flex items-center justify-between mb-2">
        <div class="text-sm font-semibold">Sensor Detail · <span id="selSensorName">WHP</span></div>
        <div class="text-xs" style="color:var(--color-text-dim)" id="selSensorDesc">--</div>
      </div>
      <div style="height:180px"><canvas id="sensorDetailChart"></canvas></div>
    </div>

    <div class="grid grid-cols-2 gap-3 mb-3">
      <div class="surface p-3">
        <div class="text-xs mb-1" style="color:var(--color-text-dim)">P(LPO) · LSTM Output</div>
        <div style="height:120px"><canvas id="lpoGauge"></canvas></div>
        <div class="text-center font-mono text-2xl font-bold mt-1" id="lpoVal" style="color:var(--color-l3a-lstm)">0.05</div>
        <div class="text-center text-xs" id="lpoLabel" style="color:var(--color-text-dim)">NORMAL · warmup</div>
      </div>
      <div class="surface p-3">
        <div class="text-xs mb-1" style="color:var(--color-text-dim)">P(LPO) Trend · last 60 ticks</div>
        <div style="height:120px"><canvas id="lpoHistChart"></canvas></div>
        <div class="text-xs mt-1 grid grid-cols-2 gap-1" style="color:var(--color-text-dim)">
          <div>IF Score: <span class="font-mono" style="color:var(--color-text)" id="ifScoreVal">0.000</span></div>
          <div>Outlier: <span class="font-mono" id="ifOutlierVal">no</span></div>
          <div>SMOTE w: <span class="font-mono" style="color:var(--color-text)" id="smoteVal">2.0</span></div>
          <div>Threshold: <span class="font-mono" style="color:var(--color-text)" id="thrVal">0.55</span></div>
        </div>
      </div>
    </div>

    <div class="surface p-3 mb-3">
      <div class="text-xs mb-2" style="color:var(--color-text-dim)">L3a · Top LSTM Contributors (current tick)</div>
      <div id="contribList" class="space-y-1 text-xs"></div>
    </div>

    <div class="surface p-3">
      <div class="text-xs mb-2" style="color:var(--color-text-dim)">L2 · 28-Feature Vector</div>
      <div id="featureGrid" class="grid grid-cols-2 gap-x-3 gap-y-1 text-xs font-mono scroll-thin" style="max-height:240px;overflow-y:auto"></div>
    </div>
  `;

  // Init detail chart (sub-signals)
  const ctx1 = el.querySelector('#sensorDetailChart').getContext('2d');
  detailChart = new Chart(ctx1, {
    type: 'line',
    data: { labels: [], datasets: [] },
    options: {
      animation: false, responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#94A3B8', font: { size: 10 } } } },
      scales: {
        x: { ticks: { color: '#64748B', font: { size: 9 } }, grid: { color: '#1E293B' } },
        y: { ticks: { color: '#94A3B8', font: { size: 9 } }, grid: { color: '#1E293B' } },
      },
      elements: { point: { radius: 0 }, line: { borderWidth: 1.5, tension: 0.2 } },
    },
  });

  // Init gauge (doughnut)
  const ctx2 = el.querySelector('#lpoGauge').getContext('2d');
  gaugeChart = new Chart(ctx2, {
    type: 'doughnut',
    data: {
      labels: ['P(LPO)', 'rest'],
      datasets: [{
        data: [5, 95],
        backgroundColor: ['#7B72E8', '#1E293B'],
        borderWidth: 0,
      }],
    },
    options: {
      animation: false, responsive: true, maintainAspectRatio: false,
      cutout: '70%', circumference: 180, rotation: -90,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
    },
  });

  // LPO history chart
  const ctx3 = el.querySelector('#lpoHistChart').getContext('2d');
  lpoChart = new Chart(ctx3, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'P(LPO)',
        data: [],
        borderColor: '#7B72E8',
        backgroundColor: 'rgba(123,114,232,0.2)',
        fill: true,
      }],
    },
    options: {
      animation: false, responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { display: false },
        y: { min: 0, max: 1, ticks: { color: '#64748B', font: { size: 9 } }, grid: { color: '#1E293B' } },
      },
      elements: { point: { radius: 0 }, line: { borderWidth: 1.5 } },
    },
  });

  function rebuildDetailChart() {
    const id = state.selectedSensor;
    const meta = SENSOR_META[id];
    el.querySelector('#selSensorName').textContent = `${meta.label} (${meta.desc})`;
    el.querySelector('#selSensorDesc').textContent = `Zona ${meta.zona} · ${meta.subSignals.length} sub-signals`;

    const allRows = L1.getAllRowsFor(id);
    const sliceStart = Math.max(0, state.tick - 60);
    const sliceEnd = Math.min(allRows.length, state.tick);
    const labels = [];
    for (let i = sliceStart; i < sliceEnd; i++) labels.push(allRows[i]?.timestamp || '');

    const palette = ['#60A5FA', '#34D399', '#FB923C', '#A78BFA', '#F472B6'];
    const datasets = meta.subSignals.map((s, i) => ({
      label: s,
      data: allRows.slice(sliceStart, sliceEnd).map(r => r ? r[s] : null),
      borderColor: palette[i % palette.length],
      backgroundColor: 'transparent',
      yAxisID: i === 0 ? 'y' : (meta.subSignals.length > 1 && i === 1 ? 'y' : 'y'),
    }));
    detailChart.data.labels = labels;
    detailChart.data.datasets = datasets;
    detailChart.update('none');
  }

  function refresh() {
    // gauge
    const p = state.P_LPO;
    const pct = Math.round(p * 100);
    let color = '#16A34A';
    if (p >= 0.85) color = '#DC2626';
    else if (p >= 0.65) color = '#D97706';
    else if (p >= 0.4) color = '#7B72E8';
    gaugeChart.data.datasets[0].data = [pct, 100 - pct];
    gaugeChart.data.datasets[0].backgroundColor = [color, '#1E293B'];
    gaugeChart.update('none');
    el.querySelector('#lpoVal').textContent = p.toFixed(3);
    el.querySelector('#lpoVal').style.color = color;
    let labelTxt = 'NORMAL';
    if (state.warmupProgress.filled < 24) labelTxt = `WARMUP · ${state.warmupProgress.filled}/24`;
    else if (p >= 0.85) labelTxt = 'CRITICAL';
    else if (p >= 0.65) labelTxt = 'WARNING';
    el.querySelector('#lpoLabel').textContent = labelTxt;

    // history chart
    lpoChart.data.labels = state.P_LPO_history.map((_, i) => i);
    lpoChart.data.datasets[0].data = [...state.P_LPO_history];
    lpoChart.update('none');

    // IF panel
    el.querySelector('#ifScoreVal').textContent = state.ifScore.toFixed(3);
    el.querySelector('#ifOutlierVal').textContent = state.isOutlier ? 'YES' : 'no';
    el.querySelector('#ifOutlierVal').style.color = state.isOutlier ? 'var(--color-l3a-if)' : 'var(--color-text-dim)';
    el.querySelector('#smoteVal').textContent = state.smoteWeight.toFixed(2);
    el.querySelector('#thrVal').textContent = (0.55 - 0.05 * (state.smoteWeight - 1)).toFixed(2);

    // contributors
    const cl = el.querySelector('#contribList');
    const contribs = state.lstmContributors || [];
    if (!contribs.length) {
      cl.innerHTML = `<div style="color:var(--color-text-dim)">No contributors (warmup)</div>`;
    } else {
      const max = Math.max(...contribs.map(c => Math.abs(c.contribution))) || 1;
      cl.innerHTML = contribs.map(c => {
        const pct = (Math.abs(c.contribution) / max * 100).toFixed(0);
        const sign = c.contribution >= 0 ? '+' : '−';
        const col = c.contribution >= 0 ? 'var(--color-critical)' : 'var(--color-normal)';
        return `
          <div class="flex items-center gap-2">
            <div class="w-40 truncate font-mono text-[10px]">${c.feature}</div>
            <div class="flex-1 h-2 rounded" style="background:#1E293B"><div style="width:${pct}%;height:100%;background:${col};border-radius:inherit"></div></div>
            <div class="font-mono text-[10px] w-12 text-right" style="color:${col}">${sign}${Math.abs(c.contribution).toFixed(2)}</div>
          </div>`;
      }).join('');
    }

    // feature grid
    const fg = el.querySelector('#featureGrid');
    fg.innerHTML = FEATURE_NAMES.map((n, i) => {
      const v = state.features28[i];
      const vStr = (v == null || !Number.isFinite(v)) ? '--' : v.toFixed(3);
      return `<div><span style="color:var(--color-text-dim)">[${String(i).padStart(2, '0')}]</span> ${n}: <span style="color:var(--color-text)">${vStr}</span></div>`;
    }).join('');

    rebuildDetailChart();
  }

  on('stateChange', refresh);
  on('sensorSelected', refresh);
  refresh();
}
