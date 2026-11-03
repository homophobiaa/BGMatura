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

## Testing components

Component tests are `*.test.tsx` files next to the component. They run in `npm test`
with jsdom (add `// @vitest-environment jsdom` at the top of the file), React Testing
Library, and user-event, which drives real keyboard and click interactions. Import
`@/test-support/dom` first: it fills in `CSS.escape`, which jsdom lacks and user-event
needs to move between radio buttons.

Tests find controls the way a person or a screen reader would, by role and accessible
name, so they also check labels. Look at the result in a real browser too, at phone and
desktop widths, using a temporary page that is not committed.
