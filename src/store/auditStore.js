// store/auditStore.js
import { emit } from './simulationStore.js';

const KEY = 'ws_audit';
let entries = [];

try {
  const raw = localStorage.getItem(KEY);
  if (raw) entries = JSON.parse(raw);
} catch (_) { entries = []; }

export function addEntry(e) {
  const entry = { id: entries.length + 1, timestamp: new Date().toISOString(), ...e };
  entries.unshift(entry);
  if (entries.length > 500) entries = entries.slice(0, 500);
  try { localStorage.setItem(KEY, JSON.stringify(entries)); } catch (_) {}
  emit('auditChanged');
  return entry;
}

export function listAll() { return [...entries]; }
export function clearAll() {
  entries = [];
  try { localStorage.removeItem(KEY); } catch (_) {}
  emit('auditChanged');
}

export function exportCSV() {
  const headers = ['id', 'timestamp', 'ticket_id', 'tier', 'role', 'action', 'reason', 'P_LPO', 'severity'];
  const rows = entries.map(e => headers.map(h => JSON.stringify(e[h] ?? '')).join(','));
  return [headers.join(','), ...rows].join('\n');
}
