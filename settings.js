import { html, useState } from '../lib/preact.js';
import { update, replaceState } from '../lib/store.js';
import * as L from '../lib/logic.js';
import { defaultState } from '../lib/defaults.js';
import { getSim, setSim } from '../lib/dates.js';
import { uid, fmtClock } from '../lib/util.js';
import { cloudEnabled, useCloud, signOut } from '../lib/cloud.js';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function Settings({ state, now }) {
  const s = state.settings;
  const today = now.date;
  const cloud = useCloud();
  // Every settings change also refreshes today's checklist and targets.
  const set = (fn) => update((st) => { fn(st.settings); L.syncItems(st, today); });
  const move = (arr, i, dir) => { const j = i + dir; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; };

  return html`
    <header class="top"><div><div class="eyebrow">Driveway Daily</div><h1>Settings</h1></div></header>

    <section class="card form">
      <h2>Why I'm doing this</h2>
      <textarea rows="5" value=${s.why} placeholder="In your own words. Who are you doing this for? What does winning look like?"
        onInput=${(e) => set((x) => { x.why = e.target.value; })} />
    </section>

    <${ListEditor} title="What I'm after" hint="Shown every morning under the monthly revenue goal." field="ambitions" noun="line" s=${s} set=${set} move=${move} />
    <${ListEditor} title="Remember today (principles)" field="principles" noun="principle" s=${s} set=${set} move=${move} />

    <section class="card">
      <h2>Daily tasks</h2>
      <p class="muted small">Shows up every Monday to Friday. You can also edit this from the Tasks tab.</p>
      ${s.nonNegotiables.map((n, i) => html`<div class="edit-row" key=${n.id}>
        <input value=${n.title} onInput=${(e) => set((x) => { x.nonNegotiables[i].title = e.target.value; })} aria-label="Daily task" />
        <input class="num" type="number" inputmode="numeric" min="0" value=${n.minutes} aria-label="Minutes"
          onChange=${(e) => set((x) => { x.nonNegotiables[i].minutes = Math.max(0, +e.target.value || 0); })} />
        <button class="icon-btn" onClick=${() => confirm(`Remove "${n.title}"?`) && set((x) => { x.nonNegotiables.splice(i, 1); })} aria-label="Delete">✕</button>
      </div>`)}
      <button class="btn ghost" onClick=${() => set((x) => { x.nonNegotiables.push({ id: 'nn_' + uid(), title: '', minutes: 15 }); })}>+ Add daily task</button>
    </section>

    <section class="card">
      <h2>Volume targets</h2>
      <div class="edit-row col-head"><span class="grow"></span><small>Mon–Fri</small><small>Sat</small></div>
      ${s.counters.map((c, i) => html`<div class="edit-row" key=${c.id}>
        <span class="grow">${c.label}</span>
        <input class="num" type="number" inputmode="numeric" min="0" value=${c.target} aria-label=${c.label + ' weekday target'}
          onChange=${(e) => set((x) => { x.counters[i].target = Math.max(0, +e.target.value || 0); })} />
        <input class="num" type="number" inputmode="numeric" min="0" value=${c.saturdayTarget} aria-label=${c.label + ' Saturday target'}
          onChange=${(e) => set((x) => { x.counters[i].saturdayTarget = Math.max(0, +e.target.value || 0); })} />
      </div>`)}
    </section>

    <section class="card">
      <h2>Recurring reminders</h2>
      ${s.reminders.map((r, i) => html`<div class="reminder-edit" key=${r.id}>
        <input value=${r.text} onInput=${(e) => set((x) => { x.reminders[i].text = e.target.value; })} aria-label="Reminder" />
        <div class="day-picks">
          ${DAYS.map((d, wd) => html`<button class=${'chip' + (r.days.includes(wd) ? ' on' : '')}
            onClick=${() => set((x) => { const ds = x.reminders[i].days; x.reminders[i].days = ds.includes(wd) ? ds.filter((v) => v !== wd) : [...ds, wd]; })}>${d}</button>`)}
        </div>
        <label class="toggle"><input type="checkbox" checked=${r.rolling} onChange=${(e) => set((x) => { x.reminders[i].rolling = e.target.checked; })} /> It's rolling (stop reminding me)</label>
      </div>`)}
    </section>

    <section class="card form">
      <h2>Day</h2>
      <label class="inline-label">Workday ends at
        <input type="time" value=${`${String(Math.floor(s.workdayEnd / 60)).padStart(2, '0')}:${String(s.workdayEnd % 60).padStart(2, '0')}`}
          onChange=${(e) => { const [h, m] = e.target.value.split(':').map(Number); if (!isNaN(h)) set((x) => { x.workdayEnd = h * 60 + (m || 0); }); }} />
      </label>
      <p class="muted small">Used for "time left today" on the Tasks tab. Now: ${fmtClock(s.workdayEnd)}.</p>
      <div class="inline-label">End-of-day lock
        <div class="seg">
          <button class=${s.eodLock === 'strict' ? 'on' : ''} onClick=${() => set((x) => { x.eodLock = 'strict'; })}>Strict</button>
          <button class=${s.eodLock === 'reminder' ? 'on' : ''} onClick=${() => set((x) => { x.eodLock = 'reminder'; })}>Reminder only</button>
        </div>
      </div>
      <p class="muted small">${s.eodLock === 'strict' ? 'Tomorrow stays hidden until you answer the end-of-day questions.' : 'You get a banner, but tomorrow still opens.'}</p>
      <label class="toggle"><input type="checkbox" checked=${s.mondayExtras} onChange=${(e) => set((x) => { x.mondayExtras = e.target.checked; })} />
        Monday extras: ${s.mondayTasks.map((t) => t.title.toLowerCase()).join(', ')}</label>
    </section>

    <section class="card">
      <h2>Idea bank</h2>
      <p class="muted small">Turn one on and it shows up in your daily checklist.</p>
      ${s.ideaBank.map((it, i) => html`<label class="toggle row-toggle" key=${it.id}>
        <input type="checkbox" checked=${it.enabled} onChange=${(e) => set((x) => { x.ideaBank[i].enabled = e.target.checked; })} />
        <span class="grow">${it.title}</span><small class="muted">${it.minutes}m</small>
      </label>`)}
    </section>

    <${Testing} today=${today} />

    <section class="card">
      <h2>Account & data</h2>
      ${cloudEnabled
        ? html`<p class="muted small">Signed in as <b>${cloud.email}</b>. Everything syncs between your phone and desktop.</p>
            <button class="btn" onClick=${() => confirm('Sign out on this device?') && signOut()}>Sign out</button>`
        : html`<p class="muted small">Local mode: saved in this browser only. Add your Supabase details to config.js to sync phone and desktop.</p>`}
      <div class="btn-row">
        ${state.sample && html`<button class="btn" onClick=${() => confirm('Remove the sample days and wins? Your goals, settings and anything you entered yourself stay.') && update((st) => {
          for (const k of Object.keys(st.days)) if (st.days[k].sample) delete st.days[k];
          for (const d of Object.values(st.days)) if (d.tasks) d.tasks = d.tasks.filter((t) => !t.sample);
          st.goals = st.goals.filter((g) => !g.sample);
          st.wins = st.wins.filter((w) => !w.sample);
          st.sample = false;
          L.ensureRevenueGoal(st, today.slice(0, 7));
        })}>Remove sample data</button>`}
        <button class="btn danger" onClick=${() => confirm('Erase everything, including settings? This cannot be undone.') && replaceState(defaultState(today, false))}>Erase everything</button>
      </div>
    </section>
  `;
}

function ListEditor({ title, hint, field, noun, s, set, move }) {
  const list = s[field];
  return html`<section class="card">
    <h2>${title}</h2>
    ${hint && html`<p class="muted small">${hint}</p>`}
    ${list.map((p, i) => html`<div class="edit-row" key=${p.id}>
      <input value=${p.text} onInput=${(e) => set((x) => { x[field][i].text = e.target.value; })} aria-label=${noun} />
      <button class="icon-btn" disabled=${i === 0} onClick=${() => set((x) => move(x[field], i, -1))} aria-label="Move up">↑</button>
      <button class="icon-btn" disabled=${i === list.length - 1} onClick=${() => set((x) => move(x[field], i, 1))} aria-label="Move down">↓</button>
      <button class="icon-btn" onClick=${() => set((x) => { x[field].splice(i, 1); })} aria-label="Delete">✕</button>
    </div>`)}
    <button class="btn ghost" onClick=${() => set((x) => { x[field].push({ id: uid(), text: '' }); })}>+ Add ${noun}</button>
  </section>`;
}

function Testing({ today }) {
  const sim = getSim();
  const [d, setD] = useState(sim.date || today);
  const [t, setT] = useState(sim.time || '');
  return html`<section class="card form">
    <h2>Testing: pretend it's another day</h2>
    <p class="muted small">Jump ahead to try carry-over and the end-of-day lock. Only affects this browser tab.</p>
    <div class="field-row">
      <label>Date<input type="date" value=${d} onInput=${(e) => setD(e.target.value)} /></label>
      <label>Time (optional)<input type="time" value=${t} onInput=${(e) => setT(e.target.value)} /></label>
    </div>
    <div class="btn-row">
      <button class="btn" onClick=${() => { setSim({ date: d, time: t || undefined }); location.hash = '#/today'; }}>Go</button>
      ${(sim.date || sim.time) && html`<button class="btn ghost" onClick=${() => { setSim({}); setD(today); setT(''); }}>Back to real time</button>`}
    </div>
  </section>`;
}
