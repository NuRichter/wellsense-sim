// main.js — Entry point. Auto-detects page and mounts components.
import { state } from './store/simulationStore.js';
import * as orchestrator from './engine/orchestrator.js';
import * as L1 from './engine/L1_dataStream.js';

import * as navbar from './components/layout/navbar.js';
import * as statusBar from './components/layout/statusBar.js';

// Page detection
const page = (location.pathname.split('/').pop() || 'index.html').replace('.html', '') || 'index';

async function bootCommon() {
  // Navbar always
  const navEl = document.getElementById('navbar');
  if (navEl) navbar.mount(navEl);
  const sbEl = document.getElementById('statusBar');
  if (sbEl) statusBar.mount(sbEl);

  // Bootstrap engine
  try {
    await orchestrator.bootstrap();
  } catch (e) {
    console.error('Bootstrap failed:', e);
    document.body.insertAdjacentHTML('beforeend',
      `<div class="fixed bottom-4 right-4 p-4 surface" style="border-left:4px solid var(--color-critical);max-width:400px">
        <strong style="color:var(--color-critical)">Failed to load CSV data</strong>
        <div class="text-xs mt-1" style="color:var(--color-text-dim)">
          Make sure you're running this via a static server (e.g. <code>python3 -m http.server</code>)
          and not <code>file://</code>. Path expected: <code>data/${state.activeDate}/sensor_*.csv</code>.
          Error: ${e.message}
        </div>
      </div>`);
  }
}

async function bootIndex() {
  await bootCommon();
  const pipeline = await import('./components/dashboard/pipelineStageIndicator.js');
  const zoneGrid = await import('./components/dashboard/sensorZoneGrid.js');
  const detail = await import('./components/dashboard/sensorDetailPanel.js');
  const stream = await import('./components/dashboard/sensorStreamChart.js');
  const alert = await import('./components/dashboard/alertBanner.js');
  const scenario = await import('./components/shared/scenarioPanel.js');

  pipeline.mount(document.getElementById('pipelineStage'));
  zoneGrid.mount(document.getElementById('sensorZoneGrid'));
  detail.mount(document.getElementById('sensorDetailPanel'));
  stream.mount(document.getElementById('sensorStreamChart'));
  alert.mount(document.getElementById('alertBanner'));
  scenario.mount(document.getElementById('scenarioPanel'));
}

async function bootPortfolio() {
  await bootCommon();
  const view = await import('./components/portfolio/regimeView.js');
  view.mount(document.getElementById('regimeView'));
}

async function bootTickets() {
  await bootCommon();
  const card = await import('./components/tickets/ticketCard.js');
  card.mount(document.getElementById('ticketList'));
}

async function bootAudit() {
  await bootCommon();
  const tbl = await import('./components/audit/auditTable.js');
  tbl.mount(document.getElementById('auditView'));
}

async function bootPipeline() {
  await bootCommon();
  const diag = await import('./components/pipeline/pipelineDiagram.js');
  diag.mount(document.getElementById('pipelineDiagram'));
}

const ROUTES = {
  index: bootIndex,
  portfolio: bootPortfolio,
  tickets: bootTickets,
  audit: bootAudit,
  pipeline: bootPipeline,
};

(ROUTES[page] || bootIndex)();

// Expose for debugging
window._wellsense = { state, orchestrator, L1 };

// Lucide icons (if used)
window.addEventListener('load', () => {
  if (window.lucide?.createIcons) lucide.createIcons();
});
