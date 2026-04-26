// components/shared/printNotification.js — toast for print job events
import { on } from '../../store/simulationStore.js';

let host;

function ensureHost() {
  if (host) return host;
  host = document.createElement('div');
  host.id = 'printToastHost';
  host.style.cssText = `
    position:fixed;top:80px;right:20px;z-index:9000;
    display:flex;flex-direction:column;gap:8px;max-width:340px;
    pointer-events:none;
  `;
  document.body.appendChild(host);
  return host;
}

function show(opts) {
  const h = ensureHost();
  const div = document.createElement('div');
  const color = opts.color || '#1D9E75';
  div.style.cssText = `
    pointer-events:auto;background:#1E293B;border:1px solid #334155;
    border-left:4px solid ${color};border-radius:6px;padding:10px 12px;
    color:#F1F5F9;font-size:12px;box-shadow:0 4px 12px rgba(0,0,0,0.4);
    transform:translateX(380px);transition:transform 0.25s ease-out;
  `;
  div.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
      <div style="font-weight:700;color:${color}">🖨 ${opts.title}</div>
    </div>
    <div style="color:#94A3B8;font-size:11px">${opts.body}</div>
  `;
  h.appendChild(div);
  requestAnimationFrame(() => { div.style.transform = 'translateX(0)'; });
  setTimeout(() => {
    div.style.transform = 'translateX(380px)';
    setTimeout(() => div.remove(), 300);
  }, 5000);
}

export function mount() {
  on('printJobIssued', e => {
    const d = e.detail;
    if (d.kind === 'RT') {
      const t = d.ticket;
      const isCritical = t.severity === 'CRITICAL';
      show({
        title: 'Print Job A · Tiket Intervensi',
        body: `${t.severity} · ${t.ticket_id} · P(LPO)=${t.P_LPO} · Modal preview terbuka untuk Well Operator.`,
        color: isCritical ? '#DC2626' : '#D97706',
      });
    } else if (d.kind === 'BD_RECAP') {
      const sc = d.scenario.replace(/_/g, ' ');
      show({
        title: 'Print Job B · Recap Harian',
        body: `Skenario: ${sc} · ${d.dateStr} · PDF preview siap dicetak.`,
        color: d.scenario === 'NO_MIGRATION' ? '#16A34A'
             : d.scenario === 'STABLE_TO_MODERATE' ? '#D97706'
             : '#DC2626',
      });
    }
  });
}
