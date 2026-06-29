# KettleFit — Next Actions (read me first)

> **Audit subject:** `tyler109j/kettlefit` @ `master` (v34) · **Date:** 2026-06-29
> Full detail in `BUG_REPORT.md` / `SECURITY_REVIEW.md` / `REPO_MAP.md` / `TEST_RESULTS.md`.

## Top 5 to review first

1. **🔐 Verify Supabase RLS (BUG-10).** Confirm in the Supabase dashboard that
   `profiles` and `feedback` have SELECT/UPDATE policies restricting rows to the
   owner (`auth.uid() = id`) or a server-side `is_admin()`. The client `isAdmin()`
   check is cosmetic — if RLS is missing, **any logged-in user can read every
   user's email and all feedback** (Critical PII leak). *5-minute check; highest stakes.*

2. **🏋️ Fix the load-prescription bug (BUG-01, `engine.js:109-112`).** The
   `Math.min(1, …)` weight clamp is dead code, so high-`weightFactor` lifts
   (deadlift, `0.65`) are prescribed **~30% heavy**. Decide the intended formula —
   this affects every strength session and is injury-adjacent.

3. **🔥 Decide streak-freeze semantics (BUG-02 + BUG-03, `gamification.js`).**
   Freezes currently *grow* the streak, one token covers any-length gap, and
   tokens auto-refill from session count (effectively unlimited). Streaks +
   `longestStreak` are inflated and synced to the cloud summary.

4. **🌍 Timezone day-boundaries (BUG-05).** Streaks, weekly consistency, the
   `perfect_week` badge, and notification throttling all key off **UTC** dates.
   Users away from UTC get off-by-one streaks and mis-bucketed weeks. Switch to
   local date components consistently.

5. **💥 Crash-recovery hardening (BUG-06, `app.js`).** A persisted active-session
   snapshot from an older version can crash the resume render (`ex.name` on
   `undefined`). Validate/clamp indices before rendering — this is the one path
   meant to survive app updates.

## Quick wins (small, high-value, low-risk)

- **BUG-04** — one-liner: `hist[0]` → `hist[hist.length-1]` in `cloud.js:131` (admin dashboard shows wrong "last session").
- **BUG-07** — guard `s.settings.lastSession && …` in `progression.js:83` (prevents a whole-generation crash on bad import).
- **BUG-14** — `if (!blob) return resolve('failed')` in `share.js:115` (stops the share flow hanging).
- **BUG-15** — treat `AbortError` as cancel in `share.js` (stop downloading on share-cancel).
- **BUG-09** — add parentheses in `engine.js:462` (restore MED movement balance).
- **BUG-DOC** — update README: it still says "no backend required" but ships Supabase.
- **BUG-12 / BUG-19 / BUG-20** — delete dead/confusing code (`readinessScore`, `history._bw`, redundant `streak7` clause).

> **Offer:** BUG-04, BUG-07, BUG-14, BUG-15 are genuinely safe and non-behavior-
> controversial. I held off auto-fixing (no test harness + your "review first"
> instruction), but I can implement these on this branch with quick unit tests on request.

## Larger refactors worth considering

- **Add a tiny test layer.** Even a handful of Node unit tests around the pure
  functions in `engine.js` (`prescribe`, `medWorkout`), `progression.js`
  (`calcE1RM`, `overloadRecommendation`), `recovery.js` (`computeReadiness`,
  `ageRecovery`), and `gamification.js` (`processSession`, `startOfWeek`) would
  have caught BUG-01, 02, 03, 05, 09 directly. No framework needed (`node --test`).
- **Centralize date/“today”/“this week” helpers** (one local-time module) to kill
  the whole class of timezone bugs (BUG-05) at the source.
- **Don't mutate prescribed exercise objects** in circuit/superset builders
  (BUG-16); carry circuit metadata separately.
- **Supply-chain hardening:** pin `@supabase/supabase-js` to an exact version,
  self-host or add SRI, and add a CSP (see SECURITY_REVIEW §4).
- **State immutability:** `demo.js` (BUG-18) relies on `getState()` returning a
  live mutable reference; make all writes go through `update()` so the store can
  later be made immutable safely.

## Tests that should be added (highest value first)

1. `prescribe()` weight math — assert deadlift target ≈ `e1rm*pct` (catches BUG-01).
2. `processSession()` streak transitions incl. freeze across a 2+ day gap (BUG-02/03).
3. `startOfWeek()` / `todayStr()` across a timezone offset + DST (BUG-05).
4. `restoreSessionFromStorage()` with a mismatched snapshot (BUG-06).
5. Share-code encode→decode round-trip with non-ASCII (regression guard — currently OK).
6. `summarize()` last-session selection (BUG-04).

## Open questions for you

1. **RLS:** Are `profiles`/`feedback` RLS policies actually in place? (Determines if BUG-10 is Critical or non-issue.)
2. **BUG-01:** What's the intended weight formula — clamp `weightFactor` to ≤1.0, or allow it to scale load up? (The dead code says clamp; the live code scales up.)
3. **Streaks:** Should a freeze *preserve* (not grow) the streak, and should one token cover only a single missed day?
4. **Want me to implement the "quick wins" subset** (BUG-04/07/14/15 + README) on this branch with unit tests, or leave everything report-only?
5. Should I run the same audit against **`kettlefit-preview`'s own app** (graphify / pose_review / workout_preview) — it's a different codebase I did **not** audit here.
