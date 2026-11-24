// Cloud sync through Supabase: one row per user holding the whole app document.
// - Every edit saves to this device instantly, then uploads ~1s later.
// - On open / when the app comes back to the front, the newer copy wins (by meta.savedAt).
// - Offline: keeps working from this device and uploads when back online.
// With no config (config.js empty) the app runs local-only.
import { useState, useEffect } from './preact.js';
import { CONFIG } from '../../config.js';

const SDK = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
export const cloudEnabled = !!(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);

let client = null;
let user = null;
let status = cloudEnabled ? 'starting' : 'local'; // starting | signed-out | syncing | ready | saving | offline
let ready = !cloudEnabled; // true once the first sync has finished (or we gave up and went offline)
let dirty = false;
let timer = null;
let getLocal = () => null;
let applyRemote = () => {};
const listeners = new Set();
const notify = () => listeners.forEach((l) => l());

export const cloudState = () => ({ status, ready, email: user?.email || '' });

export function useCloud() {
  const [, force] = useState(0);
  useEffect(() => { const l = () => force((x) => x + 1); listeners.add(l); return () => listeners.delete(l); }, []);
  return cloudState();
}

export async function startCloud(getState, replaceFromCloud) {
  getLocal = getState;
  applyRemote = replaceFromCloud;
  if (!cloudEnabled) return;
  try {
    const { createClient } = await import(SDK);
    client = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'dd-auth' },
    });
    const { data } = await client.auth.getSession();
    user = data.session?.user || null;
    client.auth.onAuthStateChange((_event, session) => {
      const before = user?.id;
      user = session?.user || null;
      if (user && user.id !== before) firstSync();
      if (!user) { status = 'signed-out'; ready = false; notify(); }
    });
    if (user) await firstSync();
    else { status = 'signed-out'; notify(); }
  } catch (e) {
    // Couldn't even load the sync library (offline on a cold start): run from this device.
    console.warn('Cloud unavailable', e);
    status = 'offline'; ready = true; notify();
  }
  const refresh = () => { if (document.visibilityState === 'visible') pullIfNewer(); };
  document.addEventListener('visibilitychange', refresh);
  window.addEventListener('focus', refresh);
  window.addEventListener('online', () => (dirty ? pushNow() : pullIfNewer()));
}

async function firstSync() {
  status = 'syncing'; notify();
  try { await pullIfNewer(true); } catch (e) { console.warn('First sync failed', e); status = 'offline'; }
  ready = true; notify();
}

async function fetchRemote() {
  const { data, error } = await client.from('app_state').select('data').eq('user_id', user.id).maybeSingle();
  if (error) throw error;
  return data?.data || null;
}

async function pullIfNewer(strict = false) {
  if (!client || !user) return;
  if (dirty) return pushNow(); // our own unsaved edits go up first
  let remote;
  try { remote = await fetchRemote(); } catch (e) { if (strict) throw e; status = 'offline'; notify(); return; }
  const lt = getLocal()?.meta?.savedAt || 0;
  const rt = remote?.meta?.savedAt || 0;
  if (remote && rt > lt) applyRemote(remote);
  else if (!remote || lt > rt) await pushNow(true);
  status = dirty ? 'saving' : 'ready'; notify();
}

export function schedulePush() {
  if (!cloudEnabled || !user) return;
  dirty = true; status = 'saving'; notify();
  clearTimeout(timer);
  timer = setTimeout(() => pushNow(), 1200);
}

async function pushNow(force = false) {
  if (!client || !user || (!ready && !force)) return;
  clearTimeout(timer);
  const snapshot = getLocal();
  try {
    const { error } = await client.from('app_state').upsert({ user_id: user.id, data: snapshot, updated_at: new Date().toISOString() });
    if (error) throw error;
    if (getLocal() === snapshot) dirty = false;
    status = dirty ? 'saving' : 'ready';
  } catch (e) {
    console.warn('Upload failed, will retry', e);
    status = 'offline';
    clearTimeout(timer);
    timer = setTimeout(() => pushNow(), 15000);
  }
  notify();
}

export async function signIn(email, password) {
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
}
export async function signUp(email, password) {
  const { data, error } = await client.auth.signUp({ email, password });
  if (error) throw error;
  return !!data.session; // false = "confirm your email first"
}
export async function signOut() {
  if (dirty) await pushNow();
  await client.auth.signOut();
}
