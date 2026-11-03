# Final submission review

The last screen of an exam. `SubmissionReview` shows how many questions are answered, says
plainly that submitting is final, asks for an explicit confirmation, shows a submitting state, and
copes with failures and with returning to an attempt that is already submitted. Code:
[`SubmissionReview.tsx`](../../src/features/exams/components/SubmissionReview.tsx).

```tsx
<SubmissionReview
  total={questions.length}
  unansweredIndexes={unansweredIndexes}        // zero-based, from the answer drafts
  status={status}                              // reviewing | submitting | failed | submitted
  onConfirm={submitExam}
  onGoToQuestion={setCurrentIndex}
/>
```

## The flow

| Step | What the student sees |
| --- | --- |
| Review | **Отговорени n от total**, **Без отговор m от total**, numbered buttons to return to each unanswered question, and the finality notice |
| First click on **Предай матурата** | Nothing is sent. A confirmation appears and takes focus: **Сигурен ли си, че искаш да предадеш матурата?** with **Да, предай матурата** and **Назад към въпросите** |
| Confirm | `onConfirm` is called once. The page moves to `submitting` |
| Submitting | **Предаване…** on a disabled button, **Предаваме отговорите ти…** announced politely, and every other control locked |
| Failed | An error with the message and **Отговорите ти са запазени и можеш да опиташ отново.** The button reads **Опитай отново** |
| Submitted | **Матурата е предадена**, a success message, and **Виж резултата**. No submit button |

## Finality is explained first

The notice **Предаването е окончателно** is on the review before any confirmation is opened. It says
answers cannot be changed after submitting, and that written answers get no automatic score and are
for the student's own judgement with the guidance
([written-self-review.md](written-self-review.md)).

## No duplicate requests, and safe recovery

- The confirm button is disabled while submitting, and a guard inside the component ignores any
  further click in the moment between a click and the page updating `status`, so however fast it is
  clicked exactly one request is sent. The guard is released when the submission fails, so a retry works.
- A failed submission keeps every answer and offers to try again. That is only safe because the server
  treats the submission as safe to repeat (#119).
- When the attempt is already submitted, for example after a refresh or coming back later, the page
  passes `status={{ phase: "submitted", resultHref }}`. The component then shows the way to the
  result and never offers to submit again, so the completed result can always be recovered.

## What the page does

The component only shows state. The page owns `status` and `onConfirm`, which should, in order:

1. make sure pending answers are saved (autosave and its retry, #116);
2. send the submission (#119), which the server validates against its own clock;
3. update `status` to `submitted` with the result address, or to `failed` with a message.

## Tests

`SubmissionReview.test.tsx` covers the counts and the way back to unanswered questions, the finality
notice, the two-step confirmation and its focus, rapid repeated clicks, the locked submitting state,
failure and retry, the already-submitted state, and a full flow against a page that talks to the
server through a controllable promise.
