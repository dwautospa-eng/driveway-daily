// One JSON document holds everything. It's saved in this browser (localStorage) instantly,
// and synced to Supabase when cloud sync is configured (see cloud.js / config.js).
import { useState, useEffect } from './preact.js';
import { defaultState, migrate } from './defaults.js';
import { schedulePush } from './cloud.js';

const KEY = 'driveway-daily:v1';
let state;
const listeners = new Set();
const notify = () => listeners.forEach((l) => l());

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch (e) { console.error('Could not read saved data', e); }
  return null;
}
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.error('Could not save', e); }
}
const touch = () => { state.meta = { ...(state.meta || {}), savedAt: Date.now() }; };

export function initStore(today) {
  state = load() || defaultState(today, true);
  persist();
  // Keep two open tabs in sync
  window.addEventListener('storage', (e) => { if (e.key === KEY) { const s = load(); if (s) { state = s; notify(); } } });
}

export const getState = () => state;

export function update(fn) {
  const next = structuredClone(state);
  fn(next);
  state = next;
  touch();
  persist();
  notify();
  schedulePush();
}

export function replaceState(next) { state = next; touch(); persist(); notify(); schedulePush(); }

// A newer copy arrived from the cloud: take it as-is (no re-upload).
export function replaceFromCloud(remote) { state = migrate(remote); persist(); notify(); }

export function useAppState() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((x) => x + 1);
    listeners.add(l);
    return () => listeners.delete(l);
  }, []);
  return state;
}
