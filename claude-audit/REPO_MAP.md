# KettleFit — Repository Map & Architecture

> **Audit subject:** `tyler109j/kettlefit` @ `master` (v34, commit `a1257e4`)
> **Note:** `tyler109j/kettlefit-dev` is byte-for-byte identical to live at v34 (synced this session), so this map applies to both.
> **Audit date:** 2026-06-29 · **Auditor:** Claude (automated deep-dive)
> Reports live in `tyler109j/kettlefit-preview` on branch `audit/deep-dive-20260629`.

## 1. What the product is

KettleFit is an **adaptive kettlebell training PWA**. It generates individualized
kettlebell workouts from the user's available bells ("rack"), training goal,
recovery state, and history; logs sets in real time; tracks progression, PRs,
streaks/XP/badges; and renders progress charts. It is installable (manifest +
service worker) and works fully offline.

The README claims "**local-first, no backend required**," but this is **out of
date** — the app ships a full **Supabase** backend (`js/cloud.js`) for
multi-user accounts, cloud state sync, an admin "testers" dashboard, and a
feedback inbox. (See BUG-DOC in BUG_REPORT.md.)

## 2. Tech stack

| Concern | Choice |
|---|---|
| Language | Vanilla **ES modules** (no framework, no bundler) |
| UI | Hand-rolled DOM via `h()` helper in `js/ui.js` |
| Storage (local) | `localStorage` key `kettlefit_v1` (single JSON blob) |
| Storage (cloud) | **Supabase** (Postgres + Auth + RLS), `@supabase/supabase-js@2` via esm.sh CDN |
| Offline | Service worker (`service-worker.js`), cache `kettlefit-v34` |
| Build | **None.** Edit JS/CSS and refresh. `version_assets.py` / `scripts/*` are release helpers |
| CI | One GitHub Action: `release-changelog.yml` (changelog + cache-version bump on `[release]` commits) |
| Tests | **None present** (no test runner, no spec files) |
| Charts | Hand-rolled SVG (`js/charts.js`) |

## 3. Directory map

```
kettlefit/
├── index.html              App shell; loads js/app.js as a module
├── privacy.html            Static privacy policy
├── manifest.json           PWA manifest
├── service-worker.js       Offline cache (network-first shell, cache-first data)
├── version_assets.py       Release helper: stamps ?v=N on asset URLs
├── css/styles.css          All styling (722 lines)
├── js/                     Application code (ES modules)
│   ├── app.js              (~3533) Main controller: routing, all screens, session lifecycle, admin UI
│   ├── state.js            (~245) localStorage model, repairState(), rack derivation, import/export, data cache
│   ├── engine.js           (~501) Workout GENERATION: eligibility, scoring, prescribe(), circuits/supersets, warmup
│   ├── progression.js      (~145) e1RM (Brzycki), overload cascade recommendations
│   ├── recovery.js         (~342) Per-muscle recovery decay/regen, readiness, ACWR
│   ├── gamification.js     (~260) Streaks, XP, ranks, badges, freeze tokens
│   ├── workouts.js         (~211) Saved/templated workouts, share-code payload <-> workout
│   ├── share.js            (~128) Canvas share-cards + base64url share-code encode/decode
│   ├── cloud.js            (~249) Supabase auth + state sync + admin/feedback queries
│   ├── demo.js             (~347) Generates realistic demo history/state
│   ├── charts.js           (~137) SVG line/bar/radar charts
│   ├── notifications.js    (~50) Local notification gating (max 1/day)
│   └── ui.js               (~91) DOM helpers: h(), toast, modal, overlay, header
├── data/                   Static JSON content (loaded via fetch)
│   ├── exercises.json      (43 exercises — source of truth for ids)
│   ├── warmup_map.json     (keyed by MUSCLE name)
│   ├── technique_cues.json (keyed by exercise id; full 43/43 coverage)
│   ├── benchmarks.json     strength benchmarks
│   ├── strength_standards.json
│   ├── badges.json         (27 badge defs: transparent + secret)
│   └── changelog.json      in-app changelog (v1..v34)
├── scripts/                append-changelog.mjs, add_video_urls.py (release tooling)
├── .github/workflows/      release-changelog.yml
└── .well-known/assetlinks.json   Android TWA Digital Asset Links (package app.pplx.kettlefit)
```

## 4. Core end-to-end flows

### Flow A — Generate a workout (`engine.generateWorkout`)
`app.renderSessionConfig` (user picks goal/duration/intensity) →
`engine.generateWorkout(opts)` →
`recovery.ageRecovery()` (regen muscles) →
`blockPhase()`/deload heuristics → build `mods` (lowReadiness, deload, med, longAbsence) →
`filterEligible()` (rack/level/avoid/split filters) →
`scoreExercise()` per candidate, sort desc →
pick N by `EX_PER_DURATION[duration]` with required movement categories →
**`prescribe()`** per exercise: e1RM × `GOAL_PCT` × weightFactor → `snapToBell` → low-readiness/deload adjustments → overload cascade →
`buildWarmup()` + `buildCircuits()`/`buildSupersets()` → workout object stored in `state.currentWorkout`.
> Bugs found here: BUG-01 (weightFactor clamp defeated), BUG-08 (deload double-discount), BUG-09 (MED precedence), BUG-16 (circuit mutates sets).

### Flow B — Log & finish a session (`app.js` active-workout)
`startWorkout()` → `renderActiveWorkout()` (per-exercise sets) →
`completeSet()` → `finalizePendingSet()` (advances cursor, starts rest timer) →
progress snapshotted to `localStorage['kettlefit_active_v1']` for crash recovery →
`commitSession()` builds the `session` record, `history.push(session)` (**oldest-first**),
updates progression e1RMs, `recovery.applyWorkoutFatigue()`, `gamification.processSession()` →
`state.saveState()` → cloud `schedulePush()`.
> Bugs found here: BUG-06 (restore doesn't validate indices), BUG-11 (NaN volume), BUG-02/03 (streak/freeze).

### Flow C — Cloud sync (`cloud.js`)
On load: `initSession()` (Supabase getSession) → if signed in, `pullState()`
(retried; selects `id, state` so RLS policy column is present) →
`afterLogin()` merges/guards against clobbering good local data →
`setSyncPaused(false)` → thereafter every `saveState()` fires `schedulePush()`
(debounced 1.5s) → `pushState()` upserts a **gzip-compressed** state blob +
denormalized summary columns into `profiles`.
> Bugs found here: BUG-04 (summarize reads oldest session), BUG-10 (admin gating relies entirely on server RLS — must verify).

## 5. External integrations

| Integration | How used | Notes |
|---|---|---|
| **Supabase** (`vxorqbapoienakldbdre.supabase.co`) | Auth (email/password), `profiles` + `feedback` tables, RLS | Anon key shipped in client (public-by-design). **Security depends entirely on server-side RLS** — verify (BUG-10). |
| **esm.sh CDN** | `import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'` | Runtime dependency on 3rd-party CDN; no SRI/pinned hash, floating major version `@2`. |
| **YouTube** | Exercise demo video links in `exercises.json` | Rendered as links/text. |
| **Web Share API / Canvas** | Share cards (`share.js`) | Cancel handling imperfect (BUG-15), `toBlob` null unhandled (BUG-14). |
| **Android TWA** | `.well-known/assetlinks.json` | Package `app.pplx.kettlefit`, one SHA-256 cert fingerprint. |

## 6. Config / environment / secrets (redacted)

- **No `.env`, no secret manager.** All config is hard-coded in `js/cloud.js`:
  - `SUPABASE_URL` — public project URL (not secret).
  - `SUPABASE_ANON_KEY` — JWT, role `anon`, **public-by-design** (location `js/cloud.js:13`, value redacted: `eyJhbGci…REDACTED…Mq5Q`). Safe to ship **iff** RLS is correctly configured.
  - `ADMIN_EMAIL = 'tyler109j@gmail.com'` (`js/cloud.js:17`) — used client-side to toggle admin UI; **not** a real authorization boundary.
- CI secret: workflow uses the built-in `secrets.GITHUB_TOKEN` only (`release-changelog.yml`). No custom secrets exposed in the repo.
- **No service-role / private keys found in the repo.** (Secrets scan summary in SECURITY_REVIEW.md.)

## 7. Build / test / deploy notes

- **Build:** none required. Open `index.html` (Chrome/Edge) or `python -m http.server 8080`.
- **Test:** no test suite exists. Validation performed in this audit = `node --check` on every module + `JSON.parse` on every data file (all passed — see TEST_RESULTS.md).
- **Deploy:** static hosting (GitHub Pages most likely; no CNAME committed). The `release-changelog` Action, on a `[release]`-prefixed commit to `master`, appends the changelog, bumps `CACHE` + `APP_VERSION`, commits back with `[skip ci]`, and fires a `repository_dispatch` `redeploy` event.
- **Cache busting:** module imports use `?v=NN`; the service worker `CACHE` name (`kettlefit-v34`) must be bumped in lockstep or installed PWAs serve stale code. The Action automates this.

## 8. Areas that clearly need human review

1. **Supabase RLS policies** — the entire data-confidentiality model rests on them; not visible from the client. **(BUG-10, highest priority.)**
2. **Workout load math** in `engine.prescribe()` — BUG-01 silently over-prescribes weight for high-`weightFactor` lifts (e.g. deadlift +30%). This is a *training-safety-adjacent* correctness bug; verify intended formula before changing.
3. **Streak/timezone semantics** — day boundaries computed in UTC (BUG-05) and freeze-token economics (BUG-02/03) don't match their stated intent. Decide desired behavior.
4. **Crash-recovery robustness** — `restoreSessionFromStorage` trusts a persisted snapshot's indices across app-version schema drift (BUG-06).
5. **CDN supply-chain** — floating `@supabase/supabase-js@2` from esm.sh with no SRI.
