import { html, useState } from './preact.js';
import { signIn, signUp } from './cloud.js';

export function Login() {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setMsg('');
    try {
      if (mode === 'signin') await signIn(email.trim(), pw);
      else {
        const inNow = await signUp(email.trim(), pw);
        if (!inNow) { setMsg('Check your email to confirm the account, then sign in here.'); setMode('signin'); }
      }
    } catch (err) {
      setMsg(err.message || 'Something went wrong. Try again.');
    }
    setBusy(false);
  };

  return html`<div class="login">
    <div class="login-mark"><img src="icon-192.png" alt="" width="72" height="72" /></div>
    <h1>Driveway Daily</h1>
    <p class="muted">${mode === 'signin' ? 'Sign in to pick up where you left off.' : 'One-time setup: create your account.'}</p>
    <form class="card form" onSubmit=${submit}>
      <label>Email<input type="email" autocomplete="username" value=${email} onInput=${(e) => setEmail(e.target.value)} required /></label>
      <label>Password<input type="password" autocomplete=${mode === 'signin' ? 'current-password' : 'new-password'} minlength="8" value=${pw} onInput=${(e) => setPw(e.target.value)} required /></label>
      ${msg && html`<p class="login-msg">${msg}</p>`}
      <button class="btn primary big" type="submit" disabled=${busy || !email || pw.length < 8}>${busy ? 'One sec…' : mode === 'signin' ? 'Sign in' : 'Create account'}</button>
    </form>
    <button class="link" onClick=${() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMsg(''); }}>
      ${mode === 'signin' ? 'First time? Create your account' : 'Already have an account? Sign in'}
    </button>
  </div>`;
}
