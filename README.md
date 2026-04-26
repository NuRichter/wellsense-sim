# Wellsense IOC Simulation · v4

Simulasi interaktif platform Wellsense untuk seleksi wawancara **IOC Digital Hackathon AI/ML Hulu Migas 2026**. Mendemonstrasikan alur kerja end-to-end dari 10 sensor stream → preprocessing → dual-track AI/ML → HITL decision framework.

## Quick Start

Karena project ini menggunakan ES Modules, **harus dijalankan via static server**, bukan `file://`.

```bash
cd wellsense-sim
python3 -m http.server 8000
# buka http://localhost:8000
```

Atau deploy langsung ke Vercel — `vercel.json` sudah disertakan (zero build).

## Halaman

- `index.html` — Dashboard IOC: pipeline stage indicator, sensor zone grid, sensor detail panel, scenario injection
- `portfolio.html` — Operating Regime Clustering (BD Track scatter + timeline + migration log)
- `tickets.html` — Antrian tiket intervensi dengan 3-Tier RBAC
- `audit.html` — Rekam jejak keputusan (persistent localStorage)
- `pipeline.html` — Visualisasi 5-Layer architecture

## Arsitektur

```
L1  → 10 CSV sensor stream paralel (Mahakam baseline)
L2  → 10 representative values + 28 features + SMOTE + Sequence Format (24×28)
L3a → Isolation Forest (20 trees) → LSTM 2-Layer → P(LPO)
L3b → K-Means k=3 (Lloyd's + K-Means++ + Silhouette) → Operating Regime
L4  → 3-Tier RBAC + 5-Cycle + Audit Trail
```

## Switching Hari Simulasi

Edit `src/store/simulationStore.js` field `state.activeDate`:
- `'2026-04-27'` (default) — Hari 1
- `'2026-04-28'` — Hari 2 (anomali sedikit lebih severe untuk variasi)

## Scenario Injection

**Auto schedule** (otomatis saat tick mencapai):
- Tick 30 — WHP drop (Zona 1)
- Tick 60 — GL failure (Zona 3)
- Tick 90 — Multi-zone boost
- Tick 120 — BSW rising (Zona 4)
- Tick 150 — Force K-Means
- Tick 180 — Choke oscillation (Zona 2)

**Manual mode** — tombol di Scenario Panel di bawah dashboard.

## Tech Stack — Zero Build

- HTML5 + ES Modules native browser
- Tailwind CSS via Play CDN
- Chart.js, PapaParse, Lucide via CDN
- localStorage untuk audit trail
- No npm, no build step

## Data

20 CSV pre-generated di `data/<date>/sensor_<id>_<date>.csv` (144 rows = 10-min resolution × 24 jam). Anomali sudah ter-embed sesuai tabel skenario di prompt v4.
