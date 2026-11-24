import { html, useState } from './preact.js';
import { update } from './store.js';
import * as L from './logic.js';
import { monthKey, monthName, dateShort } from './dates.js';
import { uid, money, parseMoney } from './util.js';

// marker = where you "should" be (pace), drawn as a thin tick on the bar
export function Bar({ value, max, marker }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const mk = marker != null && max > 0 ? Math.min(100, (marker / max) * 100) : null;
  return html`<div class="bar" role="progressbar" aria-valuenow=${Math.round(pct)} aria-valuemin="0" aria-valuemax="100">
    <div class=${'bar-fill' + (pct >= 100 ? ' full' : '')} style=${{ width: pct + '%' }}></div>
    ${mk != null && mk > 0 && html`<div class="bar-marker" style=${{ left: mk + '%' }} title="Pace"></div>`}
  </div>`;
}

export function GoalList({ state, today, compact }) {
  const goals = L.activeGoals(state, today);
  if (!goals.length) return html`<p class="muted">No active goals yet. Add one on the Goals page.</p>`;
  return html`<div class=${'goal-list' + (compact ? ' compact' : '')}>
    ${goals.map((g) => {
      const p = L.goalProgress(state, g);
      return html`<div class="goal">
        <div class="goal-top"><span class="goal-title">${g.title}${g.status === 'hit' ? ' ✓' : ''}</span><b>${p.label}</b></div>
        <${Bar} value=${p.value} max=${p.max} />
        ${g.reward && html`<div class="reward">🎁 ${g.reward}</div>`}
      </div>`;
    })}
  </div>`;
}

function SetTarget({ month, current }) {
  const [v, setV] = useState(String(current || ''));
  const n = parseMoney(v);
  return html`<div class="set-target">
    <div class="set-target-q">New month. What's the revenue goal for ${monthName(month)}?</div>
    <div class="muted small" style=${{ marginBottom: '8px' }}>Set it once. You can change it anytime on the Revenue page.</div>
    <div class="inline-form">
      <div class="money-input grow"><span>$</span><input inputmode="numeric" value=${v} onInput=${(e) => setV(e.target.value)} aria-label="Revenue goal" /></div>
      <button class="btn primary" disabled=${!(n > 0)} onClick=${() => update((s) => L.setRevenueTarget(s, month, n))}>Set goal</button>
    </div>
  </div>`;
}

// The revenue block: progress, pace, and (optionally) the forecast.
export function RevenueBlock({ state, today, forecast }) {
  const r = L.revenueStatus(state, today);
  const month = monthKey(today);
  const ahead = r.diff >= 0;
  const pct = r.target ? Math.round((r.collected / r.target) * 100) : 0;
  const hit = r.remaining <= 0;
  const gap = r.projected - r.target;

  return html`<div class="rev">
    ${r.goal?.needsTarget && L.firstStartedDayOfMonth(state, month) === today && html`<${SetTarget} month=${month} current=${r.target} />`}
    <div class="rev-big"><b>${money(r.collected)}</b><span>of ${money(r.target)}</span></div>
    <${Bar} value=${r.collected} max=${r.target} marker=${hit ? null : r.expected} />
    <div class="bar-legend"><span>${pct}% collected</span>${!hit && html`<span><i class="tick"></i>Pace ${money(r.expected)}</span>`}</div>
    <div class="stat-row">
      <div><small>${ahead ? 'Ahead of pace' : 'Behind pace'}</small><b class=${ahead ? 'good' : 'bad'}>${ahead ? '+' : '−'}${money(Math.abs(r.diff))}</b></div>
      <div><small>Need per working day</small><b>${hit ? 'Hit 🎉' : money(r.perDay)}</b></div>
      <div><small>Working days left</small><b>${r.remainingDays}</b></div>
    </div>
    ${forecast && html`<div class="forecast">
      <div class="eyebrow">Forecast</div>
      <div class="stat-row">
        <div><small>Left to collect</small><b>${money(r.remaining)}</b></div>
        <div><small>Your avg / working day</small><b>${r.elapsed ? money(r.avgPerDay) : '—'}</b></div>
        <div><small>Projected month-end</small><b class=${r.elapsed ? (gap >= 0 ? 'good' : 'bad') : ''}>${r.elapsed ? money(r.projected) : '—'}</b></div>
      </div>
      <p class="forecast-line">${forecastLine(r, gap)}</p>
    </div>`}
    ${r.goal?.reward && html`<div class="reward">🎁 ${r.goal.reward}</div>`}
  </div>`;
}

function forecastLine(r, gap) {
  if (!r.elapsed) return 'No cash logged yet this month. Log it at end of day to start the forecast.';
  if (r.remaining <= 0) return `Goal hit with ${r.remainingDays} working days to spare. Everything from here is upside.`;
  if (gap >= 0) return `At your current pace you finish around ${money(r.projected)}, ${money(gap)} over goal. Keep the pressure on.`;
  const lift = r.avgPerDay > 0 ? Math.round(((r.perDay - r.avgPerDay) / r.avgPerDay) * 100) : null;
  return `At your current pace you finish around ${money(r.projected)}, ${money(-gap)} short. You need ${money(r.perDay)} per working day${lift != null ? `, ${lift}% above your average so far` : ''}.`;
}

export function RevenueCard({ state, today, title, forecast }) {
  return html`<section class="card">
    <div class="card-head"><h2>${title || `${monthName(monthKey(today))} revenue`}</h2></div>
    <${RevenueBlock} state=${state} today=${today} forecast=${forecast} />
  </section>`;
}

export function AddWin({ date }) {
  const [t, setT] = useState('');
  const add = (e) => {
    e.preventDefault();
    if (!t.trim()) return;
    update((s) => { s.wins.unshift({ id: uid(), date, text: t.trim() }); });
    setT('');
  };
  return html`<form class="inline-form" onSubmit=${add}>
    <input value=${t} onInput=${(e) => setT(e.target.value)} placeholder="Log a win…" aria-label="New win" />
    <button class="btn" type="submit" disabled=${!t.trim()}>Add</button>
  </form>`;
}

export function WinList({ wins, limit }) {
  const list = [...wins].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, limit || wins.length);
  if (!list.length) return html`<p class="muted">No wins logged yet.</p>`;
  return html`<ul class="wins">${list.map((w) => html`<li><span class="muted">${dateShort(w.date)}</span> ${w.text}</li>`)}</ul>`;
}
