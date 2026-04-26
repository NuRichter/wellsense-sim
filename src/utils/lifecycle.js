// utils/lifecycle.js — view scope helper for SPA routing
// Provides a unified abort signal that auto-cleans event listeners (via EventTarget signal support)
// and Chart.js instances on view unmount.

import { on } from '../store/simulationStore.js';

export function createViewScope() {
  const ctrl = new AbortController();
  const charts = [];
  return {
    signal: ctrl.signal,
    on(event, handler) {
      return on(event, handler, { signal: ctrl.signal });
    },
    track(chart) {
      if (chart) charts.push(chart);
      return chart;
    },
    dispose() {
      // First: neutralize charts to stop pending updates / resize observers
      charts.forEach(c => {
        try {
          if (c?.options) {
            c.options.responsive = false;
            c.options.animation = false;
          }
          if (c?.stop) c.stop();
        } catch (_) {}
      });
      // Then: cancel listeners
      ctrl.abort();
      // Finally: destroy charts (now they have no pending work)
      charts.forEach(c => { try { c.destroy(); } catch (_) {} });
      charts.length = 0;
    },
  };
}
