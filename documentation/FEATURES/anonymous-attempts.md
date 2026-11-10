# Anonymous attempt ownership and persistence

> Decision record for issue #4. It sets the rules that practice sessions, exam attempts, and results must follow. Implementation happens in the practice, exam, and result issues (for example #121–#130 and #146).

## Constraints

From `.claude/PROJECT_DIRECTION.md` §4.3–§4.6 and §14:

- Students never create accounts or profiles.
- An active exam must survive an accidental refresh or navigation.
- Correct answers stay hidden until an exam is submitted.
- Results must not be reachable by guessing or enumerating URLs.
- Collect as little student data as possible.
- Persistent cross-device history is **not** required.

## Decision

**Database-backed attempts, owned by a random browser key stored in an HttpOnly cookie. The database stores only a hash of that key.**

### Options compared

| Option | Verdict | Reason |
| --- | --- | --- |
| **Database rows + random owner cookie** | **Selected** | Exams need server-side state anyway (saved answers, server deadline, one-time submission). Ownership can be checked on every request and revoked by deleting rows. |
| Signed tokens only (state in the browser) | Rejected | Saved answers and the deadline would live in the browser, where they can be lost or altered; cookies have size limits; signed tokens cannot be revoked. |
| Hybrid (signed token + database) | Rejected | Adds a second mechanism without a concrete benefit over the selected option. |
| Unguessable result link as the only key | Rejected for MVP | Anyone who sees the link sees the answers. Ownership by browser was chosen instead (see "Sharing"). |

## Owner key

| Property | Value |
| --- | --- |
| Cookie name | `bgm_owner` |
| Value | 32 random bytes from `crypto.randomBytes`, base64url encoded (256 bits). |
| Attributes | `HttpOnly`, `Secure` in production, `SameSite=Lax`, `Path=/`, `Max-Age` 30 days, renewed when used. |
| When created | Lazily, the first time a student starts a practice session or exam. Reading lessons sets no cookie. |
| Stored in database | `ownerKeyHash` = SHA-256 of the key. The raw key is never stored or logged. |

SHA-256 without a salt is sufficient because the key is 256 random bits, not a password; it cannot be guessed or brute-forced. A database leak therefore does not let anyone impersonate a student.

The cookie is strictly necessary for the feature the student asked for (keeping their attempt) and carries no tracking data, so it needs no consent banner. The privacy note should still mention it in Bulgarian.

## Ownership checks

Every practice session and exam attempt has:

- `publicId`: random UUID (v4) used in URLs (`/matura/[publicId]`, `/rezultati/[publicId]`). Never a sequential ID.
- `ownerKeyHash`: hash of the owner key that created it.

Every server entry point that reads or changes an attempt (page, Server Action, Route Handler) must:

1. Load the attempt by `publicId`.
2. Hash the `bgm_owner` cookie from the request and compare it with `ownerKeyHash` using a constant-time comparison.
3. If the attempt does not exist **or** the hash does not match, respond the same way (HTTP 404 page „Опитът не е намерен на това устройство.“). Never reveal whether a `publicId` exists.

This check lives in one shared server function owned by the attempts/exams feature, so routes cannot forget it or implement it differently.

## Practice sessions

- A practice session row records the chosen topic, the question versions shown, and each submitted answer with its server-computed grading result.
- Each answer is graded on the server when submitted; the explanation is returned with the result.
- After a refresh the server reloads the session, so answered questions and the end-of-session summary stay correct.
- No timer and no submission lock: practice is meant to be repeated.

## Exam attempts

| Concern | Rule |
| --- | --- |
| Start | Creates an attempt with a snapshot reference to the exact exam and question versions, `startedAt`, and a server-computed `deadlineAt`. |
| Timer | The server's `deadlineAt` is authoritative. The browser only displays the remaining time it receives from the server. |
| Saving answers | Each answer change is saved to the server (autosave). Answers saved after `deadlineAt` plus a 30-second network grace period are rejected. |
| Refresh / navigation | The page reloads the attempt by `publicId` + owner cookie and restores saved answers and the remaining time. |
| Several tabs | Allowed; they share one attempt. The last saved answer for a question wins. |
| Submission | One conditional update `in_progress → submitted` inside a transaction, followed by grading. A repeated submit (double click, retry, second tab) finds the attempt already submitted and returns the existing result. |
| Deadline reached | The attempt is finalized as `expired` with the answers saved so far, either when it is next opened or by the cleanup job (#121). It is graded like a submitted attempt. |
| Answer secrecy | Correct answers, accepted answers, and explanations are not sent to the browser before the attempt is `submitted` or `expired`. |

## Results and sharing

- A result is visible only in the browser that owns the attempt (same owner cookie).
- **No share links in the MVP.** Opening a result URL on another device shows „Резултатът е достъпен само на устройството, на което е направен опитът.“ An opt-in, separately generated share link can be added later without changing this model.

## Lost cookies or access

Clearing cookies, private browsing, or switching device creates a new anonymous owner. Earlier attempts stay in the database until retention removes them, but they are unreachable. This is accepted: offering recovery codes or email links would turn into a profile system, which the MVP excludes. The not-found page offers „Започни нов опит“.

## Retention and stored data

| Data | Kept |
| --- | --- |
| Practice sessions | Deleted 7 days after the last activity. |
| Exam attempts and results | Deleted 30 days after creation, matching the cookie lifetime. |
| Owner key | Only its hash, on the attempt rows. |

Nothing else is stored about the student: no IP address, user agent, name, email, or device fingerprint on attempt rows. Application logs must not contain the owner key, cookie headers, or submitted answers. The cleanup job and exact schedule are implemented in #146.

## Not decided here

- Exact database schema and migration (follows `documentation/DATABASE.md` conventions).
- Exam duration and composition (versioned exam configuration, §5).
- Short-answer normalization and which written items are auto-graded.
