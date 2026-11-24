import { addDays, weekday, monthKey, monthEnd, quarterEnd } from './dates.js';
import { blankDay, newTask, timeframeDates } from './logic.js';
import { uid } from './util.js';

export function defaultSettings() {
  return {
    why: '',
    principles: [
      'Volume negates luck.',
      "More beats better. Better beats new. Do more of what's already working.",
      'Speed to lead: the first one to respond usually wins.',
      'Be relentless.',
    ].map((text) => ({ id: uid(), text })),
    // "What I'm after": shown every morning under the monthly revenue goal.
    ambitions: [
      'Hit the monthly revenue goal. Every single month.',
      'Keep pushing growth. Never settle.',
      "Build something I'm extremely proud of.",
      'Dominate. Grow Driveway into the biggest shop here.',
      'The supercar, and real money. One day soon.',
    ].map((text) => ({ id: uid(), text })),
    nonNegotiables: [
      { id: 'nn_leads', title: 'Check new leads', minutes: 10 },
      { id: 'nn_followups', title: 'Follow-ups', minutes: 20 },
      { id: 'nn_content', title: 'Content creation', minutes: 30 },
      { id: 'nn_oldleads', title: 'Outreach to old leads', minutes: 20 },
      { id: 'nn_past', title: 'Text 5 past customers', minutes: 15, note: 'Check in, ask for a review or referral.' },
      { id: 'nn_partners', title: 'Partner outreach (3)', minutes: 20, note: 'Dealerships, exotic rentals, car photographers, Cars & Coffee, HOA/apartment managers.' },
      { id: 'nn_handoff', title: 'Hand off one thing', minutes: 15, note: "Document or delegate one task so you're not the bottleneck." },
    ],
    counters: [
      { id: 'c_past', group: 'outreach', label: 'Past customers texted', target: 5, saturdayTarget: 2 },
      { id: 'c_oldleads', group: 'outreach', label: 'Old leads contacted', target: 15, saturdayTarget: 5 },
      { id: 'c_partners', group: 'outreach', label: 'Partners reached', target: 3, saturdayTarget: 1 },
      { id: 'c_clips', group: 'content', label: 'Clips shot', target: 10, saturdayTarget: 6 },
      { id: 'c_hooks', group: 'content', label: 'Hooks written', target: 5, saturdayTarget: 2 },
      { id: 'c_posts', group: 'content', label: 'Posts made', target: 2, saturdayTarget: 1 },
      { id: 'c_followups', group: 'followups', label: 'Follow-ups completed', target: 10, saturdayTarget: 4 },
    ],
    reminders: [
      { id: 'rem_partners', text: 'Recruit new referral partners', days: [1, 3, 5], rolling: false },
    ],
    mondayExtras: false,
    mondayTasks: [
      { id: 'mon_analytics', title: 'Weekly analytics rundown', minutes: 30 },
      { id: 'mon_forecast', title: 'Week forecast', minutes: 20 },
    ],
    ideaBank: [
      ['idea_hooks', 'Write 5 hooks', 15],
      ['idea_dms', 'Reply to comments and DMs', 15],
      ['idea_ads', '5-minute ad check', 5],
      ['idea_calls', "Review yesterday's sales calls (Plaud)", 20],
      ['idea_objections', 'Objection practice', 10],
      ['idea_quotes', 'Quote follow-ups', 15],
      ['idea_logsales', 'Log sales same day', 5],
      ['idea_scoreboard', 'Daily scoreboard review', 5],
      ['idea_reviews', 'Reply to Google reviews', 10],
      ['idea_learning', '20 minutes of learning', 20],
    ].map(([id, title, minutes]) => ({ id, title, minutes, enabled: false })),
    eodLock: 'strict', // 'strict' | 'reminder'
    workdayEnd: 18 * 60,
    revenueTarget: 40000,
  };
}

export function defaultState(today, withSample) {
  const st = { version: 4, settings: defaultSettings(), goals: defaultGoals(today), wins: [], days: {}, weeks: {}, v3: true, v4: true };
  if (withSample) seedSample(st, today);
  return st;
}

// Chandler's real starting goals (not sample data). Rewards left blank on purpose.
function defaultGoals(today) {
  const month = monthKey(today);
  return [
    { id: 'g_rev', type: 'revenue', title: 'Monthly revenue', month, target: 40000, reward: '', status: 'active', start: `${month}-01`, due: monthEnd(today), createdAt: today, needsTarget: true },
    videosGoal(today),
    brandGoal(today),
    { id: 'g_partners', type: 'number', title: 'Sign 5 referral partners', target: 5, base: 0, counterIds: [], timeframe: 'quarter', start: timeframeDates('quarter', today).start, due: quarterEnd(today), reward: '', status: 'active', createdAt: today },
  ];
}
// 1–2 personal-brand videos a week. Repeats every Monday.
const brandGoal = (today) => ({
  id: 'g_brand', type: 'number', title: 'Personal brand videos (1–2 a week)', target: 2, base: 0, counterIds: [],
  timeframe: 'week', repeat: 'week', ...timeframeDates('week', today), reward: '', status: 'active', createdAt: today,
});
const videosGoal = (today) => ({
  id: 'g_videos', type: 'number', title: 'Record 20 organic videos', target: 20, base: 0, counterIds: [], timeframe: 'month',
  start: `${monthKey(today)}-01`, due: monthEnd(today), reward: '', status: 'active', createdAt: today,
});

// Bring older saved data up to the current shape.
export function migrate(st) {
  const d = defaultSettings();
  st.settings = { ...d, ...st.settings };
  st.goals ||= []; st.wins ||= []; st.days ||= {}; st.weeks ||= {};
  // Saturday targets (step 3) for counters saved before they existed.
  const defCounters = Object.fromEntries(d.counters.map((c) => [c.id, c]));
  for (const c of st.settings.counters) if (c.saturdayTarget == null) c.saturdayTarget = defCounters[c.id]?.saturdayTarget ?? Math.ceil(c.target / 3);
  // Goals know their date window.
  for (const g of st.goals) {
    if (g.start) continue;
    if (g.type === 'revenue') { g.start = `${g.month}-01`; g.due = monthEnd(`${g.month}-01`); }
    else if (g.timeframe === 'month' && g.due) g.start = `${monthKey(g.due)}-01`;
    else if (g.timeframe === 'quarter' && g.due) g.start = timeframeDates('quarter', g.due).start;
    else g.start = g.createdAt || '0000-00-00';
  }
  // v3 (Chandler's feedback after step 2): trim goals, no rewards, no bottleneck list, drop "The hook is everything."
  if (!st.v3) {
    const today = Object.keys(st.days).filter((k) => st.days[k].started).sort().pop() || new Date().toISOString().slice(0, 10);
    st.goals = st.goals.filter((g) => !['g_ppf', 'g_reviews', 'g_clips', 'g_hist'].includes(g.id));
    for (const g of st.goals) {
      if (g.type === 'revenue') { g.reward = ''; delete g.sample; if (g.status === 'active') g.needsTarget = true; }
      if (g.id === 'g_partners') { g.reward = ''; g.base = 0; delete g.sample; }
    }
    if (!st.goals.some((g) => g.id === 'g_videos')) st.goals.push(videosGoal(today));
    st.settings.principles = st.settings.principles.filter((p) => p.text.trim() !== 'The hook is everything.');
    for (const d of Object.values(st.days)) for (const t of d.tasks || []) if (t.goalId === 'g_ppf') t.goalId = null;
    delete st.bottleneck;
    delete st.v2Sample;
    st.v3 = true;
  }
  // v4: weekly personal-brand videos goal
  if (!st.v4) {
    const today = Object.keys(st.days).filter((k) => st.days[k].started).sort().pop() || new Date().toISOString().slice(0, 10);
    if (!st.goals.some((g) => g.id === 'g_brand' || g.title.startsWith('Personal brand videos'))) st.goals.push(brandGoal(today));
    st.v4 = true;
  }
  return st;
}

// ---------- Sample data (so every screen has something to show) ----------
function seedSample(st, today) {
  const s = st.settings;
  const month = monthKey(today);
  st.sample = true;
  st.wins = [
    { id: uid(), sample: true, date: addDays(today, -9), text: 'Closed a $6,800 full-body PPF on a 911 from a Meta lead.' },
    { id: uid(), sample: true, date: addDays(today, -6), text: 'Three 5-star Google reviews in one day.' },
    { id: uid(), sample: true, date: addDays(today, -3), text: 'Rivian ceramic reel hit 18k views.' },
  ];

  const dates = [];
  for (let d = addDays(today, -1); dates.length < 18; d = addDays(d, -1)) if (weekday(d) !== 0) dates.unshift(d);

  const cash = [1850, 0, 2200, 950, 2600, 1100, 0, 1200, 2600, 800, 2250, 1900, 650, 2800, 0, 2900, 1450, 2400];
  const intents = ['book two PPF consults', 'post 2 reels and text 5 past customers', 'clear every follow-up', 'get one new partner on the phone'];
  const winsTxt = ['Booked a ceramic package off a 60-second callback.', 'Two partner calls, one wants a meeting.', 'Posted 2 reels, one is taking off.', 'Got a referral from a past customer text.'];
  const slips = ['Partner outreach: got pulled into the shop.', 'Hooks: ran out of time after a walk-in.', 'Nothing major.', 'Hand-off: never documented the intake script.'];
  const ones = ['Close the Escalade tint quote', 'Film the before/after on the M4', 'Call the BMW dealer GM', 'Write the intake SOP for DJ'];

  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

  dates.forEach((date, i) => {
    const day = blankDay(s, date);
    day.sample = true;
    day.checkin = { at: 0, intention: intents[i % intents.length] };
    const perfect = i >= dates.length - 6;
    day.items.forEach((it) => {
      it.done = perfect || (!(it.refId === 'nn_handoff' && i % 3 === 1) && !(it.refId === 'nn_partners' && i % 4 === 2));
      if (it.done && rnd() < 0.6) it.actual = Math.max(3, Math.round(it.minutes * (0.7 + rnd() * 0.7)));
    });
    s.counters.forEach((c) => { day.counts[c.id] = Math.max(0, Math.round(c.target * (0.6 + rnd() * 0.6))); });
    day.cash = cash[i % cash.length];
    day.jobs = day.cash >= 2500 ? 2 : day.cash >= 800 ? 1 : 0;
    day.eod = { at: 0, win: winsTxt[i % winsTxt.length], slipped: slips[i % slips.length], tomorrowOne: ones[i % ones.length] };
    st.days[date] = day;
  });

  // Linked-goal progress example
  st.days[dates[10]].tasks.push(newTask(dates[10], 'Book the Cayenne PPF', 15, null, { done: true, sample: true }));

  // Last worked day: one done task, two unfinished (these carry over), plus a #1 for today
  const last = st.days[dates[dates.length - 1]];
  last.tasks.push(newTask(last.date, 'Film the GT3 reveal clip', 30, null, { done: true, sample: true }));
  last.tasks.push(newTask(dates[dates.length - 2], 'Send quote to the Model Y ceramic lead', 15, null, { pushCount: 1, sample: true }));
  last.tasks.push(newTask(dates[dates.length - 3], 'Update Google Business photos', 20, null, { pushCount: 2, sample: true }));
  last.eod.tomorrowOne = 'Close the GT3 full-front PPF quote';
}
