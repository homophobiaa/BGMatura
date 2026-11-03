# Written-answer self-review

After a student submits an extended response or an argumentative text, `WrittenSelfReview`
shows what they wrote next to the guidance and rubric captured with the attempt, so they can
judge their own work. Nothing is machine graded: this is the honest handling of written work
required by [PROJECT_DIRECTION.md](../../.claude/PROJECT_DIRECTION.md) section 5. Code:
[`WrittenSelfReview.tsx`](../../src/features/questions/components/WrittenSelfReview.tsx).

```tsx
<WrittenSelfReview
  prompt={definition.prompt}
  submittedText={answer.text}                 // exactly as submitted, may be empty
  status={review.evaluation.status}           // "self-review" or "ungraded"
  referenceGuidance={review.referenceGuidance}
  rubric={review.rubric}                      // captured with the attempt
/>
```

The values come from the written review the server records for an attempt
([grading-service.md](grading-service.md)) and from the question snapshot
([question-snapshots.md](question-snapshots.md)), so the guidance is the version the student's
attempt was captured with. Pass them only after submission: the guidance is feedback and must not
reach the browser while the student is still answering.

## What it shows

| Part | Content |
| --- | --- |
| Prompt | The question text |
| Status | **За самооценка** for a self-review question, **Без автоматична оценка** for an ungraded one, each with a clock icon, and a sentence saying the system gives no points |
| Твоят отговор | The student's text; **Не си написал отговор.** when it is empty or only spaces and line breaks |
| Насоки за самооценка | The reference guidance, with its paragraphs kept |
| Критерии | The rubric, when there is one. Each criterion is its own block |

## No machine score

The component has no way to receive or show an earned score, a maximum, or a percentage, and
its tests check that none appears. Rubric points, when the editor gave them, are shown only as
**Ориентировъчно: до N точки** with the note that they are a guide and **are not added to the
result**. There is no AI scoring.

## Long and multiline text

The student's text keeps its line breaks and spacing, is limited to a comfortable line length
(about 70 characters), and wraps even a very long unbroken word, so a long Bulgarian essay stays
readable at any width without horizontal scrolling. It was checked at 375px with a 264-character
word.

## Using it in a result page

Place it inside the question-by-question review (#125) for written questions. Choice and short
questions use the right/wrong feedback instead. The component renders no headings above level 3
and labels itself as an article ("Преглед на писмен отговор"), so it can sit in a list of reviewed
questions.
