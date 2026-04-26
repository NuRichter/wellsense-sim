// components/dashboard/alertBanner.js
import { on } from '../../store/simulationStore.js';

export function mount(el, scope) {
  function show(t) {
    if (!el || !el.isConnected) return;  // guard against stale el after navigation
    const sev = t.severity;
    const bg = sev === 'CRITICAL' ? 'var(--color-critical)' : sev === 'ESCALATION' ? 'var(--color-l3a-if)' : 'var(--color-warning)';
    const cls = sev === 'CRITICAL' ? 'critical-pulse' : '';
    el.innerHTML = `
      <div class="${cls} flex items-center gap-3 px-4 py-2 rounded mb-3" style="background:rgba(220,38,38,0.12);border:1px solid ${bg}">
        <div class="font-bold" style="color:${bg}">${sev}</div>
        <div class="text-sm flex-1">
          ${t.source === 'RT'
            ? `RT Track · P(LPO)=<span class="font-mono">${t.P_LPO}</span> · ${t.primary_zone} · Tiket <span class="font-mono">${t.ticket_id}</span>`
            : `BD Track · Regime ${t.regime_from} → ${t.regime_to} · Tiket <span class="font-mono">${t.ticket_id}</span>`}
        </div>
        <a href="#tickets" class="text-xs underline">Open ticket queue →</a>
        <button id="dismissAlert" class="text-xs opacity-60 hover:opacity-100">✕</button>
      </div>
    `;
    el.classList.remove('hidden');
    const dismissBtn = el.querySelector('#dismissAlert');
    if (dismissBtn) dismissBtn.addEventListener('click', () => el.classList.add('hidden'));
    setTimeout(() => { if (el && el.isConnected) el.classList.add('hidden'); }, 8000);
  }
  const sub = scope ? scope.on : on;
  sub('ticketCreated', e => show(e.detail.ticket));
}
