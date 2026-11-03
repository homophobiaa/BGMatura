# Public question projections

While a student answers, the browser may receive only what is needed to present the
question. Answer keys and grading rules stay on the server until authorized feedback,
and that protection does not rely on the UI hiding anything: the data is never sent.

The code is
[`public-questions.ts`](../../src/features/questions/server/public-questions.ts); the
public shape is `Question` in [`types.ts`](../../src/features/questions/types.ts).

## What is public

| Question type | Public fields |
| --- | --- |
| Multiple choice | `id`, `type`, `prompt`, and `options` (each option's `id` and `text`, in order) |
| Short response, extended response, argumentative writing | `id`, `type`, `prompt` |

The answer input follows from `type`: a choice among the options, or free text. Nothing
else is public.

## What is withheld

The correct option, accepted answers, explanation, reference guidance, rubric, and
points (`maximumPoints`) are withheld until authorized feedback, as are status,
provenance, and all editorial fields. Points stay private for now because the `Question`
contract does not include them; show them to students only by adding them deliberately
to the contract, the whitelist, and its tests.

## Two entry points

- `findPublishedPublicQuestion(questionId)` reads one **published** question. The query
  selects only the whitelisted columns, so keys and rules are never loaded, a draft never
  resolves, and options come back in their stored order.
- `toPublicQuestion(definition)` projects a `QuestionDefinition`, typically the one read
  from an attempt's snapshot (see [question-snapshots.md](question-snapshots.md)). An
  active attempt should present its snapshot, not the live question.

Both build each object **field by field and never spread** a definition. A field added to
the server contract later (an answer key, an explanation, points) therefore cannot reach
the browser by accident; it needs a deliberate change to the whitelist.

## How it is tested

- **Serialized output.** Tests fill every private field with a marker text, then check
  that the JSON of the public object contains neither the marker nor any private field
  name, for all four question types. This is done from both entry points, the second
  against a real database.
- **Exact shape.** Public objects are compared with `toEqual`, so an extra field fails.
- **Added fields.** A definition with extra properties, such as `isCorrect` on an option,
  still produces a clean public object.
- **Client Component props.** `src/client-boundary.test.ts` fails if any file marked
  `"use client"` directly imports server code (`server/` modules, `server-only`, the
  database client, the generated Prisma client, Node built-ins). The build separately
  rejects a Client Component that reaches a `server-only` module indirectly.

## Using it

Pass the result of these functions, never a definition or a database record, to Client
Components and to responses sent to the browser. Feedback after submission is a separate,
authorized step that may reveal the explanation and answer key.
