# KettleFit — Security Review

> **Audit subject:** `tyler109j/kettlefit` @ `master` (v34) · **Date:** 2026-06-29
> Client-side static review only. Server-side Supabase RLS policies could **not** be inspected and must be verified separately (see §2).

## 1. Secrets & sensitive files scan

| Item | Location | Verdict |
|---|---|---|
| `SUPABASE_ANON_KEY` (JWT, role `anon`) | `js/cloud.js:13` (redacted: `eyJhbGci…REDACTED…Mq5Q`) | **Not a leak.** Supabase anon keys are designed to ship in client code; they grant only what RLS allows. Safe **iff** RLS is correct. |
| `SUPABASE_URL` | `js/cloud.js:12` | Public project URL — not secret. |
| `ADMIN_EMAIL = tyler109j@gmail.com` | `js/cloud.js:17` | Owner email in client source. Not a credential, but it is PII and names the admin account to any reader; the address is also the user's own. Cosmetic admin gating only. |
| Android signing cert SHA-256 | `.well-known/assetlinks.json` | Public by design (Digital Asset Links). |
| CI token | `release-changelog.yml` uses built-in `secrets.GITHUB_TOKEN` | No custom secrets in the repo. |
| Private keys / service-role keys / `.env` | — | **None found.** No service-role key, no private key, no `.env`. |

**Bottom line:** no improperly-exposed secret was found. The only "credential-looking"
value (the anon key) is intentionally public; its safety is entirely a function
of server-side RLS.

## 2. AuthN / AuthZ observations  ⚠️ highest-priority security item

- **Authentication:** Supabase email/password (`signUp`/`signIn`/`signOut`,
  `cloud.js:46-66`), persisted sessions with auto-refresh. Password min length 6
  enforced **client-side only** (`app.js:407`) — Supabase server settings should
  enforce the real policy.
- **Authorization — client-side only (BUG-10):** `isAdmin()` (`cloud.js:33`) is a
  plain `_user.email === ADMIN_EMAIL` check. The testers dashboard and feedback
  inbox are merely *hidden* by it. The exported `fetchAllTesters()` /
  `fetchAllFeedback()` (which read **all** users' email/display-name/stats and all
  feedback messages) are callable by any authenticated user from the console.
  - **Real protection must come from RLS.** The code comments assert RLS exists
    (`USING (auth.uid() = id)` on `profiles`, admin via `is_admin()`), but this
    could not be verified from the client. **ACTION:** confirm in the Supabase
    dashboard that SELECT/UPDATE policies on `profiles` and `feedback` restrict
    rows to the owner or the admin. If they don't, this is a **Critical** PII leak.
- **IDOR surface:** `pullState`/`pushState` upsert by `_user.id`; `feedback` updates
  by `id` (`updateFeedbackStatus`). All are safe **only** under RLS — without it,
  a user could read/update other users' rows by id.
- **Defense-in-depth gap:** admin render functions don't re-check `isAdmin()` on
  entry (BUG-10 fix note). Add guards even though RLS is the real boundary.

## 3. Input validation & trust boundaries

- **Rendering is XSS-safe today.** All dynamic/user data (profile name,
  display_name, tester email, feedback message, notes/tags, exercise names)
  renders through `ui.h()` → `document.createTextNode`. **No user-controlled string
  reaches an `innerHTML`/`html:` sink.** The only `html:` interpolation,
  `header()` (`ui.js:65`), receives hardcoded literals — a *latent* sink only
  (BUG-13).
- **Imported data is trusted structurally.** `importJSON` (`state.js:210`) and the
  share-code decode (`workouts.js`) run `repairState`, which backfills defaults —
  good. But some fields are dereferenced without guards downstream (BUG-07
  `settings.lastSession.goal`; BUG-06 active-session indices), so a hand-crafted
  import/snapshot can crash the app (DoS-of-self, not code execution).
- **Feedback message** is length-capped to 4000 chars (`cloud.js:225`) before
  insert — good. Stored and later rendered as a text node — safe.
- **No SQL/command/template injection surface** in the client (PostgREST
  parameterizes; no string-built queries, no `eval`/`new Function`, no shell).

## 4. Dependency / supply-chain notes

- **No `package.json`/lockfile** → no `npm audit` possible; dependencies are
  loaded at runtime, not built in.
- **`@supabase/supabase-js@2` via `https://esm.sh`** (`cloud.js:9`): a **floating
  major version** pulled from a third-party CDN with **no Subresource Integrity
  (SRI)** and no pinned hash. If esm.sh is compromised or serves a malicious
  build, it runs with full app privileges (including the user's Supabase session).
  - **Recommendation:** pin an exact version (`@2.x.y`), and either self-host the
    module or add an integrity check. Consider a Content-Security-Policy that
    restricts `script-src`/`connect-src` to the Supabase origin + esm.sh.
- **CDN auth flow:** `detectSessionInUrl: false` is set (`cloud.js:20`), which
  avoids parsing tokens from the URL — good hardening.

## 5. Other observations & recommended mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| RLS unverified (BUG-10) | High→Critical if absent | Verify/author RLS on `profiles` + `feedback`; treat client `isAdmin()` as cosmetic. |
| CDN supply chain (floating `@2`, no SRI) | Medium | Pin version, self-host or SRI, add CSP. |
| No CSP header | Low | Add a CSP (`script-src 'self' https://esm.sh`, `connect-src 'self' https://*.supabase.co`, `img-src` for share). Static-host config. |
| Client-only password length check | Low | Enforce password policy in Supabase Auth settings. |
| Admin email in source | Low/info | Acceptable; it's the owner's own email and not a credential. |
| Self-DoS via crafted import/snapshot | Low | Guard derefs (BUG-06, BUG-07). |
| Service worker caches any 2xx/opaque response | Low | Optionally restrict caching to same-origin + check `res.ok` before `cache.put`. |

**No evidence of malicious code, backdoors, or exfiltration was found.** The app's
only outbound destinations are the user's own Supabase project, the esm.sh CDN
(for the Supabase SDK), local `data/*.json`, and YouTube links in exercise data.
