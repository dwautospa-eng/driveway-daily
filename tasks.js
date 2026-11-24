// Tasks tab: the daily task list (same every weekday, editable right here) + today-only tasks.
import { html, useState, useEffect } from '../lib/preact.js';
import { update } from '../lib/store.js';
import * as L from '../lib/logic.js';
import { dayLabel, weekday } from '../lib/dates.js';
import { uid, fmtMin, fmtClock } from '../lib/util.js';
import { Bar } from './common.js';

export function Tasks({ state, now }) {
  const date = now.date, day = state.days[date], s = state.settings;
  const sat = weekday(date) === 6;
  const score = L.dayScore(day);
  const [editing, setEditing] = useState(false);

  const live = day.tasks.filter((t) => !t.dropped);
  const order = (t) => (t.done ? 1000 : 0) + (t.topOne ? 0 : t.pushCount > 0 ? 100 - t.pushCount : 200);
  const tasks = [...live].sort((a, b) => order(a) - order(b));
  const dropped = day.tasks.filter((t) => t.dropped);
  const dailyDone = day.items.filter((i) => i.done).length;

  return html`
    <header class="top">
      <div><div class="eyebrow">${dayLabel(date)}</div><h1>Tasks</h1></div>
      <div class="score"><b>${score.pct}%</b><small>${score.done}/${score.total} done</small></div>
    </header>
    <div class="tasks-bar"><${Bar} value=${score.done} max=${score.total || 1} /></div>

    <${TimePlan} day=${day} now=${now} settings=${s} />

    ${(sat || (day.pickups || []).length > 0) && html`<${Pickups} day=${day} date=${date} />`}

    <section class="card">
      <div class="card-head">
        <h2>Daily tasks</h2>
        <div class="head-actions">
          ${!editing && day.items.length > 0 && html`<small class="muted">${dailyDone}/${day.items.length}</small>`}
          <button class="link" onClick=${() => setEditing(!editing)}>${editing ? 'Done' : 'Edit list'}</button>
        </div>
      </div>
      ${editing
        ? html`<${DailyListEditor} state=${state} date=${date} />`
        : html`
          ${sat && html`<p class="muted small">Saturday is lighter: your daily list is Monday to Friday. Tap "Edit list" to change it.</p>`}
          ${!sat && day.items.length === 0 && html`<p class="muted">No daily tasks yet. Tap "Edit list" to add the things you do every day.</p>`}
          ${day.items.map((i) => html`<${Row} key=${i.refId} id=${i.refId} entry=${i} date=${date} day=${day} state=${state} />`)}`}
    </section>

    <section class="card">
      <div class="card-head"><h2>${sat ? 'Finish the week' : 'Today only'}</h2><small class="muted">${live.filter((t) => t.done).length}/${live.length}</small></div>
      <p class="muted small">${sat ? "Anything left from the week lands here. Close it out or drop it with a reason." : "One-off tasks for today. Unfinished ones move to tomorrow, marked late."}</p>
      <${AddTask} date=${date} />
      ${tasks.map((t) => html`<${Row} key=${t.id} id=${t.id} entry=${t} date=${date} day=${day} state=${state} isTask />`)}
      ${dropped.length > 0 && html`<details class="dropped"><summary>Dropped (${dropped.length})</summary>
        ${dropped.map((t) => html`<div class="dropped-item"><s>${t.title}</s><small class="muted">Reason: ${t.dropped.reason}</small></div>`)}
      </details>`}
    </section>
  `;
}

// Edit the recurring daily list in place. Changes apply today and every weekday after.
function DailyListEditor({ state, date }) {
  const list = state.settings.nonNegotiables;
  const set = (fn) => update((st) => { fn(st.settings.nonNegotiables); L.syncItems(st, date); });
  const move = (arr, i, dir) => { const j = i + dir; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; };
  return html`<div class="daily-editor">
    <p class="muted small">These show up every Monday to Friday. Minutes are your time estimate.</p>
    ${list.map((n, i) => html`<div class="edit-row" key=${n.id}>
      <input value=${n.title} onInput=${(e) => set((x) => { x[i].title = e.target.value; })} aria-label="Daily task" />
      <input class="num" type="number" inputmode="numeric" min="0" value=${n.minutes} aria-label="Minutes"
        onChange=${(e) => set((x) => { x[i].minutes = Math.max(0, +e.target.value || 0); })} />
      <button class="icon-btn" disabled=${i === 0} onClick=${() => set((x) => move(x, i, -1))} aria-label="Move up">↑</button>
      <button class="icon-btn" onClick=${() => confirm(`Remove "${n.title}" from your daily list?`) && set((x) => { x.splice(i, 1); })} aria-label="Delete">✕</button>
    </div>`)}
    <button class="btn ghost" onClick=${() => set((x) => { x.push({ id: 'nn_' + uid(), title: '', minutes: 15 }); })}>+ Add daily task</button>
  </div>`;
}

function TimePlan({ day, now, settings }) {
  const all = [...day.items, ...day.tasks.filter((t) => !t.dropped)];
  const left = all.filter((x) => !x.done).reduce((a, x) => a + (x.minutes || 0), 0);
  const total = all.reduce((a, x) => a + (x.minutes || 0), 0);
  const timeLeft = Math.max(0, settings.workdayEnd - now.minutes);
  const over = left - timeLeft;
  return html`<section class="card">
    <div class="stat-row two">
      <div><small>Still to do</small><b>${fmtMin(left)}</b></div>
      <div><small>Time left (until ${fmtClock(settings.workdayEnd)})</small><b>${fmtMin(timeLeft)}</b></div>
    </div>
    ${over > 0
      ? html`<p class="warn-text">You've planned ${fmtMin(over)} more than fits today. Push or drop something.</p>`
      : html`<p class="muted small">${fmtMin(timeLeft - left)} of slack. Planned today: ${fmtMin(total)}.</p>`}
  </section>`;
}

function Pickups({ day, date }) {
  const [name, setName] = useState('');
  const pickups = day.pickups || [];
  const add = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    update((s) => { const d = s.days[date]; (d.pickups ||= []).push({ id: uid(), name: name.trim(), checks: {} }); });
    setName('');
  };
  const toggle = (id, k) => update((s) => { const p = s.days[date].pickups.find((x) => x.id === id); p.checks[k] = !p.checks[k]; });
  const required = L.PICKUP_STEPS.filter((x) => !x[2]).length;
  return html`<section class="card">
    <div class="card-head"><h2>Pickups</h2><small class="muted">${pickups.length} today</small></div>
    <p class="muted small">Add each car going home today.</p>
    <form class="inline-form" onSubmit=${add}>
      <input value=${name} onInput=${(e) => setName(e.target.value)} placeholder="Customer / car, e.g. Mike, GT3 PPF" aria-label="New pickup" />
      <button class="btn primary" type="submit" disabled=${!name.trim()}>Add</button>
    </form>
    ${pickups.map((p) => {
      const n = L.PICKUP_STEPS.filter(([k, , opt]) => !opt && p.checks[k]).length;
      return html`<div class=${'pickup' + (n === required ? ' complete' : '')} key=${p.id}>
        <div class="pickup-head">
          <b class="grow">${p.name}</b><small class=${n === required ? 'good' : 'muted'}>${n}/${required}</small>
          <button class="icon-btn small-icon" aria-label="Remove pickup" onClick=${() => confirm(`Remove ${p.name}?`) && update((s) => { const d = s.days[date]; d.pickups = d.pickups.filter((x) => x.id !== p.id); })}>✕</button>
        </div>
        ${L.PICKUP_STEPS.map(([k, label, opt]) => html`<button class=${'mini-check' + (p.checks[k] ? ' on' : '') + (opt ? ' opt' : '')} onClick=${() => toggle(p.id, k)}>
          <span class="box">${p.checks[k] ? '✓' : ''}</span><span>${label}</span></button>`)}
      </div>`;
    })}
  </section>`;
}

function AddTask({ date }) {
  const [t, setT] = useState('');
  const [m, setM] = useState(15);
  const add = (e) => {
    e.preventDefault();
    if (!t.trim()) return;
    update((s) => { s.days[date].tasks.push(L.newTask(date, t.trim(), m)); });
    setT('');
  };
  return html`<form class="inline-form" onSubmit=${add}>
    <input value=${t} onInput=${(e) => setT(e.target.value)} placeholder="Add a task for today" aria-label="New task" />
    <select value=${m} onChange=${(e) => setM(+e.target.value)} aria-label="Estimated time">
      ${[5, 10, 15, 20, 30, 45, 60, 90, 120].map((v) => html`<option value=${v}>${fmtMin(v)}</option>`)}
    </select>
    <button class="btn primary" type="submit" disabled=${!t.trim()}>Add</button>
  </form>`;
}

function Elapsed({ start }) {
  const [, tick] = useState(0);
  useEffect(() => { const i = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(i); }, []);
  const sec = Math.max(0, Math.floor((Date.now() - start) / 1000));
  return html`<span class="elapsed">⏱ ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}</span>`;
}

function Row({ id, entry, date, day, state, isTask }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const running = day.timer?.key === id;
  const mut = (fn) => update((s) => fn(L.findEntry(s.days[date], id), s.days[date]));
  const avg = !isTask ? L.avgActual(state, id, date) : null;
  const goal = isTask && entry.goalId ? state.goals.find((g) => g.id === entry.goalId) : null;
  const numberGoals = state.goals.filter((g) => g.status === 'active' && g.type === 'number');
  const fresh = isTask && !entry.pushCount && !entry.topOne;

  return html`<div class=${'row-wrap' + (open ? ' open' : '')}>
    <div class=${'row' + (entry.done ? ' done' : '') + (running ? ' running' : '')}>
      <button class="check" aria-label=${entry.done ? 'Mark not done' : 'Mark done'} onClick=${() => update((s) => L.toggleDone(s.days[date], id))}>
        ${entry.done ? '✓' : ''}
      </button>
      <button class="row-main" onClick=${() => setOpen(!open)} aria-expanded=${open}>
        <span class="row-title">
          ${entry.topOne && html`<span class="tag accent">#1</span>`}${entry.title}
        </span>
        <span class="row-meta">
          <span>${fmtMin(entry.minutes)}</span>
          ${entry.actual != null && html`<span>took ${fmtMin(entry.actual)}</span>`}
          ${running && html`<${Elapsed} start=${day.timer.start} />`}
          ${isTask && entry.pushCount > 0 && html`<span class="tag late">Late · pushed ${entry.pushCount} ${entry.pushCount === 1 ? 'day' : 'days'}</span>`}
          ${goal && html`<span class="tag">→ ${goal.title}</span>`}
        </span>
      </button>
      ${!entry.done && html`<button class=${'timer-btn' + (running ? ' on' : '')} aria-label=${running ? 'Stop timer' : 'Start timer'}
        onClick=${() => update((s) => { const d = s.days[date]; running ? L.stopTimer(d) : L.startTimer(d, id); })}>${running ? '■' : '▶'}</button>`}
    </div>
    ${open && html`<div class="row-detail">
      ${entry.note && html`<p class="muted small">${entry.note}</p>`}
      <div class="field-row">
        <label>Estimate (min)<input type="number" inputmode="numeric" min="0" value=${entry.minutes}
          onChange=${(e) => mut((x) => { x.minutes = Math.max(0, +e.target.value || 0); x.minutesEdited = true; })} /></label>
        <label>How long did it take? (min)<input type="number" inputmode="numeric" min="0" placeholder="—" value=${entry.actual ?? ''}
          onChange=${(e) => mut((x) => { x.actual = e.target.value === '' ? null : Math.max(0, +e.target.value); })} /></label>
      </div>
      ${avg && html`<p class="muted small">Usually takes you about ${fmtMin(avg.avg)} (last ${avg.n} times).</p>`}
      ${isTask && html`<label class="full">Counts toward goal
        <select value=${entry.goalId || ''} onChange=${(e) => mut((x) => { x.goalId = e.target.value || null; })}>
          <option value="">None</option>
          ${numberGoals.map((g) => html`<option value=${g.id}>${g.title}</option>`)}
        </select></label>`}
      ${isTask && !entry.done && html`<div class="drop">
        <input value=${reason} onInput=${(e) => setReason(e.target.value)} placeholder="Why are you dropping this?" aria-label="Reason for dropping" />
        <button class="btn danger" disabled=${!reason.trim()} onClick=${() => mut((x) => { x.dropped = { reason: reason.trim(), at: Date.now() }; })}>Drop</button>
      </div>`}
      ${fresh && html`<button class="link danger-text" onClick=${() => update((s) => { const d = s.days[date]; d.tasks = d.tasks.filter((t) => t.id !== id); if (d.timer?.key === id) d.timer = null; })}>Delete (typo / added by mistake)</button>`}
    </div>`}
  </div>`;
}
