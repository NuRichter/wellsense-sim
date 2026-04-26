// components/layout/statusBar.js
import { state, on } from '../../store/simulationStore.js';
import { fmtUptime, tickToSimTime } from '../../utils/timeFormatter.js';
import * as orchestrator from '../../engine/orchestrator.js';

export function mount(el) {
  el.innerHTML = `
    <div id="statusBar" class="flex flex-wrap items-center gap-x-6 gap-y-2 px-6 py-2 text-xs"
         style="background:#0B1120;border-bottom:1px solid var(--color-border)">
      <div class="flex items-center gap-2">
        <span class="inline-block w-2 h-2 rounded-full" style="background:var(--color-normal)"></span>
        <strong>WELLSENSE IOC</strong> · Mahakam Block
      </div>
      <div>⏱ Uptime: <span id="uptimeVal" class="font-mono">00:00:00</span></div>
      <div>📅 Sim: <span id="simTimeVal" class="font-mono">${state.activeDate} 00:00</span></div>
      <div>🔄 Tick #<span id="tickVal" class="font-mono">0</span> / 144</div>
      <div>⚡ <span id="speedVal" class="font-mono">1×</span></div>
      <div>📡 DAQ: <span style="color:var(--color-normal)">10ch Active</span></div>
      <div>🧠 Warmup: <span id="warmupVal" class="font-mono">0/24</span></div>
      <div class="ml-auto flex items-center gap-2">
        <button id="btnPlay"  class="px-3 py-1 rounded text-xs font-semibold" style="background:var(--color-normal);color:white">▶ Start</button>
        <button id="btnPause" class="px-3 py-1 rounded text-xs font-semibold hidden" style="background:var(--color-warning);color:white">⏸ Pause</button>
        <button id="btnStep"  class="px-3 py-1 rounded text-xs border" style="border-color:var(--color-border)">Step</button>
        <select id="speedSel" class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs">
          <option value="1">1×</option>
          <option value="2">2×</option>
          <option value="4">4×</option>
          <option value="8">8×</option>
        </select>
      </div>
    </div>
  `;
  const upt = el.querySelector('#uptimeVal');
  const sm  = el.querySelector('#simTimeVal');
  const tk  = el.querySelector('#tickVal');
  const sp  = el.querySelector('#speedVal');
  const wm  = el.querySelector('#warmupVal');
  const btnPlay = el.querySelector('#btnPlay');
  const btnPause = el.querySelector('#btnPause');
  const btnStep = el.querySelector('#btnStep');
  const speedSel = el.querySelector('#speedSel');

  setInterval(() => {
    if (state.startedAt) upt.textContent = fmtUptime(Date.now() - state.startedAt);
  }, 250);

  function refresh() {
    sm.textContent = tickToSimTime(state.tick, state.activeDate);
    tk.textContent = state.tick;
    sp.textContent = state.speed + '×';
    wm.textContent = `${state.warmupProgress.filled}/${state.warmupProgress.total}`;
    btnPlay.classList.toggle('hidden', state.isRunning);
    btnPause.classList.toggle('hidden', !state.isRunning);
  }
  on('tickAdvanced', refresh);
  on('runStateChange', refresh);
  on('stateChange', refresh);

  btnPlay.addEventListener('click', () => orchestrator.start());
  btnPause.addEventListener('click', () => orchestrator.pause());
  btnStep.addEventListener('click', () => orchestrator.singleStep());
  speedSel.addEventListener('change', e => orchestrator.setSpeed(parseInt(e.target.value, 10)));
  refresh();
}
