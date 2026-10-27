# Grading service

Authoritative scoring lives in `src/features/questions/server/`. Practice and exam
flows call these functions; scores are never calculated in routes or in the browser,
and answer keys never reach Client Components. Every module imports `server-only`.

All graders take a server-side `QuestionDefinition` and a validated `SubmittedAnswer`
and return an `Evaluation` (`scored`, `ungraded`, or `self-review`, see
`src/features/questions/evaluation.ts`).

## Multiple choice

`gradeMultipleChoice(definition, submittedAnswer)` in `grade-multiple-choice.ts`.

| Submission | Result |
| --- | --- |
| Selected option is the correct one | `scored`, full configured points |
| Selected option is another offered option | `scored`, 0 points |
| No option selected (`selectedOptionId: null`) | `scored`, 0 points |
| Option the question does not offer, wrong question id, or wrong answer type | throws `InvalidSubmittedAnswerError` |
| Definition is not gradable | throws `InvalidQuestionDefinitionError` |

A missing answer is a legitimate zero, while an unknown option identifier is an
invalid submission that the calling server entry point should reject rather than
score. A definition is not gradable when its maximum is negative or not finite, its
option identifiers repeat, or its correct option is not among the options. Option
identifiers match exactly; there is no trimming or case folding.

Points are the configured maximum, awarded all-or-nothing, so earned points can
never exceed the maximum.
