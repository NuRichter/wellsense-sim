// router.js — hash-based router. Engine bootstraps once; views swap with proper teardown.
import { createViewScope } from './utils/lifecycle.js';

let currentScope = null;
let outletEl = null;
let viewTitleEl = null;

const VIEWS = {
  '#dashboard': {
    title: 'Dashboard · Real-Time Monitoring',
    subtitle: 'L1 → L2 → L3a (IF + LSTM) → L4 · Tick interval = 10 menit · per-tick anomaly detection',
    render: dashboardView,
  },
  '#regime': {
    title: 'Operating Regime Clustering',
    subtitle: 'BD Track · K-Means k=3 · Daily recap pukul 23:00 WIT · 3 regime: STABLE / MODERATE / HIGH_RISK',
    render: regimeView,
  },
  '#tickets': {
    title: 'Antrian Tiket Intervensi',
    subtitle: 'L4 · 3-Tier RBAC (Well Operator → Well Engineer → Production Engineer) · 5-Cycle Mechanism',
    render: ticketsView,
  },
  '#audit': {
    title: 'Rekam Jejak Keputusan',
    subtitle: 'Persistent audit trail (localStorage) · setiap aksi HITL terekam dengan timestamp, role, tier, action, reason',
    render: auditView,
  },
  '#pipeline': {
    title: 'Pipeline Architecture · Live View',
    subtitle: '5-Layer stack visualisasi · stage indicator menyala mengikuti tick aktif',
    render: pipelineView,
  },
};

// ─── VIEW BUILDERS ────────────────────────────────────────────
async function dashboardView(host, scope) {
  host.innerHTML = `
    <div id="alertBanner" class="hidden"></div>
    <div id="pipelineStage"></div>
    <div id="sensorStreamChart"></div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div id="sensorZoneGrid"></div>
      <div id="sensorDetailPanel"></div>
    </div>
    <div class="mt-4">
      <div id="scenarioPanel"></div>
    </div>
  `;
  const [pipeline, zoneGrid, detail, stream, alert, scenario] = await Promise.all([
    import('./components/dashboard/pipelineStageIndicator.js'),
    import('./components/dashboard/sensorZoneGrid.js'),
    import('./components/dashboard/sensorDetailPanel.js'),
    import('./components/dashboard/sensorStreamChart.js'),
    import('./components/dashboard/alertBanner.js'),
    import('./components/shared/scenarioPanel.js'),
  ]);
  pipeline.mount(host.querySelector('#pipelineStage'), scope);
  stream.mount(host.querySelector('#sensorStreamChart'), scope);
  zoneGrid.mount(host.querySelector('#sensorZoneGrid'), scope);
  detail.mount(host.querySelector('#sensorDetailPanel'), scope);
  alert.mount(host.querySelector('#alertBanner'), scope);
  scenario.mount(host.querySelector('#scenarioPanel'), scope);
}

async function regimeView(host, scope) {
  host.innerHTML = `<div id="regimeView"></div>`;
  const m = await import('./components/portfolio/regimeView.js');
  m.mount(host.querySelector('#regimeView'), scope);
}

async function ticketsView(host, scope) {
  host.innerHTML = `<div id="ticketList"></div>`;
  const m = await import('./components/tickets/ticketCard.js');
  m.mount(host.querySelector('#ticketList'), scope);
}

async function auditView(host, scope) {
  host.innerHTML = `<div id="auditView"></div>`;
  const m = await import('./components/audit/auditTable.js');
  m.mount(host.querySelector('#auditView'), scope);
}

async function pipelineView(host, scope) {
  host.innerHTML = `<div id="pipelineDiagram"></div>`;
  const m = await import('./components/pipeline/pipelineDiagram.js');
  m.mount(host.querySelector('#pipelineDiagram'), scope);
}

// ─── ROUTING ─────────────────────────────────────────────────
function currentRoute() {
  const h = (location.hash || '#dashboard').split('?')[0];
  return VIEWS[h] ? h : '#dashboard';
}

async function navigate() {
  const route = currentRoute();
  const def = VIEWS[route];

  // Tear down previous view scope (cancels listeners + destroys charts)
  if (currentScope) {
    currentScope.dispose();
    currentScope = null;
  }

  // Title block
  if (viewTitleEl) {
    viewTitleEl.innerHTML = `
      <h1 class="text-xl font-bold mb-1">${def.title}</h1>
      <p class="text-sm" style="color:var(--color-text-dim)">${def.subtitle}</p>
    `;
  }

  // New scope for this view
  currentScope = createViewScope();
  outletEl.innerHTML = '<div class="text-center py-12" style="color:var(--color-text-dim)">Loading view…</div>';
  try {
    await def.render(outletEl, currentScope);
  } catch (e) {
    console.error('View render failed:', e);
    outletEl.innerHTML = `<div class="surface p-6" style="color:var(--color-critical)">View render failed: ${e.message}</div>`;
  }
}

export function start({ outlet, viewTitle }) {
  outletEl = outlet;
  viewTitleEl = viewTitle;
  if (!location.hash) location.hash = '#dashboard';
  window.addEventListener('hashchange', navigate);
  navigate();
}
