# Answering controls

Components students use to answer a question. They are presentational: the page that
owns the practice session (or exam) holds the answers, sends them to the server, and
passes in whatever the server confirms. They take only the **public** question (see
[public-question-projections.md](public-question-projections.md)), so no answer key can
reach them.

Code: [`src/features/questions/components/`](../../src/features/questions/components/).

## Multiple choice: `MultipleChoiceAnswer`

```tsx
<MultipleChoiceAnswer
  question={publicQuestion}          // MultipleChoiceQuestion: prompt and options only
  selectedOptionId={answer}          // owned by the parent
  onSelect={setAnswer}
  feedback={confirmed ? { correctOptionId } : undefined}   // only after server grading
  disabled={sending}
/>
```

| Behaviour | How |
| --- | --- |
| Labelled and keyboard accessible | A native radio group in a `fieldset`; the prompt is its `legend`. Tab enters the group, arrow keys move and choose, Space chooses. |
| Touch | Each whole row is the label of its radio, at least 48px tall, with 8px between rows. |
| Visible selection | `surface-strong` background and a 2px `primary` border (drawn without shifting layout). |
| Selection is preserved | The component is controlled. The parent keeps `selectedOptionId`, so a choice survives moving to another question and back, and a refresh once the parent restores it. |
| Answering is separate from feedback | `feedback` is a separate prop passed only after the server has confirmed the answer. Without it, no option is marked and no key exists in the component's data. |
| Feedback is never colour alone | With feedback the options are locked; the right answer shows a green border, an icon, and **Вярно**; a wrong choice shows a red border, an icon, **Грешно**, and **Твоят отговор**. If nothing was chosen it says **Не си избрал отговор.** |
| Locked while sending | `disabled` locks the options without marking them. |
| Several questions on one page | Each group gets its own radio `name`, so choices stay independent. |

The status text sits under the option text, not beside it, so a long option keeps the full
width on a phone. Wording follows the fixed result labels in
[DESIGN.md](../../.claude/DESIGN.md) section 2.

## Written answers: `WrittenAnswer`

```tsx
<WrittenAnswer
  question={publicQuestion}   // short-response, extended-response, or argumentative-writing
  value={text}                // owned by the parent, exactly as typed
  onChange={setText}
  error={problemMessage}      // after an empty or too long submission
  disabled={sending}
/>
```

| Question type | Field | Limit |
| --- | --- | --- |
| Short response | One-line text input | 500 characters |
| Extended response | Textarea, 6 rows | 3000 characters |
| Argumentative writing | Textarea, 14 rows | 10000 characters |

| Behaviour | How |
| --- | --- |
| Labelled | The prompt is the field's `label`. The field declares `lang="bg"` so spellchecking uses Bulgarian. |
| Self-review explained | Extended and argumentative answers show, before writing, that the answer gets no automatic score and that guidance will follow. The public question does not say whether a question is self-review or ungraded, so the wording is true of both. A short response shows no such note. |
| Text is never changed | No trimming or reformatting: line breaks, spacing, quotation marks, and Bulgarian letters are kept exactly as typed. The parent owns the text, so it survives moving between questions. |
| Limits | `maxLength` comes from `WRITTEN_ANSWER_MAX_LENGTH`. A textarea shows `n от max знака`. Assistive technology hears about the limit only near it (the last 10%): "Остават N знака." and "Достигнат е лимитът от N знака." |
| Empty or invalid submission | Pass a message in `error`. It is announced (`role="alert"`) and shown with an icon, the field gets a red border and `aria-invalid`, the message is linked with `aria-describedby`, and **focus moves to the field**. |
| Locked while sending | `disabled` locks the field. |

### Limits and validation are shared

[`answer-limits.ts`](../../src/features/questions/answer-limits.ts) holds the limits and
`findWrittenAnswerProblem(type, text)`, which returns `"empty"` (nothing but spaces or line
breaks), `"too-long"`, or `null`. It has no server or browser dependencies, so the page uses
it to decide when to show an error and the **server must run the same check** on every
submitted answer, because a browser limit alone can be bypassed. Whether an empty answer is
allowed depends on the page: practice asks the student to write something, while an exam may
be submitted with unanswered questions.

The limits are editorial defaults sized for the 2026 exam format (a rewritten paragraph in
a short answer, a few sentences in an extended response, about four pages for the
argumentative text). Revisit them when the 2027 specification is confirmed
([EXAM_BLUEPRINT.md](../EXAM_BLUEPRINT.md)).

## Testing components

Component tests are `*.test.tsx` files next to the component. They run in `npm test`
with jsdom (add `// @vitest-environment jsdom` at the top of the file), React Testing
Library, and user-event, which drives real keyboard and click interactions. Import
`@/test-support/dom` first: it fills in `CSS.escape`, which jsdom lacks and user-event
needs to move between radio buttons.

Tests find controls the way a person or a screen reader would, by role and accessible
name, so they also check labels. Look at the result in a real browser too, at phone and
desktop widths, using a temporary page that is not committed.
