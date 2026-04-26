// components/layout/navbar.js
import { state, on, emit } from '../../store/simulationStore.js';

const ROUTES = [
  { hash: '#dashboard', label: 'Dashboard' },
  { hash: '#regime',    label: 'Regime' },
  { hash: '#tickets',   label: 'Tickets' },
  { hash: '#audit',     label: 'Audit' },
  { hash: '#pipeline',  label: 'Pipeline' },
];

function activeHash() {
  const h = (location.hash || '#dashboard').split('?')[0];
  return h;
}

export function mount(el, scope) {
  function render() {
    const cur = activeHash();
    el.innerHTML = `
      <div class="flex items-center justify-between px-6 py-3 border-b" style="border-color:var(--color-border);background:var(--color-surface)">
        <div class="flex items-center gap-3">
          <div class="text-xl font-bold tracking-tight">
            <span style="color:var(--color-l4)">⬢</span> WELLSENSE
            <span class="text-xs font-normal ml-2" style="color:var(--color-text-dim)">IOC · Mahakam Block</span>
          </div>
        </div>
        <div class="flex items-center gap-4 text-sm">
          <div class="flex items-center gap-2">
            <label class="text-xs" style="color:var(--color-text-dim)">ROLE:</label>
            <select id="roleSelect" class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm">
              <option>Well Operator</option>
              <option>Well Engineer</option>
              <option>Production Engineer</option>
            </select>
          </div>
          ${ROUTES.map(r => {
            const isActive = cur === r.hash;
            const style = isActive
              ? 'color:var(--color-l4);border-bottom:2px solid var(--color-l4);font-weight:600'
              : 'color:var(--color-text);border-bottom:2px solid transparent';
            return `<a href="${r.hash}" data-nav="${r.hash}" style="padding:4px 2px;${style}" class="hover:opacity-80">${r.label}</a>`;
          }).join('')}
        </div>
      </div>
    `;
    const sel = el.querySelector('#roleSelect');
    sel.value = state.role;
    sel.addEventListener('change', e => {
      state.role = e.target.value;
      emit('roleChanged');
    });
  }

  render();
  // Use scope-bound listener so it survives view swaps but cleans up if navbar itself remounts
  const sub = scope ? scope.on : on;
  sub('roleChanged', () => {
    const sel = el.querySelector('#roleSelect');
    if (sel) sel.value = state.role;
  });
  // Re-render highlight on hash change (window listener, since navbar persists across views)
  window.addEventListener('hashchange', render);
}
