import { html, useState } from '../lib/preact.js';
import { update } from '../lib/store.js';
import * as L from '../lib/logic.js';
import { dayLabel } from '../lib/dates.js';
import { parseMoney } from '../lib/util.js';
import { RevenueCard } from './common.js';

export function EndOfDay({ state, date, today, blocking }) {
  const day = state.days[date];
  const e = day?.eod || {};
  const [win, setWin] = useState(e.win || '');
  const [slipped, setSlipped] = useState(e.slipped || '');
  const [one, setOne] = useState(e.tomorrowOne || '');
  const [cash, setCash] = useState(day?.cash != null ? String(day.cash) : '');
  const [jobs, setJobs] = useState(day?.jobs ?? 0);

  if (!day?.started) return html`<p class="muted">Nothing to close for ${dayLabel(date)}.</p>`;

  const score = L.dayScore(day);
  const nnDone = day.items.filter((i) => i.kind === 'nn' && i.done).length;
  const nnTotal = day.items.filter((i) => i.kind === 'nn').length;
  const cashVal = parseMoney(cash);
  const valid = win.trim() && slipped.trim() && one.trim() && cashVal != null && cashVal >= 0;

  const save = () => update((s) => {
    const d = s.days[date];
    L.stopTimer(d);
    d.eod = { at: Date.now(), win: win.trim(), slipped: slipped.trim(), tomorrowOne: one.trim() };
    d.cash = cashVal;
    d.jobs = Math.max(0, +jobs || 0);
    const next = L.nextStartedDate(s, date);
    if (next) L.addTopOne(s.days[next], one.trim());
    location.hash = '#/today';
    window.scrollTo(0, 0);
  });

  return html`
    <header class="top">
      <div><div class="eyebrow">${dayLabel(date)}</div><h1>End of day</h1></div>
    </header>
    ${blocking && html`<p class="banner warn">Close out ${dayLabel(date)} to unlock today.</p>`}

    <section class="card">
      <div class="stat-row">
        <div><small>Tasks done</small><b>${score.pct}%</b><small>${score.done}/${score.total}</small></div>
        <div><small>Daily tasks</small><b class=${nnDone === nnTotal ? 'good' : ''}>${nnDone}/${nnTotal}</b></div>
        <div><small>Volume</small><b>${L.volumeTotal(day)}</b><small>of ${L.volumeTarget(day)}</small></div>
      </div>
    </section>

    <section class="card form">
      <label>What did I win today?<textarea rows="2" value=${win} onInput=${(ev) => setWin(ev.target.value)} /></label>
      <label>What slipped and why?<textarea rows="2" value=${slipped} onInput=${(ev) => setSlipped(ev.target.value)} /></label>
      <label>What's tomorrow's #1?<input value=${one} onInput=${(ev) => setOne(ev.target.value)} placeholder="It'll be pinned at the top of tomorrow's tasks" /></label>
    </section>

    <section class="card form">
      <label>How much cash did we collect today?
        <div class="money-input"><span>$</span><input inputmode="decimal" value=${cash} onInput=${(ev) => setCash(ev.target.value)} placeholder="0" /></div>
      </label>
      <p class="muted small">Count it the day it's collected: deposits the day they're received, the balance at pickup.</p>
      <label>Customers closed today
        <div class="stepper">
          <button type="button" class="minus" onClick=${() => setJobs(Math.max(0, jobs - 1))} aria-label="One fewer">−</button>
          <b>${jobs}</b>
          <button type="button" class="plus" onClick=${() => setJobs(jobs + 1)} aria-label="One more">+</button>
        </div>
      </label>
    </section>

    <button class="btn primary big" disabled=${!valid} onClick=${save}>${day.eod ? 'Save changes' : 'Close the day'}</button>
    ${!valid && html`<p class="muted small center">Answer all three and enter the cash (0 is fine) to close the day.</p>`}

    ${date === today && html`<${RevenueCard} state=${state} today=${today} />`}
  `;
}
