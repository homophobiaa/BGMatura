# Authentication: administrators and optional students

> Decision record for #3; implementation in #21–23 (administrators) and #194 (student role). Better Auth 1.7.15 with its Prisma adapter.

## Scope

- Administrators sign in to edit content. Students may **optionally** sign in to keep their results (decided in #193, `.claude/PROJECT_DIRECTION.md` §4.8). Learning, practice, and exams never require an account.
- There are two roles, **admin** and **student**. No role hierarchy or editorial approval workflow (§4.7, "Not required"). The role is **derived from the allowlist on every request** (see below). It is never stored and never taken from the browser.
- Student data is minimal: the name and verified email from Google only, no profile image, no passwords. Account and data deletion, retention, the privacy notice, and the approach to minors are #198.
- Expected number of admins: a handful of known people.

## Decision

**Better Auth with Google sign-in, restricted to an allowlist of admin email addresses. Sessions are stored in PostgreSQL through Better Auth's Prisma adapter.**

### Options compared

| Option | Pros | Cons | Verdict |
| --- | --- | --- | --- |
| **Better Auth** (open source library) | Runs inside our Next.js app; first-class Prisma/PostgreSQL adapter; database sessions; Google/GitHub sign-in built in; actively developed. The Auth.js maintainers now point new projects to it. | Younger than Auth.js; fewer older tutorials. | **Selected** |
| Auth.js (NextAuth) | Well known, many examples. | Now maintained by the Better Auth team, which recommends Better Auth for new projects ([announcement](https://www.better-auth.com/blog/authjs-joins-better-auth)). | Not selected |
| Hosted service (Clerk, Auth0, Supabase Auth) | Little code, polished UI. | Extra external dependency and account; possible ongoing cost; admin identities stored with a third party. Too much for a few admins. | Not selected |
| Own email + password | No external provider. | We would store password hashes and build reset, rate limiting, and lockout ourselves. Most security risk for the least benefit. | Not selected |

### Sign-in method

| Method | Verdict |
| --- | --- |
| **Google OAuth** | **Selected** (decided by the project owner on 2026-10-27). Everyone has a Google account, we store no passwords, and we need no email service. Google's own two-step verification protects the account. |
| GitHub OAuth | Can be added later as a second Better Auth provider if needed. |
| Email + password | Rejected, see above. |

## Who is allowed

Admins are listed in the environment variable `ADMIN_EMAILS`: a comma-separated list of Google account email addresses (for example `name@gmail.com`).

- Emails are compared in lower case with surrounding spaces removed.
- Only emails that Google reports as **verified** (`email_verified: true`) are accepted.
- Gmail addresses are never reassigned to a new owner, so an email is a stable identity for personal accounts. If an admin uses a school or company Google Workspace address, that domain's administrator could recreate the address; prefer personal Gmail accounts for admins.

### Who may sign in, and who is an administrator

Any Google account with a **verified** email may sign in, and becomes a student account. Being an administrator is a separate decision that our server makes, again on every request:

1. **At sign-in.** Before Better Auth creates a user or session, the server requires a verified Google email. It stores the name and email, discards the profile image, and allows Google only. Signing in grants no admin access.
2. **On every request.** The server loads the database session without any cookie cache and works the role out from `ADMIN_EMAILS` (`roleForEmail`). Removing an email from the allowlist turns that person into a student on their next request, even with a valid session cookie, and adding one promotes them at once. A student session, however valid, never passes the admin guard.

| Helper | Use |
| --- | --- |
| `getSignedInUser(headers)` | Any signed-in person with their derived role, or `null` |
| `requireSignedInUser(headers)` | For student features such as saved results: administrators and students pass, visitors get `SignInRequiredError` |
| `requireAdmin(headers)` | Administration only; a student gets `AdminAuthorizationError` |

A signed-in student who opens `/admin` sees „Нямаш достъп до администрацията.“ with a sign-out button, instead of being sent round to the sign-in page.

Hiding admin links in the UI is not access control; every admin page, Server Action, and Route Handler must call the guard (`.claude/CLAUDE.md` §7).

### Initial administrator provisioning

1. In Google Cloud Console, create an OAuth client of type "Web application" for each environment (local, production) with authorised redirect URI `<BETTER_AUTH_URL>/api/auth/callback/google`. Configure the OAuth consent screen with the app name „BG Matura“; only the basic `openid email profile` scopes are requested.
2. Put the client ID and secret into the environment variables below.
3. Put the first admin's Google email into `ADMIN_EMAILS`.
4. That person opens `/admin`, signs in with Google, and the user record is created on first successful sign-in.

Adding an admin means adding their email and redeploying. Removing one means removing their email (access stops immediately, see above) and optionally deleting their sessions.

## Sessions

| Behaviour | Value |
| --- | --- |
| Storage | Database session row in PostgreSQL (revocable), referenced by a cookie. No session data in the browser beyond the session token. |
| Cookie | `HttpOnly`, `Secure` in production, `SameSite=Lax`, signed with `BETTER_AUTH_SECRET`. Better Auth defaults. |
| Expiry | Session expires after **12 hours without activity**; it is extended at most once per hour while the admin is active. Configured with Better Auth `session.expiresIn = 12h` and `session.updateAge = 1h`. |
| Logout | „Изход“ in the admin header calls Better Auth sign-out, which deletes the session row and clears the cookie. Signing out of Google is not required. |
| Expired or missing session | Admin pages redirect to the sign-in page; admin Server Actions and Route Handlers return an authorization error and change nothing. |
| CSRF | Better Auth's built-in origin checks on its endpoints; editorial POST services also require the exact configured `Origin`. Missing or cross-origin requests fail before mutation. |

## Environment variables

Names only. Real values live in the hosting provider's secret settings and a local, uncommitted `.env`; never in the repository or logs.

| Name | Purpose |
| --- | --- |
| `BETTER_AUTH_SECRET` | Random secret (at least 32 characters) for signing cookies and tokens. Different per environment. |
| `BETTER_AUTH_URL` | Public base URL of the app, e.g. `http://localhost:3000` locally. |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID. |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret. |
| `ADMIN_EMAILS` | Comma-separated Google account emails allowed to administer the site. |

These names are in `.env.example`. Authentication initializes lazily on admin
requests; `src/features/admin/server/environment.ts` validates its configuration
without exposing supplied values. Public builds/pages need no Google credentials.
Apply `npm run db:deploy` before signing in to create the four sign-in tables: `AuthUser`, `AuthSession`, `AuthAccount`, and `AuthVerification` (renamed from `Admin*` in #194; existing rows and sessions are kept).

## Implementation and verification

- `/admin/sign-in` has the labeled Google control; `/admin` checks the session and
  offers sign-out. `/api/auth/[...all]` delegates to Better Auth. The Google provider
  requires a verified profile; the user-create hook checks again.
  The account-create hook permits Google only. Password authentication and account
  linking are disabled. No test plugin exists in the production auth factory.
- `src/features/admin/server/authorization.ts` reloads the database session with
  cookie caching disabled and rechecks the current allowlist on every request.
  Editorial services call it themselves, including direct internal calls. Mutations
  require the configured origin even after the page has authorized an editor.
- Cookies are signed, HttpOnly, SameSite=Lax and Secure for HTTPS. The URL validator
  permits plain HTTP only on loopback. OAuth account tokens are encrypted at rest;
  profile images are discarded. Better Auth's in-memory rate limiter is enabled
  (60 requests/minute per process); it is not a distributed abuse quota (a shared limit is #204).
- Admin responses and previews use private/no-store and noindex headers. Preview
  pages also include noindex metadata. Errors never return credentials or raw
  database/provider exceptions. Missing configuration fails closed.
- The isolated integration/browser runners inject clearly synthetic credentials
  only into their child processes. Test-only Better Auth helpers create real signed
  cookies and database sessions. Tests exercise production authorization, expiry,
  revocation, allowlist removal, secure-cookie attributes, disabled signup, OAuth
  provisioning hooks and rollback, and the browser sign-out control.
- A real Google consent/callback round trip requires the environment's OAuth client
  and approved account. After provisioning, verify first sign-in at `/admin`, sign
  out, and verify rejection with an unlisted Google account. Automated tests do not
  claim to have contacted Google or provisioned a hosted OAuth client.

## Not decided here

- Exact sign-in page layout (follows `.claude/DESIGN.md`).
- Hosting provider (#5); callback URLs depend on it.
