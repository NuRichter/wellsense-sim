// utils/timeFormatter.js
export const fmtUptime = (ms) => {
  const s = Math.floor(ms / 1000);
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
};

export const tickToSimTime = (tick, dateStr) => {
  // 144 ticks per hari, 10-min resolution
  const t = tick % 144;
  const hh = String(Math.floor(t / 6)).padStart(2, '0');
  const mm = String((t % 6) * 10).padStart(2, '0');
  return `${dateStr} ${hh}:${mm}`;
};

export const fmtNow = () => new Date().toLocaleString('en-GB', { hour12: false });
