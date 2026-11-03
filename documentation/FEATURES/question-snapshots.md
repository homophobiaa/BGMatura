# Question snapshots

A question snapshot keeps a completed result stable. When an attempt begins, the
question's current version is copied into an immutable record. The attempt is graded
and reviewed from that copy only, so later edits, unpublishing, or deleting the
question never change a result a student has already seen.

This page records the decision for issue #68. The code is
[`question-snapshots.ts`](../../src/features/questions/server/question-snapshots.ts)
and the table is `QuestionSnapshot` (see [DATABASE.md](../DATABASE.md)).

## Format

One row holds a **versioned JSON document**:

```json
{
  "formatVersion": 1,
  "subject": "LITERATURE",
  "definition": { "id": "…", "type": "multiple-choice", "prompt": "…", "options": [ … ],
                  "assessment": { "mode": "objective", "maximumPoints": 2,
                                  "explanation": "…", "correctOptionId": "…" } },
  "source": { "origin": "ADAPTED", "attribution": "…" }
}
```

| Part | Content |
| --- | --- |
| `formatVersion` | Layout version of this document. Readers refuse a version they do not know. |
| `subject` | `BULGARIAN_LANGUAGE` or `LITERATURE` |
| `definition` | The server-side `QuestionDefinition` exactly as the graders use it: prompt, options in order, accepted answers or correct option, points, explanation (objective) or reference guidance and rubric (written) |
| `source` | Public provenance only: origin and attribution, or `null` when unclassified |

The table also stores the source `questionId`, the `formatVersion`, and a SHA-256
`contentHash` of the exact content text. Editor names, source references, review
details, topics, and works are **not** captured: the snapshot holds only what grading
and answer review need, and nothing private.

### Why one JSON document

The alternatives were copying every field into normalized snapshot tables, or keeping
version rows on the live question tables. A single document was chosen because the
graders already work from one `QuestionDefinition` value, so the snapshot is exactly
what they read, with no second mapping to keep in step. A new field means a new
`formatVersion`, not a migration of old rows, and old snapshots keep their meaning.
The cost is that fields inside `content` are not individually queryable, which grading
and review never need.

## Capturing

`captureQuestionSnapshot(questionId)` loads the question, builds the document, and
inserts it:

- Only a **published** question can be captured. A draft, an unpublished question, or a
  missing one is refused. Attempts start only on published questions.
- An unchanged question produces identical text and therefore the same hash, so the
  existing snapshot is reused and many attempts share one row. An edited question
  produces a new snapshot; older ones are untouched.
- The insert ignores duplicates, so two attempts starting at once are safe, even inside
  a transaction.

Attempt creation (practice sessions, #78/#79, and exam attempts, #110) must call it
**before any answer is evaluated**, store the snapshot's id with the attempt, and grade
and review that attempt only through `readQuestionSnapshot`.

## Immutability

- PostgreSQL rejects every `UPDATE` of a snapshot with a trigger, so even a direct
  database write cannot rewrite one. Rows can be inserted and, for retention cleanup
  (#146), deleted once nothing references them.
- There is deliberately **no foreign key** to the question. Editing, unpublishing, or
  deleting a question cannot alter or block a snapshot. The question id is a plain
  reference.
- CHECK constraints require a well-formed hash, an object as content, a declared
  `formatVersion` equal to the stored one, and a `definition.id` equal to `questionId`.

## Reading

`readQuestionSnapshot(snapshot)` validates the stored document and returns the
`QuestionDefinition`, subject, and public source. It refuses unknown format versions,
extra or missing fields, and malformed rubrics instead of guessing.

Snapshots contain answer keys. Keep them on the server, and send a student an answer
key only after submission, as for the live definitions.

## Changing the format

Add a new `formatVersion`, teach `readQuestionSnapshot` the new layout, and keep
reading every older version for as long as snapshots of it exist. Never rewrite a
stored snapshot.
