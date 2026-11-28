// Sales: log each sale the day it's sold (customer + price per service), track paid/review,
// plus the month's ad spend and lead count for ROAS and conversion.
import { html, useState } from './preact.js';
import { update } from './store.js';
import * as L from './logic.js';
import { monthKey, monthLabel, prevMonth, nextMonth, shortLabel, dateShort } from './dates.js';
import { money, parseMoney, uid } from './util.js';

export function Sales({ state, now }) {
  const today = now.date, current = monthKey(today);
  const [month, setMonth] = useState(current);
  const [editing, setEditing] = useState(null);
  const st = L.salesStats(state, month);
  const list = [...st.list].sort((a, b) => (a.date === b.date ? (b.createdAt || 0) - (a.createdAt || 0) : a.date < b.date ? 1 : -1));
  const services = Object.entries(st.byService).sort((a, b) => b[1].amount - a[1].amount);
  const maxSvc = Math.max(1, ...services.map(([, v]) => v.amount));

  return html`
    <header class="top"><div><div class="eyebrow">Booked revenue</div><h1>Sales</h1></div></header>

    <div class="month-nav">
      <button class="btn ghost" onClick=${() => setMonth(prevMonth(month))} aria-label="Previous month">‹</button>
      <b>${monthLabel(month)}</b>
      <button class="btn ghost" disabled=${month >= current} onClick=${() => setMonth(nextMonth(month))} aria-label="Next month">›</button>
    </div>

    <div class="kpis six">
      <div class="kpi"><small>Sold</small><b>${money(st.sold)}</b><span class="muted">${st.n} sale${st.n === 1 ? '' : 's'}</span></div>
      <div class="kpi"><small>Avg ticket</small><b>${st.avgTicket == null ? '—' : money(st.avgTicket)}</b></div>
      <div class="kpi"><small>ROAS</small><b>${st.roas == null ? '—' : st.roas.toFixed(1) + 'x'}</b><span class="muted">sold ÷ ad spend</span></div>
      <div class="kpi"><small>Ad spend</small><b>${money(st.spend)}</b><span class="muted">${st.costPerSale == null ? '' : money(st.costPerSale) + ' per sale'}</span></div>
      <div class="kpi"><small>Leads</small><b>${st.leads}</b></div>
      <div class="kpi"><small>Conversion</small><b>${st.conversion == null ? '—' : Math.round(st.conversion * 100) + '%'}</b><span class="muted">sales ÷ leads</span></div>
    </div>

    <div class="sales-layout">
      <div class="sales-main">
        <${SaleForm} key=${editing?.id || 'new'} state=${state} today=${today} sale=${editing} onDone=${() => setEditing(null)} />

        <section class="card">
          <div class="card-head"><h2>Sales by day sold</h2><small class="muted">${monthLabel(month)}</small></div>
          ${list.length === 0 && html`<p class="muted small">No sales logged for ${monthLabel(month)} yet.</p>`}
          ${list.length > 0 && html`<div class="sale-table">
            <div class="sale-row head"><span>Date</span><span>Customer</span><span>Services</span><span class="r">Total</span><span>Paid</span><span>Review</span><span></span></div>
            ${list.map((s) => html`<div class="sale-row" key=${s.id}>
              <span class="muted">${shortLabel(s.date)}</span>
              <b>${s.customer || '—'}</b>
              <span class="sale-lines">${(s.lines || []).map((l) => html`<span class="tag">${l.service || 'Other'} ${money(l.amount)}</span>`)}</span>
              <b class="r">${money(L.saleTotal(s))}</b>
              <button data-l="Paid" class=${'tick' + (s.paid ? ' on' : '')} aria-label=${'Paid: ' + (s.customer || 'sale')}
                onClick=${() => update((x) => { const y = x.sales.find((z) => z.id === s.id); y.paid = !y.paid; y.paidDate = y.paid ? today : null; })}>${s.paid ? '✓' : ''}</button>
              <button data-l="Review" class=${'tick' + (s.reviewAsked ? ' on' : '')} aria-label=${'Review asked: ' + (s.customer || 'sale')}
                onClick=${() => update((x) => { const y = x.sales.find((z) => z.id === s.id); y.reviewAsked = !y.reviewAsked; })}>${s.reviewAsked ? '✓' : ''}</button>
              <button class="link small" onClick=${() => { setEditing(s); window.scrollTo(0, 0); }}>Edit</button>
            </div>`)}
          </div>`}
        </section>
      </div>

      <div class="sales-side">
        <${Marketing} state=${state} month=${month} />
        <section class="card">
          <h2>By service</h2>
          ${services.length === 0 && html`<p class="muted small">Shows once you log sales.</p>`}
          ${services.map(([name, v]) => html`<div class="svc">
            <div class="svc-top"><span>${name}</span><b>${money(v.amount)}</b></div>
            <div class="svc-bar"><i style=${{ width: (v.amount / maxSvc) * 100 + '%' }}></i></div>
            <small class="muted">${v.n} job${v.n === 1 ? '' : 's'} · ${st.sold ? Math.round((v.amount / st.sold) * 100) : 0}% of sales</small>
          </div>`)}
        </section>
      </div>
    </div>
  `;
}

const blankLine = () => ({ id: uid(), service: '', amount: '' });

function SaleForm({ state, today, sale, onDone }) {
  const [date, setDate] = useState(sale?.date || today);
  const [customer, setCustomer] = useState(sale?.customer || '');
  const [lines, setLines] = useState(sale ? sale.lines.map((l) => ({ id: uid(), service: l.service, amount: String(l.amount) })) : [blankLine()]);
  const [paid, setPaid] = useState(!!sale?.paid);
  const [note, setNote] = useState(sale?.note || '');
  const total = lines.reduce((a, l) => a + (parseMoney(l.amount) || 0), 0);
  const valid = customer.trim() && lines.some((l) => (parseMoney(l.amount) || 0) > 0);
  const setLine = (i, k, v) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const known = L.knownServices(state);

  const save = () => {
    const clean = lines.filter((l) => (parseMoney(l.amount) || 0) > 0).map((l) => ({ service: l.service.trim() || 'Other', amount: parseMoney(l.amount) }));
    update((x) => {
      x.sales ||= [];
      if (sale) {
        const y = x.sales.find((z) => z.id === sale.id);
        Object.assign(y, { date, customer: customer.trim(), lines: clean, note: note.trim(), paid, paidDate: paid ? (y.paidDate || today) : null });
      } else {
        x.sales.push({ id: uid(), date, customer: customer.trim(), lines: clean, note: note.trim(), paid, paidDate: paid ? today : null, reviewAsked: false, createdAt: Date.now() });
      }
    });
    setDate(today); setCustomer(''); setLines([blankLine()]); setPaid(false); setNote('');
    onDone();
  };
  const remove = () => {
    if (!confirm(`Delete the sale for ${sale.customer || 'this customer'}?`)) return;
    update((x) => { x.sales = x.sales.filter((z) => z.id !== sale.id); });
    onDone();
  };

  return html`<section class=${'card sale-form' + (sale ? ' editing' : '')}>
    <div class="card-head"><h2>${sale ? 'Edit sale' : 'Log a sale'}</h2>${valid && html`<b class="big-num">${money(total)}</b>`}</div>
    <div class="sf-top">
      <label>Customer<input value=${customer} placeholder="Name" onInput=${(e) => setCustomer(e.target.value)} /></label>
      <label>Date sold<input type="date" value=${date} max=${today} onInput=${(e) => setDate(e.target.value || today)} /></label>
    </div>
    <datalist id="svc-list">${known.map((s) => html`<option value=${s} />`)}</datalist>
    <div class="sf-lines">
      ${lines.map((l, i) => html`<div class="sf-line" key=${l.id}>
        <input list="svc-list" value=${l.service} placeholder="Service (PPF, Ceramic…)" onInput=${(e) => setLine(i, 'service', e.target.value)} aria-label="Service" />
        <div class="money-input"><span>$</span><input inputmode="decimal" value=${l.amount} placeholder="0" onInput=${(e) => setLine(i, 'amount', e.target.value)} aria-label="Price" /></div>
        <button class="icon-btn" disabled=${lines.length === 1} onClick=${() => setLines((ls) => ls.filter((_, j) => j !== i))} aria-label="Remove service">✕</button>
      </div>`)}
    </div>
    <button class="link" onClick=${() => setLines((ls) => [...ls, blankLine()])}>+ Add a service</button>
    <label class="full sf-note">Note (optional)<input value=${note} placeholder="Vehicle, package, anything to remember" onInput=${(e) => setNote(e.target.value)} /></label>
    <label class="toggle"><input type="checkbox" checked=${paid} onChange=${(e) => setPaid(e.target.checked)} /> Paid in full already</label>
    <div class="btn-row">
      <button class="btn primary" disabled=${!valid} onClick=${save}>${sale ? 'Save changes' : 'Log sale'}</button>
      ${sale && html`<button class="btn ghost" onClick=${onDone}>Cancel</button><button class="btn danger" onClick=${remove}>Delete</button>`}
    </div>
  </section>`;
}

function Marketing({ state, month }) {
  const mk = L.monthMarketing(state, month);
  const [label, setLabel] = useState('');
  const [amt, setAmt] = useState('');
  const mut = (fn) => update((x) => fn(L.ensureMarketing(x, month)));
  const add = () => {
    const v = parseMoney(amt);
    if (!(v > 0)) return;
    mut((m) => m.spend.push({ id: uid(), label: label.trim() || 'Ads', amount: v }));
    setLabel(''); setAmt('');
  };
  return html`<section class="card">
    <h2>Marketing · ${monthLabel(month)}</h2>
    <div class="leads-row">
      <div class="grow"><b>Leads</b><small class="muted">New inquiries this month</small></div>
      <button class="minus round" disabled=${!mk.leads} onClick=${() => mut((m) => { m.leads = Math.max(0, (m.leads || 0) - 1); })} aria-label="Minus one lead">−</button>
      <input class="num" type="number" inputmode="numeric" min="0" value=${mk.leads || 0} aria-label="Leads this month"
        onChange=${(e) => mut((m) => { m.leads = Math.max(0, parseInt(e.target.value, 10) || 0); })} />
      <button class="plus round" onClick=${() => mut((m) => { m.leads = (m.leads || 0) + 1; })} aria-label="Plus one lead">+1</button>
    </div>
    <h3>Ad spend</h3>
    ${mk.spend.length === 0 && html`<p class="muted small">Add what you spent on Meta, Google, etc.</p>`}
    ${mk.spend.map((x) => html`<div class="spend-row" key=${x.id}>
      <span class="grow">${x.label}</span><b>${money(x.amount)}</b>
      <button class="link small danger-text" onClick=${() => mut((m) => { m.spend = m.spend.filter((y) => y.id !== x.id); })} aria-label=${'Remove ' + x.label}>Remove</button>
    </div>`)}
    <div class="inline-form spend-add">
      <input value=${label} placeholder="Meta ads" onInput=${(e) => setLabel(e.target.value)} aria-label="Spend label" />
      <div class="money-input"><span>$</span><input inputmode="decimal" value=${amt} placeholder="0" onInput=${(e) => setAmt(e.target.value)}
        onKeyDown=${(e) => e.key === 'Enter' && add()} aria-label="Amount" /></div>
      <button class="btn" onClick=${add}>Add</button>
    </div>
  </section>`;
}
