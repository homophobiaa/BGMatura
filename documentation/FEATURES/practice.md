# Practice pages

Issues #80, #84, #85, #88 and #89. The pages are the student interface for the attempt
API in [assessment-attempts.md](assessment-attempts.md). They add no grading: every
answer is graded by the server, and the pages only show what the server returns.

## Where things live

| Part | File | Owns |
| --- | --- | --- |
| Topic list | `src/app/testove/page.tsx`, `src/features/practice/server/practice-topics.ts` | Visible topics with usable questions, their lessons, start buttons |
| Start | `src/features/practice/components/start-practice-button.tsx` | `POST /api/attempts`, busy/error states, navigation to the new session |
| Session page | `src/app/testove/[topicId]/[attemptId]/page.tsx` | Public lesson links only; the attempt is read in the browser |
| Session | `src/features/practice/components/practice-session.tsx` | Loading, answering, navigation, finishing |
| Feedback | `src/features/practice/components/question-feedback.tsx` | Locked answer, outcome, reference answer, explanation, self-review guidance |
| Summary | `src/features/practice/components/practice-summary.tsx` | Objective-only points, counts, review list, retry, related lessons |
| Response shape | `src/features/practice/attempt-view.ts` | Zod schema of the API response and outcome labels |
| Links in | `src/app/balgarski-ezik/[slug]/page.tsx`, `src/app/literatura/[slug]/page.tsx` | „Упражни темата“ and work practice sections |

## Why the session is read in the browser

The attempt cookie is scoped to `/api/attempts/{id}`, so a server-rendered page cannot
see it. The page at `/testove/{topicId}/{attemptId}` therefore renders only public data
(lessons for the topic) and the client component fetches the attempt. The topic id in
the URL is used only for those public links and for „Ново упражнение“; it grants nothing.

## Flow

`StartPracticeButton → POST /api/attempts → /testove/{topic}/{attempt} → GET /api/attempts/{id} →
answer → POST save (one question, expectedRevision) → server-graded question → feedback`

- Feedback appears only from the save response, never from local checks.
- A practice answer is final once sent; the page says so before sending.
- Drafts that were not sent stay in memory while moving between questions. Sent answers
  and the current position are on the server, so a refresh restores them.
- Position saves are best-effort; a failed one never blocks studying.
- Finishing with unanswered questions asks for confirmation.
- The summary shows points only for automatically scored questions, with written and
  ungraded answers counted separately. Unanswered objective questions count in the maximum,
  as the server's result defines.
- „Ново упражнение по темата“ starts a new attempt. The earlier attempt keeps its own cookie
  and URL, so its summary stays readable on the same device.

## Which topics appear

A topic is listed when it is visible (its whole ancestry is published) and has at least one
question that `startPractice` would use. Both use `practiceQuestionWhere` from
`src/features/attempts/server/start.ts`, so the list never offers a topic that would fail to start.
Work pages list the practice topics of published questions linked to that work.

## Verification

- Unit: `src/features/practice/attempt-view.test.ts` (outcomes never score written answers).
- Integration: `tests/integration/practice-topics.test.ts` (visibility, counts, lessons, work links).
- Browser: `tests/browser/practice.spec.ts` covers start, wrong and right answers, drafts across
  navigation, refresh recovery, the unanswered warning, self-review guidance, the summary,
  a retry as a new attempt, and that another browser cannot open the session.
