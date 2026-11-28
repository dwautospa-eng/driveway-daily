// Google Calendar events for Home and Week (read-only, through /api/calendar).
// Remembers the last answer on this device so the widgets show something offline.
import { useState, useEffect } from './preact.js';
import { cloudEnabled, accessToken } from './cloud.js';

const mem = {};
const KEY = 'dd-cal:';
const load = (k) => { try { return JSON.parse(localStorage.getItem(KEY + k)); } catch { return null; } };
const save = (k, v) => { try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch { /* storage full or blocked */ } };

async function fetchRange(start, end) {
  if (!cloudEnabled) return { configured: false, events: [] };
  const token = await accessToken();
  const r = await fetch(`./api/calendar?start=${start}&end=${end}`, { headers: token ? { Authorization: 'Bearer ' + token } : {} });
  if (r.status === 404) return { configured: false, events: [] }; // API not deployed yet
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || 'Calendar unavailable');
  return body;
}

// → { status: 'loading' | 'ok' | 'off' | 'error', events, error }
export function useEvents(start, end) {
  const k = `${start}_${end}`;
  const cached = mem[k] || load(k);
  const [st, setSt] = useState(cached ? { status: cached.configured ? 'ok' : 'off', events: cached.events } : { status: 'loading', events: [] });
  useEffect(() => {
    let alive = true;
    const c = mem[k] || load(k);
    setSt(c ? { status: c.configured ? 'ok' : 'off', events: c.events } : { status: 'loading', events: [] });
    const go = () => fetchRange(start, end)
      .then((body) => { mem[k] = body; save(k, body); if (alive) setSt({ status: body.configured ? 'ok' : 'off', events: body.events || [] }); })
      .catch((e) => { if (alive) setSt((s) => (s.status === 'ok' ? s : { status: 'error', events: [], error: e.message })); });
    go();
    const onVis = () => { if (document.visibilityState === 'visible') go(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { alive = false; document.removeEventListener('visibilitychange', onVis); };
  }, [k]);
  return st;
}

// Events that touch a given Phoenix date.
export function eventsOn(events, date) {
  return events.filter((e) => (e.allDay ? e.start <= date && date < e.end : e.start.slice(0, 10) <= date && (e.end.slice(0, 10) > date || e.start.slice(0, 10) === date)));
}

export function eventTime(e, date) {
  if (e.allDay) return 'All day';
  const t = (s) => { const [h, m] = s.slice(11, 16).split(':').map(Number); return `${((h + 11) % 12) + 1}${m ? ':' + String(m).padStart(2, '0') : ''}${h < 12 ? 'a' : 'p'}`; };
  if (date && e.start.slice(0, 10) < date) return 'Cont.';
  return t(e.start);
}
