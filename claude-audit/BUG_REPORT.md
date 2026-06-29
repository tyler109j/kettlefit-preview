# KettleFit — Bug & Risk Report

> **Audit subject:** `tyler109j/kettlefit` @ `master` (v34, commit `a1257e4`)
> **Date:** 2026-06-29 · **Auditor:** Claude (automated deep-dive)
> **Method:** static analysis + targeted reading; no runtime execution against production Supabase.
> **Fixes applied:** none (reported only — see "Why no auto-fixes" at the bottom).

## Ranked summary

| ID | Sev | Conf | Title | Location | Status |
|----|-----|------|-------|----------|--------|
| BUG-01 | **High** | High | `weightFactor` clamp is dead code → load over-prescribed for high-factor lifts (deadlift +30%) | `js/engine.js:109-112` | Reported |
| BUG-10 | **High** | Low* | Admin dashboards gated only client-side — confidentiality depends entirely on server RLS | `js/cloud.js:33`, `js/app.js:3304+` | Reported (verify) |
| BUG-02 | Medium | High | Streak-freeze *increases* the streak and one token covers an arbitrarily long gap | `js/gamification.js:53-58` | Reported |
| BUG-03 | Medium | High | Freeze tokens auto-refill from session count → effectively unlimited freezes | `js/gamification.js:104-107` | Reported |
| BUG-04 | Medium | High | `summarize()` reads the *oldest* session as `last_session_ts` (history is oldest-first) | `js/cloud.js:131` | Reported |
| BUG-05 | Medium | High | Day boundaries use UTC (`toISOString`) not local → off-by-one streaks/weeks/notifications | `js/gamification.js:17,119`; `js/notifications.js:15` | Reported |
| BUG-06 | Medium | Medium | `restoreSessionFromStorage` never validates indices → crash on resume after schema drift | `js/app.js:1543-1579` | Reported |
| BUG-07 | Medium | Medium | `overloadRecommendation` derefs `settings.lastSession.goal` unguarded | `js/progression.js:83` | Reported |
| BUG-08 | Medium | Medium | Deload double-discounts load (bell-down *then* ×0.65) | `js/engine.js:116-120` | Reported |
| BUG-09 | Low | High | MED "full body" pick: `&&` binds tighter than `||`, dropping the hinge guard | `js/engine.js:462` | Reported |
| BUG-11 | Low | Medium | `NaN` session volume when a bodyweight set meets a missing `profile.bodyweightLbs` | `js/app.js:2843` | Reported |
| BUG-12 | Low | High | `readinessScore()` returns 0–300 not 0–100 (currently dead code) | `js/recovery.js:233` | Reported |
| BUG-13 | Low | High | `header()` interpolates `title` into `innerHTML` (latent XSS; not currently reachable) | `js/ui.js:65` | Reported |
| BUG-14 | Low | High | Canvas `toBlob` can yield `null` → share promise hangs / throws | `js/share.js:115` | Reported |
| BUG-15 | Low | Medium | Cancelling Web Share (`AbortError`) still downloads a PNG | `js/share.js:118-124` | Reported |
| BUG-16 | Low | Medium | Circuit/superset builders mutate per-exercise `sets`, can revert deload reduction | `js/engine.js:255,289-314` | Reported |
| BUG-17 | Low | High | `lineChartDual` scales the two series on different x-axes → misaligned overlay | `js/charts.js:54` | Reported |
| BUG-18 | Low | Medium | `demo.js` mutates state outside an `update()` transaction (fragile) | `js/demo.js:152-177` | Reported |
| BUG-19 | Low | High | `demo.js` dead `history._bw` + hardcoded `weeklyConsistency.completed:3` | `js/demo.js:176,309` | Reported |
| BUG-20 | Low | High | `streak7` XP: redundant first clause; bonus pays every 7 days (intent unclear) | `js/gamification.js:82` | Reported |
| BUG-21 | Low | Medium | Imported workouts drop coaching notes (`note` never put in the share payload) | `js/workouts.js` `buildPayload` / `:154` | Reported |
| BUG-22 | Low | Medium | `snapToBell` returns raw un-snapped weight on an empty rack | `js/state.js:170` | Reported |
| BUG-DOC | Low | High | README says "no backend required" but a full Supabase backend ships | `README.md` vs `js/cloud.js` | Reported |

\* BUG-10 confidence is "Low" only because server-side RLS cannot be inspected from the client. **If RLS is missing/misconfigured the real-world severity is Critical.** It must be verified.

---

## Detailed findings

### BUG-01 — `weightFactor` clamp is dead code; high-factor lifts over-prescribed
- **Severity:** High · **Confidence:** High
- **Location:** `js/engine.js:109-112` (function `prescribe`)
- **What is wrong:** The intended clamped target is computed on line 109 and then immediately **overwritten**:
  ```js
  let target = e1rm * pct * (ex.weightFactor ? Math.min(1, ex.weightFactor / 0.5) : 1); // line 109 (clamped)
  // ex.weightFactor scales relative load; clamp                                        // line 110 (comment)
  target = e1rm * pct;                                                                   // line 111 — DISCARDS line 109
  target = target * (ex.weightFactor ? (ex.weightFactor / 0.5) : 1);                     // line 112 — NO clamp
  ```
  Line 111 throws away the clamped value; line 112 re-applies `weightFactor / 0.5` with the `Math.min(1, …)` removed.
- **Why it matters:** For any exercise with `weightFactor > 0.5` the prescribed load is inflated. `kb_deadlift` has `weightFactor: 0.65` → multiplier `0.65/0.5 = 1.3`, so the target is **30% heavier** than the (apparently intended) `e1rm * pct`. Over-prescribing kettlebell load is a training-quality and injury-risk concern.
- **Reproduce/verify:** Generate a strength workout containing a high-`weightFactor` lift (e.g. deadlift). Compare prescribed weight to `e1rm * GOAL_PCT[goal]`; observe the ×1.3 inflation. Line 109 (the dead code) documents the original clamped intent.
- **Suggested fix:** Delete lines 111–112 and keep the clamped line 109; **or** apply the clamp on line 112: `target = target * (ex.weightFactor ? Math.min(1, ex.weightFactor / 0.5) : 1)`. **Confirm the intended formula with the product owner before changing prescribed loads.**
- **Status:** Reported. (Not auto-fixed: changes prescribed training weights — owner decision.)

### BUG-10 — Admin dashboards gated only client-side; confidentiality rests entirely on RLS
- **Severity:** High (Critical if RLS absent) · **Confidence:** Low (server policies not inspectable)
- **Location:** `js/cloud.js:33` `isAdmin() { return _user && _user.email === ADMIN_EMAIL; }`; consumers `js/app.js:3304,3382,3389`; data fetchers `fetchAllTesters` (`cloud.js:206`), `fetchAllFeedback` (`cloud.js:234`).
- **What is wrong:** `isAdmin()` is a pure client-side email-equality check. The "View testers" / "Feedback inbox" UI and the `fetchAllTesters`/`fetchAllFeedback` queries (which `SELECT` every tester's email, display name, stats and all feedback messages) are only *hidden* by this check, not authorized. Any authenticated user can call those exported functions from the devtools console.
- **Why it matters:** If the Supabase `profiles`/`feedback` tables don't enforce row-level security tying admin reads to a server-side `is_admin()`, **every user's email and all feedback are readable by any logged-in user** — a PII/data-exposure vulnerability. The code comments claim RLS exists; this must be confirmed, not assumed.
- **Reproduce/verify:** Sign in as a non-admin, open devtools, import the cloud module and call `fetchAllTesters()` / `fetchAllFeedback()`. If rows come back, RLS is missing. (Also: in the Supabase dashboard, confirm SELECT policies on both tables restrict to the admin.)
- **Suggested fix:** Verify/author RLS policies: `profiles` and `feedback` SELECT restricted to `auth.uid() = id` (own row) OR a server-side `is_admin()`. Treat the client `isAdmin()` strictly as UI cosmetics. Add `if (!Cloud.isAdmin()) return;` guards on the admin render functions as defense-in-depth.
- **Status:** Reported — **action required: verify RLS.**

### BUG-02 — Streak-freeze grows the streak and one token covers any gap
- **Severity:** Medium · **Confidence:** High
- **Location:** `js/gamification.js:53-58`
- **What is wrong:**
  ```js
  else if (gap > 1) {
    if (g.streakFreezeTokens > 0) {
      g.streakFreezeTokens -= 1;
      result.streakMsg = `…your ${g.streak}-day streak is safe 🛡️`;
      g.streak += 1;            // <-- treats the missed day(s) as trained
    } else { g.streak = 1; … }
  }
  ```
  A freeze should *preserve* a streak across a missed day. Instead it consumes one token and **increments** the streak, and a single token bridges a gap of any length (5 days missed → 1 token → streak still grows).
- **Why it matters:** Streaks/`longestStreak` are inflated and also pushed to the cloud summary columns (and any future leaderboard). The displayed message ("your N-day streak is safe") contradicts the code, which actually grows it.
- **Reproduce/verify:** `lastStreakDate = today − 5`, `streakFreezeTokens = 1`, `streak = 4`; complete a session → token→0, streak becomes 5 (should stay 4 or require ~4 tokens).
- **Suggested fix:** On freeze, keep `g.streak` unchanged; only allow a freeze to cover a single missed day (`gap === 2`); reset for larger gaps.
- **Status:** Reported.

### BUG-03 — Freeze tokens auto-refill → effectively unlimited
- **Severity:** Medium · **Confidence:** High
- **Location:** `js/gamification.js:104-107` (`saveAndCheck`)
- **What is wrong:**
  ```js
  const tokens = Math.min(3, Math.floor(s.history.length / 7));
  if (tokens > (s.gamification.streakFreezeTokens || 0)) {
    s.gamification.streakFreezeTokens = Math.min(3, tokens);
  }
  ```
  Tokens are recomputed from *total* session count every session. Once a user has ≥21 sessions, `floor(history.length/7)` is pinned at 3, so any token consumed by BUG-02 is immediately refilled on the next session — the "1 per 7 sessions" economy never actually depletes.
- **Why it matters:** Combined with BUG-02, streak protection is effectively infinite, making streaks meaningless and over-rewarding XP.
- **Reproduce/verify:** With ≥21 sessions, spend a token, complete one more session → back to 3.
- **Suggested fix:** Track granted-vs-consumed tokens separately (cumulative grants − consumed), or grant only when crossing each *new* multiple of 7.
- **Status:** Reported.

### BUG-04 — `summarize()` reports the oldest session as `last_session_ts`
- **Severity:** Medium · **Confidence:** High
- **Location:** `js/cloud.js:131`
- **What is wrong:** `const last = hist.length ? hist[0] : null; // history is newest-first`. The comment is wrong — history is **oldest-first** everywhere else: `history.push(session)` appends (`app.js:2859`, `demo.js:266`), and "newest" is read as `history[history.length - 1]` (`app.js:798`, `engine.js:15`, `demo.js:323`).
- **Why it matters:** The admin testers dashboard column `last_session_ts` (rendered `app.js:517`) shows each user's **first ever** session instead of their latest, so recency sorting/triage is wrong for every row.
- **Reproduce/verify:** Push any multi-session profile; the dashboard `last_session_ts` equals the earliest workout date.
- **Suggested fix:** `const last = hist.length ? hist[hist.length - 1] : null;` and fix the comment.
- **Status:** Reported. (Low-risk one-liner — safe candidate for the first fix once approved.)

### BUG-05 — Day boundaries computed in UTC, not local time
- **Severity:** Medium · **Confidence:** High
- **Location:** `js/gamification.js:17` (`todayStr` via `toISOString`), `js/gamification.js:119-124` (`startOfWeek` mixes local `getDay/getDate` with a UTC `toISOString` slice), `js/notifications.js:15-18,30` (`today`/`openedToday` via `toISOString`).
- **What is wrong:** `new Date(...).toISOString().slice(0,10)` yields the **UTC** calendar date. For users far from UTC, "today"/"this week" flips at the wrong local moment. `startOfWeek` is internally inconsistent (local components → UTC string), so for negative-UTC offsets the computed local Monday can map to the previous UTC day, splitting a single local week across two keys.
- **Why it matters:** Streaks can break or double-count near local midnight; weekly-consistency rollover and the `perfect_week` badge mis-bucket sessions; notifications keyed to a UTC day can fire twice in one local day or be suppressed across two.
- **Reproduce/verify:** Set TZ to UTC−6; log a Monday-evening session → `startOfWeek` key is the prior Sunday. Log two consecutive late-evening sessions in UTC−5 → streak gap misreads.
- **Suggested fix:** Derive all day/week keys from **local** components (`getFullYear/getMonth/getDate`) consistently across `gamification.js` and `notifications.js`.
- **Status:** Reported.

### BUG-06 — `restoreSessionFromStorage` doesn't validate indices → crash on resume
- **Severity:** Medium · **Confidence:** Medium
- **Location:** `js/app.js:1543-1579` (restore) → consumed at `js/app.js:1645-1646`
- **What is wrong:** Restore copies `exIdx`/`stepIdx`/`setIdx`/`logged` from the persisted snapshot without checking them against the restored `workout`. `renderActiveWorkout` then does `const ex = w.exercises[as.exIdx]` and `const log = as.logged[as.exIdx]` and immediately reads `ex.name`/`log.sets`. If a snapshot from an older app version has a different plan shape (or `exIdx` past a shorter array), `ex`/`log` is `undefined` and the render throws — leaving a blank/broken workout with no recovery (the global handler only `console.warn`s).
- **Why it matters:** This key exists *specifically* for crash recovery across updates — exactly when schema drift makes indices inconsistent — so the failure mode is a hard crash on resume.
- **Reproduce/verify:** Put a snapshot in `localStorage['kettlefit_active_v1']` whose `workout.exercises` has length 2 but `exIdx: 5`; reload → throw on `ex.name`.
- **Suggested fix:** In restore, bail (clear + return false) if `!Array.isArray(workout.exercises)`, `logged.length !== exercises.length`, or `exIdx >= exercises.length`; clamp `stepIdx`/`setIdx`.
- **Status:** Reported.

### BUG-07 — `overloadRecommendation` derefs `settings.lastSession.goal` unguarded
- **Severity:** Medium · **Confidence:** Medium
- **Location:** `js/progression.js:83`
- **What is wrong:** `const repRange = ex.reps[s.settings.lastSession.goal || goal] || [8, 12];` — `s.settings.lastSession` is dereferenced directly. `repairState` restores `lastSession` from defaults when missing, **but** if an imported/legacy `settings` contains an explicit `lastSession: null` (or a non-object), `Object.assign` keeps the bad value and `.goal` throws.
- **Why it matters:** `prescribe` calls this for every exercise (`engine.js:128`), so one corrupted import crashes the entire workout generation, not just one exercise.
- **Reproduce/verify:** Import JSON with `settings: { lastSession: null }`, then generate a workout.
- **Suggested fix:** `const lsGoal = (s.settings.lastSession && s.settings.lastSession.goal) || goal;` plus guard `ex.reps`.
- **Status:** Reported. (Defensive one-liner — safe fix candidate.)

### BUG-08 — Deload double-discounts load
- **Severity:** Medium · **Confidence:** Medium
- **Location:** `js/engine.js:116-120`
- **What is wrong:** Low-readiness steps the bell down, then deload multiplies the **already-reduced** weight by 0.65:
  ```js
  if (mods.lowReadiness) weight = nextBellDown(weight, derived.availableSingleWeights);
  if (mods.deload) { weight = snapToBell(weight * 0.65, derived.availableSingleWeights); }
  ```
  When a session is both low-readiness and deload (e.g. `longAbsence` forces `deload` at `engine.js:391` and may coincide with low readiness), the reductions compound, and the warm-up at `engine.js:141` then computes `weight * 0.6` off the double-reduced value.
- **Why it matters:** Returning/long-absence users (a vulnerable group) can be prescribed far lighter than intended, repeatedly snapping to `minWeight` and undermining the stimulus.
- **Reproduce/verify:** Generate with `intensity:'Light'`, `deload:true`, readiness < 50; inspect prescribed `weight`.
- **Suggested fix:** Make low-readiness and deload mutually exclusive, or apply the 0.65 factor to the base snapped weight before the low-readiness step.
- **Status:** Reported.

### BUG-09 — MED "full body" pick: operator precedence drops the hinge guard
- **Severity:** Low · **Confidence:** High
- **Location:** `js/engine.js:462`
- **What is wrong:** `scored.find((c) => c.ex.category === 'power' || ['core','carry'].includes(c.ex.movementPattern) && c.ex !== hinge)`. `&&` binds tighter than `||`, so this parses as `category==='power' || (isCoreCarry && c.ex !== hinge)` — the `!== hinge` guard never applies to the `power` branch. `kb_swing` is `category:'power'` + `movementPattern:'hinge'`, so the already-chosen hinge swing is re-selected as "full body" (downstream dedupe then drops it, collapsing the movement-balance guarantee).
- **Why it matters:** Minimal-effective-dose workouts lose their hinge/push-pull/full-body balance in racks dominated by swings.
- **Reproduce/verify:** Rack of swing + one press; MED mode → `full` resolves to the swing again, dedup drops it, an arbitrary extra fills in.
- **Suggested fix:** Parenthesize: `(c.ex.category === 'power' || ['core','carry'].includes(c.ex.movementPattern)) && c.ex !== hinge`.
- **Status:** Reported.

### BUG-11 — `NaN` session volume for bodyweight sets with missing bodyweight
- **Severity:** Low · **Confidence:** Medium
- **Location:** `js/app.js:2843`
- **What is wrong:** `volume += (set.weight || S.getState().profile.bodyweightLbs * 0.4) * set.reps;` — if `set.weight` is 0/falsy (bodyweight move) and `profile.bodyweightLbs` is `undefined`/0 (onboarding allows `… || 0`), the term is `undefined * 0.4 = NaN`, poisoning `session.volume`.
- **Why it matters:** `NaN` volume corrupts the history record, home "last session" volume, and progress charts.
- **Reproduce/verify:** Onboard with bodyweight cleared, do a bodyweight-only exercise, finish → `session.volume === NaN`.
- **Suggested fix:** `(set.weight || (profile.bodyweightLbs || 150) * 0.4) * (set.reps || 0)`.
- **Status:** Reported.

### BUG-12 — `readinessScore()` returns 0–300, not 0–100 (currently dead code)
- **Severity:** Low · **Confidence:** High
- **Location:** `js/recovery.js:233-235`
- **What is wrong:** `return Math.round((sleep*20)+((6-soreness)*20)+(energy*20)) / 3 * 3 / 1;` — `/3*3/1` cancels to ×1, so it returns the raw sum (max 300). The correct normalized function is `computeReadiness` directly below it. **`readinessScore({...})` has no call sites** (verified) — it's dead code; the `readinessScore` property stored on sessions is set elsewhere from `computeReadiness`.
- **Why it matters:** Latent foot-gun: if anyone wires this up, readiness exceeds 100 and corrupts `regenRateFactor` and any % UI.
- **Reproduce/verify:** `readinessScore({sleep:5,soreness:1,energy:5})` → 300.
- **Suggested fix:** Delete `readinessScore` or make it delegate to `computeReadiness`.
- **Status:** Reported.

### BUG-13 — `header()` interpolates `title` into `innerHTML` (latent XSS)
- **Severity:** Low · **Confidence:** High (latent; **not currently reachable**)
- **Location:** `js/ui.js:65`
- **What is wrong:** `h('div', { class:'logo-wrap', html: LOGO_SVG + \`<span>${title || 'KettleFit'}</span>\` }, …)`. The `html:` attribute sets `innerHTML`. Every current `header(...)` caller passes a **hardcoded literal**, so no user data flows in today.
  **XSS verdict for the whole app:** no user-controlled string currently reaches an `innerHTML`/`html:` sink — all dynamic content renders via `h()` → `document.createTextNode` (safe). Confirmed for tester email/display_name, feedback message, profile name, notes/tags.
- **Why it matters:** The first time someone calls `header(user.display_name)` (or similar) it becomes stored XSS. Defense-in-depth / future-proofing.
- **Suggested fix:** Render the title as a separate text node instead of interpolating into `html:`.
- **Status:** Reported.

### BUG-14 — Canvas `toBlob` null not handled → share promise hangs
- **Severity:** Low · **Confidence:** High
- **Location:** `js/share.js:115-116`
- **What is wrong:** `canvas.toBlob(async (blob) => { const file = new File([blob], 'kettlefit.png', …); … })`. Per spec `toBlob` passes `null` on failure (tainted canvas / OOM on the 1080² buffer). `new File([null], …)` throws inside the callback; the throw isn't propagated to the outer promise, so the awaiting caller hangs and the error surfaces only as an unhandledrejection.
- **Why it matters:** A failed share silently hangs the flow instead of falling back.
- **Suggested fix:** `if (!blob) { resolve('failed'); return; }` at the top of the callback; wrap body in try/catch.
- **Status:** Reported. (Safe robustness fix candidate.)

### BUG-15 — Cancelling Web Share still downloads a PNG
- **Severity:** Low · **Confidence:** Medium
- **Location:** `js/share.js:118-124`
- **What is wrong:** `navigator.share` rejects with `AbortError` when the user cancels the share sheet; the catch falls through and unconditionally triggers a download. So "cancel" becomes "download anyway."
- **Suggested fix:** In the catch, `if (e.name === 'AbortError') { resolve('cancelled'); return; }` before falling through.
- **Status:** Reported.

### BUG-16 — Circuit/superset builders mutate per-exercise `sets`
- **Severity:** Low · **Confidence:** Medium
- **Location:** `js/engine.js:255` (`normalizeSets`), `289-314` (`buildSupersets`)
- **What is wrong:** These write `exercises[i].sets = rounds` in place on the prescribed objects. For circuit/conditioning formats, a floor like `Math.max(def, …)` can *raise* a deload-reduced set count back up, silently reverting the `finalSets = max(1, sets-1)` reduction from `prescribe`. (Deload/longAbsence force `straight` format, which partly shields this; current data has no `sets < 3` conditioning entries, hence Low.)
- **Suggested fix:** Carry round count as separate circuit metadata; don't overwrite `sets`.
- **Status:** Reported.

### BUG-17 — `lineChartDual` scales the two series on different x-axes
- **Severity:** Low · **Confidence:** High
- **Location:** `js/charts.js:54`
- **What is wrong:** The overlay series uses `px(i) = padL + (i / max(1, d2.length-1)) * …` while the primary uses `data.length-1`. If the two series differ in length they use different horizontal scales and won't align.
- **Suggested fix:** Scale both against a shared point count (max length / shared x labels).
- **Status:** Reported.

### BUG-18 — `demo.js` mutates state outside an `update()` transaction
- **Severity:** Low · **Confidence:** Medium
- **Location:** `js/demo.js:152-177`
- **What is wrong:** After an `S.update(...)`, the code does `const st = S.getState(); … st.bodyweightLog.push(...)` directly, relying on `getState()` returning the same mutable reference; the final commit never reassigns `bodyweightLog`. Works only by implementation detail; breaks if state is ever cloned/immutable.
- **Suggested fix:** Build a local array and assign it inside the final `S.update((s) => { s.bodyweightLog = bw; … })`.
- **Status:** Reported.

### BUG-19 — `demo.js` dead `history._bw` + hardcoded `weeklyConsistency.completed`
- **Severity:** Low · **Confidence:** High
- **Location:** `js/demo.js:176` (`history._bw = history._bw || []` — set, never read; dropped by `JSON.stringify` of an array), `js/demo.js:309` (`weeklyConsistency: { …, completed: 3, … }` — hardcoded regardless of actual sessions in the current week).
- **Why it matters:** Dead code; demo weekly ring can contradict the generated history.
- **Suggested fix:** Delete `_bw`; compute `completed` from sessions in the current week.
- **Status:** Reported.

### BUG-20 — `streak7` XP: redundant clause / pays every 7 days
- **Severity:** Low · **Confidence:** High
- **Location:** `js/gamification.js:82`
- **What is wrong:** `if (g.streak === 7 || (g.streak % 7 === 0 && g.streak > 0)) xp += XP.streak7;` — the first clause is fully subsumed by the second. The bonus pays at 7, 14, 21, … If a one-time 7-day award was intended, this over-pays weekly.
- **Suggested fix:** Decide intent; drop the redundant clause, or track a one-time flag.
- **Status:** Reported.

### BUG-21 — Imported workouts drop coaching notes
- **Severity:** Low · **Confidence:** Medium
- **Location:** `js/workouts.js:154` (reads `pe.note`) vs `buildPayload` (`workouts.js:81-95`, never includes `note`)
- **What is wrong:** In exact-import mode the note falls through to `pe.note`, but `note` is never written into the share payload, so it's always `undefined` — original "You earned a heavier bell"/overload notes vanish on import.
- **Suggested fix:** Add `note: ex.note` to the payload exercise mapping in `buildPayload`.
- **Status:** Reported.

### BUG-22 — `snapToBell` returns raw un-snapped weight on empty rack
- **Severity:** Low · **Confidence:** Medium
- **Location:** `js/state.js:170-171`
- **What is wrong:** With no bells, `availableSingleWeights` is empty and `snapToBell` returns the raw float target (e.g. `78.4`). `filterEligible` mostly excludes loaded exercises when the rack is empty, so exposure is limited to edge states (adjustable-only / partial racks).
- **Suggested fix:** Return `0` (or treat as bodyweight) when the list is empty; have callers handle 0 as unprescribed.
- **Status:** Reported.

### BUG-DOC — README contradicts the shipped backend
- **Severity:** Low · **Confidence:** High
- **Location:** `README.md` ("Local-first, no backend required") vs `js/cloud.js` (full Supabase auth + sync + admin).
- **Why it matters:** Misleads contributors about data flow, the privacy surface, and where user PII goes.
- **Suggested fix:** Update README to document the Supabase backend, accounts, sync, and that RLS is the security boundary.
- **Status:** Reported.

---

## Verified-OK (to save reviewer time)

- Share-code encode/decode round-trip (`workouts.js` / `share.js`) handles non-ASCII correctly (gzip bytes + `TextEncoder`/`TextDecoder` fallback, correct base64url padding). No round-trip corruption.
- `cloud.js` gzip compress/decode wrapper and `_u8ToBase64`/`_base64ToU8` are byte-safe.
- `calcE1RM` (`progression.js:5`) guards `reps <= 0` and the Brzycki denominator. No divide-by-zero.
- Chart empty-data / `min===max` paths return safely (no NaN coordinates); bar-label stride never divides by zero.
- `state.repairState()` robustly backfills nested defaults for legacy/partial imports.
- `afterLogin` data-loss guards (`app.js:112-169`) correctly avoid clobbering good local data on a failed/blank cloud pull.
- **Data referential integrity: clean** (0 dangling refs; SW asset list matches disk).

## Why no auto-fixes were applied

Per the audit's Phase-5 rules, fixes are only applied when the change is small,
low-risk, **and not a controversial behavior change**, and can be tested locally.
The two highest-impact bugs (BUG-01 load prescription, BUG-02/03 streak economy)
**change product behavior** and need owner sign-off. The remainder are genuinely
safe but there is **no test harness** to validate against. I therefore left
everything as reported and flagged the safe-to-fix subset (BUG-04, BUG-07,
BUG-14) in NEXT_ACTIONS.md — say the word and I'll implement those on this branch
with a couple of quick unit tests.
