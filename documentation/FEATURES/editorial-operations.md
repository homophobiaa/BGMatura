# Authorized editorial operations

This backend slice implements #31, #33, #35, #37, #40–42, #54–55, #58, #69,
and #74. Forms remain separate frontend tasks. Student access remains anonymous.

## Follow the request

`src/app/api/admin/learning/[kind]/route.ts` and `api/admin/questions/route.ts`
authorize before reading a bounded JSON body, validate a strict command, then
delegate to feature-owned services. `src/server/editorial.ts` repeats authorization
and exact-Origin checks for direct service callers and owns the serializable
transaction. It retries serialization failures at most twice; stale versions,
missing relations, and duplicate slugs return actionable errors. All writes in a
command commit together or roll back. Prisma and answer definitions stay server-only.

Kinds are `author`, `work`, `topic`, and `lesson`. POST learning commands:

```json
{ "operation": "save", "draft": { "name": "Draft author", "slug": "draft-author", "context": null } }
```

Use the appropriate type's fields in `draft`. Other commands are:

```json
{ "operation": "publish", "id": "record-uuid" }
{ "operation": "unpublish", "id": "record-uuid" }
{ "operation": "delete", "id": "record-uuid", "confirmation": "current-slug" }
```

Send a JSON Content-Type, same-origin signed session cookie and exact configured
Origin. Body limit is 64 KiB regardless of Content-Length. Success is `{ record }`;
expected failures are `{ error, message, fields }`: 400 invalid input, 401 access/
origin denied, 404 missing record, 409 stale/linked/published conflict, 503 missing
auth configuration. Unexpected errors are generic 500 responses. Responses are
private/no-store and noindex. Nothing echoes raw persistence errors.

## Drafts and links

Create omits `id`. Edit requires `id` plus the last returned ISO `expectedUpdatedAt`.
Saving never accepts client-provided status. **Unpublish before editing a published
record.** Incomplete draft saves cannot modify public material. Stale saves must
reload rather than overwrite another editor. Incomplete content is valid as a
draft, but names/titles/slugs and relational/type structure must remain valid.

- Authors own a name, slug and optional plain-text context.
- Works require an existing author, and preserve genre, summary, interpretation,
  and ordered theme/character/important-idea arrays. Characters may be empty.
- Topics require a valid subject, slug, title, nonnegative position and optional
  same-subject parent. Walks and database triggers reject cycles; subject changes
  are blocked while children, lessons or questions depend on the topic. Reparenting
  within the subject is valid when it creates no cycle. A draft ancestor hides
  published descendants; reparenting does not silently publish them.
- Lessons require an existing language topic and the versioned block format in
  [learning-content.md](learning-content.md). No HTML blocks, unsafe links, unknown
  fields or unsupported versions. Plain text resembling HTML is escaped as text.

Publication is explicit and validates inside the same transaction:

| Kind | Additional publication requirements |
| --- | --- |
| Author | Nonblank name/context |
| Work | Title, genre, summary, interpretation, theme and important idea; published author |
| Topic | Published complete ancestry |
| Lesson | Valid blocks with explanation paragraph and illustrative example; published complete topic ancestry |

Status and `updatedAt` change together. Unpublishing preserves relations rather than
deleting other content. Public author links are removed when the author is
unpublished; an already published work remains readable with its author context
withheld, matching existing public-reader behavior. Language lessons are hidden if
any topic ancestor is unpublished. No cascading status rewrites occur.

## Previews, refresh and deletion

`GET /api/admin/learning/[kind]/[id]` reads the saved private record.
`/admin/preview/[kind]/[id]` renders author/work/lesson drafts with the exact shared
`StudyText`/`LearningContent` renderers used publicly, a clear preview banner,
authentication, private headers and noindex metadata. Anonymous visitors redirect
to sign-in and never receive draft content. Topics can also be previewed.

After a successful HTTP mutation commits, `refreshLearningPages` revalidates the
affected learning families: literature catalog/work/author pages or language
catalog/lesson pages. Dynamic patterns cover old/new slugs and dependent links;
unrelated homepage/practice/exam pages keep their caching. Public queries already
read current published data without a cross-request data cache. Production browser
tests exercise previously visited URLs across publish, edit and unpublish, and
catalog removal. Direct service callers outside these HTTP routes must call the
refresh helper after commit if they affect cached pages.

Deletion is only for unused drafts, requires the current slug as confirmation and
runs with reference checks inside the serializable transaction. Authors with works,
works with question links, and topics with children/lessons/question links cannot
be deleted. Prefer unpublish or explicitly unlink first. Lessons currently have
no incoming references in this schema. Future relations must extend these rules.

## Question bank

`saveQuestionDraft` validates type/assessment-discriminated input. Objective items
require finite nonnegative points (two decimal places, up to 9999.99); written
items never accept numeric grading fields. Explanations/guidance may be empty in a
draft. Multiple choice accepts ordered `options: [{ text }]` and nullable
`correctOptionIndex`; objective short responses accept `acceptedAnswers`. Written
rubric criteria have unique IDs, descriptions and optional indicative points.
All topic links must exist in the same subject; work links require literature.
Duplicate links are rejected.

Editing replaces answer options and associations atomically, clearing the correct
option reference first. Provenance is optional in a draft. `reviewed: true` is an
explicit editor confirmation requiring editor/source attribution; reviewer ID
and time are assigned on the server. Saving without that confirmation resets review.
Clients cannot set review timestamps, reviewer identity or publication status.

The questions endpoint accepts `save` with `draft`, or `publish`/`unpublish` with
`id`. `setQuestionPublication` authorizes, checks published topic ancestry and linked
works/authors, and delegates completeness to the existing #73 validator. It returns
all completeness codes as field reasons. Lower-level `publishQuestion` is an
internal persistence helper, never a route authorization boundary.

Unpublishing removes questions from new public selections. Immutable snapshots are
untouched: attempt/result consumers must grade the captured definition, not re-read
the live bank. Integration tests capture inside a rolled-back fixture, unpublish/
edit through real authorized services, and verify the saved answer, points and
grade remain unchanged. No snapshot cleanup or applied migration rewriting is used.
See [question-snapshots.md](question-snapshots.md).
