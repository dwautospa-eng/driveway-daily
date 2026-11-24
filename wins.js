import { html } from '../lib/preact.js';
import { update } from '../lib/store.js';
import { dateShort } from '../lib/dates.js';
import { AddWin } from './common.js';

export function Wins({ state, now }) {
  const list = [...state.wins].sort((a, b) => (a.date < b.date ? 1 : -1));
  return html`
    <header class="top"><div><div class="eyebrow">Proof you can do this</div><h1>Wins</h1></div></header>
    <section class="card">
      <${AddWin} date=${now.date} />
    </section>
    <section class="card">
      ${list.length === 0 && html`<p class="muted">Nothing yet. Log the first one.</p>`}
      <ul class="wins big">
        ${list.map((w) => html`<li>
          <span class="muted">${dateShort(w.date)}</span>
          <span class="grow">${w.text}</span>
          <button class="icon-btn" aria-label="Delete win" onClick=${() => confirm('Delete this win?') && update((s) => { s.wins = s.wins.filter((x) => x.id !== w.id); })}>✕</button>
        </li>`)}
      </ul>
    </section>
  `;
}
