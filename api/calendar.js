// Driveway Daily: read-only Google Calendar feed for the Home and Week tabs.
//
// Setup (once): Google Calendar → Settings → your calendar → "Integrate calendar" →
// copy "Secret address in iCal format". In Vercel → Project → Settings → Environment Variables,
// add GCAL_ICS_URL = that address (several calendars: separate them with spaces).
// The address never reaches the browser. Only a signed-in Driveway Daily user can call this.
//
// GET /api/calendar?start=YYYY-MM-DD&end=YYYY-MM-DD  (end inclusive, max 62 days)
// → { configured, events: [{ id, title, location, allDay, start, end }] }
//   start/end are Phoenix wall time "YYYY-MM-DDTHH:MM", or "YYYY-MM-DD" for all-day (end exclusive).

const SUPABASE_URL = 'https://lutltmwntrejouykeojo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_OR2zDRdPaekbpbHA2ip9uw_gsJaV5Ol'; // publishable, same as config.js
const HOME_TZ = 'America/Phoenix';
const DAY = 864e5;

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  try {
    const auth = req.headers.authorization || '';
    if (!auth.startsWith('Bearer ')) return send(res, 401, { error: 'Sign in first' });
    const who = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_KEY, Authorization: auth } });
    if (!who.ok) return send(res, 401, { error: 'Sign in first' });

    const urls = (process.env.GCAL_ICS_URL || '').split(/\s+/).filter(Boolean);
    if (!urls.length) return send(res, 200, { configured: false, events: [] });

    const q = new URL(req.url, 'http://x').searchParams;
    const start = isDate(q.get('start')) ? q.get('start') : null;
    const end = isDate(q.get('end')) ? q.get('end') : null;
    if (!start || !end || end < start || dayNum(end) - dayNum(start) > 62) return send(res, 400, { error: 'Bad date range' });

    const texts = await Promise.all(urls.map(async (u) => {
      const r = await fetch(u.replace(/^webcal:/, 'https:'));
      if (!r.ok) throw new Error('Calendar feed returned ' + r.status);
      return r.text();
    }));
    const events = [];
    for (const t of texts) events.push(...expand(parseICS(t), start, end));
    events.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : a.allDay ? -1 : 1));
    send(res, 200, { configured: true, events });
  } catch (e) {
    send(res, 502, { error: String(e.message || e) });
  }
};

function send(res, code, body) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

// ---------- Dates ----------
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
const pad = (n) => String(n).padStart(2, '0');
const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const dayNum = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / DAY;
const fromDayNum = (n) => new Date(n * DAY).toISOString().slice(0, 10);
const weekdayOf = (n) => new Date(n * DAY).getUTCDay();

const fmtCache = {};
function tzParts(ms, tz) {
  let f = fmtCache[tz];
  if (!f) {
    try {
      f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch { f = tzParts.fallback || (tzParts.fallback = new Intl.DateTimeFormat('en-US', { timeZone: HOME_TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })); }
    fmtCache[tz] = f;
  }
  const p = {};
  for (const x of f.formatToParts(new Date(ms))) p[x.type] = +x.value;
  return p;
}
// Wall-clock time in a time zone → UTC milliseconds.
function zonedToUtc(y, mo, d, h, mi, s, tz) {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  const off = (ms) => { const p = tzParts(ms, tz); return Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second) - ms; };
  let utc = guess - off(guess);
  utc = guess - off(utc);
  return utc;
}
// UTC milliseconds → Phoenix "YYYY-MM-DDTHH:MM".
function toHome(ms) {
  const p = tzParts(ms, HOME_TZ);
  return `${ymd(p.year, p.month, p.day)}T${pad(p.hour % 24)}:${pad(p.minute)}`;
}

// ---------- ICS parsing ----------
function unescapeText(v) {
  return v.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
}

// Parses a date/time property into { allDay, date } or { allDay:false, ms }.
function parseWhen(value, params) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (!h || params.VALUE === 'DATE') return { allDay: true, date: ymd(+y, +mo, +d) };
  if (z) return { allDay: false, ms: Date.UTC(+y, +mo - 1, +d, +h, +mi, +s), tz: 'UTC', wall: [+y, +mo, +d, +h, +mi, +s] };
  const tz = params.TZID ? params.TZID.replace(/^"|"$/g, '') : HOME_TZ;
  return { allDay: false, ms: zonedToUtc(+y, +mo, +d, +h, +mi, +s, tz), tz, wall: [+y, +mo, +d, +h, +mi, +s] };
}

function parseDuration(v) {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec((v || '').trim());
  if (!m) return null;
  const sign = m[1] === '-' ? -1 : 1;
  return sign * ((+m[2] || 0) * 7 * DAY + (+m[3] || 0) * DAY + (+m[4] || 0) * 36e5 + (+m[5] || 0) * 6e4 + (+m[6] || 0) * 1e3);
}

function parseICS(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const events = [];
  let ev = null, depth = 0;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { ev = { exdates: [] }; depth = 0; continue; }
    if (!ev) continue;
    if (line.startsWith('BEGIN:')) { depth++; continue; } // e.g. VALARM
    if (line.startsWith('END:') && depth > 0) { depth--; continue; }
    if (line === 'END:VEVENT') { events.push(ev); ev = null; continue; }
    if (depth > 0) continue;
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const [name, ...rawParams] = line.slice(0, colon).split(';');
    const value = line.slice(colon + 1);
    const params = {};
    for (const p of rawParams) { const i = p.indexOf('='); if (i > 0) params[p.slice(0, i).toUpperCase()] = p.slice(i + 1); }
    switch (name.toUpperCase()) {
      case 'UID': ev.uid = value; break;
      case 'SUMMARY': ev.title = unescapeText(value); break;
      case 'LOCATION': ev.location = unescapeText(value); break;
      case 'STATUS': ev.status = value.toUpperCase(); break;
      case 'DTSTART': ev.start = parseWhen(value, params); break;
      case 'DTEND': ev.end = parseWhen(value, params); break;
      case 'DURATION': ev.duration = parseDuration(value); break;
      case 'RRULE': ev.rrule = Object.fromEntries(value.split(';').map((kv) => kv.split('=')).map(([k, v]) => [k.toUpperCase(), v])); break;
      case 'EXDATE': for (const v of value.split(',')) { const w = parseWhen(v, params); if (w) ev.exdates.push(w); } break;
      case 'RECURRENCE-ID': ev.recurrenceId = parseWhen(value, params); break;
    }
  }
  return events.filter((e) => e.start);
}

// ---------- Recurrence ----------
const WD = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
const keyOf = (w) => (w.allDay ? w.date : String(w.ms));

function matches(rule, startN, n) {
  const freq = rule.FREQ, interval = Math.max(1, +rule.INTERVAL || 1);
  const sd = fromDayNum(startN), cd = fromDayNum(n);
  const sy = +sd.slice(0, 4), sm = +sd.slice(5, 7), sdd = +sd.slice(8, 10);
  const cy = +cd.slice(0, 4), cm = +cd.slice(5, 7), cdd = +cd.slice(8, 10);
  const byMonth = rule.BYMONTH ? rule.BYMONTH.split(',').map(Number) : null;
  if (byMonth && !byMonth.includes(cm)) return false;
  const byDay = rule.BYDAY ? rule.BYDAY.split(',').map((x) => { const m = /^([+-]?\d+)?([A-Z]{2})$/.exec(x); return m ? { n: m[1] ? +m[1] : 0, wd: WD[m[2]] } : null; }).filter(Boolean) : null;
  const wd = weekdayOf(n);
  if (freq === 'DAILY') return (n - startN) % interval === 0 && (!byDay || byDay.some((b) => b.wd === wd));
  if (freq === 'WEEKLY') {
    const wk = (x) => x - ((weekdayOf(x) + 6) % 7); // Monday of that week
    if (((wk(n) - wk(startN)) / 7) % interval !== 0) return false;
    return byDay ? byDay.some((b) => b.wd === wd) : wd === weekdayOf(startN);
  }
  if (freq === 'MONTHLY') {
    if (((cy - sy) * 12 + (cm - sm)) % interval !== 0) return false;
    if (byDay) {
      const dim = new Date(Date.UTC(cy, cm, 0)).getUTCDate();
      return byDay.some((b) => b.wd === wd && (b.n === 0 || (b.n > 0 ? Math.ceil(cdd / 7) === b.n : Math.ceil((dim - cdd + 1) / 7) === -b.n)));
    }
    if (rule.BYMONTHDAY) {
      const dim = new Date(Date.UTC(cy, cm, 0)).getUTCDate();
      return rule.BYMONTHDAY.split(',').map(Number).some((x) => (x > 0 ? x : dim + 1 + x) === cdd);
    }
    return cdd === sdd;
  }
  if (freq === 'YEARLY') {
    if ((cy - sy) % interval !== 0) return false;
    return cm === sm && cdd === sdd;
  }
  return false;
}

function expand(events, startStr, endStr) {
  const rangeStart = dayNum(startStr), rangeEnd = dayNum(endStr); // inclusive day numbers
  // Phoenix is UTC−7 all year: a Phoenix day covers [day 07:00Z, next day 07:00Z).
  const rsMs = rangeStart * DAY + 7 * 36e5, reMs = (rangeEnd + 1) * DAY + 7 * 36e5;
  const overrides = new Set();
  for (const e of events) if (e.recurrenceId) overrides.add(e.uid + '|' + keyOf(e.recurrenceId));

  const out = [];
  const push = (e, w, len) => {
    if (e.status === 'CANCELLED') return;
    if (w.allDay) {
      const a = dayNum(w.date), b = a + Math.max(1, Math.round(len / DAY));
      if (b - 1 < rangeStart || a > rangeEnd) return;
      out.push({ id: `${e.uid}|${w.date}`, title: e.title || '(No title)', location: e.location || '', allDay: true, start: w.date, end: fromDayNum(b) });
    } else {
      const s = w.ms, en = w.ms + Math.max(0, len);
      if (en <= rsMs && en !== s) return;
      if (s >= reMs || (en === s && s < rsMs)) return;
      out.push({ id: `${e.uid}|${s}`, title: e.title || '(No title)', location: e.location || '', allDay: false, start: toHome(s), end: toHome(en) });
    }
  };

  for (const e of events) {
    const st = e.start;
    let len;
    if (e.end) len = st.allDay ? (dayNum(e.end.date || toHome(e.end.ms).slice(0, 10)) - dayNum(st.date)) * DAY : e.end.ms - st.ms;
    else if (e.duration != null) len = e.duration;
    else len = st.allDay ? DAY : 0;

    if (!e.rrule || e.recurrenceId) { push(e, st, len); continue; }

    const rule = e.rrule;
    const ex = new Set(e.exdates.map(keyOf));
    const count = rule.COUNT ? +rule.COUNT : Infinity;
    const until = rule.UNTIL ? parseWhen(rule.UNTIL, rule.UNTIL.length === 8 ? { VALUE: 'DATE' } : {}) : null;
    const untilN = until ? (until.allDay ? dayNum(until.date) : null) : null;
    const startN = st.allDay ? dayNum(st.date) : dayNum(ymd(st.wall[0], st.wall[1], st.wall[2]));
    const spanDays = Math.ceil(Math.max(len, 0) / DAY) + 1;
    let n = startN, seen = 0;
    for (let guard = 0; guard < 40000 && seen < count; guard++, n++) {
      if (n > rangeEnd + 1) break;
      if (untilN != null && n > untilN) break;
      if (!matches(rule, startN, n)) continue;
      const d = fromDayNum(n);
      let w;
      if (st.allDay) w = { allDay: true, date: d };
      else {
        const [, , , h, mi, s] = st.wall;
        const ms = st.tz === 'UTC' ? Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10), h, mi, s)
          : zonedToUtc(+d.slice(0, 4), +d.slice(5, 7), +d.slice(8, 10), h, mi, s, st.tz);
        if (until && !until.allDay && ms > until.ms) break;
        w = { allDay: false, ms };
      }
      seen++;
      if (n + spanDays < rangeStart) continue;
      const k = keyOf(w);
      if (ex.has(k) || overrides.has(e.uid + '|' + k)) continue;
      push(e, w, len);
    }
  }
  return out;
}

module.exports.parseICS = parseICS;
module.exports.expand = expand;
