// Home (widgets) and Week (Mon–Sun list of calendar events). Open before the morning check-in.
import { html, useState } from './preact.js';
import * as L from './logic.js';
import { addDays, weekStart, weekday, dayLabel, dateShort, monthKey, monthName } from './dates.js';
import { money, fmtClock } from './util.js';
import { useEvents, eventsOn, eventTime } from './calendar.js';

const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ICON = {
  cal: 'M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z',
  clock: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2',
  check: 'M20 6L9 17l-5-5',
  trend: 'M3 17l6-6 4 4 8-8M15 7h6v6',
};
const Icon = ({ d }) => html`<svg class="wicon" viewBox="0 0 24 24" aria-hidden="true"><path d=${d} /></svg>`;

const weekDates = (date) => { const m = weekStart(date); return [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(m, i)); };
const greeting = (min) => (min < 5 * 60 ? 'Good evening' : min < 12 * 60 ? 'Good morning' : min < 17 * 60 ? 'Good afternoon' : 'Good evening');
const shortMoney = (n) => (n >= 1000 ? '$' + (n / 1000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, '') + 'k' : money(n));
const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

export function Home({ state, now, unlocked }) {
  const date = now.date;
  const days = weekDates(date);
  const cal = useEvents(days[0], days[6]);
  const name = (state.settings.name || '').trim();
  const todays = eventsOn(cal.events, date);
  const open = L.openTodos(state.days[date]);
  const r = L.revenueStatus(state, date);
  const cta = unlocked ? 'Open the dashboard' : L.isSunday(date) ? 'Plan the week' : 'Start my day';
  return html`
    <section class="home-hero">
      <div class="hero-eyebrow"><b>${DOW_LONG[weekday(date)]}</b><span>${dateShort(date)}</span><span>${fmtClock(now.minutes)}</span></div>
      <h1 class="hello">${greeting(now.minutes)}${name ? html`, <em>${name}.</em>` : '.'}</h1>
      <p class="hero-sub">
        ${cal.status === 'ok' && html`<span><b>${todays.length || 'No'}</b> event${todays.length === 1 ? '' : 's'} today</span>`}
        ${state.days[date] && html`<span><b>${open.length || 'No'}</b> open to-do${open.length === 1 ? '' : 's'}</span>`}
        <span>${r.elapsed ? html`pacing <b>${shortMoney(r.projected)}</b> of ${shortMoney(r.target)}` : html`<b>${shortMoney(r.collected)}</b> collected this month`}</span>
      </p>
      <a class="btn primary hero-cta" href="#/overview">${cta} <i>→</i></a>
    </section>

    <div class="widgets">
      <${WeekWidget} days=${days} date=${date} now=${now} cal=${cal} />
      <${TodayEvents} date=${date} now=${now} cal=${cal} />
      <${TodosWidget} state=${state} date=${date} />
      <${RevenueWidget} r=${r} date=${date} />
    </div>
  `;
}

function CalNote({ cal }) {
  if (cal.status === 'off') return html`<p class="w-note">Calendar not connected yet.</p>`;
  if (cal.status === 'error') return html`<p class="w-note">Couldn't reach your calendar.</p>`;
  if (cal.status === 'loading') return html`<p class="w-note">Loading…</p>`;
  return null;
}

function WeekWidget({ days, date, now, cal }) {
  const total = cal.events.length;
  const t = `${date}T${hhmm(now.minutes)}`;
  const next = cal.events.find((e) => !e.allDay && e.start >= t) || null;
  return html`<a class="widget w-week" href="#/week">
    <div class="w-title"><${Icon} d=${ICON.cal} /><span>The week</span><em class="go">Open week →</em></div>
    <div class="wk-grid">
      ${days.map((d) => {
        const evs = eventsOn(cal.events, d);
        return html`<div class=${'wk-day' + (d === date ? ' today' : '') + (d < date ? ' past' : '')}>
          <small>${DOW[weekday(d)]}</small>
          <b>${+d.slice(8)}</b>
          <div class="dots">
            ${evs.slice(0, 4).map((e) => html`<i class=${e.allDay ? 'all' : ''}></i>`)}
            ${evs.length > 4 && html`<em>+${evs.length - 4}</em>`}
          </div>
          <div class="wk-times">
            ${evs.slice(0, 4).map((e) => html`<span class=${e.allDay ? 'all' : ''} title=${e.title}>${e.allDay ? e.title : html`<em>${eventTime(e, d)}</em>${e.title}`}</span>`)}
            ${evs.length > 4 && html`<span class="more">+${evs.length - 4} more</span>`}
          </div>
        </div>`;
      })}
    </div>
    ${cal.status === 'ok'
      ? html`<div class="w-foot"><span><b>${total}</b> event${total === 1 ? '' : 's'} this week</span>
          ${next && html`<span>Next · ${next.start.slice(0, 10) === date ? 'today' : DOW_LONG[weekday(next.start.slice(0, 10))]} ${eventTime(next)}, ${next.title}</span>`}</div>`
      : html`<${CalNote} cal=${cal} />`}
  </a>`;
}

function TodayEvents({ date, now, cal }) {
  const evs = eventsOn(cal.events, date);
  const t = `${date}T${hhmm(now.minutes)}`;
  const nextIdx = evs.findIndex((e) => !e.allDay && e.end > t);
  return html`<a class="widget w-events" href="#/week">
    <div class="w-title"><${Icon} d=${ICON.clock} /><span>Today</span>${evs.length > 0 && html`<b class="w-count">${evs.length}</b>`}</div>
    ${cal.status === 'ok' && evs.length === 0 && html`<p class="w-empty">A clear day. Make it count.</p>`}
    ${cal.status !== 'ok' && html`<${CalNote} cal=${cal} />`}
    <ul class="agenda">
      ${evs.slice(0, 6).map((e, i) => html`<li class=${i === nextIdx ? 'next' : !e.allDay && e.end <= t ? 'done' : ''}>
        <span class="t">${eventTime(e, date)}</span><span class="rail"><i></i></span>
        <div class="what"><b>${e.title}</b>${e.location && html`<small>${e.location}</small>`}</div>
      </li>`)}
    </ul>
    ${evs.length > 6 && html`<small class="muted">+${evs.length - 6} more</small>`}
  </a>`;
}

function TodosWidget({ state, date }) {
  const day = state.days[date];
  const open = L.openTodos(day);
  const all = day ? (day.items || []).length + (day.tasks || []).filter((t) => !t.dropped && !t.carriedTo).length : 0;
  return html`<a class="widget w-todos" href="#/tasks">
    <div class="w-title"><${Icon} d=${ICON.check} /><span>To-dos</span>${all > 0 && html`<b class="w-count">${all - open.length} of ${all}</b>`}</div>
    ${all > 0 && html`<div class="w-progress"><i style=${{ width: ((all - open.length) / all) * 100 + '%' }}></i></div>`}
    ${!day && html`<p class="w-empty">${L.isSunday(date) ? 'Sunday is for planning the week.' : 'Your list opens with the morning check-in.'}</p>`}
    ${day && open.length === 0 && html`<p class="good w-empty">All done. Enjoy it.</p>`}
    <ul class="w-list">
      ${open.slice(0, 5).map((t) => html`<li class=${t.top ? 'lead' : ''}><i class="w-box"></i><span class="w-what">${t.title}</span></li>`)}
    </ul>
    ${open.length > 5 && html`<small class="muted">+${open.length - 5} more</small>`}
  </a>`;
}

function RevenueWidget({ r, date }) {
  const C = 2 * Math.PI * 54;
  const frac = (v) => (r.target ? Math.max(0, Math.min(1, v / r.target)) : 0);
  const proj = r.projected || 0;
  const ahead = proj >= r.target;
  return html`<a class="widget w-rev" href="#/cash">
    <div class="w-title"><${Icon} d=${ICON.trend} /><span>${monthName(monthKey(date))}</span></div>
    <div class="ring-wrap">
      <div class="ring">
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <defs><linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f5e2bd" /><stop offset="1" stop-color="#b8915a" /></linearGradient></defs>
          <circle class="track" cx="60" cy="60" r="54" />
          <circle class="proj" cx="60" cy="60" r="54" stroke-dasharray=${`${frac(proj) * C} ${C}`} />
          <circle class="done" cx="60" cy="60" r="54" stroke-dasharray=${`${frac(r.collected) * C} ${C}`} />
        </svg>
        <div class="ring-mid"><b>${Math.round(frac(r.collected) * 100)}%</b><small>of goal</small></div>
      </div>
      <div class="ring-stats">
        <div><small>Collected</small><b>${money(r.collected)}</b></div>
        <div><small>Projected</small><b>${r.elapsed ? money(proj) : '—'}</b></div>
      </div>
    </div>
    <p class=${'w-verdict ' + (r.elapsed ? (ahead ? 'good' : 'bad') : 'muted')}>${r.elapsed
      ? ahead ? `On pace to clear ${money(r.target)}.` : `${money(r.target - proj)} short at this pace.`
      : `Goal ${money(r.target)}.`}</p>
  </a>`;
}

// ---------- Week tab ----------
export function Week({ now }) {
  const [offset, setOffset] = useState(0);
  const anchor = addDays(now.date, offset * 7);
  const days = weekDates(anchor);
  const cal = useEvents(days[0], days[6]);
  const label = offset === 0 ? 'This week' : offset === 1 ? 'Next week' : offset === -1 ? 'Last week' : `Week of ${dateShort(days[0])}`;
  return html`
    <header class="top"><div><div class="eyebrow">${dateShort(days[0])} – ${dateShort(days[6])}</div><h1>${label}</h1></div>
      <div class="head-actions">
        <button class="btn ghost" onClick=${() => setOffset(offset - 1)} aria-label="Previous week">‹</button>
        ${offset !== 0 && html`<button class="btn ghost" onClick=${() => setOffset(0)}>Today</button>`}
        <button class="btn ghost" onClick=${() => setOffset(offset + 1)} aria-label="Next week">›</button>
      </div>
    </header>
    ${cal.status === 'off' && html`<section class="card banner-card"><b>Connect Google Calendar</b>
      <p class="muted small">Google Calendar → Settings → your calendar → Integrate calendar → copy "Secret address in iCal format". Then in Vercel → driveway-daily → Settings → Environment Variables, add <code>GCAL_ICS_URL</code> with that address and redeploy.</p></section>`}
    ${cal.status === 'error' && html`<section class="card"><p class="bad small">Couldn't load your calendar: ${cal.error}</p></section>`}
    <div class="week-list">
      ${days.map((d) => {
        const evs = eventsOn(cal.events, d);
        return html`<section class=${'card wl-day' + (d === now.date ? ' today' : '') + (d < now.date ? ' past' : '')}>
          <div class="wl-head"><b>${DOW_LONG[weekday(d)]}</b><span class="muted">${dateShort(d)}</span>${d === now.date && html`<span class="tag accent">Today</span>`}</div>
          ${cal.status === 'loading' && html`<p class="muted small">Loading…</p>`}
          ${cal.status === 'ok' && evs.length === 0 && html`<p class="muted small wl-none">Nothing scheduled</p>`}
          ${evs.map((e) => html`<div class="wl-ev"><span class="w-time">${eventTime(e, d)}</span>
            <div class="grow"><div class="w-what">${e.title}</div>${e.location && html`<small class="muted">${e.location}</small>`}</div></div>`)}
        </section>`;
      })}
    </div>
  `;
}
