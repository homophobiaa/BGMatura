# Student privacy, deletion and retention

Profiles are optional (see `.claude/PROJECT_DIRECTION.md` §4.8). This page records the decisions behind the Bulgarian notice at `/poveritelnost`. **A legal review of the notice and of these decisions is required before the public release.**

## What is kept

- Without an account: only the attempt itself, tied to a random token in the browser's cookie, for 30 days. No name, email or other personal data.
- With an account: the name and verified email from Google, and the attempts the student chose to keep. No password, photo, phone, address or age.
- Personal data stays out of logs: Better Auth logging is disabled and the account endpoints return only the display name and role, never the email.

## Decisions

| Question | Decision |
|---|---|
| Deleting a profile | **Deletes** the account, its sessions and the attempts linked to it (answers included), in one transaction. Attempts that were never linked are not touched; they belong to their browser token. |
| Retention | Expired sessions are removed. An account with no session activity for **24 months** is deleted with its attempts. Stated in the notice (`inactiveAccountMonths`). |
| Minors | The profile is for students **14 or older**, the Bulgarian age of digital consent. The notice and the sign-in page say so, and say that everything for learning works without a profile. No age is collected, so there is nothing to verify; this relies on the statement and on Google's own age rules. A legal review decides whether more (for example parental consent for under-14s) is required. |
| Who can see results | Only the student. Editors cannot read attempts. |

## How it works

- `/profil` (signed-in only) offers sign-out and **Изтрий профила и данните ми** with a two-step confirmation.
- `POST /api/account/delete` needs this site's origin, a signed-in student and `{ "confirm": true }`. It deletes the data and clears the session cookies.
- `removeStaleAccountData` (`src/features/account/data-removal.ts`) is the retention job. Run it on a schedule with `npm run maintenance:retention` (daily is enough). Scheduling depends on the hosting decision (#5).
- The privacy notice is linked from the footer, the sign-in page and the profile page.

## Tests

`tests/integration/account-data.test.ts` (deletion removes only the student's own data, the endpoint's refusals, retention) and `tests/browser/student-sign-in.spec.ts` (notice links, profile access, confirmation flow).
