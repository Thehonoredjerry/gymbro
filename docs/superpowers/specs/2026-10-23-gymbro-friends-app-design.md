# GymBro for a group of friends — design

Date: 2026-10-23 · Status: ready for approval

## Intent

GymBro is being turned from a self-hoster's tool into an app the owner hands to a small group of
friends (2–3 now, maybe ~10 later). Friends are on Android phones, iPhones (an iPhone 17 among
them) and Windows PCs. The owner wants it to feel like a real gym app: sign in on the phone, pick
a language, set up a profile, train from routines that remember the last session, and see your
strength climb through ranks and levels — the part of Liftoff they liked — without any
subscription. Thai speakers are first-class users, so Thai must have no bugs.

## What exists already (do not rebuild)

- Server on Railway, live: `https://gymbro-production-c5ec.up.railway.app` (project
  `patient-quietude`, services `gymbro` = web/nginx and `api` = Node with a volume at `/data`).
  Data stays as GymBro's JSON files on the volume (decided; no database).
- Routines (e.g. "Leg Day") built from the 5,600-exercise library, machines included; sets, reps
  and rest time per exercise; rest timer starts when a set is finished; rest time picker up to
  15 min; set-by-set loading from the **most recent** session of that exercise in that routine
  (`lib/history.js` `buildWorkSets`, `lib/session-start.js`).
- Password sign-in and sign-up with invite codes (`POST /api/login/password`,
  `POST /api/register/password`, gated by `PASSWORD_LOGIN=1`; invites via `INVITE_ONLY=1`, codes
  made in the admin dashboard). Pairing a phone issues a **bearer token** (`/api/pair/redeem` →
  `makeSession`); the app stores it via `lib/remote.js`.
- Estimated 1RM per exercise (`lib/onerm.js`), body-weight log (`S.bodyweight`), body type
  (`S.body`: male/female), PR detection, workout finish flow (`lib/finish-workout.js`).
- Web push for "rest over" (`POST /api/push/rest-timer`, server-side timer), day reminders.
- Capacitor shells `frontend/android` and `frontend/ios`; app id `com.gymbro.app`.

## Goals

1. **Welcome & login (phone-first).** First launch: choose language (Thai or English) → sign in or
   create an account (username + password + invite code) → first-time profile → app.
2. **Workout defaults.** A routine always opens at exactly what was lifted last time; no automatic
   weight increases unless the person switches a progression rule on; an exercise never done
   before opens empty.
3. **Strength ranks** for every weighted exercise (machines included) and overall, Bronze →
   Champion with I–III divisions, counted only once a level is reached twice.
4. **XP and levels** that reward showing up, so beginners level up too.
5. **Rank-up screen** after a workout when a rank or level goes up.
6. **Thai with no bugs**, including notifications (bug found: push text has no Thai).
7. **Android APK** built in the cloud (GitHub Actions), signed, sideloaded by friends.

## Non-goals

- Friends leaderboard, badges, weekly challenges (owner chose not to). No social feed.
- A database, a native iOS app, TestFlight, App Store / Play Store distribution. iPhone users use
  the Safari web app (Add to Home Screen).
- New languages beyond Thai and English in the picker. The other 17 locale packs stay in the repo,
  hidden, so they can come back later.
- Passkeys inside the native app (needs Apple/Google domain association; not worth it here).

## Anti-goals (failure even if it "works")

- Any Thai screen showing English, cut-off text, or broken line wrapping in the new flows.
- A friend getting locked out, or a stranger able to sign up without an invite code.
- Losing anyone's workout data, or the rank system rewarding one-off ego lifts.
- A rank number that is wrong or unexplained — the person must be able to see why they have it.

## Constraints

- Dependency-light (CLAUDE.md): frontend React + Router + Zustand only; api two runtime deps. No
  new npm dependencies.
- Training logic (ranks, XP, loading rules) lives in pure helpers in `frontend/src/lib/` with a
  unit test beside each (CONTRIBUTING.md).
- Every new UI string goes into every locale pack (`node scripts/check-locales.mjs` in CI). Thai
  gets a real translation; the 16 hidden packs get the English text.
- AGPL: friends using the server must be able to get the source. The repo is going private, so
  friends are given read access on request; the "Source code" link stays.
- Media licence wording ("licensed for openGym only") is never changed.
- Existing sync/merge rules (`lib/sync-merge.js`) must cover any new synced state fields.

## Part 1 — Welcome & login

**Decided by the owner:** username + password + an invite code the owner gives out; language
picker shows only ไทย and English; the first-run profile asks for name, body weight "and more" so
improvement and ranks can be calculated.

Flow on first launch (Android app and web/PWA alike):

1. **Language** — two big choices, ไทย / English. Sets `S.lang` explicitly (clears `langAuto`).
   The picker in Settings also shows only these two (an `ACTIVE_LANGS` list in `i18n-core.js`;
   `LANGS` keeps all packs for later).
2. **Sign in / Create account** — username, password; "Create account" adds the invite code
   field. Errors shown inline in the chosen language (wrong password, name taken, invalid or used
   invite code, weak password, server unreachable).
3. **Profile** (first time only, after account creation): display name (pre-filled from the
   username), body type (male/female — needed for rank standards), current body weight
   (stored as the first `S.bodyweight` entry). Optional: goal weight (`S.targetW`). Units follow
   the language default (kg) and stay changeable in Settings.
4. **Notifications** (web/PWA, iPhone especially) — a tap-to-allow step, since iOS only allows the
   permission request from a user tap; skippable.

Server address: the Android build has the Railway URL built in (a build-time variable for the
mobile build), so friends never type it. The app's old "Use on this device / Connect to my server
with a pairing code" screen is replaced by this flow when a built-in server is set; pairing stays
available under Settings for anyone who needs it.

Server changes:

- When the caller is the native app, `POST /api/login/password` and `POST /api/register/password`
  also return a bearer `token` in the body (same `makeSession` the pairing uses; the
  change-password route already returns one to a phone), so the app can use the existing
  bearer-token path. Browsers keep using the cookie only.
- These two routes are deliberately *not* in `CSRF_EXEMPT` (login-CSRF protection, comment near
  `api/server.js` line 640). My call: accept them only from the two Capacitor WebView origins,
  `capacitor://localhost` (iOS) and `https://localhost` (Android) — **not** `http://localhost`,
  so a page served on a friend's machine cannot use them. Only these routes, only these origins.
- Password reset by code already exists, so a friend who forgets a password has a way back in
  (admin hands out a reset code).
- Railway variables: `PASSWORD_LOGIN=1`, `INVITE_ONLY=1` (after the owner's own account exists),
  `ALLOW_GUEST=0` (friends app; no "continue without account").

Web (PC and iPhone): the same three screens replace the current passkey-first login page. My call:
the web sign-in screen keeps a secondary "Sign in with passkey" button, so an account that was
created with a passkey (for example the owner's, if made before this ships) is never locked out;
adding a passkey stays in Settings. The live server has 0 accounts as of writing.

## Part 2 — Workout defaults

**Decided by the owner:** load the most recent session (not the highest, so an ego lift never
sticks); no automatic increases unless the person configures progression; never-done exercises
start empty; rest time is theirs to set.

- Default progression policy becomes **off** for every exercise and routine that has no explicit
  rule (`lib/progression.js` `policyFor` fallback `linear` → `off`; today that fallback already
  is `off` for everything but rep-based exercises). Routines and exercises that set a rule keep
  it; the progression settings stay as they are.
- Most-recent loading stays as implemented; verify with tests that it never picks a heavier
  earlier session.
- An exercise with no history and no planned weight opens with empty weight **and empty reps**
  (my call — owner to confirm; the alternative is pre-filling the routine's planned reps as a
  hint). Empty must be visibly empty, not "0".
- Rest timer: unchanged behaviour, verified in Thai and English, including the push when the app
  is in the background.

## Part 3 — Ranks, XP, rank-up screen

**Decided by the owner:** ranks like Liftoff (tiers with I–III), XP & levels, a rank-up screen.

Ranks (my call on the details, all tunable constants in one helper with tests):

- **Which exercises (owner decided):** every weighted exercise earns a rank — barbell, dumbbell
  and machines alike ("it's their and my achievement"). Timed holds and cardio earn XP only.
  Bodyweight exercises with added load (dip belt) rank on the added load plus body weight.
- **"Prove it twice" (owner decided):** a level only counts once it has been reached in **two
  different sessions**. Concretely: take each session's best estimated 1RM for the exercise in
  the last 90 days (`lib/onerm.js`, the app's chosen formula, sets above the formula's rep cap
  ignored as it already does); the exercise's ranking strength is the **second-highest** of
  those session bests. One lucky heavy day never ranks anyone up; matching it once more does.
- **Per-exercise rank:** ranking strength ÷ current body weight, mapped to tiers by thresholds.
  There are no published standards for 5,600 exercises, so GymBro groups exercises into a small
  number of movement groups from catalogue fields (target muscle, body part, equipment — e.g.
  big lower-body presses like squat and leg press, hinges, horizontal presses, vertical presses,
  rows and pulldowns, arm isolation, shoulder isolation, calves, core) plus a default group, with
  its own thresholds per group and body type. Dumbbell exercises use per-hand load as logged.
  Machine ranks are approximate by nature (machines differ between gyms) — the rank detail says
  so in one line. GymBro writes its own thresholds — no copying another app's tables.
- **Overall rank (my call):** with machines in, a powerlifting-only DOTS total would leave
  machine-only friends unranked forever. Instead: each tier division is worth points
  (Bronze III = 1 … Champion = 16); the overall rank is the average of the person's **top five**
  exercise ranks, rounded down to a division. Shown once three exercises are ranked; before
  that, "Unranked — rank three exercises". DOTS is dropped.
- **Tiers:** Bronze, Silver, Gold, Platinum, Diamond, Champion; I–III inside each except
  Champion. Each rank shows "next tier at X kg" so the number is explained.
- Ranks are derived from history, not stored — editing or deleting a workout recomputes them.

XP & levels (my call):

- XP for each finished workout (base) plus per completed working set, plus a weekly-streak bonus.
  Levels on a rising curve so early levels come quickly. Derived from workout history, not stored,
  so it syncs and recomputes for free.
- Shown on Home (level, progress bar) and in Stats.

Rank-up screen:

- After finishing a workout, if any exercise rank, the overall rank or the level went up compared
  with before that workout, show a full-screen celebration (tier badge, old → new, the exercise and
  the e1RM that did it). One screen listing several changes if more than one. Respects reduced
  motion. Dismiss returns to the normal finish summary.

## Thai and notification fixes

- `api/push-messages.js` has only English and Portuguese copy: add Thai for rest-over, day
  reminder and test notifications, and a test that every active language has every push string.
- All new strings translated to natural Thai; screens checked at phone width in Thai for clipping,
  wrapping and Prompt-font rendering.

## Android APK

- GitHub Actions workflow on `main`: `npm run build:mobile` with the built-in server URL,
  Gradle `assembleRelease`, zipalign + sign with a keystore stored in repo secrets, upload the APK
  and its `.sha256` as a workflow artifact.
- The keystore is created once; the owner keeps a copy — losing it means friends must uninstall
  to update.
- Private repo: GitHub Releases are not downloadable by friends, and the app's update check reads
  public releases. My call: switch the in-app update check off for this build; the owner sends new
  APKs directly.

## Testing (owner: "test EVERY feature")

- Unit tests for every new helper (ranks, movement groups, prove-it-twice, overall rank, XP/levels, rank-up diff, empty-start rule,
  progression default), and server tests for the token-returning login/register and invite rules.
- Full existing suites green apart from the documented Windows-only baseline failures.
- Locale checks (`check-locales.mjs`, `check-source-strings.mjs`) and a test that new strings have
  real Thai (not English) in `th.js`.
- End-to-end in a real browser against a local server, in Thai and in English: first launch →
  language → create account with invite → profile → build Leg Day → train it → finish → rank-up
  screen → second session loads last weights → progression off by default; plus a wrong-password
  and a bad-invite path. Screenshots of every new screen in Thai reviewed for clipping.
- After deploy: the same smoke test against the Railway URL; APK build checked in CI.

## Left to the builder

Exact component structure and file names, threshold and XP numbers (as long as they live in one
tested helper and feel right for beginners through advanced), the rank badge artwork (simple,
in the GymBro palette), and the order of commits.
