// Today: focus and motivation. The checklist itself lives on the Tasks tab.
import { html, useState } from './preact.js';
import { update } from './store.js';
import * as L from './logic.js';
import { dayLabel, shortLabel, weekday } from './dates.js';
import { fmtMin, money } from './util.js';
import { Bar, GoalList } from './common.js';

const GROUPS = [['outreach', 'Outreach'], ['content', 'Content'], ['team', 'Team']];

export function Today({ state, now }) {
  const date = now.date, day = state.days[date], s = state.settings;
  const score = L.dayScore(day);
  const streak = L.streak(state, date);
  const pending = L.findPendingEod(state, date);
  const wd = weekday(date);
  const sat = wd === 6;
  const reminders = s.reminders.filter((r) => !r.rolling && r.days.includes(wd) && !day.reminders[r.id]);

  return html`
    <header class="top">
      <div><div class="eyebrow">${dayLabel(date)}</div><h1>${sat ? 'Saturday' : 'Today'}</h1></div>
      <div class="score">
        <b>${score.pct}%</b>
        <small>${score.done}/${score.total} done</small>
        ${streak > 0 && html`<small class="streak">🔥 ${streak}-day streak</small>`}
      </div>
    </header>
    ${pending && html`<a class="banner warn" href=${'#/eod/' + pending}>You never closed out ${shortLabel(pending)}. Finish it →</a>`}
    ${!day.eod && now.minutes >= s.workdayEnd - 60 && html`<a class="banner lead" href="#/eod"><b>End of day</b> How much cash did we collect today? Close out →</a>`}

    <${Intention} date=${date} day=${day} />
    <${WeekCard} state=${state} date=${date} />
    <a class="card tight block-link" href="#/goals"><${GoalList} state=${state} today=${date} compact /></a>
    <div class="banner lead"><b>Speed to lead</b> New leads → call within 60 seconds.</div>

    ${reminders.map((r) => html`<div class="card reminder">
      <div><div class="eyebrow">Reminder</div><b>${r.text}</b></div>
      <div class="btn-row">
        <button class="btn" onClick=${() => update((st) => { st.days[date].reminders[r.id] = true; })}>Did it today</button>
        <button class="btn ghost" onClick=${() => update((st) => { st.settings.reminders.find((x) => x.id === r.id).rolling = true; })}>It's rolling, stop reminding</button>
      </div>
    </div>`)}

    <${TasksSummary} day=${day} score=${score} sat=${sat} />
    <${Volume} day=${day} date=${date} settings=${s} state=${state} />

    ${day.eod
      ? html`<section class="card closed">
          <div><b>Day closed ✓</b><div class="muted">${money(day.cash)} collected · volume ${L.volumeTotal(day)}</div></div>
          <a class="btn ghost" href="#/eod">Edit</a>
        </section>`
      : html`<a class="btn primary big" href="#/eod">End of day →</a>`}
  `;
}

// A glance at what's left; the full list is on the Tasks tab.
function TasksSummary({ day, score, sat }) {
  const order = (t) => (t.topOne ? 0 : t.pushCount > 0 ? 100 - t.pushCount : 200);
  const open = [
    ...day.tasks.filter((t) => !t.dropped && !t.done && (t.topOne || t.pushCount > 0)).sort((a, b) => order(a) - order(b)),
    ...day.items.filter((i) => !i.done),
    ...day.tasks.filter((t) => !t.dropped && !t.done && !t.topOne && !t.pushCount),
  ];
  const pickups = (day.pickups || []).length;
  return html`<a class="card block-link tasks-summary" href="#/tasks">
    <div class="card-head"><h2>Tasks</h2><b class="big-num">${score.done} / ${score.total}</b></div>
    <${Bar} value=${score.done} max=${score.total || 1} />
    ${open.length === 0
      ? html`<p class="good" style=${{ margin: '12px 0 0', fontWeight: 650 }}>Everything's done. ✓</p>`
      : html`<div class="next-up">
          <div class="eyebrow sub">Up next</div>
          ${open.slice(0, 3).map((t) => html`<div class="next-row">
            <span class="grow">${t.topOne ? '#1 ' : ''}${t.title}</span>
            ${t.pushCount > 0 && html`<span class="tag late">late</span>`}
            <small class="muted">${fmtMin(t.minutes)}</small>
          </div>`)}
          ${open.length > 3 && html`<div class="muted small">+ ${open.length - 3} more</div>`}
        </div>`}
    ${sat && pickups > 0 && html`<div class="muted small" style=${{ marginTop: '8px' }}>${pickups} pickup${pickups === 1 ? '' : 's'} today</div>`}
    <div class="link" style=${{ marginTop: '12px' }}>Open tasks →</div>
  </a>`;
}

// Next-week plan from Sunday: top 3 outcomes, weekly targets, the one thing to stop.
function WeekCard({ state, date }) {
  const w = L.weekProgress(state, date);
  if (!w) return null;
  const p = w.plan;
  const outs = p.outcomes.map((o, i) => [o, i]).filter(([o]) => o.trim());
  if (!outs.length && !p.cashTarget && !p.bookingsTarget && !p.stopDoing) return null;
  return html`<section class="card week-card">
    <div class="eyebrow">This week's outcomes</div>
    ${outs.map(([o, i]) => html`<button class=${'outcome' + (p.outcomesDone[i] ? ' on' : '')}
      onClick=${() => update((s) => { const pl = s.weeks[w.key]; pl.outcomesDone[i] = !pl.outcomesDone[i]; })}>
      <span class="box">${p.outcomesDone[i] ? '✓' : i + 1}</span><span>${o}</span></button>`)}
    ${p.cashTarget > 0 && html`<div class="goal week-goal">
      <div class="goal-top"><span class="goal-title">Cash this week</span><b>${money(w.cash)} / ${money(p.cashTarget)}</b></div>
      <${Bar} value=${w.cash} max=${p.cashTarget} /></div>`}
    ${p.bookingsTarget > 0 && html`<div class="goal week-goal">
      <div class="goal-top"><span class="goal-title">Customers closed this week</span><b>${w.jobs} / ${p.bookingsTarget}</b></div>
      <${Bar} value=${w.jobs} max=${p.bookingsTarget} /></div>`}
    ${p.stopDoing.trim() && html`<p class="stop-doing"><b>Stop doing</b> ${p.stopDoing}</p>`}
  </section>`;
}

function Intention({ date, day }) {
  const [edit, setEdit] = useState(false);
  return html`<section class="card intention">
    <div class="eyebrow">Today I win if I…</div>
    ${edit
      ? html`<input class="intention-input" autoFocus value=${day.checkin.intention}
          onInput=${(e) => update((s) => { s.days[date].checkin.intention = e.target.value; })}
          onBlur=${() => setEdit(false)} onKeyDown=${(e) => e.key === 'Enter' && setEdit(false)} />`
      : html`<button class="intention-text" onClick=${() => setEdit(true)}>${day.checkin.intention || 'Tap to set'}</button>`}
  </section>`;
}

function Volume({ day, date, settings, state }) {
  const total = L.volumeTotal(day), target = L.volumeTarget(day);
  const bump = (id, n) => update((s) => {
    const c = s.days[date].counts;
    c[id] = Math.max(0, (c[id] || 0) + n);
  });
  return html`<section class="card">
    <div class="card-head"><h2>Volume today</h2><b class="big-num">${total} / ${target}</b></div>
    <${Bar} value=${total} max=${target} />
    ${GROUPS.map(([g, label]) => {
      const list = settings.counters.filter((c) => c.group === g);
      return list.length > 0 && html`
      <h3>${label}</h3>
      ${list.map((c) => {
        const weekly = c.per === 'week';
        const today = day.counts[c.id] || 0;
        const n = weekly ? L.weekCount(state, date, c.id) : today;
        const t = weekly ? c.target : (day.targets[c.id] ?? c.target);
        const step = c.step || 1;
        return html`<div class=${'counter' + (t > 0 && n >= t ? ' hit' : '')}>
          <div class="counter-label"><span>${c.label}</span><small>${n} / ${t}${weekly ? ' this week' : ''}${t > 0 && n >= t ? ' ✓' : ''}</small></div>
          <button class="minus" disabled=${today <= 0} onClick=${() => bump(c.id, -1)} aria-label=${'Minus one ' + c.label}>−</button>
          ${step > 1 && html`<button class="plus" onClick=${() => bump(c.id, step)} aria-label=${'Plus ' + step + ' ' + c.label}>+${step}</button>`}
          <button class="plus" onClick=${() => bump(c.id, 1)} aria-label=${'Plus one ' + c.label}>+1</button>
        </div>`;
      })}`;
    })}
  </section>`;
}
