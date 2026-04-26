// engine/L4_hitlStateMachine.js — Layer 4
import * as ticketStore from '../store/ticketStore.js';
import * as auditStore from '../store/auditStore.js';
import { state, emit } from '../store/simulationStore.js';
import { generateRTTicketPDF, openPDFInModal } from './pdfGenerator.js';

const ALPHA = 0.65;
const HUMAN_JUDGMENT = { APPROVE: 1.0, REJECT: 0.0, ESCALATE: 0.5, OVERRIDE: 0.7 };

export const ZONE_NAME = {
  1: 'Zona 1 — Wellhead',
  2: 'Zona 2 — Flow & Process',
  3: 'Zona 3 — Gas-Lift Manifold',
  4: 'Zona 4 — Multiphase & Analytical',
};

function recommendation(severity, primary_zone) {
  if (severity === 'CRITICAL')  return primary_zone === 'Zona 3 — Gas-Lift Manifold' ? 'Adjust GL Rate / Inspect GL Manifold' : 'Inspect Sensor + Operational Review';
  if (severity === 'WARNING')   return 'Inspect Sensor';
  if (severity === 'ESCALATION') return 'Escalate to Production Engineer + Field Inspection';
  return 'Monitor';
}

export function createRTTicket({ P_LPO, sensor_snapshot, top_contributors, primary_zone, sim_time }) {
  let severity, tier;
  if (P_LPO >= 0.85) { severity = 'CRITICAL'; tier = 3; }
  else if (P_LPO >= 0.65) { severity = 'WARNING'; tier = 1; }
  else return null;

  const ticket = ticketStore.createTicket({
    source: 'RT',
    severity,
    P_LPO: Number(P_LPO.toFixed(3)),
    regime_from: null,
    regime_to: null,
    timestamp_sim: sim_time,
    sensor_snapshot,
    top_contributors,
    primary_zone,
    recommendation: recommendation(severity, primary_zone),
    current_tier: tier,
    cycle_number: Math.floor(state.tick / 30) + 1,
  });
  auditStore.addEntry({
    ticket_id: ticket.ticket_id, tier, role: 'SYSTEM',
    action: 'CREATED', reason: `Auto-created: P(LPO)=${ticket.P_LPO}`,
    P_LPO: ticket.P_LPO, severity,
  });
  // Print Job A — auto-cetak PDF tiket RT (warning/critical)
  scheduleRTPrint(ticket);
  return ticket;
}

function scheduleRTPrint(ticket) {
  // Defer to next tick so the dashboard can render the alert banner first
  setTimeout(() => {
    try {
      const pdf = generateRTTicketPDF(ticket);
      const title = `Tiket Intervensi · ${ticket.ticket_id} · ${ticket.severity}`;
      openPDFInModal(pdf, title);
      emit('printJobIssued', { kind: 'RT', ticket });
    } catch (e) {
      console.warn('PDF generation failed:', e);
    }
  }, 250);
}

export function createBDTicket({ migration, snapshot, sim_time }) {
  if (!migration) return null;
  const sevMap = { WARNING: 'WARNING', CRITICAL: 'CRITICAL', ESCALATION: 'ESCALATION' };
  const ticket = ticketStore.createTicket({
    source: 'BD',
    severity: sevMap[migration.kind],
    P_LPO: null,
    regime_from: migration.from,
    regime_to: migration.to,
    timestamp_sim: sim_time,
    sensor_snapshot: snapshot,
    top_contributors: [
      { feature: 'regime_migration', contribution: 1 },
      { feature: `from_${migration.from}`, contribution: 1 },
      { feature: `to_${migration.to}`, contribution: 1 },
    ],
    primary_zone: 'Multi-Zone (Operating Regime)',
    recommendation: recommendation(sevMap[migration.kind], 'Multi-Zone'),
    current_tier: migration.tier,
    cycle_number: Math.floor(state.tick / 30) + 1,
  });
  auditStore.addEntry({
    ticket_id: ticket.ticket_id, tier: migration.tier, role: 'SYSTEM',
    action: 'CREATED', reason: `Regime migration: ${migration.from} → ${migration.to}`,
    P_LPO: null, severity: sevMap[migration.kind],
  });
  return ticket;
}

export function performAction({ ticket_id, action, reason, role }) {
  const t = ticketStore.getById(ticket_id);
  if (!t) return { ok: false, error: 'Not found' };
  const tier = state.roleTier[role];
  if (tier !== t.current_tier) {
    return { ok: false, error: `Role tier mismatch (need T${t.current_tier}, you are T${tier || '?'})` };
  }
  if (t.status !== 'PENDING') {
    return { ok: false, error: `Ticket already ${t.status}` };
  }

  // Validate action vs tier
  const allowed = {
    1: ['APPROVE', 'REJECT', 'ESCALATE'],
    2: ['APPROVE', 'REJECT', 'OVERRIDE'],
    3: ['APPROVE', 'REJECT', 'OVERRIDE'],
  };
  if (!allowed[tier].includes(action)) {
    return { ok: false, error: `Action ${action} not allowed at Tier ${tier}` };
  }
  if ((action === 'REJECT' || action === 'OVERRIDE') && (!reason || reason.length < 20)) {
    return { ok: false, error: 'Reason ≥ 20 characters required' };
  }

  const approval = { tier, role, action, reason: reason || '', timestamp: new Date().toISOString() };
  t.approvals.push(approval);

  let newStatus = t.status;
  let newTier = t.current_tier;

  if (action === 'APPROVE') {
    if (tier === 3) newStatus = 'APPROVED';
    else newTier = tier + 1;
  } else if (action === 'REJECT') {
    newStatus = 'REJECTED';
  } else if (action === 'ESCALATE') {
    newTier = 3;
  } else if (action === 'OVERRIDE') {
    newStatus = 'OVERRIDDEN';
  }

  // Confidence
  const hj = HUMAN_JUDGMENT[action];
  const conf = t.P_LPO != null ? ALPHA * t.P_LPO + (1 - ALPHA) * hj : null;

  ticketStore.updateTicket(ticket_id, {
    status: newStatus,
    current_tier: newTier,
    confidence_final: conf != null ? Number(conf.toFixed(3)) : null,
  });

  auditStore.addEntry({
    ticket_id, tier, role, action,
    reason: reason || '',
    P_LPO: t.P_LPO,
    severity: t.severity,
    confidence: conf != null ? Number(conf.toFixed(3)) : null,
  });

  return { ok: true, ticket: ticketStore.getById(ticket_id) };
}

export const CYCLE_LENGTH = 30;  // tick
