// components/pipeline/pipelineDiagram.js
import { state, on } from '../../store/simulationStore.js';

export function mount(el, scope) {
  function render() {
    const ss = state.stageStatus;
    const cls = (s) => s === 'active' ? 'stage-active' : s === 'done' ? 'stage-done' : 'stage-idle';
    el.innerHTML = `
      <div class="surface p-6">
        <div class="text-lg font-semibold mb-1">Wellsense Architecture · 5-Layer Stack</div>
        <div class="text-xs mb-6" style="color:var(--color-text-dim)">Dual-Track AI/ML — RT (per tick) + BD (per 6 ticks = 1 jam sim)</div>

        <!-- L1 -->
        <div class="surface p-4 mb-3" style="border-left:4px solid var(--color-l1)">
          <div class="font-semibold ${cls(ss.L1)}">⬢ L1 · Data Source + Hardware</div>
          <div class="text-xs mt-1" style="color:var(--color-text-dim)">
            10 Sensor (4–20 mA, HART 7) → Emerson ROC800L (AGA 3/7/8, 30-day buffer) →
            IS Barrier MTL5500 (Zone 1 → Safe) → Modbus TCP/IP → Edge Server Ubuntu 22.04
          </div>
        </div>

        <div class="text-center text-xs my-1" style="color:var(--color-text-dim)">↓</div>

        <!-- L2 -->
        <div class="surface p-4 mb-3" style="border-left:4px solid var(--color-l2)">
          <div class="font-semibold ${cls(ss.L2)}">⬢ L2 · Edge Computing / Preprocessing</div>
          <div class="text-xs mt-1" style="color:var(--color-text-dim)">
            Merge 10 streams → 10 representative values → Feature Engineering (28 fitur:
            10 raw scaled, 3 log, 5 rolling, 4 lag, 3 delta, 2 ratio, 1 step) → SMOTE Adaptive Weight
            → LSTM Sequence Format (24×28 sliding window)
          </div>
        </div>

        <div class="text-center text-xs my-1" style="color:var(--color-text-dim)">↓ DUAL TRACK ↓</div>

        <div class="grid grid-cols-2 gap-3 mb-3">
          <!-- L3a RT -->
          <div class="surface p-4" style="border-left:4px solid var(--color-l3a-lstm)">
            <div class="font-semibold">⬢ L3a · RT Track</div>
            <div class="text-[11px] mt-2 space-y-2">
              <div class="${cls(ss.L3a_IF)}">
                <strong style="color:var(--color-l3a-if)">M1 · Isolation Forest</strong><br/>
                <span style="color:var(--color-text-dim)">20 trees · sensor noise filter · SMOTE-weighted threshold · imputation t-1 jika outlier</span>
              </div>
              <div class="${cls(ss.L3a_LSTM)}">
                <strong style="color:var(--color-l3a-lstm)">M2 · LSTM 2-Layer</strong><br/>
                <span style="color:var(--color-text-dim)">Layer 1 lokal · Layer 2 trend · output P(LPO) per tick</span>
              </div>
            </div>
          </div>

          <!-- L3b BD -->
          <div class="surface p-4" style="border-left:4px solid var(--color-l3b-km)">
            <div class="font-semibold">⬢ L3b · BD Track</div>
            <div class="text-[11px] mt-2 ${cls(ss.L3b)}">
              <strong style="color:var(--color-l3b-km)">M3 · K-Means (k=3)</strong><br/>
              <span style="color:var(--color-text-dim)">
                K-Means++ init · Lloyd's algorithm · Silhouette score ·
                3 regime: OPTIMAL / DEGRADED / CRITICAL ·
                Migration detection → BD ticket
              </span>
            </div>
          </div>
        </div>

        <div class="text-center text-xs my-1" style="color:var(--color-text-dim)">↓</div>

        <!-- L4 -->
        <div class="surface p-4 mb-3" style="border-left:4px solid var(--color-l4)">
          <div class="font-semibold ${cls(ss.L4)}">⬢ L4 · HITL Decision Framework</div>
          <div class="text-xs mt-1" style="color:var(--color-text-dim)">
            Ticket queue · 3-Tier RBAC (Well Operator → Well Engineer → Production Engineer) ·
            5-Cycle Mechanism · Confidence final = 0.65×P(LPO) + 0.35×human · Audit trail ke localStorage
          </div>
        </div>

        <div class="text-center text-xs my-1" style="color:var(--color-text-dim)">↓</div>

        <!-- L5 -->
        <div class="surface p-4" style="border-left:4px solid var(--color-text-dim)">
          <div class="font-semibold">⬢ L5 · Presentation Layer</div>
          <div class="text-xs mt-1" style="color:var(--color-text-dim)">
            Dashboard IOC · Sensor Stream Overview · Sensor Detail Panel · Regime Scatter ·
            Ticket Queue · Audit Table
          </div>
        </div>
      </div>
    `;
  }
  const sub = scope ? scope.on : on;
  sub('stageChange', render);
  sub('stateChange', render);
  render();
}
