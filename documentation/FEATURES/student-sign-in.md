# Student sign-in and registration

Signing in is optional. Learning, practice and mock exams work without an account; an account only lets a student keep results (see `.claude/PROJECT_DIRECTION.md` §4.8).

## Pages

- `/vhod` — "Вход и регистрация": one button, "Вход или регистрация с Google". With Google the first sign-in creates the account, so signing in and registering are the same step. The page says plainly that no password is kept, that only the name and the verified email are stored, and that learning needs no account.
- `/registraciya` — redirects to `/vhod`, keeping a safe `next` path.
- Header — an anonymous visitor sees "Вход"; a signed-in student sees their name and "Изход"; an admin also sees "Администрация". The same controls sit in the mobile menu.

## How it works

- `GET /api/account/me` returns `{ user: null | { name, role } }` with private, no-store headers. It never returns the email. It answers `503` when sign-in is not configured, and the header then shows nothing instead of a button that cannot work.
- The header reads that endpoint in the browser after the page loads, so public pages stay static and cacheable.
- Sign-out posts to the Better Auth `/api/auth/sign-out` endpoint and returns to the home page.
- `next` (where to go after signing in) goes through `safeReturnPath`: only paths on this site are kept; other websites, protocol-relative addresses, backslashes, control characters, very long values, and the sign-in and API paths fall back to `/`.

## Tests

- `src/features/account/return-path.test.ts` — the return-path rules.
- `tests/browser/student-sign-in.spec.ts` — the page, the registration redirect, the header link, and a signed-in student signing out (desktop, tablet, phone).

## Not covered here

A real Google sign-in needs OAuth credentials, tracked in issue #203; the browser tests use a signed session cookie created in the test database instead.
