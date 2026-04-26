// store/ticketStore.js
import { uuid } from '../utils/math.js';
import { emit } from './simulationStore.js';

export const tickets = [];

export function createTicket(payload) {
  const t = {
    ticket_id: 'TK-' + uuid().slice(0, 8).toUpperCase(),
    timestamp_real: new Date().toISOString(),
    status: 'PENDING',
    cycle_number: 1,
    approvals: [],
    ...payload,
  };
  tickets.unshift(t);
  emit('ticketCreated', { ticket: t });
  emit('ticketsChanged');
  return t;
}

export function getById(id) { return tickets.find(t => t.ticket_id === id); }

export function listPending() { return tickets.filter(t => t.status === 'PENDING'); }

export function updateTicket(id, patch) {
  const t = getById(id);
  if (!t) return null;
  Object.assign(t, patch);
  emit('ticketsChanged');
  return t;
}

export function getStats() {
  return {
    total: tickets.length,
    pending: tickets.filter(t => t.status === 'PENDING').length,
    approved: tickets.filter(t => t.status === 'APPROVED').length,
    rejected: tickets.filter(t => t.status === 'REJECTED').length,
    overridden: tickets.filter(t => t.status === 'OVERRIDDEN').length,
  };
}
