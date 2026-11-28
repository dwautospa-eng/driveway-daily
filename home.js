// Home (widgets) and Week (Mon–Sun list of calendar events). Open before the morning check-in.
import { html, useState } from './preact.js';
import * as L from './logic.js';
import { addDays, weekStart, weekday, dayLabel, dateShort, monthKey, monthName } from './dates.js';
import { money } from './util.js';
import { useEvents, eventsOn, eventTime } from './calendar.js';

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ICON = {
  cal: 'M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z',
  clock: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2',
  check: 'M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2',
  trend: 'M3 17l6-6 4 4 8-8M15 7h6v6',
};
const Icon = ({ d }) => html`<svg class="wicon" viewBox="0 0 24 24" aria-hidden="true"><path d=${d} /></svg>`;

const weekDates = (date) => { const m = weekStart(date); return [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(m, i)); };
const greeting = (min) => (min < 12 * 60 ? 'Good morning' : min < 17 * 60 ? 'Good afternoon' : 'Good evening');

export function Home({ state, now, unlocked }) {
  const date = now.date;
  const days = weekDates(date);
  const cal = useEvents(days[0], days[6]);
  const name = (state.settings.name || '').trim();
  return html`
    <header class="home-head">
      <div>
        <h1 class="hello">${greeting(now.minutes)}${name ? `, ${name}` : ''}</h1>
        <div class="muted hello-date">${dayLabel(date)}</div>
      </div>
      <a class="btn primary start-btn" href="#/overview">${unlocked ? 'Open dashboard →' : L.isSunday(date) ? 'Sunday planning →' : 'Start my day →'}</a>
    </header>

    <div class="widgets">
      <${WeekWidget} days=${days} date=${date} cal=${cal} />
      <${TodayEvents} date=${date} cal=${cal} />
      <${TodosWidget} state=${state} date=${date} />
      <${RevenueWidget} state=${state} date=${date} />
    </div>
  `;
}

function CalNote({ cal }) {
  if (cal.status === 'off') return html`<p class="muted small w-note">Calendar not connected yet.</p>`;
  if (cal.status === 'error') return html`<p class="muted small w-note">Couldn't reach your calendar.</p>`;
  return null;
}

function WeekWidget({ days, date, cal }) {
  const total = cal.events.length;
  const next = cal.events.find((e) => !e.allDay && e.start >= `${date}T${'00:00'}`) || null;
  return html`<a class="widget w-week" href="#/week">
    <div class="w-title"><${Icon} d=${ICON.cal} /><span>This week</span></div>
    <div class="wk-grid">
      ${days.map((d) => {
        const evs = eventsOn(cal.events, d);
        return html`<div class=${'wk-day' + (d === date ? ' today' : '') + (d < date ? ' past' : '')}>
          <small>${DOW[weekday(d)]}</small>
          <b>${+d.slice(8)}</b>
          <div class="dots">
            ${evs.slice(0, 4).map((e) => html`<i class=${e.allDay ? 'all' : ''} title=${e.title}></i>`)}
            ${evs.length > 4 && html`<em>+${evs.length - 4}</em>`}
          </div>
          <div class="wk-times">${evs.slice(0, 5).map((e) => html`<span class=${e.allDay ? 'all' : ''}>${e.allDay ? 'All day' : eventTime(e, d)}</span>`)}
            ${evs.length > 5 && html`<span class="more">+${evs.length - 5}</span>`}</div>
        </div>`;
      })}
    </div>
    <div class="w-foot">
      ${cal.status === 'ok'
        ? html`<span>${total ? `${total} event${total === 1 ? '' : 's'} this week` : 'Nothing on the calendar'}</span>
          ${next && html`<span class="muted">Next: ${next.start.slice(0, 10) === date ? '' : DOW_LONG[weekday(next.start.slice(0, 10))].slice(0, 3) + ' '}${eventTime(next)} · ${next.title}</span>`}`
        : cal.status === 'loading' ? html`<span class="muted">Loading calendar…</span>` : html`<${CalNote} cal=${cal} />`}
    </div>
  </a>`;
}

function TodayEvents({ date, cal }) {
  const evs = eventsOn(cal.events, date);
  return html`<a class="widget w-events" href="#/week">
    <div class="w-title"><${Icon} d=${ICON.clock} /><span>Today</span>${evs.length > 0 && html`<b class="w-count">${evs.length}</b>`}</div>
    ${cal.status === 'ok' && evs.length === 0 && html`<p class="muted w-empty">No events today</p>`}
    ${cal.status !== 'ok' && html`<${CalNote} cal=${cal} />`}
    <ul class="w-list">
      ${evs.slice(0, 4).map((e) => html`<li><span class="w-time">${eventTime(e, date)}</span><span class="w-what">${e.title}</span></li>`)}
    </ul>
    ${evs.length > 4 && html`<small class="muted">+${evs.length - 4} more</small>`}
  </a>`;
}

function TodosWidget({ state, date }) {
  const day = state.days[date];
  const open = L.openTodos(day);
  const all = day ? (day.items || []).length + (day.tasks || []).filter((t) => !t.dropped && !t.carriedTo).length : 0;
  return html`<a class="widget w-todos" href="#/tasks">
    <div class="w-title"><${Icon} d=${ICON.check} /><span>To-dos</span>${all > 0 && html`<b class="w-count">${all - open.length}/${all}</b>`}</div>
    ${!day && html`<p class="muted w-empty">${L.isSunday(date) ? 'Sunday: plan the week.' : 'Starts with your check-in.'}</p>`}
    ${day && open.length === 0 && html`<p class="good w-empty">All done ✓</p>`}
    <ul class="w-list checks">
      ${open.slice(0, 4).map((t) => html`<li><i class="w-box"></i><span class="w-what">${t.title}</span></li>`)}
    </ul>
    ${open.length > 4 && html`<small class="muted">+${open.length - 4} more</small>`}
  </a>`;
}

function RevenueWidget({ state, date }) {
  const r = L.revenueStatus(state, date);
  const proj = r.projected || 0;
  const pct = r.target ? Math.min(100, (r.collected / r.target) * 100) : 0;
  const projPct = r.target ? Math.min(100, (proj / r.target) * 100) : 0;
  const ahead = proj >= r.target;
  return html`<a class="widget w-rev" href="#/cash">
    <div class="w-title"><${Icon} d=${ICON.trend} /><span>${monthName(monthKey(date))} projection</span></div>
    <div class="w-rev-main">
      <div><b class="w-big">${r.elapsed ? money(proj) : '—'}</b><small class="muted">projected of ${money(r.target)}</small></div>
      <div class="w-rev-side"><b>${money(r.collected)}</b><small class="muted">collected</small></div>
    </div>
    <div class="w-meter"><i class="proj" style=${{ width: projPct + '%' }}></i><i style=${{ width: pct + '%' }}></i></div>
    <small class=${r.elapsed ? (ahead ? 'good' : 'bad') : 'muted'}>${r.elapsed
      ? ahead ? `On track to beat the goal by ${money(proj - r.target)}` : `${money(r.target - proj)} short at this pace · need ${money(r.perDay)}/day`
      : 'Projection starts after the first day of cash.'}</small>
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
