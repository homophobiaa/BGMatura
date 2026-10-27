# Admin authentication

> Decision record for issue #3. Implementation follows in #21 (login and logout) and #23 (reusable server-side admin authorization).

## Scope

- Only administrators sign in. Students never sign in (`.claude/PROJECT_DIRECTION.md` §4.7, §6).
- There is a single role: **admin**. No role hierarchy or editorial approval workflow (§4.7, "Not required").
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

### Rejecting unapproved identities

Anyone with a Google account can complete Google's sign-in screen, so the allowlist is checked by our server in two places:

1. **At sign-in.** Before Better Auth creates a user or session, the server checks the verified Google email against `ADMIN_EMAILS`. If it is not listed or not verified, sign-in is refused, nothing is stored, and the person sees „Нямаш достъп до администрацията.“
2. **On every admin request.** The shared admin guard (#23) loads the session on the server and checks the stored email against the allowlist again. Removing an email from `ADMIN_EMAILS` therefore ends that person's access on their next request, even if they still have a valid session cookie.

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
| CSRF | Better Auth's built-in origin checks on its endpoints; our Server Actions rely on Next.js's same-origin checks. |

## Environment variables

Names only. Real values live in the hosting provider's secret settings and a local, uncommitted `.env`; never in the repository or logs.

| Name | Purpose |
| --- | --- |
| `BETTER_AUTH_SECRET` | Random secret (at least 32 characters) for signing cookies and tokens. Different per environment. |
| `BETTER_AUTH_URL` | Public base URL of the app, e.g. `http://localhost:3000` locally. |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID. |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret. |
| `ADMIN_EMAILS` | Comma-separated Google account emails allowed to administer the site. |

These names go into `.env.example` and the environment validation added in #8.

## Not decided here

- Exact sign-in page layout (follows `.claude/DESIGN.md`).
- Hosting provider (#5); callback URLs depend on it.
