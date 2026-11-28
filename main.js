import { html, render, useState, useEffect } from './preact.js';
import { initStore, useAppState, update, getState, replaceFromCloud } from './store.js';
import { startCloud, useCloud, cloudEnabled } from './cloud.js';
import { Login } from './login.js';
import { nowPhoenix, getSim, setSim, shortLabel } from './dates.js';
import { fmtClock } from './util.js';
import * as L from './logic.js';
import { CheckIn } from './checkin.js';
import { Today } from './today.js';
import { EndOfDay } from './eod.js';
import { Cash } from './cash.js';
import { Wins } from './wins.js';
import { Settings } from './settings.js';
import { Goals } from './goals.js';
import { Celebration } from './celebrate.js';
import { Sunday } from './sunday.js';
import { Tasks } from './tasks.js';
import { Home, Week } from './home.js';
import { Overview } from './overview.js';
import { Sales } from './sales.js';

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
  const parse = () => (location.hash.replace(/^#\/?/, '') || 'home').split('/');
  const [r, setR] = useState(parse);
  useEffect(() => {
    const h = () => { setR(parse()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  return r;
}

const IC = {
  home: 'M3 11l9-7 9 7M5 9.5V20h5v-6h4v6h5V9.5',
  week: 'M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1zM8 12h0M12 12h0M16 12h0M8 16h0M12 16h0',
  overview: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z',
  sales: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3',
  cash: 'M12 2v20M17 6H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6',
  today: 'M12 3v2M12 19v2M5 12H3M21 12h-2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4M12 8a4 4 0 100 8 4 4 0 000-8z',
  tasks: 'M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2',
  goals: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 16a4 4 0 100-8 4 4 0 000 8zM12 12h0',
  wins: 'M8 4h8v5a4 4 0 01-8 0zM8 6H5a3 3 0 003 4M16 6h3a3 3 0 01-3 4M12 13v4M8 21h8M10 17h4',
  settings: 'M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4',
  more: 'M5 12h0M12 12h0M19 12h0',
  lock: 'M7 11V8a5 5 0 0110 0v3M6 11h12v9H6z',
};
const Svg = ({ d, cls }) => html`<svg class=${cls || ''} viewBox="0 0 24 24" aria-hidden="true"><path d=${d} /></svg>`;

// Phone: bottom tabs. Mac: sidebar.
const TABS = [['home', 'Home'], ['today', 'Today'], ['tasks', 'Tasks'], ['sales', 'Sales'], ['more', 'More']];
const SIDE = [
  ['Home', [['home', 'Home'], ['week', 'Week']]],
  ['Dashboard', [['overview', 'Overview'], ['sales', 'Sales'], ['cash', 'Financials']]],
  ['Daily', [['today', 'Today'], ['tasks', 'Tasks'], ['goals', 'Goals']]],
];
const SIDE_FOOT = [['wins', 'Wins'], ['settings', 'Settings']];
// These open only after the morning check-in (and a closed-out yesterday).
const GATED = ['overview', 'sales', 'cash', 'goals', 'today', 'tasks'];
const WIDE = ['home', 'week', 'overview', 'sales', 'cash'];
const MORE = ['more', 'wins', 'settings', 'overview', 'week', 'cash', 'goals'];

function More() {
  const item = (id, label, sub) => html`<a class="card nav-card" href=${'#/' + id}><b>${label}</b><span class="muted">${sub}</span></a>`;
  return html`
    <header class="top"><div><div class="eyebrow">Driveway Daily</div><h1>More</h1></div></header>
    ${item('overview', 'Overview', 'Revenue, average ticket, conversion, ROAS, unpaid jobs')}
    ${item('week', 'Week', 'Monday to Sunday with your calendar events')}
    ${item('cash', 'Financials', 'Cash actually collected, by day')}
    ${item('goals', 'Goals', 'Monthly revenue, videos, referral partners')}
    ${item('wins', 'Wins', 'Proof you can do this')}
    ${item('settings', 'Settings', "Name, why, what I'm after, principles, daily tasks, targets, idea bank")}
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

  const tab = route[0];
  const checkedIn = started && !!state.days[date].checkin;
  const locked = strictBlock || (!sunday && !checkedIn);

  let screen;
  if (tab === 'home') screen = html`<${Home} state=${state} now=${now} unlocked=${!locked} />`;
  else if (tab === 'week') screen = html`<${Week} now=${now} />`;
  else if (tab === 'more') screen = html`<${More} />`;
  else if (tab === 'wins') screen = html`<${Wins} state=${state} now=${now} />`;
  else if (tab === 'settings') screen = html`<${Settings} state=${state} now=${now} />`;
  else if (tab === 'eod') {
    const d = route[1] || date;
    screen = html`<${EndOfDay} key=${d} state=${state} date=${d} today=${date} />`;
  } else if (strictBlock) {
    screen = html`<${EndOfDay} key=${pending} state=${state} date=${pending} today=${date} blocking />`;
  } else if (sunday && (tab === 'today' || tab === 'tasks')) {
    screen = tab === 'tasks'
      ? html`<header class="top"><div><div class="eyebrow">Sunday</div><h1>Tasks</h1></div></header>
          <section class="card"><p>No daily tasks on Sunday. Today is for planning the week.</p><a class="btn primary" href="#/today">Open Sunday planning →</a></section>`
      : html`<${Sunday} key=${date} state=${state} now=${now} />`;
  } else if (!sunday && !started) {
    screen = html`<p class="muted">Loading…</p>`;
  } else if (!sunday && !checkedIn) {
    // Everything past Home unlocks after the morning check-in.
    screen = html`<${CheckIn} state=${state} now=${now} />`;
  } else if (tab === 'overview') screen = html`<${Overview} state=${state} now=${now} />`;
  else if (tab === 'sales') screen = html`<${Sales} state=${state} now=${now} />`;
  else if (tab === 'cash') screen = html`<${Cash} state=${state} now=${now} />`;
  else if (tab === 'goals') screen = html`<${Goals} state=${state} now=${now} />`;
  else if (tab === 'tasks') screen = html`<${Tasks} state=${state} now=${now} />`;
  else screen = html`<${Today} state=${state} now=${now} />`;

  const known = ['home', 'week', 'more', 'wins', 'settings', 'eod', ...GATED];
  const cur = known.includes(tab) ? (tab === 'eod' ? 'today' : tab) : 'today';
  const phoneActive = MORE.includes(cur) ? 'more' : cur;
  const wide = WIDE.includes(cur) && !(GATED.includes(cur) && locked);
  const sideLink = ([id, label]) => html`<a href=${'#/' + id} class=${cur === id ? 'on' : ''}>
    <${Svg} d=${IC[id]} /><span>${label}</span>${GATED.includes(id) && locked && html`<${Svg} cls="lock" d=${IC.lock} />`}
  </a>`;
  return html`
    ${(sim.date || sim.time) && html`<div class="sim">
      Pretending it's ${shortLabel(date)}, ${fmtClock(now.minutes)}
      <button onClick=${() => setSim({})}>Back to real time</button>
    </div>`}
    <div class="shell">
      <aside class="side">
        <div class="side-brand"><span>DRIVEWAY</span><em>DAILY</em></div>
        ${SIDE.map(([group, items]) => html`<div class="side-group"><small>${group}</small>${items.map(sideLink)}</div>`)}
        <div class="side-group side-foot">${SIDE_FOOT.map(sideLink)}</div>
      </aside>
      <main class=${'app' + (wide ? ' wide' : '')}>
        <div class="brand" aria-hidden="true"><span>DRIVEWAY</span><em>DAILY</em></div>
        ${screen}
      </main>
    </div>
    ${celebrating && html`<${Celebration} goal=${celebrating} state=${state} />`}
    <nav class="tabs">
      ${TABS.map(([id, label]) => html`<a href=${'#/' + id} class=${phoneActive === id ? 'on' : ''}>
        <${Svg} d=${IC[id]} />
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
