// components/layout/navbar.js
import { state, on, emit } from '../../store/simulationStore.js';

export function mount(el) {
  el.innerHTML = `
    <div class="flex items-center justify-between px-6 py-3 border-b" style="border-color:var(--color-border);background:var(--color-surface)">
      <div class="flex items-center gap-3">
        <div class="text-xl font-bold tracking-tight">
          <span style="color:var(--color-l4)">⬢</span> WELLSENSE
          <span class="text-xs font-normal ml-2" style="color:var(--color-text-dim)">IOC · Mahakam Block</span>
        </div>
      </div>
      <div class="flex items-center gap-3 text-sm">
        <div class="flex items-center gap-2">
          <label class="text-xs" style="color:var(--color-text-dim)">ROLE:</label>
          <select id="roleSelect" class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm">
            <option>Well Operator</option>
            <option>Well Engineer</option>
            <option>Production Engineer</option>
          </select>
        </div>
        <a href="index.html"      class="hover:underline">Dashboard</a>
        <a href="portfolio.html"  class="hover:underline">Regime</a>
        <a href="tickets.html"    class="hover:underline">Tickets</a>
        <a href="audit.html"      class="hover:underline">Audit</a>
        <a href="pipeline.html"   class="hover:underline">Pipeline</a>
      </div>
    </div>
  `;
  const sel = el.querySelector('#roleSelect');
  sel.value = state.role;
  sel.addEventListener('change', e => {
    state.role = e.target.value;
    emit('roleChanged');
  });
  on('roleChanged', () => { sel.value = state.role; });
}
