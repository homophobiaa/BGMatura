# Question navigation and revisit states

Students move between the questions of an exam or a practice session, and every answer must
be exactly as they left it when they come back. Two pieces do this: a navigator that shows
the position and moves, and a small set of draft helpers that hold the answers. Code:
[`QuestionNavigator.tsx`](../../src/features/questions/components/QuestionNavigator.tsx) and
[`answer-drafts.ts`](../../src/features/questions/answer-drafts.ts).

## `QuestionNavigator`

```tsx
<QuestionNavigator
  items={toNavigatorItems(questions, drafts)}   // [{ id, answered }]
  currentIndex={index}                          // zero-based
  onNavigate={setIndex}
/>
```

| Part | Behaviour |
| --- | --- |
| Position | **Въпрос 7 от 41**, and **Отговорени: 7 от 41** |
| Numbered buttons | One per question, in a list inside a labelled navigation region |
| Markers | An answered question has a **check mark**; the current one has a **thick border** and `aria-current="step"`. Neither relies on colour alone |
| Accessible names | Each button says its number and state, for example "Въпрос 2, без отговор, текущ" |
| Back and next | The shared `Button` (**Назад** secondary, **Напред** primary), disabled on the first and last question |
| Legend | A line of text explains the check mark and the thick border |

Every number button is a 44×44px target with 8px between buttons, so 41 questions fit in about
seven rows on a phone and three on a desktop. Tab visits the numbers, then Назад and Напред;
Enter and Space activate them. The component only navigates: the page decides which question
is current and what to do on leaving one.

## Keeping answers while moving: the draft helpers

The page holds every answer in one place **above** the question, so moving never loses one:

```tsx
const { drafts, setDraft } = useAnswerDrafts();

<MultipleChoiceAnswer
  selectedOptionId={choiceFromDraft(drafts[question.id])}
  onSelect={(optionId) => setDraft(question.id, optionId)} … />

<WrittenAnswer
  value={drafts[question.id] ?? ""}
  onChange={(text) => setDraft(question.id, text)} … />
```

A draft is a string per question id: the chosen option id for multiple choice, the typed text for
a written answer, and an empty string for none. Text is stored exactly as typed. `isAnswered`
decides what counts as an answer: an option chosen, or text with a visible character, so
spaces and line breaks alone do not count and a cleared answer becomes unanswered again.
`toNavigatorItems` turns the questions and drafts into the navigator's items.

Drafts live in memory. Saving them to the server and restoring them after a refresh belong to
autosave (#116) and restoring the active exam (#117).

## Tests

`answer-drafts.test.tsx` covers what counts as an answer and the hook.
`QuestionNavigator.test.tsx` covers the markers, names, touch targets, back and next at the
edges, and the keyboard. A final group runs the navigator with the real choice and written
controls and checks that every chosen option and typed text, including a multiline answer,
is still there after jumping, stepping back and forth, and only passing through a question.
