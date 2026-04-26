// main.js — SPA entry. Engine bootstraps ONCE; router swaps views without restarting simulation.
import { state } from './store/simulationStore.js';
import * as orchestrator from './engine/orchestrator.js';
import * as L1 from './engine/L1_dataStream.js';
import * as navbar from './components/layout/navbar.js';
import * as statusBar from './components/layout/statusBar.js';
import * as printNotification from './components/shared/printNotification.js';
import { start as startRouter } from './router.js';

async function bootApp() {
  // Filter benign Chart.js teardown errors (when user navigates away during a pending chart update,
  // Chart.js' internal ResizeObserver/animation queue fires AFTER destroy and tries to bind events
  // on a detached canvas. Functionally harmless — the chart was about to be destroyed anyway.)
  window.addEventListener('error', e => {
    if (e?.filename?.includes('chart.umd') || e?.error?.stack?.includes('chart.umd')) {
      e.preventDefault();
      return false;
    }
  });

  const navEl   = document.getElementById('navbar');
  const sbEl    = document.getElementById('statusBar');
  const titleEl = document.getElementById('viewTitle');
  const outlet  = document.getElementById('viewOutlet');

  // Persistent shell components (mounted once, no view scope)
  navbar.mount(navEl);
  statusBar.mount(sbEl);
  printNotification.mount();

  // Bootstrap engine ONCE
  try {
    await orchestrator.bootstrap();
  } catch (e) {
    console.error('Bootstrap failed:', e);
    outlet.innerHTML = `
      <div class="surface p-6" style="border-left:4px solid var(--color-critical)">
        <strong style="color:var(--color-critical)">Failed to load CSV data</strong>
        <div class="text-xs mt-2" style="color:var(--color-text-dim)">
          Pastikan dijalankan via static server (e.g. <code>python3 -m http.server</code>) — bukan <code>file://</code>.<br/>
          Path expected: <code>data/${state.activeDate}/sensor_*.csv</code><br/>
          Error: ${e.message}
        </div>
      </div>`;
    return;
  }

  // Auto-start the simulation so demo flows don't require an extra click
  orchestrator.start();

  // Hand off to router (handles navigation & view scope teardown)
  startRouter({ outlet, viewTitle: titleEl });
}

bootApp();

// Expose for debugging / forced scenarios from console
window._wellsense = { state, orchestrator, L1 };
