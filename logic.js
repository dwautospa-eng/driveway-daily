// Pure functions over the app state. Mutating helpers take a draft (see store.update).
import { addDays, weekday, monthKey, daysInMonth, weekStart } from './dates.js';
import { uid, money, sum } from './util.js';

export const isWorkday = (d) => weekday(d) !== 0; // Mon–Sat
export const isSaturday = (d) => weekday(d) === 6;
export const isSunday = (d) => weekday(d) === 0;

// Saturday pickup checklist. The third value marks an optional step (not scored).
export const PICKUP_STEPS = [
  ['walk', 'Walk-around with the customer'],
  ['aftercare', 'Go over aftercare'],
  ['review', 'Ask for a Google review'],
  ['referral', 'Ask for a referral'],
  ['footage', 'Shoot before/after footage for content'],
  ['testimonial', 'Short video testimonial (if possible)', true],
];

// Saturday is lighter: lower volume targets.
export function targetsFor(settings, date) {
  const sat = isSaturday(date);
  return Object.fromEntries(settings.counters.filter((c) => c.per !== 'week').map((c) => [c.id, sat ? (c.saturdayTarget ?? Math.ceil(c.target / 3)) : c.target]));
}

// ---------- Day records ----------
export function itemsFor(settings, date) {
  if (isSaturday(date)) return []; // Saturday: no weekday non-negotiables
  const list = settings.nonNegotiables.map((n) => ({ refId: n.id, kind: 'nn', title: n.title, minutes: n.minutes, note: n.note || '' }));
  if (settings.mondayExtras && weekday(date) === 1) {
    settings.mondayTasks.forEach((n) => list.push({ refId: n.id, kind: 'monday', title: n.title, minutes: n.minutes, note: 'Monday extra' }));
  }
  settings.ideaBank.filter((i) => i.enabled).forEach((n) => list.push({ refId: n.id, kind: 'extra', title: n.title, minutes: n.minutes, note: 'From your idea bank' }));
  return list;
}

export function blankDay(settings, date) {
  return {
    date,
    started: true,
    checkin: null, // { at, intention }
    items: itemsFor(settings, date).map((i) => ({ ...i, done: false, actual: null })),
    tasks: [],
    counts: {},
    targets: targetsFor(settings, date),
    pickups: [], // Saturday: [{ id, name, checks: { walk: true, ... } }]
    reminders: {},
    timer: null, // { key, start }
    eod: null, // { at, win, slipped, tomorrowOne }
    cash: null,
    jobs: null,
  };
}

export function newTask(date, title, minutes, goalId = null, extra = {}) {
  return {
    id: uid(), title, minutes, actual: null, done: false, goalId,
    createdDate: date, pushCount: 0, topOne: false, dropped: null, carriedTo: null,
    ...extra,
  };
}

export function prevStartedDate(state, date) {
  let best = null;
  for (const d in state.days) if (d < date && state.days[d].started && (!best || d > best)) best = d;
  return best;
}
export function nextStartedDate(state, date) {
  let best = null;
  for (const d in state.days) if (d > date && state.days[d].started && (!best || d < best)) best = d;
  return best;
}

export function addTopOne(day, text, extra = {}) {
  if (!text) return;
  const ex = day.tasks.find((t) => t.topOne && t.createdDate === day.date);
  if (ex) { if (!ex.done) ex.title = text; return; }
  day.tasks.unshift(newTask(day.date, text, 30, null, { topOne: true, ...extra }));
}

// Create today's record: carry over unfinished tasks and add yesterday's "#1".
export function ensureDay(state, date) {
  if (state.days[date]?.started) return state.days[date];
  const stub = state.days[date];
  const day = blankDay(state.settings, date);
  if (stub) { day.cash = stub.cash ?? null; day.jobs = stub.jobs ?? null; }
  const prevD = prevStartedDate(state, date);
  if (prevD) {
    const prev = state.days[prevD];
    for (const t of prev.tasks) {
      if (t.done || t.dropped || t.carriedTo) continue;
      t.carriedTo = date;
      day.tasks.push({ ...t, id: uid(), carriedFrom: prevD, carriedTo: null, topOne: false, pushCount: (t.pushCount || 0) + 1 });
    }
    if (prev.eod?.tomorrowOne) addTopOne(day, prev.eod.tomorrowOne, prev.sample ? { sample: true } : {});
  }
  state.days[date] = day;
  ensureRevenueGoal(state, monthKey(date));
  rollRecurring(state, date);
  if (weekday(date) === 1) applyMondayTasks(state, date);
  return day;
}

// Keep today's checklist in step with Settings edits.
export function syncItems(state, date) {
  const day = state.days[date];
  if (!day?.started) return;
  const built = itemsFor(state.settings, date);
  const next = built.map((b) => {
    const ex = day.items.find((i) => i.refId === b.refId);
    return ex ? { ...ex, title: b.title, note: b.note, kind: b.kind, minutes: ex.minutesEdited ? ex.minutes : b.minutes } : { ...b, done: false, actual: null };
  });
  day.items.forEach((i) => { if (i.done && !next.some((n) => n.refId === i.refId)) next.push(i); });
  day.items = next;
  day.targets = targetsFor(state.settings, date);
}

export function findEntry(day, key) {
  return day.items.find((i) => i.refId === key) || day.tasks.find((t) => t.id === key);
}

export function stopTimer(day) {
  if (!day.timer) return;
  const e = findEntry(day, day.timer.key);
  if (e) e.actual = (e.actual || 0) + Math.max(1, Math.round((Date.now() - day.timer.start) / 60000));
  day.timer = null;
}
export function startTimer(day, key) {
  if (day.timer) stopTimer(day);
  day.timer = { key, start: Date.now() };
}
export function toggleDone(day, key) {
  const e = findEntry(day, key);
  if (!e) return;
  if (!e.done && day.timer?.key === key) stopTimer(day);
  e.done = !e.done;
}

export function findPendingEod(state, date) {
  const p = prevStartedDate(state, date);
  return p && state.days[p].checkin && !state.days[p].eod ? p : null;
}

// ---------- Scores ----------
export function dayScore(day) {
  const list = [...(day.items || []), ...(day.tasks || []).filter((t) => !t.dropped)];
  const checks = (day.pickups || []).flatMap((p) => PICKUP_STEPS.filter((s) => !s[2]).map((s) => !!p.checks?.[s[0]]));
  const done = list.filter((x) => x.done).length + checks.filter(Boolean).length;
  const total = list.length + checks.length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

// ---------- Weekly plan (made on Sunday, keyed by the Monday it starts) ----------
export function blankWeek() {
  return {
    outcomes: ['', '', ''], outcomesDone: [false, false, false], cashTarget: null, bookingsTarget: null,
    wins: '', slipped: '', bigItems: '', stopDoing: '', handoff: '', mondayTasks: [], goalReview: {}, reviewedAt: null,
  };
}
export function ensureWeek(state, key) {
  state.weeks ||= {};
  return (state.weeks[key] ||= blankWeek());
}

// Sunday's "Monday list" becomes real tasks on Monday (once).
export function applyMondayTasks(state, key) {
  const p = state.weeks?.[key];
  const day = state.days[key];
  if (!p?.reviewedAt || !day?.started) return;
  for (const t of p.mondayTasks) {
    if (t.added) continue;
    day.tasks.push(newTask(key, t.title, t.minutes || 15));
    t.added = true;
  }
}

// Numbers for Sunday's review of the Mon–Sat that just ended.
export function weekReview(state, sunday) {
  const start = addDays(sunday, -6);
  const dates = Array.from({ length: 6 }, (_, i) => addDays(start, i));
  const prevDates = dates.map((d) => addDays(d, -7));
  const rows = dates.map((d) => {
    const day = state.days[d];
    const worked = !!day?.started;
    return {
      date: d, worked, pct: worked ? dayScore(day).pct : null,
      volume: volumeTotal(day), volTarget: worked ? volumeTarget(day) : 0, cash: day?.cash ?? null, jobs: day?.jobs || 0,
    };
  });
  const worked = rows.filter((r) => r.worked);
  const pushed = {};
  for (const d of dates) for (const t of state.days[d]?.tasks || []) if (t.pushCount > 0 && !t.dropped) pushed[t.title] = Math.max(pushed[t.title] || 0, t.pushCount);
  return {
    start, end: addDays(start, 5), rows,
    avgPct: worked.length ? Math.round(sum(worked.map((r) => r.pct)) / worked.length) : null,
    volume: sum(rows.map((r) => r.volume)), prevVolume: sum(prevDates.map((d) => volumeTotal(state.days[d]))),
    volTarget: sum(rows.map((r) => r.volTarget)),
    cash: sum(rows.map((r) => r.cash)), prevCash: sum(prevDates.map((d) => state.days[d]?.cash)),
    jobs: sum(rows.map((r) => r.jobs)),
    mostPushed: Object.entries(pushed).sort((a, b) => b[1] - a[1]).slice(0, 5),
    eods: dates.map((d) => ({ date: d, ...(state.days[d]?.eod || {}) })).filter((e) => e.win || e.slipped),
    wins: state.wins.filter((w) => w.date >= start && w.date <= sunday),
  };
}

// This week's plan + progress, for the Today screen.
export function weekProgress(state, date) {
  const key = weekStart(date);
  const plan = state.weeks?.[key];
  if (!plan?.reviewedAt) return null;
  const ds = Array.from({ length: 7 }, (_, i) => addDays(key, i)).filter((d) => d <= date);
  return { key, plan, cash: sum(ds.map((d) => state.days[d]?.cash)), jobs: sum(ds.map((d) => state.days[d]?.jobs)) };
}

export function nnComplete(day) {
  const nn = (day?.items || []).filter((i) => i.kind === 'nn');
  return nn.length > 0 && nn.every((i) => i.done);
}

// Consecutive weekdays (Mon–Fri) with every non-negotiable done. Weekends don't break it.
export function streak(state, today) {
  let s = 0;
  const wd = weekday(today);
  if (wd !== 0 && wd !== 6 && nnComplete(state.days[today])) s++;
  let d = addDays(today, -1);
  for (let i = 0; i < 800; i++) {
    const w = weekday(d);
    if (w !== 0 && w !== 6) {
      if (nnComplete(state.days[d])) s++;
      else break;
    }
    d = addDays(d, -1);
  }
  return s;
}

// Only counters with a daily target count toward the day's volume (weekly ones and retired ones don't).
export const volumeTotal = (day) => sum(Object.keys(day?.targets || {}).map((id) => day.counts?.[id] || 0));
// Weekly counters: Monday through this date.
export function weekCount(state, date, id) {
  let n = 0;
  for (let d = weekStart(date); d <= date; d = addDays(d, 1)) n += state.days[d]?.counts?.[id] || 0;
  return n;
}
export const volumeTarget = (day) => sum(Object.values(day?.targets || {}));

// ---------- Money ----------
const daysInMonthOf = (state, month) => Object.values(state.days).filter((d) => d.date.startsWith(month));
export const monthCash = (state, month) => sum(daysInMonthOf(state, month).map((d) => d.cash));
export const monthJobs = (state, month) => sum(daysInMonthOf(state, month).map((d) => d.jobs));

export function bestWeek(state) {
  const weeks = {};
  for (const d of Object.values(state.days)) {
    if (!d.cash) continue;
    const k = weekStart(d.date);
    weeks[k] = (weeks[k] || 0) + d.cash;
  }
  let best = null;
  for (const [start, total] of Object.entries(weeks)) if (!best || total > best.total) best = { start, total };
  return best;
}

export const revenueGoal = (state, month) =>
  state.goals.find((g) => g.type === 'revenue' && g.month === month && g.status !== 'dropped');

export function setRevenueTarget(state, month, target) {
  let g = revenueGoal(state, month);
  if (!g) { ensureRevenueGoal(state, month); g = revenueGoal(state, month); }
  g.target = target;
  delete g.needsTarget;
  if (g.status === 'hit' && monthCash(state, month) < target) { g.status = 'active'; delete g.completedAt; delete g.celebrated; }
}

// The revenue-goal question only shows on the first day the app is opened in a month.
export function firstStartedDayOfMonth(state, month) {
  return Object.keys(state.days).filter((d) => d.startsWith(month) && state.days[d].started).sort()[0] || null;
}

export function setDayCash(state, date, cash) {
  const d = state.days[date] || (state.days[date] = { date, cash: null, jobs: null });
  d.cash = cash;
}

export function monthWorkdays(month) {
  const n = daysInMonth(`${month}-01`), out = [];
  for (let i = 1; i <= n; i++) {
    const d = `${month}-${String(i).padStart(2, '0')}`;
    if (isWorkday(d)) out.push(d);
  }
  return out;
}

// Pace is measured in working days (Mon–Sat). Today counts as "elapsed" once its cash is entered.
export function revenueStatus(state, today) {
  const month = monthKey(today);
  const goal = revenueGoal(state, month);
  const target = goal?.target ?? state.settings.revenueTarget;
  const collected = monthCash(state, month);
  const wds = monthWorkdays(month);
  const elapsed = wds.filter((d) => d < today || (d === today && state.days[d]?.cash != null)).length;
  const expected = wds.length ? (target * elapsed) / wds.length : 0;
  const remainingDays = wds.length - elapsed;
  const remaining = Math.max(0, target - collected);
  // Forecast: if the rest of the month goes like the working days so far.
  const avgPerDay = elapsed ? collected / elapsed : 0;
  const projected = elapsed ? collected + avgPerDay * remainingDays : 0;
  return {
    goal, target, collected, expected, diff: collected - expected, remainingDays, remaining,
    perDay: remainingDays > 0 ? remaining / remainingDays : remaining,
    elapsed, totalDays: wds.length, avgPerDay, projected,
  };
}

// ---------- Goals ----------
// The current month's revenue goal stays on screen all month, even after it's hit.
export function activeGoals(state, today) {
  const m = monthKey(today);
  return state.goals
    .filter((g) => (g.type === 'revenue' ? g.month === m && g.status !== 'dropped'
      : g.status === 'active' || (g.repeat && g.status === 'hit' && !g.rolled && g.due >= today)))
    .sort((a, b) => (a.type === 'revenue' ? -1 : b.type === 'revenue' ? 1 : (a.due || '') < (b.due || '') ? -1 : 1));
}

export function goalProgress(state, g) {
  if (g.type === 'revenue') {
    const v = monthCash(state, g.month);
    return { value: v, max: g.target, label: `${money(v)} / ${money(g.target)}` };
  }
  if (g.type === 'done') return { value: g.done ? 1 : 0, max: 1, label: g.done ? 'Done' : 'Not yet' };
  const base = g.base || 0;
  let fromTasks = 0, fromCounters = 0;
  const start = g.start || '0000-00-00', end = g.due || '9999-12-31';
  const cids = g.counterIds || [];
  for (const d of Object.values(state.days)) {
    for (const t of d.tasks || []) if (t.goalId === g.id && t.done) fromTasks++;
    if (cids.length && d.date >= start && d.date <= end) for (const c of cids) fromCounters += d.counts?.[c] || 0;
  }
  const v = base + fromTasks + fromCounters;
  return { value: v, max: g.target, label: `${v} / ${g.target}`, base, fromTasks, fromCounters };
}

export function goalHit(state, g) {
  if (g.type === 'done') return !!g.done;
  const p = goalProgress(state, g);
  return p.max > 0 && p.value >= p.max;
}

// Goals that just reached their target become "hit" and wait to be celebrated.
export function markHitGoals(state, today) {
  for (const g of state.goals) {
    if (g.status === 'active' && goalHit(state, g)) { g.status = 'hit'; g.completedAt = today; g.celebrated = false; }
  }
}

export function timeframeDates(tf, today, custom) {
  const [y, m] = today.split('-').map(Number);
  if (tf === 'week') { const s = weekStart(today); return { start: s, due: addDays(s, 6) }; }
  if (tf === 'month') return { start: `${monthKey(today)}-01`, due: `${monthKey(today)}-${String(daysInMonth(today)).padStart(2, '0')}` };
  if (tf === 'quarter') {
    const qs = Math.floor((m - 1) / 3) * 3 + 1;
    const start = `${y}-${String(qs).padStart(2, '0')}-01`;
    const endMonth = `${y}-${String(qs + 2).padStart(2, '0')}-01`;
    return { start, due: `${monthKey(endMonth)}-${String(daysInMonth(endMonth)).padStart(2, '0')}` };
  }
  return { start: today, due: custom || today };
}

// Repeating goals (weekly / monthly): when the period ends, the old one goes to
// history (hit or missed) and a fresh copy starts for the current period.
export function rollRecurring(state, date) {
  for (const g of [...state.goals]) {
    if (!g.repeat || g.rolled || !g.due || g.due >= date || g.status === 'dropped') continue;
    g.rolled = true;
    if (g.status === 'active') { g.status = 'missed'; g.completedAt = g.due; }
    const { start, due } = timeframeDates(g.repeat, date);
    const next = { ...g, id: uid(), start, due, base: 0, done: false, status: 'active', rolled: false, createdAt: date };
    delete next.completedAt; delete next.celebrated;
    state.goals.push(next);
  }
}

// Each month gets its own revenue goal. It starts from last month's number and
// asks Chandler to set this month's (needsTarget) until he confirms it.
export function ensureRevenueGoal(state, month) {
  if (revenueGoal(state, month)) return;
  const last = state.goals.filter((g) => g.type === 'revenue' && g.month < month).sort((a, b) => (a.month < b.month ? 1 : -1))[0];
  state.goals.push({
    id: uid(), type: 'revenue', title: 'Monthly revenue', month, target: last?.target ?? state.settings.revenueTarget,
    reward: '', status: 'active', start: `${month}-01`, due: `${month}-${String(daysInMonth(`${month}-01`)).padStart(2, '0')}`, createdAt: `${month}-01`,
    needsTarget: true,
  });
}

// ---------- Time estimates ----------
export function avgActual(state, refId, before) {
  const vals = Object.keys(state.days).filter((d) => d < before).sort().reverse().slice(0, 20)
    .map((d) => state.days[d].items?.find((i) => i.refId === refId)?.actual)
    .filter((v) => v > 0).slice(0, 10);
  return vals.length >= 2 ? { avg: Math.round(sum(vals) / vals.length), n: vals.length } : null;
}
