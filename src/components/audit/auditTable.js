// components/audit/auditTable.js
import { listAll, exportCSV, clearAll } from '../../store/auditStore.js';
import { on } from '../../store/simulationStore.js';

export function mount(el, scope) {
  function render() {
    const all = listAll();
    el.innerHTML = `
      <div class="surface p-3">
        <div class="flex items-center justify-between mb-3">
          <div class="text-sm font-semibold">Rekam Jejak Keputusan · ${all.length} entries</div>
          <div class="flex gap-2">
            <button id="exportBtn" class="px-3 py-1 text-xs rounded border" style="border-color:var(--color-border)">Export CSV</button>
            <button id="clearBtn" class="px-3 py-1 text-xs rounded border" style="border-color:var(--color-critical);color:var(--color-critical)">Clear All</button>
          </div>
        </div>
        ${all.length === 0
          ? `<div class="text-center py-8" style="color:var(--color-text-dim)">No audit entries yet.</div>`
          : `<div class="scroll-thin" style="max-height:600px;overflow-y:auto">
              <table class="audit-tbl">
                <thead><tr>
                  <th>#</th><th>Timestamp</th><th>Ticket</th><th>Tier</th>
                  <th>Role</th><th>Action</th><th>Severity</th><th>P(LPO)</th><th>Conf</th><th>Reason</th>
                </tr></thead>
                <tbody>
                  ${all.map(e => `
                    <tr>
                      <td>${e.id}</td>
                      <td class="font-mono text-[10px]">${e.timestamp.replace('T', ' ').slice(0, 19)}</td>
                      <td class="font-mono">${e.ticket_id || ''}</td>
                      <td>${e.tier ?? ''}</td>
                      <td>${e.role || ''}</td>
                      <td><span class="badge ${e.action === 'APPROVE' ? 'badge-normal' : e.action === 'REJECT' ? 'badge-critical' : 'badge-warning'}">${e.action}</span></td>
                      <td>${e.severity || ''}</td>
                      <td class="font-mono">${e.P_LPO ?? ''}</td>
                      <td class="font-mono">${e.confidence ?? ''}</td>
                      <td class="text-[10px]" style="color:var(--color-text-dim);max-width:200px">${e.reason || ''}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>`}
      </div>
    `;
    const exp = el.querySelector('#exportBtn');
    if (exp) exp.addEventListener('click', () => {
      const csv = exportCSV();
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `wellsense_audit_${Date.now()}.csv`; a.click();
      URL.revokeObjectURL(url);
    });
    const clr = el.querySelector('#clearBtn');
    if (clr) clr.addEventListener('click', () => {
      if (confirm('Clear all audit entries?')) clearAll();
    });
  }
  const sub = scope ? scope.on : on;
  sub('auditChanged', render);
  render();
}
