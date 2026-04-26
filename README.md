# Wellsense IOC Simulation · v4 (revisi-2)

Simulasi interaktif platform Wellsense untuk seleksi wawancara **IOC Digital Hackathon AI/ML Hulu Migas 2026** — single-page application yang memodelkan alur kerja end-to-end dari 10 sensor stream → preprocessing → dual-track AI/ML → HITL decision framework dengan auto-print PDF tiket fisik.

## Quick Start

ES Modules — **wajib via static server**, bukan `file://`.

```bash
cd wellsense-sim
python3 -m http.server 8000
# buka http://localhost:8000
```

Atau deploy langsung ke Vercel — `vercel.json` sudah disertakan (zero build).

## Yang Baru di Revisi-2

### 1 · Auto-Print PDF untuk RT Tickets (Print Job A)

Setiap kali RT Track mendeteksi anomali yang melampaui threshold, sistem otomatis membuka modal preview PDF **Tiket Intervensi** dengan tombol Print + Download. Operator dapat langsung mencetak fisik untuk tanda tangan basah berjenjang.

| Severity | Threshold | Routing | Template Header |
|----------|-----------|---------|-----------------|
| **CRITICAL** | P(LPO) ≥ 0.85 | Tier 3 · Production Engineer | Merah · template threshold critical realtime |
| **WARNING**  | 0.65 ≤ P(LPO) < 0.85 | Tier 1 · Well Operator | Oranye · template threshold warning realtime |

Isi tiap PDF terdiri dari 5 section: **(①)** Identitas tiket + box besar P(LPO) confidence, **(②)** Top-3 kontributor anomali dari LSTM feature importance, **(③)** Sensor snapshot 10 representative values, **(④)** AI reasoning naratif + rekomendasi tindakan, **(⑤)** Signature block 3-tier RBAC untuk tanda tangan basah.

### 2 · Daily Recap PDF untuk BD Track (Print Job B)

Pada tick 138 setiap hari simulasi (= **23:00 WIT**), sistem otomatis mencetak laporan harian Operating Regime Clustering. Empat skenario di-handle dengan template berbeda:

| Skenario | Migrasi | Severity | Routing |
|----------|---------|----------|---------|
| **NO_MIGRATION** | Tidak ada pergeseran | NORMAL | Arsip rutin |
| **STABLE → MODERATE** | Shift Safe → Warning | WARNING | Tier 2 · Well Engineer |
| **STABLE → HIGH_RISK** | Shift Safe → Critical (double-jump) | CRITICAL | Tier 3 · Production Engineer |
| **MODERATE → HIGH_RISK** | Progresi Caution → Critical | ESCALATION | Tier 3 · Production Engineer |

Isi PDF Daily Recap: **(①)** Skenario migrasi, **(②)** Interpretasi naratif spesifik per skenario, **(③)** Statistik harian (jumlah tiket RT, BD, regime today/yesterday), **(④)** Timeline strip 24-jam berwarna sesuai regime per jam, **(⑤)** Daftar tiket RT yang di-create hari itu, **(⑥)** Signature block 3-tier.

Tombol manual **📄 Force Daily Recap** tersedia di Scenario Panel untuk demo segera tanpa menunggu tick 138.

### 3 · Single-Page Application — Simulasi Tidak Pernah Restart

Sebelumnya tiap halaman adalah `.html` terpisah sehingga tiap pindah halaman engine harus bootstrap ulang. Sekarang aplikasi adalah SPA murni dengan hash-based router:

- `#dashboard` · `#regime` · `#tickets` · `#audit` · `#pipeline`
- Engine bootstrap **sekali** pada page load (auto-start)
- Router melakukan view swap dengan `AbortController`-based scope teardown — listener dibatalkan, Chart.js instances di-destroy, tapi state simulasi tetap utuh
- Navbar & Status Bar adalah persistent shell — tidak ikut unmount
- Tick counter terus berjalan saat operator pindah-pindah halaman

## Arsitektur

```
L1  → 10 CSV sensor stream paralel (Mahakam baseline)
L2  → 10 representative + 28 features + SMOTE adaptive + Sequence (24×28)
L3a → Isolation Forest (20 trees) → LSTM 2-Layer → P(LPO) per tick
L3b → K-Means k=3 (Lloyd + K-Means++ + Silhouette) → STABLE / MODERATE / HIGH_RISK
L4  → 3-Tier RBAC + 5-Cycle + Audit Trail + Auto-Print PDF
```

## Halaman (SPA Routes)

- **#dashboard** — Pipeline stage indicator, sensor zone grid, sensor detail panel, scenario injection
- **#regime** — K-Means scatter, hourly timeline strip, migration log
- **#tickets** — Antrian tiket dengan tombol re-print PDF
- **#audit** — Rekam jejak keputusan (persistent localStorage)
- **#pipeline** — Visualisasi 5-Layer architecture live

## Switching Hari Simulasi

Edit `src/store/simulationStore.js` field `state.activeDate`:
- `'2026-04-27'` (default) — Hari 1
- `'2026-04-28'` — Hari 2 (severity ×1.15)

## Scenario Injection

**Auto-schedule** (otomatis saat tick mencapai):
- 30 — WHP drop (Zona 1)
- 60 — GL failure (Zona 3)
- 90 — Multi-zone boost
- 120 — BSW rising (Zona 4)
- **138 — 📄 Daily Recap PDF (23:00 WIT)**
- 150 — Force K-Means
- 180 — Choke oscillation (Zona 2)

**Manual mode** — tombol di Scenario Panel: 💥 WHP Drop · ⚠️ GL Failure · 🔴 Multi-Zone Alert · **📄 Force Daily Recap** · 🔁 Reset All.

## Tech Stack — Zero Build

- HTML5 + ES Modules native browser
- Tailwind CSS via Play CDN
- Chart.js, PapaParse, jsPDF via cdnjs.cloudflare.com (jsdelivr fallback)
- localStorage untuk audit trail
- No npm, no build step

## Data

20 CSV pre-generated di `data/<date>/sensor_<id>_<date>.csv` (144 rows = 10-min resolution × 24 jam). Anomali sudah ter-embed sesuai tabel skenario di prompt v4.

## Demo Flow Recommendation

1. Buka `http://localhost:8000` — engine auto-start, dashboard menampilkan pipeline mengalir
2. Tunggu hingga tick ~30 — WHP drop tercetus, alert banner muncul, **modal PDF tiket WARNING terbuka otomatis** (severity oranye)
3. Klik "Print" pada modal untuk demo cetak fisik
4. Tutup modal, lanjutkan ke `#regime` — simulasi tidak berhenti, K-Means scatter sudah populate
5. Tunggu tick ~90 — multi-zone boost, modal PDF tiket CRITICAL terbuka (severity merah)
6. Klik **📄 Force Daily Recap** di scenario panel — modal PDF Recap Harian terbuka dengan skenario sesuai migrasi yang sudah terjadi
7. Lanjutkan ke `#tickets` untuk approval flow 3-tier (ganti role di navbar untuk pindah tier)
8. Cek `#audit` untuk rekam jejak persistent
