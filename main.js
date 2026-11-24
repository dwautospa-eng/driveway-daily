import { html, render, useState, useEffect } from './lib/preact.js';
import { initStore, useAppState, update, getState, replaceFromCloud } from './lib/store.js';
import { startCloud, useCloud, cloudEnabled } from './lib/cloud.js';
import { Login } from './ui/login.js';
import { nowPhoenix, getSim, setSim, shortLabel } from './lib/dates.js';
import { fmtClock } from './lib/util.js';
import * as L from './lib/logic.js';
import { CheckIn } from './ui/checkin.js';
import { Today } from './ui/today.js';
import { EndOfDay } from './ui/eod.js';
import { Cash } from './ui/cash.js';
import { Wins } from './ui/wins.js';
import { Settings } from './ui/settings.js';
import { Goals } from './ui/goals.js';
import { Celebration } from './ui/celebrate.js';
import { Sunday } from './ui/sunday.js';
import { Tasks } from './ui/tasks.js';

function useNow() {
  const [now, setNow] = useState(nowPhoenix);
  useEffect(() => {
    const refresh = () => setNow(nowPhoenix());
    const i = setInterval(refresh, 30000);
    window.addEventListener('dd-clock', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { clearInterval(i); window.removeEventListener('dd-clock', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, []);
  return now;
}

function useRoute() {
  const parse = () => (location.hash.replace(/^#\/?/, '') || 'today').split('/');
  const [r, setR] = useState(parse);
  useEffect(() => {
    const h = () => { setR(parse()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  return r;
}

const TABS = [
  ['today', 'Today', 'M12 3v2M12 19v2M5 12H3M21 12h-2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4M12 8a4 4 0 100 8 4 4 0 000-8z'],
  ['tasks', 'Tasks', 'M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2'],
  ['goals', 'Goals', 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 16a4 4 0 100-8 4 4 0 000 8zM12 12h0'],
  ['cash', 'Revenue', 'M12 2v20M17 6H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6'],
  ['more', 'More', 'M5 12h0M12 12h0M19 12h0'],
];
const MORE = ['more', 'wins', 'settings'];

function More() {
  return html`
    <header class="top"><div><div class="eyebrow">Driveway Daily</div><h1>More</h1></div></header>
    <a class="card nav-card" href="#/wins"><b>Wins</b><span class="muted">Proof you can do this</span></a>
    <a class="card nav-card" href="#/settings"><b>Settings</b><span class="muted">Why, what I'm after, principles, daily tasks, targets, idea bank</span></a>
  `;
}

function App() {
  const state = useAppState();
  const now = useNow();
  const route = useRoute();
  const sim = getSim();
  const date = now.date;

  const pending = L.findPendingEod(state, date);
  const strictBlock = !!pending && state.settings.eodLock === 'strict';
  const started = !!state.days[date]?.started;
  // Sunday has no checklist (so nothing carries over into it). It opens the planning prompt.
  const sunday = L.isSunday(date);

  useEffect(() => {
    if (!strictBlock && !started && !sunday) update((s) => L.ensureDay(s, date));
  }, [date, strictBlock, started, sunday]);

  // Goals that reach their target get marked "hit" and celebrated once.
  const needsMark = state.goals.some((g) => g.status === 'active' && L.goalHit(state, g));
  useEffect(() => { if (needsMark) update((s) => L.markHitGoals(s, date)); }, [needsMark, date]);
  const celebrating = state.goals.find((g) => g.status === 'hit' && g.celebrated === false);

  let screen;
  const tab = route[0];
  if (tab === 'cash') screen = html`<${Cash} state=${state} now=${now} />`;
  else if (tab === 'goals') screen = html`<${Goals} state=${state} now=${now} />`;
  else if (tab === 'more') screen = html`<${More} />`;
  else if (tab === 'wins') screen = html`<${Wins} state=${state} now=${now} />`;
  else if (tab === 'settings') screen = html`<${Settings} state=${state} now=${now} />`;
  else if (tab === 'eod') {
    const d = route[1] || date;
    screen = html`<${EndOfDay} key=${d} state=${state} date=${d} today=${date} />`;
  } else if (strictBlock) {
    screen = html`<${EndOfDay} key=${pending} state=${state} date=${pending} today=${date} blocking />`;
  } else if (sunday) {
    screen = tab === 'tasks'
      ? html`<header class="top"><div><div class="eyebrow">Sunday</div><h1>Tasks</h1></div></header>
          <section class="card"><p>No daily tasks on Sunday. Today is for planning the week.</p><a class="btn primary" href="#/today">Open Sunday planning →</a></section>`
      : html`<${Sunday} key=${date} state=${state} now=${now} />`;
  } else if (!started) {
    screen = html`<p class="muted">Loading…</p>`;
  } else if (!state.days[date].checkin) {
    // The checklist unlocks after the morning check-in.
    screen = html`<${CheckIn} state=${state} now=${now} />`;
  } else if (tab === 'tasks') {
    screen = html`<${Tasks} state=${state} now=${now} />`;
  } else {
    screen = html`<${Today} state=${state} now=${now} />`;
  }

  const active = MORE.includes(tab) ? 'more' : tab === 'eod' ? 'today' : tab;
  return html`
    ${(sim.date || sim.time) && html`<div class="sim">
      Pretending it's ${shortLabel(date)}, ${fmtClock(now.minutes)}
      <button onClick=${() => setSim({})}>Back to real time</button>
    </div>`}
    <main class="app">
      <div class="brand" aria-hidden="true"><span>DRIVEWAY</span><em>DAILY</em></div>
      ${screen}
    </main>
    ${celebrating && html`<${Celebration} goal=${celebrating} state=${state} />`}
    <nav class="tabs">
      ${TABS.map(([id, label, d]) => html`<a href=${'#/' + id} class=${active === id || (id === 'today' && !TABS.some((t) => t[0] === active)) ? 'on' : ''}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d=${d} /></svg>
        <span>${label}</span>
      </a>`)}
    </nav>
  `;
}

const SYNC_LABEL = { syncing: 'Syncing…', saving: 'Saving…', ready: 'Synced', offline: 'Offline · saved on this device' };

// Login and first sync come before the app, so a stale device never overwrites newer data.
function Root() {
  const cloud = useCloud();
  if (cloudEnabled && cloud.status === 'signed-out') return html`<main class="app"><${Login} /></main>`;
  if (!cloud.ready) {
    return html`<main class="app"><div class="brand" aria-hidden="true"><span>DRIVEWAY</span><em>DAILY</em></div>
      <p class="muted center" style=${{ marginTop: '30vh' }}>Syncing…</p></main>`;
  }
  return html`<${App} />${cloudEnabled && html`<div class=${'sync-pill ' + cloud.status}>${SYNC_LABEL[cloud.status] || ''}</div>`}`;
}

initStore(nowPhoenix().date);
startCloud(getState, replaceFromCloud);
render(html`<${Root} />`, document.getElementById('root'));

// Installable + works offline. (Served over https in production; localhost is allowed for testing.)
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('Service worker failed', e)));
}
