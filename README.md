# Driveway Daily

Personal accountability dashboard for Driveway Auto Spa. See SPEC.md (in your home folder) for the full spec.

## Status
- [x] Step 1: Core (morning check-in, Today screen, volume counters, carry-over, end of day + cash collected, settings, wins, revenue page)
- [x] Step 2: Goals page (number / done / monthly revenue goals, optional rewards, celebration, history)
- [x] Feedback round 1: ambitions ("What I'm after"), revenue forecast, monthly revenue prompt, bottleneck list removed, black/navy/light-blue redesign
- [x] Step 3: Saturday template (pickup checklists, lower targets) + Sunday planning (review, goals, next week's plan pinned on Today)
- [x] Step 4 (changed): Tasks tab for daily tasks + today-only tasks, editable in place. Google Calendar dropped at Chandler's request.
- [ ] Step 5: Google Sheet scoreboard (skipped for now)
- [~] Step 6: PWA (icon, manifest, offline) + Supabase login/sync are built. Accounts + hosting: see DEPLOY.md

## Run it locally
No build step. Any static file server works. On this Mac:

    /usr/bin/ruby -run -e httpd . -p 5180

Then open http://localhost:5180

## Testing tricks
- Pretend it's another day: Settings → "Testing", or add `?date=2026-11-24&time=09:00` to the URL. `?date=clear` goes back to real time.
- Sample data loads on first run. Settings → Data → "Remove sample data" clears it.

## How it's built
- `src/lib/dates.js`: Phoenix-time day logic (America/Phoenix, no DST)
- `src/lib/logic.js`: carry-over, scores, streaks, revenue pace, goal progress
- `src/lib/store.js`: one JSON document, saved in the browser for now (Supabase in step 6)
- `src/lib/defaults.js`: default settings and sample data
- `src/ui/*`: screens (check-in, today, end of day, revenue, wins, settings)
- Preact + htm loaded from unpkg (vendored locally in step 6 for offline PWA)
