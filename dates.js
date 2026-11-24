// All "days" are America/Phoenix (UTC-7, no daylight saving), midnight to midnight.
// Dates are passed around as 'YYYY-MM-DD' strings.
const TZ = 'America/Phoenix';
const partsFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

// --- Testing: simulate another date/time with ?date=2026-11-24&time=09:00 (or from Settings) ---
const SIM_KEY = 'dd-sim';
function readSim() {
  try {
    const p = new URLSearchParams(location.search);
    if (p.has('date') || p.has('time')) {
      history.replaceState(null, '', location.pathname + location.hash);
      if (p.get('date') === 'clear') { sessionStorage.removeItem(SIM_KEY); return {}; }
      const o = {};
      if (p.get('date')) o.date = p.get('date');
      if (p.get('time')) o.time = p.get('time');
      sessionStorage.setItem(SIM_KEY, JSON.stringify(o));
      return o;
    }
    return JSON.parse(sessionStorage.getItem(SIM_KEY) || '{}');
  } catch { return {}; }
}
let sim = readSim();
export const getSim = () => sim;
export function setSim(o) {
  sim = o && (o.date || o.time) ? o : {};
  try {
    if (sim.date || sim.time) sessionStorage.setItem(SIM_KEY, JSON.stringify(sim));
    else sessionStorage.removeItem(SIM_KEY);
  } catch {}
  window.dispatchEvent(new Event('dd-clock'));
}

export function nowPhoenix() {
  const p = {};
  for (const x of partsFmt.formatToParts(new Date())) p[x.type] = x.value;
  let date = `${p.year}-${p.month}-${p.day}`;
  let minutes = (+p.hour % 24) * 60 + +p.minute;
  if (sim.date) date = sim.date;
  if (sim.time) { const [h, m] = sim.time.split(':').map(Number); minutes = h * 60 + (m || 0); }
  return { date, minutes };
}

// --- Pure date-string math (done in UTC so it never shifts) ---
const toUTC = (d) => { const [y, m, dd] = d.split('-').map(Number); return Date.UTC(y, m - 1, dd); };
const fromUTC = (t) => new Date(t).toISOString().slice(0, 10);
export const addDays = (d, n) => fromUTC(toUTC(d) + n * 864e5);
export const weekday = (d) => new Date(toUTC(d)).getUTCDay(); // 0 = Sunday
export const diffDays = (a, b) => Math.round((toUTC(b) - toUTC(a)) / 864e5);
export const monthKey = (d) => d.slice(0, 7);
export const daysInMonth = (d) => { const [y, m] = d.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };
export const monthEnd = (d) => `${monthKey(d)}-${String(daysInMonth(d)).padStart(2, '0')}`;
export const weekStart = (d) => addDays(d, -((weekday(d) + 6) % 7)); // Monday
export const quarterEnd = (d) => {
  const [y, m] = d.split('-').map(Number);
  const qm = Math.ceil(m / 3) * 3;
  return monthEnd(`${y}-${String(qm).padStart(2, '0')}-01`);
};
export const prevMonth = (month) => addDays(`${month}-01`, -1).slice(0, 7);
export const nextMonth = (month) => addDays(monthEnd(`${month}-01`), 1).slice(0, 7);

const fmt = (d, opts) => new Date(toUTC(d)).toLocaleDateString('en-US', { timeZone: 'UTC', ...opts });
export const dayLabel = (d) => fmt(d, { weekday: 'long', month: 'short', day: 'numeric' });
export const shortLabel = (d) => fmt(d, { weekday: 'short', month: 'short', day: 'numeric' });
export const monthLabel = (month) => fmt(`${month}-01`, { month: 'long', year: 'numeric' });
export const monthName = (month) => fmt(`${month}-01`, { month: 'long' });
export const dateShort = (d) => fmt(d, { month: 'short', day: 'numeric' });
