import { html, useState } from './preact.js';
import { update } from './store.js';
import * as L from './logic.js';
import { monthKey, monthLabel, prevMonth, nextMonth, shortLabel } from './dates.js';
import { money, parseMoney } from './util.js';
import { RevenueCard } from './common.js';

export function Cash({ state, now }) {
  const today = now.date, current = monthKey(today);
  const [month, setMonth] = useState(current);
  const goal = L.revenueGoal(state, month);
  const target = goal?.target ?? state.settings.revenueTarget;

  const dates = new Set(L.monthWorkdays(month).filter((d) => d <= today));
  Object.values(state.days).forEach((d) => { if (d.date.startsWith(month) && d.cash != null) dates.add(d.date); });
  const list = [...dates].sort().reverse();
  const total = L.monthCash(state, month);
  const st = L.salesStats(state, month);
  const outstanding = L.unpaidSales(state).reduce((a, x) => a + L.saleTotal(x), 0);
  const jobs = L.monthJobs(state, month);
  const chartDays = L.monthWorkdays(month);
  const maxDay = Math.max(1, ...chartDays.map((d) => state.days[d]?.cash || 0));

  return html`
    <header class="top"><div><div class="eyebrow">Cash actually collected</div><h1>Financials</h1></div></header>

    <div class="month-nav">
      <button class="btn ghost" onClick=${() => setMonth(prevMonth(month))} aria-label="Previous month">‹</button>
      <b>${monthLabel(month)}</b>
      <button class="btn ghost" disabled=${month >= current} onClick=${() => setMonth(nextMonth(month))} aria-label="Next month">›</button>
    </div>

    <div class="kpis five">
      <div class="kpi"><small>Collected</small><b>${money(total)}</b><span class="muted">${jobs ? `${jobs} customers closed` : 'this month'}</span></div>
      <div class="kpi"><small>Sold</small><b>${money(st.sold)}</b><span class="muted">${st.n} sale${st.n === 1 ? '' : 's'} logged</span></div>
      <div class="kpi"><small>Outstanding</small><b>${money(outstanding)}</b><span class="muted">unpaid jobs, all months</span></div>
      <div class="kpi"><small>Ad spend</small><b>${money(st.spend)}</b></div>
      <div class="kpi"><small>After ad spend</small><b>${money(total - st.spend)}</b><span class="muted">collected − ads</span></div>
    </div>

    <section class="card day-chart-card">
      <div class="card-head"><h2>Collected by day</h2><small class="muted">${monthLabel(month)}</small></div>
      <div class="day-chart">
        ${chartDays.map((d) => {
          const v = state.days[d]?.cash;
          return html`<div class=${'dc-col' + (d === today ? ' today' : '') + (d > today ? ' future' : '')} title=${`${shortLabel(d)}: ${v == null ? 'not entered' : money(v)}`}>
            <i style=${{ height: v ? Math.max(3, (v / maxDay) * 100) + '%' : '0' }}></i>
            <small>${+d.slice(8)}</small>
          </div>`;
        })}
      </div>
    </section>

    <div class="fin-layout">
      <div>
        ${month === current && html`<${TodayCash} key=${today} today=${today} day=${state.days[today]} />`}

        ${month === current
          ? html`<${RevenueCard} state=${state} today=${today} title="This month" forecast />`
          : html`<section class="card"><div class="rev-big"><b>${money(total)}</b><span> / ${money(target)}</span></div></section>`}

        <section class="card">
          <label class="inline-label">Monthly goal
            <div class="money-input"><span>$</span><input inputmode="numeric" value=${target}
              onChange=${(e) => { const v = parseMoney(e.target.value); if (v > 0) update((s) => L.setRevenueTarget(s, month, v)); }} /></div>
          </label>
        </section>
      </div>

      <section class="card">
        <div class="card-head"><h2>By day</h2><small class="muted">Tap a day to fix it</small></div>
        ${list.length === 0 && html`<p class="muted">No working days yet this month.</p>`}
        ${list.map((d) => html`<${CashRow} key=${d} date=${d} day=${state.days[d]} />`)}
      </section>
    </div>
  `;
}

// Quick entry for today's cash. Same number the end-of-day prompt asks for.
function TodayCash({ today, day }) {
  const saved = day?.cash;
  const [editing, setEditing] = useState(saved == null);
  const [v, setV] = useState(saved != null ? String(saved) : '');
  const n = parseMoney(v);
  if (!editing) {
    return html`<section class="card today-cash">
      <div><div class="eyebrow">Collected today · ${shortLabel(today)}</div><div class="today-cash-amt">${money(saved)}</div></div>
      <button class="btn ghost" onClick=${() => { setV(String(saved)); setEditing(true); }}>Edit</button>
    </section>`;
  }
  return html`<section class="card today-cash-form">
    <div class="eyebrow">Collected today · ${shortLabel(today)}</div>
    <p class="muted small">Deposits count the day they're received, balances at pickup. End of day asks for this too.</p>
    <div class="inline-form">
      <div class="money-input grow"><span>$</span><input inputmode="decimal" value=${v} placeholder="0" onInput=${(e) => setV(e.target.value)} aria-label="Cash collected today" /></div>
      <button class="btn primary" disabled=${n == null || n < 0} onClick=${() => { update((s) => L.setDayCash(s, today, n)); setEditing(false); }}>Save</button>
    </div>
  </section>`;
}

function CashRow({ date, day }) {
  const [edit, setEdit] = useState(false);
  const [cash, setCash] = useState('');
  const [jobs, setJobs] = useState('');
  const open = () => { setCash(day?.cash != null ? String(day.cash) : ''); setJobs(String(day?.jobs ?? 0)); setEdit(true); };
  const save = () => {
    const v = parseMoney(cash);
    update((s) => {
      const d = s.days[date] || (s.days[date] = { date, cash: null, jobs: null });
      d.cash = v;
      d.jobs = Math.max(0, parseInt(jobs, 10) || 0);
    });
    setEdit(false);
  };
  if (edit) {
    return html`<div class="cash-row editing">
      <b>${shortLabel(date)}</b>
      <div class="field-row">
        <label>Cash<div class="money-input"><span>$</span><input inputmode="decimal" autoFocus value=${cash} onInput=${(e) => setCash(e.target.value)} /></div></label>
        <label>Customers closed<input type="number" inputmode="numeric" min="0" value=${jobs} onInput=${(e) => setJobs(e.target.value)} /></label>
      </div>
      <div class="btn-row"><button class="btn primary" onClick=${save}>Save</button><button class="btn ghost" onClick=${() => setEdit(false)}>Cancel</button></div>
    </div>`;
  }
  return html`<button class="cash-row" onClick=${open}>
    <span>${shortLabel(date)}</span>
    <span class="muted small">${day?.jobs ? `${day.jobs} closed` : ''}</span>
    <b class=${day?.cash == null ? 'muted' : ''}>${day?.cash == null ? '—' : money(day.cash)}</b>
  </button>`;
}
