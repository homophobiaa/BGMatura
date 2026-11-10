# Assessment backend

The assessment APIs support anonymous practice, curated exam sets, and timed
exam submission. The question bank and existing graders are shared by both
modes. The student pages and editorial forms can consume these APIs as their
interface issues land.

## Ownership and recovery

The backend uses a provisional same-browser policy while the ownership
decision in #4 remains open. Each successful start creates a fresh attempt
and a separate 256-bit random capability. PostgreSQL stores only its SHA-256
digest. The server sends the token as an HttpOnly, SameSite=Lax cookie scoped
to the attempt's API path, using a Secure cookie on HTTPS. It is never part
of a URL, a JSON response, or a browser script's storage.

Every attempt read and write requires both the ID and the matching cookie.
Missing, wrong, and expired credentials share a 404 response with a restart
message. Sharing a URL does not transfer access. Refreshes in the same
browser restore server-saved work. Clearing cookies or switching browsers
requires a new attempt. Access expires 30 days from start without renewal,
and the feature collects no student profile or contact information. The
access boundary does not delete records. Retention and cleanup are tracked
separately in #146.

Set `SITE_URL` to the application's HTTPS origin on hosted deployments.
POST handlers require the exact configured Origin. Loopback HTTP is allowed
for development, and local production builds use an explicit loopback
`SITE_URL`. Attempt, catalog API, and admin API responses are private,
no-store, and noindex. Admin exam writes also require the existing Better
Auth admin session and admin mutation origin.

## Exam preparation and publication

- `ExamConfiguration` stores an immutable version keyed by target year,
  session, and version. Its format-1 blueprint contains ordered sections,
  each with a duration and ordered groups of question types, counts, and
  per-item points. It also records public sources, reviewer, check date,
  verification gaps, and an optional documented passing threshold. New
  rules require a new version. The backend does not assume a fixed official
  question count, duration, or points total.
- `Exam` references a configuration and contains ordered bank links with
  exam-specific allocations. An editor can save an incomplete draft.
  Editing replaces the links and allocations in one transaction, using
  `expectedUpdatedAt` to reject stale edits. Published sets must be
  unpublished before editing.
- Publication checks order, section composition, allocations, question
  availability, explanations, guidance, review, attribution, and published
  topic ancestry. Conditional configurations support clearly classified
  practice material. The official past paper classification requires an
  editor-verified blueprint, attribution, and official source provenance for
  all linked questions. The API makes no official equivalence or passing
  claim. There is no automatic seed for the 2027 blueprint.
- Catalog reads and new starts check availability again. Unpublishing an
  exam or one of its required questions blocks fresh starts and removes it
  from the public catalog. Existing attempts retain the versions, order,
  allocation, and deadline they captured. Section durations determine the
  aggregate countdown. Per-section locking is a separate interface policy.

## Start, save, and submit

| Operation | API |
| --- | --- |
| Start | `POST /api/attempts` with `{ mode: "practice", topicId }` or `{ mode: "exam", examId }`. Returns 201 with `{ id }` and sets the cookie. |
| Restore | `GET /api/attempts/{id}` returns ordered prompts, persisted answers, position, state, clock data, and allowed feedback. |
| Save | `POST /api/attempts/{id}` with `{ operation: "save", answer, expectedRevision }`. Revisions begin at zero, independently per question. |
| Navigate | POST to the same route with `{ operation: "position", position, expectedPosition }`. Positions are zero-based. |
| Finish | POST to the same route with `{ operation: "finish" }`. The final result uses previously saved answers. |
| Browse | `GET /api/exams?after={cursor}` and `GET /api/exams/{id}`. Advance using `next` when present. The cursor represents the last checked published row, so a page can contain fewer results if some sets are unavailable. |
| Edit | `POST /api/admin/exams` accepts `configuration` with a `configuration` object, `save` with a `draft`, or `publish` / `unpublish` with an `id` as its `operation`. `GET /api/admin/exams/{id}` reads a draft. |

Practice selects up to ten published questions linked directly to the chosen
published topic, ordered by creation time and ID. An empty selection returns
a useful 409. Starts capture the ordered question versions and write the
attempt atomically. Each successful start creates an independent attempt,
including a retry after a lost start response.

Answers use the existing `SubmittedAnswer` variants and text limits. A
practice answer is final once graded. Repeating the same saved value
acknowledges the existing response. Exam drafts may be replaced or cleared
with the current revision. An old revision cannot overwrite newer data.
Unsent text lives only in the calling UI. Flush pending saves before manual
submission if they should count.

All operations on an attempt acquire the same PostgreSQL row lock. The
database clock is sampled after the lock is acquired. An exam save is
eligible strictly before its stored deadline. At or after the deadline the
server rejects saves and finalizes the previously saved drafts on the next
owner read or finish request. This works after the browser closes or goes
offline. Concurrent finishes reuse the same saved result. Finalization
writes grades and the state change together, so a failure leaves the attempt
available for retry.

Practice exposes feedback once that question is answered. Active exams
expose only safe prompts and the student's drafts. Completed attempts use
the captured question versions for review. The summary counts answered and
unanswered items, correct and incorrect objective answers, ungraded answers,
and self-review separately. Its maximum includes scoreable unanswered items
and excludes written and ungradable answers. It is an objective-only score,
with no inferred written score, official grade, or passing prediction.

## Implementation and checks

The main entry points are
[`start.ts`](../../src/features/attempts/server/start.ts),
[`session.ts`](../../src/features/attempts/server/session.ts),
[`editorial.ts`](../../src/features/exams/server/editorial.ts), and
[`catalog.ts`](../../src/features/exams/server/catalog.ts).
The PostgreSQL integration suite exercises the Next.js handlers and real
database writes, including mismatched credentials, revision checks,
blueprint validation, answer visibility, publication changes, and deadline
races. Run it using the isolated test database:

```sh
npm run db:test:start
npm run test:integration
```

## Linking an attempt to a student account (optional)

An account is optional. An attempt is always owned by its anonymous token (the per-attempt cookie); `Attempt.userId` is an extra, nullable link.

- **At start.** When a signed-in student starts practice or an exam, the attempt is linked to them. Having no account, or sign-in being unavailable, never blocks starting.
- **Claiming.** `POST /api/attempts/{id}` with `{ "operation": "claim" }` links an attempt to the signed-in student. It needs the attempt's own cookie, so only the browser that started it can claim it. The cookie is scoped to the one attempt's path, so claiming is per attempt, not "everything in this browser at once": the page that shows an attempt (or the save-progress prompt, #199) calls it while signed in.
- **Idempotent.** Claiming again as the same student succeeds and changes nothing.
- **Other accounts.** An attempt already linked to another account answers "not found" to a second account on the same browser, so nothing about the first account leaks.
- **Not signed in.** `claim` answers `401`, and nothing is linked.
- **The token keeps working.** Claiming never removes browser access; the original browser can still read and answer the attempt until its 30-day access ends.
- **Deleting an account.** `onDelete: SetNull` detaches the attempts instead of deleting them; what deleting a profile should do with results is decided in #198.

Tests: `tests/integration/attempt-claim.test.ts`.
