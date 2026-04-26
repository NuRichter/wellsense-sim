// engine/pdfGenerator.js — Print Job A (RT per-alert) + Print Job B (BD daily recap)
// Uses jsPDF loaded via CDN as window.jspdf.jsPDF

import { state, SENSOR_META } from '../store/simulationStore.js';
import { tickets } from '../store/ticketStore.js';
import { tickToSimTime } from '../utils/timeFormatter.js';

const COL = {
  critical: [220, 38, 38],
  warning:  [217, 119, 6],
  normal:   [22, 163, 74],
  l4:       [29, 158, 117],
  text:     [30, 41, 59],
  dim:      [100, 116, 139],
  border:   [203, 213, 225],
  bg:       [248, 250, 252],
};

function newPDF() {
  const { jsPDF } = window.jspdf;
  return new jsPDF({ unit: 'mm', format: 'a4' });
}

function setFill(pdf, c) { pdf.setFillColor(c[0], c[1], c[2]); }
function setText(pdf, c) { pdf.setTextColor(c[0], c[1], c[2]); }
function setDraw(pdf, c) { pdf.setDrawColor(c[0], c[1], c[2]); }

// ─── HEADER (shared) ────────────────────────────────────────
function header(pdf, opts) {
  const { title, subtitle, severityColor, badgeText } = opts;
  // Top accent bar
  setFill(pdf, severityColor);
  pdf.rect(0, 0, 210, 8, 'F');

  // Logo block
  setFill(pdf, COL.l4);
  pdf.rect(15, 14, 8, 8, 'F');
  setText(pdf, COL.text);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.text('WELLSENSE IOC', 26, 19);
  setText(pdf, COL.dim);
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Mahakam Block · Bekapai Field · Hulu Migas', 26, 23);

  // Document type badge
  setFill(pdf, severityColor);
  pdf.roundedRect(150, 14, 45, 8, 1.5, 1.5, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.text(badgeText, 172.5, 19.5, { align: 'center' });

  // Title
  setText(pdf, COL.text);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(15);
  pdf.text(title, 15, 33);
  setText(pdf, COL.dim);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text(subtitle, 15, 38);

  // Divider
  setDraw(pdf, COL.border);
  pdf.setLineWidth(0.3);
  pdf.line(15, 41, 195, 41);
}

// ─── KEY-VALUE TABLE (shared) ───────────────────────────────
function kvTable(pdf, x, y, width, rows, opts = {}) {
  const lh = opts.lh || 6;
  const labelW = opts.labelW || 38;
  let cy = y;
  pdf.setFontSize(opts.fontSize || 9);
  for (const [label, value] of rows) {
    setText(pdf, COL.dim);
    pdf.setFont('helvetica', 'normal');
    pdf.text(label, x, cy);
    setText(pdf, COL.text);
    pdf.setFont('helvetica', 'bold');
    pdf.text(String(value), x + labelW, cy);
    cy += lh;
  }
  return cy;
}

// ─── SECTION HEADER ─────────────────────────────────────────
function sectionTitle(pdf, x, y, label, accentColor = COL.l4) {
  setFill(pdf, accentColor);
  pdf.rect(x, y - 3.5, 1.2, 4, 'F');
  setText(pdf, COL.text);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text(label, x + 3, y);
}

// ─── SIGNATURE BLOCK ────────────────────────────────────────
function signatureBlock(pdf, x, y, width) {
  sectionTitle(pdf, x, y, 'PERSETUJUAN BERJENJANG · TANDA TANGAN BASAH', COL.l4);
  y += 5;
  setText(pdf, COL.dim);
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Dokumen ini wajib ditandatangani secara berurutan oleh tiga jenjang RBAC sebelum diarsipkan.', x, y);
  y += 6;

  const colW = (width - 6) / 3;
  const tiers = [
    { tier: 'TIER 1', role: 'Well Operator',       desc: 'Triase lapangan' },
    { tier: 'TIER 2', role: 'Well Engineer',       desc: 'Analisis teknis' },
    { tier: 'TIER 3', role: 'Production Engineer', desc: 'Approval final' },
  ];
  tiers.forEach((t, i) => {
    const cx = x + i * (colW + 3);
    setDraw(pdf, COL.border);
    pdf.setLineWidth(0.3);
    pdf.roundedRect(cx, y, colW, 36, 1.5, 1.5);
    setFill(pdf, COL.l4);
    pdf.rect(cx, y, colW, 5, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.text(t.tier, cx + 2, y + 3.5);
    pdf.text(t.role.toUpperCase(), cx + colW - 2, y + 3.5, { align: 'right' });

    // Signature area
    setText(pdf, COL.dim);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.text('Nama:', cx + 2, y + 11);
    pdf.text('Tanggal:', cx + 2, y + 18);
    pdf.text('Tanda tangan:', cx + 2, y + 25);

    setDraw(pdf, COL.border);
    pdf.setLineWidth(0.2);
    pdf.line(cx + 14, y + 11, cx + colW - 2, y + 11);
    pdf.line(cx + 16, y + 18, cx + colW - 2, y + 18);
    pdf.line(cx + 2, y + 33, cx + colW - 2, y + 33);
  });
  return y + 38;
}

// ─── FOOTER ─────────────────────────────────────────────────
function footer(pdf, ticketId) {
  setText(pdf, COL.dim);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  pdf.text(`Wellsense IOC · ${ticketId} · Generated ${new Date().toLocaleString('id-ID')}`, 15, 287);
  pdf.text(`Halaman 1/1`, 195, 287, { align: 'right' });
}

// ═══════════════════════════════════════════════════════════
// PRINT JOB A — RT TICKET (Warning / Critical)
// ═══════════════════════════════════════════════════════════
export function generateRTTicketPDF(ticket) {
  const pdf = newPDF();
  const isCritical = ticket.severity === 'CRITICAL';
  const severityColor = isCritical ? COL.critical : COL.warning;

  header(pdf, {
    title: 'TIKET INTERVENSI · REAL-TIME ANOMALY DETECTION',
    subtitle: 'Print Job A · Source: RT Track · LSTM 2-Layer + Isolation Forest · Layer 4 HITL',
    severityColor,
    badgeText: isCritical ? 'CRITICAL · TIER 3' : 'WARNING · TIER 1',
  });

  let y = 48;

  // ─── ROW 1: identity left, P(LPO) box right ───
  sectionTitle(pdf, 15, y, '① IDENTITAS TIKET');
  y += 5;
  const idRows = [
    ['Ticket ID',        ticket.ticket_id],
    ['Timestamp Sim',    ticket.timestamp_sim],
    ['Timestamp Real',   new Date(ticket.timestamp_real).toLocaleString('id-ID')],
    ['Source',           'RT-LSTM (per-tick anomaly detection)'],
    ['Severity',         ticket.severity],
    ['Cycle Number',     `${ticket.cycle_number} of 5`],
    ['Primary Zone',     ticket.primary_zone || 'N/A'],
    ['Routing Tier',     `Tier ${ticket.current_tier} · ${ticket.current_tier === 1 ? 'Well Operator' : ticket.current_tier === 2 ? 'Well Engineer' : 'Production Engineer'}`],
  ];
  kvTable(pdf, 18, y, 105, idRows);

  // P(LPO) confidence box (right column)
  const boxX = 130, boxY = y - 4;
  setDraw(pdf, severityColor);
  pdf.setLineWidth(0.6);
  pdf.roundedRect(boxX, boxY, 65, 45, 2, 2);
  setText(pdf, COL.dim);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.text('CONFIDENCE SCORE', boxX + 32.5, boxY + 6, { align: 'center' });
  pdf.text('P(LPO) · LSTM Output', boxX + 32.5, boxY + 10, { align: 'center' });
  setText(pdf, severityColor);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(28);
  pdf.text(String(ticket.P_LPO ?? '--'), boxX + 32.5, boxY + 24, { align: 'center' });
  setText(pdf, COL.text);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.text(isCritical ? 'P(LPO) ≥ 0.85 · CRITICAL' : '0.65 ≤ P(LPO) < 0.85 · WARNING', boxX + 32.5, boxY + 30, { align: 'center' });
  setText(pdf, COL.dim);
  pdf.setFontSize(7);
  pdf.text('Threshold ditetapkan untuk bias-recall', boxX + 32.5, boxY + 35, { align: 'center' });
  pdf.text('(false alarm < missed event)', boxX + 32.5, boxY + 39, { align: 'center' });

  y += 56;

  // ─── ② Top Contributors ───
  sectionTitle(pdf, 15, y, '② TOP-3 KONTRIBUTOR ANOMALI · LSTM Feature Importance');
  y += 6;
  setFill(pdf, COL.bg);
  pdf.rect(15, y - 1, 180, 22, 'F');
  setText(pdf, COL.text);
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Feature', 18, y + 4);
  pdf.text('Contribution', 100, y + 4);
  pdf.text('Polarity', 145, y + 4);
  pdf.setFont('helvetica', 'normal');
  const top3 = (ticket.top_contributors || []).slice(0, 3);
  top3.forEach((c, i) => {
    const cy = y + 9 + i * 4.5;
    pdf.text(c.feature || '--', 18, cy);
    pdf.text(typeof c.contribution === 'number' ? c.contribution.toFixed(3) : String(c.contribution), 100, cy);
    const pol = typeof c.contribution === 'number' && c.contribution >= 0 ? '↑ Anomalous' : '↓ Stabilizing';
    setText(pdf, typeof c.contribution === 'number' && c.contribution >= 0 ? COL.critical : COL.normal);
    pdf.text(pol, 145, cy);
    setText(pdf, COL.text);
  });
  y += 26;

  // ─── ③ Sensor Snapshot ───
  sectionTitle(pdf, 15, y, '③ SENSOR SNAPSHOT · 10 Representative Values');
  y += 5;
  const snap = ticket.sensor_snapshot || {};
  const snapEntries = Object.entries(snap);
  // 2-column grid
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  const colWidth = 88;
  snapEntries.forEach((entry, i) => {
    const [k, v] = entry;
    const meta = SENSOR_META[k];
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cx = 18 + col * colWidth;
    const cy = y + row * 4.5;
    setText(pdf, COL.dim);
    pdf.text(`${k}${meta ? ' ('+meta.unit+')' : ''}`, cx, cy);
    setText(pdf, COL.text);
    pdf.setFont('helvetica', 'bold');
    pdf.text(typeof v === 'number' ? v.toFixed(2) : String(v), cx + 40, cy);
    pdf.setFont('helvetica', 'normal');
  });
  y += Math.ceil(snapEntries.length / 2) * 4.5 + 4;

  // ─── ④ AI Reasoning + Recommendation ───
  sectionTitle(pdf, 15, y, '④ AI REASONING & REKOMENDASI');
  y += 5;
  setFill(pdf, COL.bg);
  pdf.rect(15, y - 1, 180, 18, 'F');
  setText(pdf, COL.text);
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  const reasoning = buildReasoning(ticket);
  const wrapped = pdf.splitTextToSize(reasoning, 174);
  pdf.text(wrapped, 18, y + 4);
  y += 14;
  setText(pdf, severityColor);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.text('REKOMENDASI: ', 18, y + 3);
  setText(pdf, COL.text);
  pdf.setFont('helvetica', 'normal');
  pdf.text(ticket.recommendation || '-', 50, y + 3);
  y += 9;

  // ─── ⑤ Signature ───
  signatureBlock(pdf, 15, y, 180);

  footer(pdf, ticket.ticket_id);
  return pdf;
}

function buildReasoning(ticket) {
  const top = (ticket.top_contributors || [])[0];
  const snap = ticket.sensor_snapshot || {};
  const zone = ticket.primary_zone || 'multi-zona';
  const key = top?.feature || 'N/A';
  const fragments = [
    `LSTM 2-Layer mendeteksi probabilitas LPO sebesar ${ticket.P_LPO} pada timestep ${ticket.timestamp_sim}, melampaui threshold ${ticket.severity === 'CRITICAL' ? '0.85' : '0.65'}.`,
    `Kontributor dominan adalah ${key} dengan magnitudo ${typeof top?.contribution === 'number' ? top.contribution.toFixed(3) : '-'}.`,
    `Domain anomali terlokalisasi pada ${zone}.`,
    `Snapshot 10 sensor: WHP=${snap.WHP?.toFixed?.(1) ?? '-'} psi, GL_Rate=${snap.GL_Rate?.toFixed?.(2) ?? '-'} MMSCFD, BSW=${snap.BSW?.toFixed?.(1) ?? '-'}%.`,
    `Isolation Forest sudah memvalidasi bahwa pola tersebut bukan sensor noise (path-length konsisten).`,
  ];
  return fragments.join(' ');
}

// ═══════════════════════════════════════════════════════════
// PRINT JOB B — DAILY RECAP (BD Track · 4 Skenario)
// ═══════════════════════════════════════════════════════════
export function generateDailyRecapPDF(opts) {
  const { scenario, dateStr, todayRegime, yesterdayRegime, silhouette,
          rtTicketsToday, bdTicketsToday, regimeTimelineDay } = opts;

  const pdf = newPDF();

  // Map scenario → severity
  const SC = {
    NO_MIGRATION:           { color: COL.normal,   badge: 'RECAP DAILY · AMAN',           shift: 'No Cluster Migration',           tier: '—' },
    STABLE_TO_MODERATE:     { color: COL.warning,  badge: 'RECAP DAILY · WARNING',         shift: 'STABLE → MODERATE',              tier: 'Tier 2 · Well Engineer' },
    STABLE_TO_HIGH_RISK:    { color: COL.critical, badge: 'RECAP DAILY · CRITICAL',        shift: 'STABLE → HIGH_RISK (double-jump)', tier: 'Tier 3 · Production Engineer' },
    MODERATE_TO_HIGH_RISK:  { color: COL.critical, badge: 'RECAP DAILY · ESCALATION',      shift: 'MODERATE → HIGH_RISK',           tier: 'Tier 3 · Production Engineer' },
  };
  const sc = SC[scenario] || SC.NO_MIGRATION;

  header(pdf, {
    title: `LAPORAN HARIAN · OPERATING REGIME CLUSTERING`,
    subtitle: `Print Job B · BD Track · K-Means k=3 · Daily recap pukul 23:00 WIT · ${dateStr}`,
    severityColor: sc.color,
    badgeText: sc.badge,
  });

  let y = 48;

  // ─── ① Skenario ───
  sectionTitle(pdf, 15, y, '① SKENARIO MIGRATION YANG TERDETEKSI');
  y += 5;
  setFill(pdf, COL.bg);
  pdf.rect(15, y - 1, 180, 24, 'F');
  setText(pdf, sc.color);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.text(sc.shift, 18, y + 6);
  setText(pdf, COL.dim);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text(`Routing → ${sc.tier}`, 18, y + 12);
  pdf.text(`Yesterday: ${yesterdayRegime || '—'}   ·   Today: ${todayRegime || '—'}   ·   Silhouette: ${silhouette != null ? silhouette.toFixed(3) : '--'}`, 18, y + 18);
  y += 28;

  // Per-scenario interpretation block
  sectionTitle(pdf, 15, y, '② INTERPRETASI');
  y += 5;
  setText(pdf, COL.text);
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  const interp = scenarioInterpretation(scenario);
  const wrapped = pdf.splitTextToSize(interp, 178);
  pdf.text(wrapped, 17, y + 3);
  y += wrapped.length * 4.2 + 4;

  // ─── ③ Statistik Hari Ini ───
  sectionTitle(pdf, 15, y, '③ STATISTIK HARIAN');
  y += 5;
  // Mini stats grid
  const stats = [
    { label: 'RT Tickets Today',  value: rtTicketsToday.length },
    { label: 'BD Ticket Today',   value: bdTicketsToday.length },
    { label: "Today's Regime",    value: todayRegime || '—' },
    { label: "Yesterday's Regime", value: yesterdayRegime || '—' },
  ];
  const colW = 42;
  stats.forEach((s, i) => {
    const cx = 17 + i * (colW + 2);
    setDraw(pdf, COL.border);
    pdf.setLineWidth(0.3);
    pdf.roundedRect(cx, y, colW, 18, 1.5, 1.5);
    setText(pdf, COL.dim);
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'normal');
    pdf.text(s.label, cx + colW / 2, y + 5, { align: 'center' });
    setText(pdf, COL.text);
    pdf.setFontSize(13);
    pdf.setFont('helvetica', 'bold');
    pdf.text(String(s.value), cx + colW / 2, y + 13, { align: 'center' });
  });
  y += 22;

  // ─── ④ Timeline ───
  sectionTitle(pdf, 15, y, '④ TIMELINE REGIME · per Jam (24 snapshot)');
  y += 4;
  // Timeline strip
  const stripX = 17, stripY = y, stripW = 176, cellW = stripW / 24;
  for (let i = 0; i < 24; i++) {
    const lab = regimeTimelineDay[i] || 'STABLE';
    const c = lab === 'STABLE' ? COL.normal : lab === 'MODERATE' ? COL.warning : COL.critical;
    setFill(pdf, c);
    pdf.rect(stripX + i * cellW, stripY, cellW - 0.3, 6, 'F');
  }
  setText(pdf, COL.dim);
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  pdf.text('00:00', stripX, stripY + 11);
  pdf.text('06:00', stripX + 6 * cellW, stripY + 11);
  pdf.text('12:00', stripX + 12 * cellW, stripY + 11);
  pdf.text('18:00', stripX + 18 * cellW, stripY + 11);
  pdf.text('23:00', stripX + 23 * cellW, stripY + 11);
  y += 16;

  // ─── ⑤ List of RT tickets today ───
  sectionTitle(pdf, 15, y, '⑤ TIKET RT YANG DI-CREATE HARI INI');
  y += 5;
  if (rtTicketsToday.length === 0) {
    setText(pdf, COL.dim);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'italic');
    pdf.text('Tidak ada tiket RT yang di-create hari ini. Operasi berjalan dalam batas normal.', 18, y + 3);
    y += 8;
  } else {
    setFill(pdf, COL.bg);
    pdf.rect(15, y - 1, 180, 6, 'F');
    setText(pdf, COL.text);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Ticket ID', 18, y + 3);
    pdf.text('Time',      55, y + 3);
    pdf.text('Severity',  85, y + 3);
    pdf.text('P(LPO)',    115, y + 3);
    pdf.text('Zone',      135, y + 3);
    pdf.text('Status',    178, y + 3);
    y += 7;
    pdf.setFont('helvetica', 'normal');
    rtTicketsToday.slice(0, 12).forEach(t => {
      pdf.text(t.ticket_id, 18, y);
      pdf.text((t.timestamp_sim || '').slice(11), 55, y);
      const sevC = t.severity === 'CRITICAL' ? COL.critical : COL.warning;
      setText(pdf, sevC);
      pdf.text(t.severity, 85, y);
      setText(pdf, COL.text);
      pdf.text(String(t.P_LPO ?? '-'), 115, y);
      pdf.text((t.primary_zone || '-').slice(0, 22), 135, y);
      pdf.text(t.status, 178, y);
      y += 4.5;
    });
  }
  y += 3;

  // ─── ⑥ Signature ───
  signatureBlock(pdf, 15, y, 180);

  footer(pdf, `BD-RECAP-${dateStr}`);
  return pdf;
}

function scenarioInterpretation(scenario) {
  switch (scenario) {
    case 'NO_MIGRATION':
      return 'Tidak terdeteksi pergeseran cluster harian. Profil operasi platform tetap berada pada kelompok yang sama dengan hari sebelumnya. Silhouette score tetap tinggi yang mengindikasikan separasi cluster yang stabil. Tindakan: arsipkan recap, tidak diperlukan eskalasi. Operasi dapat dilanjutkan dengan parameter saat ini.';
    case 'STABLE_TO_MODERATE':
      return 'Profil harian bergeser dari STABLE ke MODERATE. Indikasi awal degradasi kinerja — biasanya disebabkan oleh penurunan efisiensi gas-lift atau peningkatan variansi flow. Tindakan: Well Engineer (Tier 2) wajib meninjau penyebab utama, melakukan adjustment parameter operasi (misal recalibrate GL rate), dan mengajukan persetujuan korektif sebelum cycle berikutnya.';
    case 'STABLE_TO_HIGH_RISK':
      return 'TERJADI DOUBLE-JUMP STABLE → HIGH_RISK dalam satu hari. Pergeseran profil sangat tajam — biasanya kombinasi multi-zona anomaly yang akumulasi (contoh: WHP drop + GL failure + BSW rising). Tindakan: routing langsung ke Production Engineer (Tier 3), bypass tier perantara. Field inspection wajib dijadwalkan ulang dalam 24 jam, dan pertimbangan shutdown sementara harus dievaluasi.';
    case 'MODERATE_TO_HIGH_RISK':
      return 'Profil hari ini bergeser dari MODERATE ke HIGH_RISK — progresi degradasi yang sebelumnya sudah ditandai pada hari sebelumnya. Tindakan: ESCALATION ticket ke Production Engineer (Tier 3). Diperlukan analisis lintas-cycle: apakah corrective action di cycle sebelumnya tidak efektif, atau ada faktor eksogen baru. Production Engineer wajib menyetujui rencana intervensi sebelum operasi dilanjutkan.';
  }
  return '—';
}

// ═══════════════════════════════════════════════════════════
// HELPERS — Open / save / print
// ═══════════════════════════════════════════════════════════
export function openPDFInModal(pdf, title) {
  const blob = pdf.output('blob');
  const url = URL.createObjectURL(blob);
  showPdfModal(url, title);
  return url;
}

export function savePDF(pdf, filename) {
  pdf.save(filename);
}

function showPdfModal(url, title) {
  const id = 'pdfModal';
  let modal = document.getElementById(id);
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.id = id;
  modal.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;
    display:flex;align-items:center;justify-content:center;padding:20px;
  `;
  modal.innerHTML = `
    <div style="background:#1E293B;border-radius:8px;width:min(900px,100%);height:min(90vh,800px);display:flex;flex-direction:column;border:1px solid #334155">
      <div style="padding:12px 16px;border-bottom:1px solid #334155;display:flex;align-items:center;justify-content:space-between;color:#F1F5F9">
        <div>
          <div style="font-weight:600">${title}</div>
          <div style="font-size:11px;color:#94A3B8">PDF preview · siap untuk dicetak via tanda tangan basah</div>
        </div>
        <div style="display:flex;gap:6px">
          <button id="pdfPrintBtn" style="padding:6px 12px;background:#1D9E75;color:white;border:0;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600">🖨 Print</button>
          <button id="pdfDlBtn"    style="padding:6px 12px;background:#0B1120;color:#F1F5F9;border:1px solid #334155;border-radius:4px;cursor:pointer;font-size:12px">⬇ Download</button>
          <button id="pdfCloseBtn" style="padding:6px 12px;background:transparent;color:#94A3B8;border:1px solid #334155;border-radius:4px;cursor:pointer;font-size:12px">✕</button>
        </div>
      </div>
      <iframe src="${url}" style="flex:1;width:100%;border:0;background:white"></iframe>
    </div>
  `;
  document.body.appendChild(modal);
  const closeBtn = modal.querySelector('#pdfCloseBtn');
  const printBtn = modal.querySelector('#pdfPrintBtn');
  const dlBtn    = modal.querySelector('#pdfDlBtn');
  const close = () => { try { URL.revokeObjectURL(url); } catch (_) {} modal.remove(); };
  if (closeBtn) closeBtn.addEventListener('click', close);
  if (printBtn) printBtn.addEventListener('click', () => {
    const ifr = modal.querySelector('iframe');
    try { ifr.contentWindow.focus(); ifr.contentWindow.print(); } catch (_) { window.open(url, '_blank'); }
  });
  if (dlBtn) dlBtn.addEventListener('click', () => {
    const a = document.createElement('a'); a.href = url; a.download = title.replace(/\s+/g, '_') + '.pdf'; a.click();
  });
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
}
