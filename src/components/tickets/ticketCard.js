// components/tickets/ticketCard.js
import { tickets } from '../../store/ticketStore.js';
import { on, state } from '../../store/simulationStore.js';
import { performAction } from '../../engine/L4_hitlStateMachine.js';

const SEV_COLOR = {
  CRITICAL:   'var(--color-critical)',
  WARNING:    'var(--color-warning)',
  ESCALATION: 'var(--color-l3a-if)',
};

const STATUS_BADGE = {
  PENDING:    'badge-warning',
  APPROVED:   'badge-normal',
  REJECTED:   'badge-critical',
  OVERRIDDEN: 'badge-outlier',
};

function actionsForRoleTier(tier) {
  if (tier === 1) return ['APPROVE', 'REJECT', 'ESCALATE'];
  if (tier === 2) return ['APPROVE', 'REJECT', 'OVERRIDE'];
  if (tier === 3) return ['APPROVE', 'REJECT', 'OVERRIDE'];
  return [];
}

export function mount(el) {
  function render() {
    if (!tickets.length) {
      el.innerHTML = `
        <div class="surface p-6 text-center" style="color:var(--color-text-dim)">
          <div class="text-3xl mb-2">📋</div>
          <div>Belum ada tiket aktif. Sistem masih dalam mode monitoring.</div>
        </div>
      `;
      return;
    }
    const userTier = state.roleTier[state.role] || 0;
    el.innerHTML = `
      <div class="space-y-3">
        ${tickets.map(t => {
          const sevC = SEV_COLOR[t.severity] || '#888';
          const allowed = userTier === t.current_tier && t.status === 'PENDING';
          const acts = actionsForRoleTier(userTier);
          return `
            <div class="surface p-4" style="border-left:4px solid ${sevC}">
              <div class="flex items-start justify-between mb-2">
                <div>
                  <div class="flex items-center gap-2">
                    <span class="font-mono text-sm font-bold">${t.ticket_id}</span>
                    <span class="badge ${STATUS_BADGE[t.status] || 'badge-warning'}">${t.status}</span>
                    <span class="badge" style="background:${sevC};color:white">${t.severity}</span>
                    <span class="text-xs" style="color:var(--color-text-dim)">${t.source} Track</span>
                    <span class="text-xs" style="color:var(--color-text-dim)">Tier ${t.current_tier}</span>
                  </div>
                  <div class="text-xs mt-1" style="color:var(--color-text-dim)">
                    ${t.timestamp_sim} · ${t.primary_zone} · Cycle #${t.cycle_number}
                  </div>
                </div>
                ${t.P_LPO != null
                  ? `<div class="text-right">
                      <div class="text-xs" style="color:var(--color-text-dim)">P(LPO)</div>
                      <div class="font-mono text-2xl font-bold" style="color:${sevC}">${t.P_LPO}</div>
                    </div>`
                  : `<div class="text-right">
                      <div class="text-xs" style="color:var(--color-text-dim)">Regime</div>
                      <div class="font-mono text-sm font-bold" style="color:${sevC}">${t.regime_from} → ${t.regime_to}</div>
                    </div>`}
              </div>
              <div class="grid grid-cols-2 gap-3 text-xs mb-2">
                <div>
                  <div style="color:var(--color-text-dim)" class="mb-1">Top Contributors</div>
                  ${(t.top_contributors || []).slice(0, 3).map(c =>
                    `<div class="font-mono">• ${c.feature}: ${typeof c.contribution === 'number' ? c.contribution.toFixed(2) : c.contribution}</div>`).join('')}
                </div>
                <div>
                  <div style="color:var(--color-text-dim)" class="mb-1">Sensor Snapshot (rep10)</div>
                  ${Object.entries(t.sensor_snapshot || {}).slice(0, 5).map(([k, v]) =>
                    `<div class="font-mono">${k}: ${typeof v === 'number' ? v.toFixed(2) : v}</div>`).join('')}
                </div>
              </div>
              <div class="text-xs mb-2 p-2 rounded" style="background:#0B1120">
                <span style="color:var(--color-text-dim)">Recommendation:</span> ${t.recommendation}
              </div>
              ${t.confidence_final != null
                ? `<div class="text-xs mb-2"><span style="color:var(--color-text-dim)">Confidence final:</span>
                     <span class="font-mono">${t.confidence_final}</span> = 0.65×P(LPO) + 0.35×human</div>`
                : ''}
              ${t.approvals.length
                ? `<div class="text-xs mb-2 p-2 rounded" style="background:#0B1120">
                    <div style="color:var(--color-text-dim)" class="mb-1">Approval Trail</div>
                    ${t.approvals.map(a => `<div class="font-mono">[T${a.tier}] ${a.role}: ${a.action}${a.reason ? ' — ' + a.reason : ''}</div>`).join('')}
                  </div>`
                : ''}
              ${allowed ? `
                <div class="flex gap-2 mt-2 flex-wrap">
                  ${acts.map(a => `<button data-act="${a}" data-tid="${t.ticket_id}" class="px-3 py-1 text-xs rounded font-semibold"
                    style="background:${a === 'APPROVE' ? 'var(--color-normal)' : a === 'REJECT' ? 'var(--color-critical)' : a === 'ESCALATE' ? 'var(--color-warning)' : 'var(--color-l3a-if)'};color:white">${a}</button>`).join('')}
                </div>
              ` : t.status === 'PENDING' ? `
                <div class="text-xs italic" style="color:var(--color-text-dim)">
                  Action needs role at Tier ${t.current_tier}. Anda saat ini ${state.role} (Tier ${userTier}).
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;
    el.querySelectorAll('button[data-act]').forEach(btn => {
      btn.addEventListener('click', () => {
        const act = btn.dataset.act;
        const tid = btn.dataset.tid;
        let reason = '';
        if (act === 'REJECT' || act === 'OVERRIDE') {
          reason = prompt(`${act} reason (≥ 20 chars):`) || '';
          if (reason.length < 20) {
            alert('Reason minimum 20 karakter.');
            return;
          }
        }
        const res = performAction({ ticket_id: tid, action: act, reason, role: state.role });
        if (!res.ok) alert(res.error);
      });
    });
  }
  on('ticketsChanged', render);
  on('roleChanged', render);
  render();
}
