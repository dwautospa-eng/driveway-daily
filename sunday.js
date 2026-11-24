// Sunday planning prompt (~15 min). Opens instead of the checklist on Sundays.
// Reviews Mon–Sat that just ended and builds next week (stored under next Monday's date).
import { html, useState } from './preact.js';
import { update } from './store.js';
import * as L from './logic.js';
import { addDays, dayLabel, shortLabel, dateShort } from './dates.js';
import { money, parseMoney, fmtMin } from './util.js';
import { Bar, RevenueBlock } from './common.js';
import { NewGoal } from './goals.js';

const DAY_ABBR = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function Sunday({ state, now }) {
  const date = now.date;
  const next = addDays(date, 1);
  const plan = state.weeks?.[next];
  const [editing, setEditing] = useState(!plan?.reviewedAt);
  if (plan?.reviewedAt && !editing) return html`<${PlanDone} plan=${plan} next=${next} onEdit=${() => setEditing(true)} />`;
  return html`<${PlanForm} state=${state} date=${date} next=${next} plan=${plan || L.blankWeek()} onDone=${() => { setEditing(false); window.scrollTo(0, 0); }} />`;
}

function PlanForm({ state, date, next, plan: P, onDone }) {
  const rv = L.weekReview(state, date);
  const set = (fn) => update((s) => fn(L.ensureWeek(s, next)));
  const [addingGoal, setAddingGoal] = useState(false);
  const [task, setTask] = useState('');
  const [mins, setMins] = useState(15);
  const maxVol = Math.max(1, ...rv.rows.map((r) => r.volume));
  const maxCash = Math.max(1, ...rv.rows.map((r) => r.cash || 0));
  const trend = (cur, prev) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null);
  const vt = trend(rv.volume, rv.prevVolume), ct = trend(rv.cash, rv.prevCash);
  const reviewGoals = state.goals.filter((g) => g.type !== 'revenue' && (L.activeGoals(state, date).includes(g) || P.goalReview[g.id]));
  const hasOutcome = P.outcomes.some((o) => o.trim());

  const lockIn = () => {
    update((s) => { const p = L.ensureWeek(s, next); p.reviewedAt = Date.now(); L.applyMondayTasks(s, next); });
    onDone();
  };

  return html`
    <header class="top"><div><div class="eyebrow">${dayLabel(date)}</div><h1>Sunday planning</h1></div></header>
    <p class="lede">About 15 minutes. Close out last week, then set up the next one. Everything saves as you type.</p>

    <section class="card">
      <h2><span class="step">1</span>Last week's numbers</h2>
      <div class="muted small">${shortLabel(rv.start)} – ${shortLabel(rv.end)}</div>
      <div class="stat-row">
        <div><small>Avg completion</small><b>${rv.avgPct == null ? '—' : rv.avgPct + '%'}</b></div>
        <div><small>Volume</small><b>${rv.volume}</b>${vt != null && html`<small class=${vt >= 0 ? 'good' : 'bad'}>${vt >= 0 ? '▲' : '▼'} ${Math.abs(vt)}% vs prior</small>`}</div>
        <div><small>Cash collected</small><b>${money(rv.cash)}</b>${ct != null && html`<small class=${ct >= 0 ? 'good' : 'bad'}>${ct >= 0 ? '▲' : '▼'} ${Math.abs(ct)}% vs prior</small>`}</div>
      </div>

      <div class="week-table">
        <div class="wt-row wt-head"><span></span><span>Done</span><span>Volume</span><span>Cash</span></div>
        ${rv.rows.map((r, i) => html`<div class=${'wt-row' + (r.worked ? '' : ' off')}>
          <span>${DAY_ABBR[i]}</span>
          <span>${r.pct == null ? '—' : r.pct + '%'}</span>
          <span class="wt-bar"><i style=${{ width: (r.volume / maxVol) * 100 + '%' }}></i><em>${r.volume || '—'}</em></span>
          <span class="wt-bar cash"><i style=${{ width: ((r.cash || 0) / maxCash) * 100 + '%' }}></i><em>${r.cash == null ? '—' : money(r.cash)}</em></span>
        </div>`)}
        <div class="wt-row wt-total"><span>Week</span><span>${rv.avgPct == null ? '—' : rv.avgPct + '%'}</span><span>${rv.volume} / ${rv.volTarget}</span><span>${money(rv.cash)}</span></div>
      </div>

      ${rv.mostPushed.length > 0 && html`<h3>Most-pushed tasks</h3>
        <ul class="plain-list">${rv.mostPushed.map(([t, n]) => html`<li><span class="grow">${t}</span><span class="tag late">pushed ${n}×</span></li>`)}</ul>`}

      <h3>Monthly revenue</h3>
      <${RevenueBlock} state=${state} today=${date} />
    </section>

    <section class="card form">
      <h2><span class="step">2</span>Wins from the week</h2>
      <${Reference} items=${[...rv.eods.filter((e) => e.win).map((e) => [e.date, e.win]), ...rv.wins.map((w) => [w.date, w.text])]} label="From your end-of-day notes" />
      <textarea rows="3" value=${P.wins} placeholder="The wins that mattered most…" onInput=${(e) => set((p) => { p.wins = e.target.value; })} />
    </section>

    <section class="card form">
      <h2><span class="step">3</span>What slipped, and why</h2>
      <${Reference} items=${rv.eods.filter((e) => e.slipped).map((e) => [e.date, e.slipped])} label="From your end-of-day notes" />
      <textarea rows="3" value=${P.slipped} placeholder="Be honest. What got in the way?" onInput=${(e) => set((p) => { p.slipped = e.target.value; })} />
    </section>

    <section class="card">
      <h2><span class="step">4</span>Review each goal</h2>
      ${reviewGoals.length === 0 && html`<p class="muted">No active goals to review.</p>`}
      ${reviewGoals.map((g) => html`<${GoalReview} key=${g.id} g=${g} state=${state} date=${date} decision=${P.goalReview[g.id]} set=${set} />`)}
    </section>

    <section class="card">
      <h2><span class="step">5</span>Add new goals</h2>
      ${addingGoal
        ? html`<${NewGoal} state=${state} today=${next} onDone=${() => setAddingGoal(false)} />`
        : html`<button class="btn ghost" onClick=${() => setAddingGoal(true)}>+ Add a goal</button>`}
    </section>

    <section class="card form">
      <h2><span class="step">6</span>Top 3 outcomes for next week</h2>
      <p class="muted small">Results, not tasks. These get pinned at the top of every day next week.</p>
      ${P.outcomes.map((o, i) => html`<label class="outcome-input"><span class="step">${i + 1}</span>
        <input value=${o} placeholder=${['Close 3 PPF jobs', 'Collect $12k', 'Sign 1 new referral partner'][i]} onInput=${(e) => set((p) => { p.outcomes[i] = e.target.value; })} /></label>`)}
    </section>

    <section class="card form">
      <h2><span class="step">7</span>Revenue or booking goal for the week</h2>
      <div class="field-row">
        <label>Cash to collect<div class="money-input"><span>$</span><input inputmode="numeric" value=${P.cashTarget ?? ''} placeholder="10,000"
          onInput=${(e) => set((p) => { p.cashTarget = parseMoney(e.target.value); })} /></div></label>
        <label>Customers to close<input type="number" inputmode="numeric" min="0" value=${P.bookingsTarget ?? ''} placeholder="5"
          onInput=${(e) => set((p) => { p.bookingsTarget = e.target.value === '' ? null : Math.max(0, parseInt(e.target.value, 10) || 0); })} /></label>
      </div>
      <p class="muted small">Need ${money(L.revenueStatus(state, date).perDay * 6)} over 6 working days to stay on pace for the month.</p>
    </section>

    <section class="card form">
      <h2><span class="step">8</span>Big items this week</h2>
      <p class="muted small">Big pickups, drop-offs, meetings or events coming up next week.</p>
      <textarea rows="3" value=${P.bigItems} placeholder="Big pickups, drop-offs, meetings, events…" onInput=${(e) => set((p) => { p.bigItems = e.target.value; })} />
    </section>

    <section class="card form">
      <h2><span class="step">9</span>One thing to stop doing</h2>
      <input value=${P.stopDoing} placeholder="e.g. Answering price DMs myself" onInput=${(e) => set((p) => { p.stopDoing = e.target.value; })} />
    </section>

    <section class="card form">
      <h2><span class="step">10</span>What did only I do this week that someone else could have done?</h2>
      <textarea rows="3" value=${P.handoff} placeholder="Hamm, DJ, a hire, or an automation could own…" onInput=${(e) => set((p) => { p.handoff = e.target.value; })} />
    </section>

    <section class="card">
      <h2><span class="step">✓</span>Monday's list</h2>
      <p class="muted small">These become tasks on Monday morning.</p>
      ${P.outcomes.filter((o) => o.trim() && !P.mondayTasks.some((t) => t.title === o.trim())).map((o) => html`
        <button class="chip" onClick=${() => set((p) => { p.mondayTasks.push({ title: o.trim(), minutes: 30 }); })}>+ ${o.trim()}</button>`)}
      <form class="inline-form" style=${{ marginTop: '10px' }} onSubmit=${(e) => { e.preventDefault(); if (!task.trim()) return; set((p) => { p.mondayTasks.push({ title: task.trim(), minutes: mins }); }); setTask(''); }}>
        <input value=${task} onInput=${(e) => setTask(e.target.value)} placeholder="Add a Monday task" aria-label="Monday task" />
        <select value=${mins} onChange=${(e) => setMins(+e.target.value)} aria-label="Estimated time">
          ${[5, 10, 15, 20, 30, 45, 60, 90].map((v) => html`<option value=${v}>${fmtMin(v)}</option>`)}
        </select>
        <button class="btn" type="submit" disabled=${!task.trim()}>Add</button>
      </form>
      <ul class="plain-list">${P.mondayTasks.map((t, i) => html`<li>
        <span class="grow">${t.title}</span><small class="muted">${fmtMin(t.minutes)}${t.added ? ' · added' : ''}</small>
        ${!t.added && html`<button class="icon-btn small-icon" aria-label="Remove" onClick=${() => set((p) => { p.mondayTasks.splice(i, 1); })}>✕</button>`}
      </li>`)}</ul>
    </section>

    <button class="btn primary big" disabled=${!hasOutcome} onClick=${lockIn}>Lock in next week</button>
    ${!hasOutcome && html`<p class="muted small center">Add at least one outcome to lock it in.</p>`}
  `;
}

function Reference({ items, label }) {
  if (!items.length) return null;
  return html`<details class="reference"><summary>${label} (${items.length})</summary>
    <ul class="plain-list">${items.map(([d, t]) => html`<li><span class="muted small ref-date">${dateShort(d)}</span><span class="grow">${t}</span></li>`)}</ul>
  </details>`;
}

const DECISIONS = [['hit', 'Hit'], ['keep', 'Keep going'], ['change', 'Change'], ['drop', 'Drop']];

function GoalReview({ g, state, date, decision, set }) {
  const p = L.goalProgress(state, g);
  const choose = (d) => {
    update((s) => {
      L.ensureWeek(s, addDays(date, 1)).goalReview[g.id] = d;
      const goal = s.goals.find((x) => x.id === g.id);
      if (d === 'hit') { goal.status = 'hit'; goal.completedAt = date; if (goal.type === 'done') goal.done = true; goal.celebrated = false; }
      else if (d === 'drop') { goal.status = 'dropped'; goal.completedAt = date; }
      else if (goal.status !== 'active') { goal.status = 'active'; delete goal.completedAt; goal.celebrated = true; if (goal.type === 'done') goal.done = false; }
    });
  };
  const mut = (fn) => update((s) => fn(s.goals.find((x) => x.id === g.id)));
  return html`<div class="goal-review">
    <div class="goal-top"><span class="goal-title">${g.title}</span><b>${p.label}</b></div>
    <${Bar} value=${p.value} max=${p.max} />
    <div class="muted small" style=${{ marginTop: '6px' }}>${g.due ? `Due ${dateShort(g.due)}` : ''}${g.repeat ? ' · repeats weekly' : ''}</div>
    <div class="seg wide review-seg">
      ${DECISIONS.map(([k, l]) => html`<button class=${decision === k ? 'on' : ''} onClick=${() => choose(k)}>${l}</button>`)}
    </div>
    ${decision === 'change' && html`<div class="field-row">
      ${g.type === 'number' && html`<label>Target<input type="number" inputmode="numeric" min="1" value=${g.target} onChange=${(e) => mut((x) => { x.target = Math.max(1, +e.target.value || 1); })} /></label>`}
      ${!g.repeat && html`<label>Due date<input type="date" value=${g.due || ''} onChange=${(e) => mut((x) => { x.due = e.target.value; x.timeframe = 'custom'; })} /></label>`}
    </div>`}
  </div>`;
}

function PlanDone({ plan, next, onEdit }) {
  const outs = plan.outcomes.filter((o) => o.trim());
  return html`
    <header class="top"><div><div class="eyebrow">Week of ${dateShort(next)}</div><h1>Next week is set</h1></div></header>
    <p class="lede">Rest up. It all shows up at the top of every day starting Monday.</p>
    <section class="card week-card">
      <div class="eyebrow">Top outcomes</div>
      ${outs.map((o, i) => html`<div class="outcome"><span class="box">${i + 1}</span><span>${o}</span></div>`)}
      <div class="stat-row two" style=${{ marginTop: '14px' }}>
        <div><small>Cash to collect</small><b>${plan.cashTarget ? money(plan.cashTarget) : '—'}</b></div>
        <div><small>Customers to close</small><b>${plan.bookingsTarget ?? '—'}</b></div>
      </div>
      ${plan.stopDoing.trim() && html`<p class="stop-doing"><b>Stop doing</b> ${plan.stopDoing}</p>`}
    </section>
    ${plan.mondayTasks.length > 0 && html`<section class="card">
      <h2>Monday's list</h2>
      <ul class="plain-list">${plan.mondayTasks.map((t) => html`<li><span class="grow">${t.title}</span><small class="muted">${fmtMin(t.minutes)}</small></li>`)}</ul>
    </section>`}
    <button class="btn big" onClick=${onEdit}>Edit the plan</button>
  `;
}
