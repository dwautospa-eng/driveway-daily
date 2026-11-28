// Overview: the month at a glance. First screen after the morning check-in.
import { html } from './preact.js';
import { update } from './store.js';
import * as L from './logic.js';
import { monthKey, monthLabel, dateShort } from './dates.js';
import { money } from './util.js';
import { Bar } from './common.js';

const pct = (x) => (x == null ? '—' : Math.round(x * 100) + '%');

export function Overview({ state, now }) {
  const date = now.date, month = monthKey(date);
  const r = L.revenueStatus(state, date);
  const st = L.salesStats(state, month);
  const content = L.contentMade(state, month);
  const unpaid = L.unpaidSales(state);
  const reviews = L.reviewsToAsk(state);
  const outstanding = unpaid.reduce((a, s) => a + L.saleTotal(s), 0);

  return html`
    <header class="top"><div><div class="eyebrow">${monthLabel(month)}</div><h1>Overview</h1></div>
      <a class="btn ghost" href="#/sales">+ Log a sale</a>
    </header>

    <div class="kpis">
      <a class="kpi hero" href="#/cash">
        <small>Revenue this month</small>
        <b>${money(r.collected)}</b>
        <${Bar} value=${r.collected} max=${r.target} marker=${r.expected} />
        <span class="muted">of ${money(r.target)} · ${r.elapsed ? `projected ${money(r.projected)}` : 'collected'}</span>
      </a>
      <a class="kpi" href="#/sales"><small>Average ticket</small><b>${st.avgTicket == null ? '—' : money(st.avgTicket)}</b>
        <span class="muted">${st.n} sale${st.n === 1 ? '' : 's'} · ${money(st.sold)} sold</span></a>
      <a class="kpi" href="#/sales"><small>Conversion rate</small><b>${pct(st.conversion)}</b>
        <span class="muted">${st.leads ? `${st.n} of ${st.leads} leads` : 'Add leads on Sales'}</span></a>
      <a class="kpi" href="#/sales"><small>ROAS</small><b>${st.roas == null ? '—' : st.roas.toFixed(1) + 'x'}</b>
        <span class="muted">${st.spend ? `${money(st.sold)} on ${money(st.spend)}` : 'Add ad spend on Sales'}</span></a>
      <a class="kpi" href="#/sales"><small>Marketing costs</small><b>${money(st.spend)}</b>
        <span class="muted">${st.costPerSale == null ? 'this month' : `${money(st.costPerSale)} per sale`}</span></a>
      <a class="kpi" href="#/sales"><small>Sold this month</small><b>${money(st.sold)}</b>
        <span class="muted">booked, paid or not</span></a>
      <a class="kpi" href="#/today"><small>Content made</small><b>${content.total}</b>
        <span class="muted">${content.parts.map((p) => `${p.n} ${p.label.toLowerCase()}`).join(' · ') || 'this month'}</span></a>
      <div class="kpi"><small>Reviews to ask for</small><b class=${reviews.length ? 'warn-num' : ''}>${reviews.length}</b>
        <span class="muted">paid jobs, not asked yet</span></div>
      <div class="kpi"><small>Unpaid jobs</small><b class=${unpaid.length ? 'warn-num' : ''}>${unpaid.length}</b>
        <span class="muted">${money(outstanding)} outstanding</span></div>
    </div>

    <div class="ov-lists">
      <section class="card">
        <div class="card-head"><h2>Ask for a review</h2><small class="muted">${reviews.length}</small></div>
        ${reviews.length === 0 && html`<p class="muted small">Nobody waiting. Paid jobs show up here until you ask.</p>`}
        ${reviews.map((s) => html`<div class="ov-row">
          <div class="grow"><b>${s.customer || 'Customer'}</b><small class="muted">${dateShort(s.date)} · ${services(s)}</small></div>
          <button class="btn ghost sm" onClick=${() => update((x) => { x.sales.find((y) => y.id === s.id).reviewAsked = true; })}>Asked ✓</button>
        </div>`)}
      </section>
      <section class="card">
        <div class="card-head"><h2>Waiting on payment</h2><small class="muted">${money(outstanding)}</small></div>
        ${unpaid.length === 0 && html`<p class="muted small">Every job is paid.</p>`}
        ${unpaid.map((s) => html`<div class="ov-row">
          <div class="grow"><b>${s.customer || 'Customer'}</b><small class="muted">Sold ${dateShort(s.date)} · ${services(s)}</small></div>
          <b class="ov-amt">${money(L.saleTotal(s))}</b>
          <button class="btn ghost sm" onClick=${() => update((x) => { const y = x.sales.find((z) => z.id === s.id); y.paid = true; y.paidDate = date; })}>Paid</button>
        </div>`)}
      </section>
    </div>

    <a class="btn primary big" href="#/today">Go to today →</a>
  `;
}

const services = (s) => (s.lines || []).map((l) => l.service).filter(Boolean).join(' + ') || 'Sale';
