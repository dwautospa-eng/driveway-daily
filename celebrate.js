import { html, useEffect, useMemo } from './preact.js';
import { update } from './store.js';
import * as L from './logic.js';

const COLORS = ['#7cc7ff', '#2f6df6', '#1e3a8a', '#ffffff', '#b9d9ff', '#4fd6b0'];

export function Celebration({ goal, state }) {
  const pieces = useMemo(() => Array.from({ length: 70 }, (_, i) => ({
    left: Math.random() * 100, delay: Math.random() * 0.8, dur: 2.2 + Math.random() * 1.6,
    color: COLORS[i % COLORS.length], rot: Math.random() * 360, w: 6 + Math.random() * 6,
  })), [goal.id]);

  useEffect(() => { try { navigator.vibrate?.([80, 60, 160]); } catch {} }, [goal.id]);

  const p = L.goalProgress(state, goal);
  const close = () => update((s) => { const g = s.goals.find((x) => x.id === goal.id); if (g) g.celebrated = true; });

  return html`<div class="celebrate" role="dialog" aria-modal="true" aria-label="Goal hit">
    <div class="confetti" aria-hidden="true">
      ${pieces.map((c) => html`<i style=${{ left: c.left + '%', background: c.color, width: c.w + 'px', height: c.w * 1.6 + 'px', animationDelay: c.delay + 's', animationDuration: c.dur + 's', transform: `rotate(${c.rot}deg)` }} />`)}
    </div>
    <div class="celebrate-card">
      <div class="celebrate-emoji">🏆</div>
      <div class="eyebrow">Goal hit</div>
      <h1>${goal.title}</h1>
      <p class="muted">${p.label}</p>
      ${goal.reward
        ? html`<div class="celebrate-reward"><small>You earned</small><b>🎁 ${goal.reward}</b></div>`
        : html`<p>Volume negates luck. On to the next one.</p>`}
      <button class="btn primary big" onClick=${close}>${goal.reward ? 'Claim it' : "Let's go"}</button>
    </div>
  </div>`;
}
