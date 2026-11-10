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

## History (Моята история)

- `/istoriya` lists the signed-in student's finished attempts, newest first, ten at a time ("Покажи още"). Each entry shows the mode, date, how many questions were answered, and points only from automatically graded questions. Written work is shown as self-review and never adds to the points.
- `/istoriya/{id}` is the full review: the question as captured with the attempt (not the live content), the student's answer, an outcome in words and a symbol, and the explanation. Empty, loading-failure and not-found states are in Bulgarian.
- `GET /api/account/attempts?cursor=` serves the pages. The account id comes only from the verified session; a cursor cannot widen it.
- An attempt linked to an account opens through the account from any device, without the browser token, and does not expire with the 30-day token (`AttemptAccess.userId`, set only by server code). Writes still need the token.

## Save-progress prompt

`SaveProgressPrompt` (`src/features/account/components/save-progress-prompt.tsx`) goes under a finished result: `<SaveProgressPrompt attemptId={id} returnTo={pathOfThisResult} />`.

- A visitor sees a calm section "Запази прогреса": the result stays in this browser without an account, signing in with Google also keeps it across devices, and only the name and email from Google are kept. "Влез и запази" goes to `/vhod?next=<this result>`; "Не сега" hides it for the browser session (`sessionStorage`, no cookie).
- It is not a dialog: it never covers the result, takes focus, animates, or comes back after dismissal.
- A signed-in student never sees it. Instead the finished attempt is claimed for their account, which also completes the flow when the student returns from signing in on this result page.
- If sign-in is unavailable or the network fails it shows nothing; the result never depends on it.

Mounting it needs a result screen, which is not built yet; whoever builds the result page adds the one line above.

## Tests

- `src/features/account/return-path.test.ts` — the return-path rules.
- `src/features/account/components/save-progress-prompt.test.tsx` — visitor, dismissal, signed-in claim, failures, blocked storage.
- `tests/integration/student-history.test.ts` — paging, isolation between students, access from another device.
- `tests/browser/student-sign-in.spec.ts` — the page, the registration redirect, the header link, and a signed-in student signing out (desktop, tablet, phone).

## Not covered here

A real Google sign-in needs OAuth credentials, tracked in issue #203; the browser tests use a signed session cookie created in the test database instead.
