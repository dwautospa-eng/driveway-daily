import { html, useState } from './preact.js';
import { update } from './store.js';
import * as L from './logic.js';
import { monthKey, monthName, nextMonth, dateShort, diffDays } from './dates.js';
import { uid, money, parseMoney } from './util.js';
import { Bar } from './common.js';

const TF = [['week', 'This week'], ['month', 'This month'], ['quarter', 'This quarter'], ['custom', 'Custom date']];
const tfLabel = (g) => (g.type === 'revenue' ? monthName(g.month)
  : g.repeat ? (g.repeat === 'week' ? 'Every week' : 'Every month')
  : (TF.find((t) => t[0] === g.timeframe)?.[1] || 'Custom'));
const STATUS = { hit: ['Hit', 'good'], dropped: ['Dropped', 'muted'], missed: ['Missed', 'bad'] };

export function Goals({ state, now }) {
  const today = now.date;
  const [adding, setAdding] = useState(false);
  const active = L.activeGoals(state, today);
  const history = state.goals
    .filter((g) => STATUS[g.status] && !active.includes(g))
    .sort((a, b) => ((a.completedAt || '') < (b.completedAt || '') ? 1 : -1));
  const earned = history.filter((g) => g.status === 'hit' && g.reward);

  return html`
    <header class="top">
      <div><div class="eyebrow">What I'm after</div><h1>Goals</h1></div>
      ${!adding && html`<button class="btn primary" onClick=${() => setAdding(true)}>+ New goal</button>`}
    </header>

    ${adding && html`<${NewGoal} state=${state} today=${today} onDone=${() => setAdding(false)} />`}

    ${active.length === 0 && !adding && html`<section class="card"><p class="muted">No active goals. Add one to see it every morning and at the top of every day.</p></section>`}
    ${active.map((g) => html`<${GoalCard} key=${g.id} g=${g} state=${state} today=${today} />`)}

    <h3 class="section-title">History</h3>
    ${earned.length > 0 && html`<p class="muted small">Rewards earned: ${earned.length}</p>`}
    <section class="card">
      ${history.length === 0 && html`<p class="muted">Goals you hit or drop show up here.</p>`}
      ${history.map((g) => {
        const p = L.goalProgress(state, g);
        return html`<div class="hist-row" key=${g.id}>
          <div class="grow">
            <div><b>${g.title}</b>${g.type === 'revenue' ? ` · ${monthName(g.month)}` : ''}</div>
            <div class="muted small">${g.repeat && g.start ? `Week of ${dateShort(g.start)}` : `${STATUS[g.status][0]} ${g.completedAt ? dateShort(g.completedAt) : ''}`} · ${p.label}</div>
            ${g.status === 'hit' && g.reward && html`<div class="reward">🎁 Earned: ${g.reward}</div>`}
          </div>
          <span class=${'pill ' + STATUS[g.status][1]}>${STATUS[g.status][0]}</span>
        </div>`;
      })}
    </section>
  `;
}

function GoalCard({ g, state, today }) {
  const [open, setOpen] = useState(false);
  const p = L.goalProgress(state, g);
  const mut = (fn) => update((s) => { fn(s.goals.find((x) => x.id === g.id), s); L.markHitGoals(s, today); });
  const daysLeft = g.due ? diffDays(today, g.due) : null;
  const overdue = daysLeft != null && daysLeft < 0 && g.status === 'active';

  return html`<section class=${'card goal-card' + (g.status === 'hit' ? ' hit' : '')}>
    <button class="goal-head" onClick=${() => setOpen(!open)} aria-expanded=${open}>
      <div class="grow">
        <div class="goal-title-lg">${g.title}</div>
        <div class="muted small">
          ${tfLabel(g)}${g.due && g.type !== 'revenue' ? ` · by ${dateShort(g.due)}` : ''}
          ${daysLeft != null && daysLeft >= 0 && g.status === 'active' ? ` · ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left` : ''}
          ${overdue && html` <span class="tag late">Overdue</span>`}
          ${g.status === 'hit' && html` <span class="tag good-tag">Hit ✓</span>`}
        </div>
      </div>
      <b class="goal-num">${p.label}</b>
    </button>
    <${Bar} value=${p.value} max=${p.max} />
    ${g.reward && html`<div class="reward">🎁 ${g.reward}</div>`}

    ${g.status === 'active' && g.type === 'number' && html`<div class="goal-actions">
      <span class="muted small grow">${sourceText(p, g, state)}</span>
      <button class="minus-sm" disabled=${(g.base || 0) <= 0} onClick=${() => mut((x) => { x.base = Math.max(0, (x.base || 0) - 1); })} aria-label="Minus one">−</button>
      <button class="plus-sm" onClick=${() => mut((x) => { x.base = (x.base || 0) + 1; })} aria-label="Plus one">+1</button>
    </div>`}
    ${g.status === 'active' && g.type === 'done' && html`<button class="btn primary full-btn" onClick=${() => mut((x) => { x.done = true; })}>Mark done</button>`}
    ${g.type === 'revenue' && html`<p class="muted small">Fills itself from end-of-day cash. <a class="link" href="#/cash">Revenue page →</a></p>`}

    ${open && html`<${GoalEdit} g=${g} state=${state} today=${today} mut=${mut} />`}
  </section>`;
}

function sourceText(p, g, state) {
  const parts = [];
  if (p.base) parts.push(`${p.base} added by hand`);
  if (p.fromTasks) parts.push(`${p.fromTasks} from tasks`);
  if ((g.counterIds || []).length) {
    const names = g.counterIds.map((id) => state.settings.counters.find((c) => c.id === id)?.label).filter(Boolean).join(', ');
    parts.push(`${p.fromCounters} from ${names}`);
  }
  return parts.join(' · ') || 'Tap +1 or link tasks and counters';
}

function GoalEdit({ g, state, today, mut }) {
  return html`<div class="goal-edit form">
    ${g.type !== 'revenue' && html`<label>Name<input value=${g.title} onInput=${(e) => mut((x) => { x.title = e.target.value; })} /></label>`}
    ${g.type !== 'done' && html`<label>Target
      ${g.type === 'revenue'
        ? html`<div class="money-input"><span>$</span><input inputmode="numeric" value=${g.target} onChange=${(e) => { const v = parseMoney(e.target.value); if (v > 0) update((s) => L.setRevenueTarget(s, g.month, v)); }} /></div>`
        : html`<input type="number" inputmode="numeric" min="1" value=${g.target} onChange=${(e) => mut((x) => { x.target = Math.max(1, +e.target.value || 1); })} />`}
    </label>`}
    ${g.type !== 'revenue' && !g.repeat && html`<label>Due date<input type="date" value=${g.due || ''} onChange=${(e) => mut((x) => { x.due = e.target.value; x.timeframe = 'custom'; })} /></label>`}
    ${g.type !== 'revenue' && (g.timeframe === 'week' || g.timeframe === 'month') && html`<label class="toggle">
      <input type="checkbox" checked=${!!g.repeat} onChange=${(e) => mut((x) => { if (e.target.checked) x.repeat = x.timeframe; else delete x.repeat; })} />
      Repeat every ${g.timeframe} (starts fresh automatically)</label>`}
    <label>Reward (optional)<input value=${g.reward || ''} placeholder="e.g. new golf clubs" onInput=${(e) => mut((x) => { x.reward = e.target.value; })} /></label>
    ${g.type === 'number' && html`<div>
      <div class="field-label">Count these volume counters toward it</div>
      <div class="day-picks">
        ${state.settings.counters.map((c) => {
          const on = (g.counterIds || []).includes(c.id);
          return html`<button class=${'chip' + (on ? ' on' : '')} onClick=${() => mut((x) => { const ids = x.counterIds || []; x.counterIds = on ? ids.filter((i) => i !== c.id) : [...ids, c.id]; })}>${c.label}</button>`;
        })}
      </div>
      <p class="muted small">Counts from ${dateShort(g.start || today)} to ${g.due ? dateShort(g.due) : 'the due date'}. Tasks link from the task itself (tap a task on Today).</p>
    </div>`}
    <div class="btn-row">
      ${g.status === 'active' && g.type !== 'revenue' && html`<button class="btn" onClick=${() => mut((x) => { x.status = 'hit'; x.completedAt = today; x.celebrated = false; })}>Mark as hit</button>`}
      ${g.status === 'hit' && g.type !== 'revenue' && html`<button class="btn" onClick=${() => mut((x) => { x.status = 'active'; x.done = false; delete x.completedAt; x.celebrated = true; })}>Reopen</button>`}
      ${g.type !== 'revenue' && html`<button class="btn ghost" onClick=${() => confirm(`Drop "${g.title}"? It moves to history.`) && mut((x) => { x.status = 'dropped'; x.completedAt = today; })}>Drop (keep in history)</button>`}
      ${g.type !== 'revenue' && html`<button class="btn ghost danger-text" onClick=${() => confirm(`Delete "${g.title}" for good?`) && update((s) => { s.goals = s.goals.filter((x) => x.id !== g.id); })}>Delete</button>`}
    </div>
  </div>`;
}

export function NewGoal({ state, today, onDone }) {
  const [type, setType] = useState('number');
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('');
  const [tf, setTf] = useState('month');
  const [custom, setCustom] = useState('');
  const [reward, setReward] = useState('');
  const [revMonth, setRevMonth] = useState(monthKey(today));
  const [repeat, setRepeat] = useState(false);

  const thisM = monthKey(today), nextM = nextMonth(thisM);
  const existingRev = type === 'revenue' && L.revenueGoal(state, revMonth);
  const tgt = type === 'revenue' ? parseMoney(target) : parseInt(target, 10);
  const valid = type === 'revenue' ? tgt > 0 : title.trim() && (type === 'done' || tgt > 0) && (tf !== 'custom' || custom);

  const save = () => {
    update((s) => {
      if (type === 'revenue') {
        L.setRevenueTarget(s, revMonth, tgt);
        const g = L.revenueGoal(s, revMonth);
        if (reward.trim()) g.reward = reward.trim();
      } else {
        const { start, due } = L.timeframeDates(tf, today, custom);
        s.goals.push({
          id: uid(), type, title: title.trim(), target: type === 'number' ? tgt : 1, base: 0, done: false, counterIds: [],
          timeframe: tf, start, due, reward: reward.trim(), status: 'active', createdAt: today,
          ...(repeat && (tf === 'week' || tf === 'month') ? { repeat: tf } : {}),
        });
      }
    });
    onDone();
  };

  return html`<section class="card form new-goal">
    <h2>New goal</h2>
    <div class="seg wide">
      <button class=${type === 'number' ? 'on' : ''} onClick=${() => setType('number')}>Number</button>
      <button class=${type === 'done' ? 'on' : ''} onClick=${() => setType('done')}>Done / not done</button>
      <button class=${type === 'revenue' ? 'on' : ''} onClick=${() => setType('revenue')}>Revenue</button>
    </div>

    ${type === 'revenue'
      ? html`
        <div class="seg wide">
          <button class=${revMonth === thisM ? 'on' : ''} onClick=${() => setRevMonth(thisM)}>${monthName(thisM)}</button>
          <button class=${revMonth === nextM ? 'on' : ''} onClick=${() => setRevMonth(nextM)}>${monthName(nextM)}</button>
        </div>
        ${existingRev && html`<p class="muted small">${monthName(revMonth)} already has a goal of ${money(existingRev.target)}. Saving updates it.</p>`}
        <label>Cash to collect<div class="money-input"><span>$</span><input inputmode="numeric" value=${target} onInput=${(e) => setTarget(e.target.value)} placeholder="40,000" /></div></label>`
      : html`
        <label>Goal<input value=${title} onInput=${(e) => setTitle(e.target.value)} placeholder=${type === 'number' ? 'Book 6 PPF jobs' : 'Launch the referral program'} /></label>
        ${type === 'number' && html`<label>Target number<input type="number" inputmode="numeric" min="1" value=${target} onInput=${(e) => setTarget(e.target.value)} placeholder="6" /></label>`}
        <div class="field-label">Timeframe</div>
        <div class="day-picks">${TF.map(([k, l]) => html`<button class=${'chip' + (tf === k ? ' on' : '')} onClick=${() => setTf(k)}>${l}</button>`)}</div>
        ${tf === 'custom' && html`<label>Due date<input type="date" min=${today} value=${custom} onInput=${(e) => setCustom(e.target.value)} /></label>`}
        ${(tf === 'week' || tf === 'month') && html`<label class="toggle"><input type="checkbox" checked=${repeat} onChange=${(e) => setRepeat(e.target.checked)} /> Repeat every ${tf}</label>`}`}

    <label>Reward (optional)<input value=${reward} onInput=${(e) => setReward(e.target.value)} placeholder="Hit it → new golf clubs" /></label>
    <div class="btn-row">
      <button class="btn primary" disabled=${!valid} onClick=${save}>Save goal</button>
      <button class="btn ghost" onClick=${onDone}>Cancel</button>
    </div>
  </section>`;
}
