# GitHub Issues — ready to create in `tyler109j/kettlefit-preview`

Source repo/branch audited: **`tyler109j/kettlefit` @ `master` (v34, `a1257e4`)**.
One issue per confirmed **Medium+** finding (9 total). Labels: `claude-audit`, `bug`, and the matching `severity-*`.
(If the issues were created automatically, this file is the backup/source of truth.)

---

## [Claude Audit][High] Workout load over-prescribed — weightFactor clamp is dead code
**Labels:** claude-audit, bug, severity-high
**Severity:** High · **Confidence:** High · **Location:** `js/engine.js:109-112`
**Description:** In `prescribe()`, line 109 computes a clamped target (`Math.min(1, weightFactor/0.5)`), then line 111 overwrites it with `e1rm*pct` and line 112 re-applies `weightFactor/0.5` with **no clamp**. High-`weightFactor` lifts are over-loaded — `kb_deadlift` (`weightFactor:0.65`) → ×1.3 ≈ **30% heavy**.
**Repro/verify:** Generate a strength workout with deadlift; compare prescribed weight to `e1rm*GOAL_PCT[goal]`.
**Expected:** Prescribed weight respects the intended clamp (≤ `e1rm*pct`).
**Actual:** ~30% heavier for high-factor lifts.
**Suggested fix:** Delete lines 111–112 (keep clamped 109) or apply `Math.min(1, weightFactor/0.5)` on line 112. Confirm intended formula first.
**Test/build output:** `node --check js/engine.js` passes (logic bug, not syntax). **Local fix branch:** none.

---

## [Claude Audit][High] Admin dashboards gated only client-side — verify Supabase RLS
**Labels:** claude-audit, bug, severity-high
**Severity:** High (Critical if RLS absent) · **Confidence:** Low (server policies not inspectable) · **Location:** `js/cloud.js:33`, `js/app.js:3304+`, `fetchAllTesters`/`fetchAllFeedback`
**Description:** `isAdmin()` is `_user.email === ADMIN_EMAIL` (client only). `fetchAllTesters()`/`fetchAllFeedback()` read all users' email/display-name/stats and all feedback; any authenticated user can call them from devtools. Confidentiality depends entirely on server RLS, which the code claims but can't be verified from the client.
**Repro/verify:** Sign in as non-admin, call `fetchAllTesters()` in console; if rows return, RLS is missing.
**Expected:** Only the admin can read other users' rows.
**Actual:** Unknown until RLS is confirmed; client check is bypassable.
**Suggested fix:** Verify/author RLS on `profiles` + `feedback` (own-row or `is_admin()`); add `if(!isAdmin())return;` guards as defense-in-depth.
**Test/build output:** n/a (server-side). **Local fix branch:** none. **ACTION: verify RLS.**

---

## [Claude Audit][Medium] Streak-freeze grows the streak and one token covers any gap
**Labels:** claude-audit, bug, severity-medium
**Severity:** Medium · **Confidence:** High · **Location:** `js/gamification.js:53-58`
**Description:** On `gap > 1`, a freeze consumes one token but does `g.streak += 1` (treats missed days as trained), and a single token bridges any-length gap. Message claims the streak "is safe" while the code grows it.
**Repro/verify:** `lastStreakDate=today-5`, 1 token, streak 4 → after a session: token 0, streak 5.
**Expected:** Streak preserved (stays 4); freeze covers a single missed day.
**Actual:** Streak grows; one token covers 5 missed days.
**Suggested fix:** Keep `g.streak` unchanged on freeze; only allow `gap===2`; reset for larger gaps.
**Test/build output:** n/a. **Local fix branch:** none.

---

## [Claude Audit][Medium] Freeze tokens auto-refill from session count → effectively unlimited
**Labels:** claude-audit, bug, severity-medium
**Severity:** Medium · **Confidence:** High · **Location:** `js/gamification.js:104-107`
**Description:** Tokens are recomputed each session as `min(3, floor(history.length/7))`. Past 21 sessions, any consumed token is immediately refilled — the "1 per 7 sessions" economy never depletes.
**Repro/verify:** With ≥21 sessions, spend a token, complete one session → back to 3.
**Expected:** Tokens deplete when used.
**Actual:** Auto-refill to cap.
**Suggested fix:** Track granted-vs-consumed separately, or grant only on crossing each new multiple of 7.
**Test/build output:** n/a. **Local fix branch:** none.

---

## [Claude Audit][Medium] Admin dashboard shows the oldest session as "last session"
**Labels:** claude-audit, bug, severity-medium
**Severity:** Medium · **Confidence:** High · **Location:** `js/cloud.js:131`
**Description:** `summarize()` uses `hist[0]` as newest (comment says "newest-first"), but history is **oldest-first** everywhere (`history.push` appends; newest read as `history[length-1]`). So `last_session_ts` is each user's first-ever session.
**Repro/verify:** Push a multi-session profile; dashboard `last_session_ts` = earliest date.
**Expected:** Most-recent session timestamp.
**Actual:** Oldest session timestamp.
**Suggested fix:** `const last = hist.length ? hist[hist.length-1] : null;` + fix comment.
**Test/build output:** n/a. **Local fix branch:** none (safe one-liner candidate).

---

## [Claude Audit][Medium] Day/week boundaries computed in UTC, not local time
**Labels:** claude-audit, bug, severity-medium
**Severity:** Medium · **Confidence:** High · **Location:** `js/gamification.js:17,119-124`; `js/notifications.js:15-18,30`
**Description:** `toISOString().slice(0,10)` yields the UTC date; `startOfWeek` mixes local `getDay/getDate` with a UTC string. Non-UTC users get off-by-one streaks, mis-bucketed weeks (`perfect_week` badge, weekly consistency), and notifications that can fire twice/be suppressed near UTC midnight.
**Repro/verify:** TZ UTC−6, Monday-evening session → `startOfWeek` returns prior Sunday.
**Expected:** Day/week keyed to the user's local calendar.
**Actual:** Keyed to UTC.
**Suggested fix:** Use local components (`getFullYear/getMonth/getDate`) consistently across both files.
**Test/build output:** n/a. **Local fix branch:** none.

---

## [Claude Audit][Medium] Resuming an active workout can crash after an app update
**Labels:** claude-audit, bug, severity-medium
**Severity:** Medium · **Confidence:** Medium · **Location:** `js/app.js:1543-1579` → `:1645-1646`
**Description:** `restoreSessionFromStorage` copies `exIdx/stepIdx/setIdx/logged` from the persisted snapshot without validating them against the restored `workout`. `renderActiveWorkout` then derefs `w.exercises[exIdx].name` / `logged[exIdx].sets`; a stale/old-shaped snapshot throws, leaving a broken screen.
**Repro/verify:** Snapshot with `exercises.length=2` but `exIdx:5` → throw on resume.
**Expected:** Graceful restart (discard bad snapshot).
**Actual:** Hard crash, no recovery.
**Suggested fix:** Bail/clear if `!Array.isArray(exercises)`, `logged.length!==exercises.length`, or `exIdx>=exercises.length`; clamp the rest.
**Test/build output:** n/a. **Local fix branch:** none.

---

## [Claude Audit][Medium] Bad import crashes workout generation (`lastSession.goal` deref)
**Labels:** claude-audit, bug, severity-medium
**Severity:** Medium · **Confidence:** Medium · **Location:** `js/progression.js:83`
**Description:** `ex.reps[s.settings.lastSession.goal || goal]` derefs `lastSession` directly. `repairState` restores it from defaults when missing, but an imported `settings:{lastSession:null}` survives and throws. Called per-exercise in `prescribe`, so one bad import fails the whole generation.
**Repro/verify:** Import `{settings:{lastSession:null}}`, generate a workout.
**Expected:** Generation proceeds (fallback to `goal`).
**Actual:** TypeError, no workout.
**Suggested fix:** `const lsGoal = (s.settings.lastSession && s.settings.lastSession.goal) || goal;` + guard `ex.reps`.
**Test/build output:** n/a. **Local fix branch:** none (safe defensive fix candidate).

---

## [Claude Audit][Medium] Deload double-discounts load (bell-down then ×0.65)
**Labels:** claude-audit, bug, severity-medium
**Severity:** Medium · **Confidence:** Medium · **Location:** `js/engine.js:116-120`
**Description:** Low-readiness steps the bell down, then deload multiplies the already-reduced weight by 0.65; the warm-up (`:141`) then takes `weight*0.6` off that. When both apply (e.g. long-absence forces deload), returning users get compounded under-loading.
**Repro/verify:** Generate `intensity:'Light', deload:true`, readiness<50; inspect weight.
**Expected:** A single, intended reduction.
**Actual:** Compounded reduction, often snapping to `minWeight`.
**Suggested fix:** Make low-readiness/deload mutually exclusive, or apply 0.65 to the base snapped weight before the bell-down step.
**Test/build output:** n/a. **Local fix branch:** none.
