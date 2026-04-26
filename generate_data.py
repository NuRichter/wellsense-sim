"""
Pre-generate 20 CSV files (10 sensor instruments × 2 days) for Wellsense simulation.
Resolution: 10 minutes, 144 rows per file (1 day × 24 hours × 6 intervals).
"""
import csv
import math
import random
import os
from datetime import datetime, timedelta

random.seed(42)

DATES = ['2026-04-27', '2026-04-28']
ROWS = 144  # 24 * 6 (resolusi 10 menit)
INTERVAL_MIN = 10

def gauss(mu, sigma):
    return random.gauss(mu, sigma)

def diurnal(row, period=ROWS, amp=1.0, phase=0):
    return amp * math.sin(2 * math.pi * (row + phase) / period)

def gen_timestamps(date_str):
    base = datetime.strptime(date_str + ' 00:00', '%Y-%m-%d %H:%M')
    out = []
    for i in range(ROWS):
        t = base + timedelta(minutes=i * INTERVAL_MIN)
        out.append((t.strftime('%Y-%m-%d %H:%M'), int(t.timestamp() * 1000)))
    return out

def write_csv(date, name, header, rows):
    folder = f'data/{date}'
    os.makedirs(folder, exist_ok=True)
    path = f'{folder}/sensor_{name}_{date}.csv'
    with open(path, 'w', newline='') as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)
    return path

def gen_day(date_str, day_idx):
    ts = gen_timestamps(date_str)
    # baseline drift hari 2 sedikit lebih tinggi anomalinya
    sev = 1.0 + 0.15 * day_idx

    # ─── 1. WHP ────────────────────────────────────
    rows = []
    for i, (t_str, t_unix) in enumerate(ts):
        base = 1275 + diurnal(i, amp=18) + gauss(0, 6)
        # Anomali: drop 15% di row 40-58
        if 40 <= i <= 58:
            base *= (1 - 0.15 * sev) + gauss(0, 0.01)
        p_wh = round(base, 2)
        # 4-20 mA: P range 0-2000 psi
        i_raw = round(4 + (p_wh / 2000) * 16, 3)
        rows.append([t_str, p_wh, i_raw, t_unix])
    write_csv(date_str, 'WHP', ['timestamp', 'P_wh', 'I_raw', 'timestamp_unix'], rows)

    # ─── 2. WHT ────────────────────────────────────
    rows = []
    for i, (t_str, _) in enumerate(ts):
        base = 74.5 + diurnal(i, amp=1.5) + gauss(0, 0.4)
        # Spike +8°C di row 60-78
        if 60 <= i <= 78:
            base += 8 * sev + gauss(0, 0.3)
        t_p = round(base, 2)
        t_b = round(base + gauss(0, 0.15), 2)
        # PT100: R = 100 * (1 + 0.00385 * T)
        r1 = round(100 * (1 + 0.00385 * t_p), 2)
        r2 = round(100 * (1 + 0.00385 * t_b), 2)
        rows.append([t_str, t_p, t_b, r1, r2])
    write_csv(date_str, 'WHT', ['timestamp', 'T_primary', 'T_backup', 'R_meas_1', 'R_meas_2'], rows)

    # ─── 3. FTHP ───────────────────────────────────
    rows = []
    for i, (t_str, _) in enumerate(ts):
        base = 1190 + diurnal(i, amp=10) + gauss(0, 5)
        # Gradual decline mulai row 20
        if i >= 20:
            base -= (i - 20) * 0.6 * sev
        rows.append([t_str, round(base, 2)])
    write_csv(date_str, 'FTHP', ['timestamp', 'P_fthp'], rows)

    # ─── 4. Annular ────────────────────────────────
    rows = []
    for i, (t_str, _) in enumerate(ts):
        base = 415 + diurnal(i, amp=4) + gauss(0, 2)
        # Drift +20 psi mulai row 80
        if i >= 80:
            base += min(20 * sev, (i - 80) * 0.4)
        masp = 1800.0
        rows.append([t_str, round(base, 2), masp])
    write_csv(date_str, 'Annular', ['timestamp', 'P_ann', 'masp'], rows)

    # ─── 5. FlowRate ───────────────────────────────
    rows = []
    for i, (t_str, _) in enumerate(ts):
        vol = 18500 + diurnal(i, amp=400) + gauss(0, 80)
        rho = 870 + gauss(0, 1.2)
        mass = vol * rho * 0.158987 / 24  # BPD → kg/h approx
        t_co = 74 + diurnal(i, amp=1.2) + gauss(0, 0.3)
        ph = 0.0042 + gauss(0, 0.0001)
        # phase_shift naik 3× mulai row 50
        if i >= 50:
            ph *= (1 + 2 * sev * min(1, (i - 50) / 30))
        rows.append([t_str, round(mass, 1), int(vol), round(rho, 2), round(t_co, 2), round(ph, 6)])
    write_csv(date_str, 'FlowRate',
              ['timestamp', 'mass_flow_rate', 'vol_flow_rate', 'density_fluid', 'T_coriolis', 'phase_shift'],
              rows)

    # ─── 6. Choke ──────────────────────────────────
    rows = []
    for i, (t_str, _) in enumerate(ts):
        sp = 47.5 + diurnal(i, amp=1.5)
        actual = sp + gauss(0, 0.4)
        # Osilasi ±6% mulai row 10
        if i >= 10:
            actual += 6 * sev * math.sin(i * 0.9)
        drive = 4 + (sp / 100) * 16 + gauss(0, 0.05)
        rows.append([t_str, round(actual, 2), round(sp, 2), round(drive, 2)])
    write_csv(date_str, 'Choke', ['timestamp', 'mpos_actual', 'pos_setpoint', 'drive_signal'], rows)

    # ─── 7. GL_Rate ────────────────────────────────
    rows = []
    for i, (t_str, _) in enumerate(ts):
        vol_g = 2.1 + diurnal(i, amp=0.08) + gauss(0, 0.025)
        # Drop 40% mulai row 30
        if i >= 30:
            vol_g *= (1 - 0.4 * sev * min(1, (i - 30) / 20))
        rho_g = 41.5 + gauss(0, 0.4)
        mass_g = vol_g * rho_g * 1180  # MMSCFD → kg/h approx (rough scale)
        t_inj = 67 + diurnal(i, amp=0.8) + gauss(0, 0.25)
        rows.append([t_str, round(mass_g, 1), round(vol_g, 4), round(rho_g, 2), round(t_inj, 2)])
    write_csv(date_str, 'GL_Rate',
              ['timestamp', 'mass_flow_gas', 'vol_flow_gas', 'density_gas', 'T_injection'],
              rows)

    # ─── 8. GL_Press ───────────────────────────────
    rows = []
    for i, (t_str, _) in enumerate(ts):
        p = 1465 + diurnal(i, amp=25) + gauss(0, 8)
        # Sudden drop -200 psi di row 100
        if 100 <= i <= 105:
            p -= 200 * sev
        rows.append([t_str, round(p, 2)])
    write_csv(date_str, 'GL_Press', ['timestamp', 'P_inject'], rows)

    # ─── 9. GOR ────────────────────────────────────
    rows = []
    for i, (t_str, _) in enumerate(ts):
        gor = 880 + diurnal(i, amp=15) + gauss(0, 8)
        # Naik 850→1400 mulai row 80
        if i >= 80:
            gor += min(550 * sev, (i - 80) * 9)
        q_oil = 17900 + gauss(0, 50)
        q_gas = round((gor * q_oil) / 1e6, 4)
        q_water = 2400 + gauss(0, 30)
        rows.append([t_str, round(gor, 1), int(q_oil), q_gas, int(q_water)])
    write_csv(date_str, 'GOR', ['timestamp', 'GOR', 'Q_oil', 'Q_gas', 'Q_water'], rows)

    # ─── 10. BSW ───────────────────────────────────
    rows = []
    for i, (t_str, _) in enumerate(ts):
        bsw = 12 + gauss(0, 0.2)
        # Naik 12% → 35% mulai row 20
        if i >= 20:
            bsw += min(23 * sev, (i - 20) * 0.18)
        f_res = 2.93 + gauss(0, 0.01) - bsw * 0.001
        rows.append([t_str, round(bsw, 3), round(bsw, 3), round(f_res, 4)])
    write_csv(date_str, 'BSW', ['timestamp', 'BSW_pct', 'watercut_raw', 'f_resonance'], rows)


for idx, date in enumerate(DATES):
    gen_day(date, idx)
    print(f'✓ Generated {date}')

print('All CSV generated.')
