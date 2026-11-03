# Question publication rules

A draft question may be incomplete. A **published** question is what students see, so
it must be answerable, gradable, explained, filed under a topic, attributed, and
reviewed by an editor. This page records the rules for issue #73. The code is
[`question-publication.ts`](../../src/features/questions/server/question-publication.ts).

## What is enforced where

- **The database** rejects structurally impossible rows at any time, for example points on
  a written question or a published question without an explanation. See
  [DATABASE.md](../DATABASE.md). These errors are precise but not written for editors.
- **The publication check** adds what only makes sense at publication, and answers with
  every missing item at once in plain language. It is the single source of truth for
  "ready to publish".

## The rules

| Applies to | Rule | Code |
| --- | --- | --- |
| Every question | Prompt is not blank | `prompt-missing` |
| Every question | At least one topic link | `topic-link-missing` |
| Every question | A provenance record exists | `source-missing` |
| Every question | An editor is recorded | `editor-missing` |
| Adapted or official | An attribution is recorded | `attribution-missing` |
| Every question | The provenance is marked reviewed (the database already requires reviewer and date) | `review-missing` |
| Objective | An explanation is present | `explanation-missing` |
| Written (self-review or ungraded) | Reference guidance is present | `guidance-missing` |
| Written | A rubric, if present, is well formed | `rubric-malformed` |
| Multiple choice | At least two options | `multiple-choice-needs-two-options` |
| Multiple choice | Options are distinct, ignoring case and spacing | `multiple-choice-duplicate-options` |
| Multiple choice | The correct option is one of the options | `multiple-choice-correct-option-missing` |
| Objective short response | At least one usable accepted answer | `short-response-needs-accepted-answers` |
| Objective short response | No blank accepted answers | `short-response-blank-accepted-answer` |

Written questions are never asked for points, an explanation, or accepted answers: they
are not machine scored (see [grading-service.md](grading-service.md)).

## Using it

- `findQuestionPublicationProblems(questionId)` returns the list for an editor's
  checklist. Each problem has a stable `code` and a `message` that says what to fix.
- `publishQuestion(questionId)` publishes a ready question and otherwise throws
  `QuestionNotReadyToPublishError`, whose `problems` carry the same list. It runs in a
  transaction, and publishing an already published question changes nothing.
- `publishQuestion` does **not** authorize the caller. Admin entry points must authorize
  before calling it; #74 adds the authorized publish and unpublish operations around it.

Publication is what makes a question visible: the public projections
([public-question-projections.md](public-question-projections.md)) and attempts select
published questions only.

## Changing the rules

Add or change a rule in `checkPublicationReadiness`, with a code, an actionable message,
and a test for both the failing and the passing case. Keep the rules about publication
here and structural impossibilities in the database.
