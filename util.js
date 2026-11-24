export const uid = () => Math.random().toString(36).slice(2, 10);

export const money = (n) => '$' + Math.round(n || 0).toLocaleString('en-US');

export const parseMoney = (s) => {
  const n = parseFloat(String(s).replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : null;
};

export const fmtMin = (m) => {
  m = Math.max(0, Math.round(m || 0));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
};

export const fmtClock = (min) => {
  const h = Math.floor(min / 60) % 24, m = min % 60;
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ap}`;
};

export const sum = (arr) => arr.reduce((a, b) => a + (b || 0), 0);
