import { html, useState } from './preact.js';
import { update } from './store.js';
import * as L from './logic.js';
import { dayLabel, monthKey, monthName } from './dates.js';
import { RevenueBlock } from './common.js';

export function CheckIn({ state, now }) {
  const date = now.date, s = state.settings;
  const [intention, setIntention] = useState('');
  const prevD = L.prevStartedDate(state, date);
  const suggested = prevD && state.days[prevD].eod?.tomorrowOne;

  const ready = () => update((st) => { st.days[date].checkin = { at: Date.now(), intention: intention.trim() }; window.scrollTo(0, 0); });

  return html`
    <header class="top">
      <div><div class="eyebrow">${dayLabel(date)}</div><h1>Morning check-in</h1></div>
    </header>
    <p class="lede">Two minutes. Read it, mean it, then go.</p>

    <section class="card">
      <h2><span class="step">1</span>Why I'm doing this</h2>
      ${s.why.trim()
        ? html`<p class="why">${s.why}</p>`
        : html`<p class="muted">Write your reasons in your own words. They'll show here every morning.</p>`}
      <a class="link" href="#/settings">${s.why.trim() ? 'Edit' : 'Write it in Settings →'}</a>
    </section>

    <section class="card">
      <h2><span class="step">2</span>What I'm after</h2>
      <div class="eyebrow sub">${monthName(monthKey(date))} revenue</div>
      <${RevenueBlock} state=${state} today=${date} />
      ${s.ambitions.length > 0 && html`<ul class="ambitions">${s.ambitions.map((a) => html`<li>${a.text}</li>`)}</ul>`}
    </section>

    <section class="card">
      <h2><span class="step">3</span>Remember today</h2>
      <ul class="principles">${s.principles.map((p) => html`<li>${p.text}</li>`)}</ul>
    </section>

    <section class="card">
      <h2><span class="step">4</span>Today's intention</h2>
      <label class="intent">
        <span>Today I win if I…</span>
        <input value=${intention} onInput=${(e) => setIntention(e.target.value)} placeholder="close the GT3 PPF quote" />
      </label>
      ${suggested && intention !== suggested && html`<button class="chip" onClick=${() => setIntention(suggested)}>Use yesterday's #1: ${suggested}</button>`}
    </section>

    <button class="btn primary big" disabled=${!intention.trim()} onClick=${ready}>I'm ready</button>
  `;
}
