# Deploying Driveway Daily

Three parts: Supabase (stores your data + login), Vercel (hosts the app), then install it on your phone.
Everything is free tier. Claude does the code parts; you do the account parts.

## 1. Supabase (about 5 minutes)

1. Go to **supabase.com** → **Start your project** → sign up (GitHub or email).
2. **New project**
   - Name: `driveway-daily`
   - Database password: make one and save it in your password manager (you won't need it day to day)
   - Region: **West US (North California)** (closest to Scottsdale)
   - Click **Create new project** and wait ~2 minutes.
3. Left sidebar → **SQL Editor** → **New query**. Paste everything from `supabase.sql` → **Run**. You should see "Success. No rows returned."
4. Left sidebar → **Authentication** → **Sign In / Providers** → **Email**:
   - Turn **off** "Confirm email" (so your account works right away) → Save.
5. Left sidebar → **Project Settings** → **API** (or **Data API**). Copy:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **anon public** key (a long string starting with `eyJ…`)
   Send both to Claude. They're safe to share: the database only lets you read your own data.
   Do **not** send the `service_role` key.

Claude puts those into `config.js`.

## 2. Vercel (about 5 minutes)

Recommended route (Claude can then ship updates for you every time you ask for a change):

1. Create a free **GitHub** account if you don't have one, and a new **private** repository named `driveway-daily` (leave it empty).
2. Claude commits the app and gives you one command to push it (GitHub will ask you to sign in once).
3. Go to **vercel.com** → sign up **with GitHub** → **Add New… → Project** → pick `driveway-daily` → **Deploy**.
   No settings to change: it's a static site, no build step.
4. You get a link like `https://driveway-daily.vercel.app`. That's your app.

## 3. First sign-in, lock it down, install on your phone

1. Open your Vercel link on your **desktop** browser → **First time? Create your account** → your email + a password.
   Your current data from this computer uploads automatically.
2. Back in Supabase → **Authentication** → **Sign In / Providers** → turn **off** "Allow new users to sign up" → Save.
   Now nobody else can make an account.
3. On your **iPhone**, open the link in **Safari** → sign in → tap **Share** → **Add to Home Screen** → Add.
   It opens full screen like an app, with the Driveway icon.

## How sync works

- Every change saves on the device instantly and uploads about a second later.
- When you open the app (or switch back to it), it pulls whatever is newest.
- No signal at the shop? It keeps working and uploads when you're back online.
- Tip: use one device at a time for edits; the most recent save wins.

## Before going live

- Settings → **Remove sample data** if you want to start clean (do this before the first sign-in so the sample data never uploads).
