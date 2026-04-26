// components/dashboard/sensorZoneGrid.js
import { state, on, emit, SENSOR_META, ZONA_META } from '../../store/simulationStore.js';

const STATUS_BADGE = {
  normal:   '<span class="badge badge-normal">NORMAL</span>',
  warning:  '<span class="badge badge-warning">WARNING</span>',
  critical: '<span class="badge badge-critical">CRITICAL</span>',
  outlier:  '<span class="badge badge-outlier">OUTLIER</span>',
};

function fmt(v, unit) {
  if (v == null || !Number.isFinite(v)) return '--';
  if (Math.abs(v) >= 1000) return v.toFixed(0) + ' ' + unit;
  if (Math.abs(v) >= 10)   return v.toFixed(1) + ' ' + unit;
  return v.toFixed(3) + ' ' + unit;
}

export function mount(el) {
  function render() {
    const zones = { 1: [], 2: [], 3: [], 4: [] };
    Object.entries(SENSOR_META).forEach(([id, meta]) => zones[meta.zona].push(id));

    el.innerHTML = `
      <div class="surface p-3">
        <div class="text-sm font-semibold mb-2">Zona Instrumentasi · 10 Sensor Stream Aktif</div>
        ${[1, 2, 3, 4].map(z => `
          <div class="mb-3">
            <div class="flex items-center gap-2 text-xs mb-1.5">
              <span class="inline-block w-2 h-2 rounded-full" style="background:${ZONA_META[z].color}"></span>
              <span style="color:var(--color-text-dim)">Zona ${z} · ${ZONA_META[z].name}</span>
            </div>
            <div class="grid grid-cols-2 gap-2">
              ${zones[z].map(id => {
                const meta = SENSOR_META[id];
                const status = state.sensorStatus[id];
                const val = state.representative10[id];
                const sel = state.selectedSensor === id ? 'selected' : '';
                return `
                  <div class="sensor-card zona-${z} ${sel}" data-sensor="${id}">
                    <div class="flex items-center justify-between mb-1">
                      <div class="font-semibold text-sm">${meta.label}</div>
                      ${STATUS_BADGE[status] || STATUS_BADGE.normal}
                    </div>
                    <div class="text-xs" style="color:var(--color-text-dim)">${meta.desc}</div>
                    <div class="font-mono text-base mt-1">${fmt(val, meta.unit)}</div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;
    el.querySelectorAll('.sensor-card').forEach(card => {
      card.addEventListener('click', () => {
        state.selectedSensor = card.dataset.sensor;
        emit('sensorSelected', { sensor: state.selectedSensor });
        render();
      });
    });
  }
  on('stateChange', render);
  render();
}
