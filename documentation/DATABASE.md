# Database foundation

This batch implements issues #9, #10, #12, #27, #28, #29, #62, #63, and #68. The database is
PostgreSQL 18, accessed only from server code through Prisma ORM 7.10 and its
`pg` driver adapter. Prisma 8 prereleases are deliberately excluded. The
application still has no admin content mutations or public learning routes.

## Local development

Install the **complete PostgreSQL 18 server tools**, not just a command-line
client component. `initdb`, `pg_ctl`, and their matching `share/postgres.bki`
and libraries must be available. See the [PostgreSQL downloads](https://www.postgresql.org/download/)
and [official Windows binary archives](https://www.enterprisedb.com/download-postgresql-binaries).
Add its `bin` directory to PATH, or set `PG_BIN_DIR` to that directory. No
Windows service, default-port database, Docker daemon, or global installation
is changed by the project scripts.

An unpacked complete Windows archive can alternatively live at
`.local/postgresql-runtime/pgsql/`; the helper detects its `bin` directory.
This is a local runtime cache, not a committed dependency or automatic download.

```sh
npm ci
npm run db:start
npm run db:deploy
npm run db:status
```

`db:start` initializes `.local/postgres/development/data`, binds PostgreSQL to
loopback port **55432**, and creates the `bgmatura_dev` role/database. It creates
a random SCRAM password in the ignored local credential file. Connection values
are stored in the ignored `.local/postgres/development/connection.env`.

If `.env.local` is absent, the helper creates it with the local `DATABASE_URL`.
An existing file is always preserved. If it points elsewhere, explicitly copy
the generated local setting before running a development migration. Never paste
connection strings into issues, logs, or source files. Local roles own their
dedicated clusters and are not suitable production credentials.

`npm run db:stop` stops only this project cluster and retains its data. Restart
with `db:start`. The helpers use UTC for the server session default; application
timestamps are `timestamptz`, and presentation time zones belong to the UI.

## Prisma and migrations

- [`prisma7.config.ts`](../prisma7.config.ts) loads Next.js environment files in
  the matching development/test/production mode. An explicitly supplied shell
  `DATABASE_URL` wins. There is no connection-string fallback. Generating the
  client is allowed without credentials.
- [`prisma/schema.prisma`](../prisma/schema.prisma) defines the physical models.
  `npm run db:generate` writes the ignored `src/generated/prisma/` client. npm's
  postinstall runs this too, so a fresh lockfile install can type-check/build.
- `npm run db:migrate -- --name descriptive_change` creates/applies a development
  migration. For custom SQL, use `--create-only`, review/edit the **new unapplied**
  migration, then apply it. Do not rewrite an applied migration.
- `npm run db:deploy` applies committed migrations to the explicitly configured
  target. It does not provision accounts or seed educational content.
- `npm run db:reset` is destructive **only to this project's generated local
  development database**. It gets the target from its private local settings,
  not the shell or `.env.local`, and refuses any test/other mode. It must never
  be used as a hosted/production reset mechanism.

Prisma keeps migration history in `_prisma_migrations`. The initial migration
is explicitly transactional. Prisma's schema does not express the added CHECK
constraints or hierarchy trigger; keep them in SQL and integration tests when
changing these models. Migration files use LF line endings through
`.gitattributes` so Windows/Unix checkouts do not change their checksums.

## Application boundary

[`src/server/database.ts`](../src/server/database.ts) imports `server-only` and
constructs the Prisma client lazily from `getServerEnvironment()`. Static public
pages still need no database. The starting pool has at most five connections
and a five-second connection timeout. Development hot reload shares a typed
global client cache; Node integration tests use isolated module instances.

No Prisma client, connection URL, or server model is passed into Client
Components. Future admin entry points must authorize every write before calling
feature services. These model/query helpers are not public Server Actions or
Route Handlers and do not provide an unauthenticated editing API.

## Language lessons

`Lesson` (#30) stores a title, globally unique slug, required primary `topicId`,
versioned JSON `content`, draft/published status, and creation/edit timestamps.
The primary topic may be a subtopic and can have multiple lessons. A composite
foreign key plus language-only CHECK requires a Bulgarian-language topic and
refuses deleting it while referenced; lessons cannot become orphaned. Additional
cross-topic tagging is not introduced without an implemented need.

Documents follow [learning-content.md](FEATURES/learning-content.md). Empty v1
documents are allowed in drafts. PostgreSQL checks the v1 object/array envelope
and refuses an empty published document; server writes must validate every block
with `learningContentSchema`. Full publication/editorial rules remain #40.
`findPublishedLessonBySlug` selects reading fields only, requires both lesson and
topic to be published, and parses stored JSON again; malformed content resolves
to `null`. No admin write API or public lesson route is exposed by this model.

## Authors

`Author` has a UUID identity, unique nonblank slug, nonblank name, optional
essential context, `DRAFT`/`PUBLISHED` status, and creation/update timestamps.
Draft is the default and may omit context. PostgreSQL rejects a published author
with blank/missing context; full editorial completeness remains a publishing
feature (#40). Prisma maintains `updatedAt` on Prisma writes.

[`findPublishedAuthorBySlug`](../src/features/literature/server/authors.ts)
enforces publication in the query and selects only public reading fields.
An unpublished slug resolves to `null`. Editorial writes, previews, and pages
remain separate issues. Test authors are synthetic fixtures, not real learning
material, and are rolled back rather than seeded into development.

## Literary works

`Work` is a literary work by **exactly one** author (`authorId`, required); an
author can have many works. Co-authors and translators are outside the MVP. A work
has a title, a globally unique nonblank slug for its public address, optional
`genre`, `summary`, and `interpretation` text, three ordered study lists
(`themes`, `characters`, `importantIdeas`), a `DRAFT`/`PUBLISHED` status, and
timestamps.

- **Study lists** are text arrays. They may be empty but never contain blank items
  (blank includes tabs and line breaks); an empty list means "none recorded".
- **Characters are optional.** A work where characters do not apply, such as a lyric
  poem, keeps an empty `characters` list and remains valid even when published.
- **Drafts may be incomplete.** PostgreSQL rejects publishing a work with a blank or
  missing genre or summary. Fuller editorial completeness remains a publishing
  feature (#40).
- **Author link.** The foreign key restricts deleting an author who still has works
  and changing referenced keys. Remove or reassign the works first.
- Uniqueness, nonblank title/slug, required lists, and the publication rule are
  database constraints, so they hold for writes made outside Prisma.

[`findPublishedWorkBySlug`](../src/features/literature/server/works.ts) enforces
publication in the query and selects only public reading fields: no status, author
id, or timestamps. The author appears (name and slug) **only when the author is
published too**; a draft author is never revealed through a published work, and
the work's `author` is `null` instead. Admin writes, previews, and pages remain
separate issues. Test works are synthetic fixtures, rolled back rather than seeded.

## Topics and subtopics

`Topic` has a UUID, title, slug, subject (`BULGARIAN_LANGUAGE` or `LITERATURE`),
optional parent, nonnegative position, draft/publication state, and timestamps.
Slugs are unique **within a subject**. Titles may repeat.

- The composite parent foreign key requires an existing parent in the same
  subject. It restricts deleting parents or changing referenced keys while
  children remain; explicitly reparent/unlink children first.
- A CHECK rejects self-parenting. The SQL trigger walks ancestors and rejects
  deeper cycles. A transaction-scoped advisory lock serializes hierarchy edits;
  integration tests exercise competing transactions as well as sequential edits.
- [`listTopicChildren`](../src/features/topics/server/topics.ts) uses position,
  title, then UUID as deterministic ordering. It is an **internal editorial**
  query, includes drafts, and must not be exposed as a public catalog without
  publication/ancestor visibility rules. No such route exists in this batch.

These models do not yet attach works, lessons, or attempts. Add those
relationships deliberately in later migrations, including deletion constraints.

## Question bank

`Question` and `QuestionOption` are the one shared bank for practice and exams.
Exams will **link** to questions; a question is never copied per exam. Questions
carry the fields of the server-side `QuestionDefinition` contract
([contracts.ts](../src/features/questions/server/contracts.ts)).

| Column | Used by | Notes |
| --- | --- | --- |
| `subject`, `type`, `prompt` | all | `type`: multiple choice, short response, extended response, argumentative writing |
| `assessmentMode` | all | `OBJECTIVE`, `SELF_REVIEW`, or `UNGRADED` |
| `maximumPoints`, `explanation` | objective only | `Decimal(6,2)`, so half points stay exact; zero is allowed |
| `acceptedAnswers` | objective short response only | raw editor answers; normalization happens when grading |
| `correctOptionId` | multiple choice only | one of the question's own options |
| `referenceGuidance`, `rubric` | written (self-review/ungraded) only | `rubric` is a JSON array of criteria, parsed with Zod when a definition is built |
| `status` | all | `DRAFT` or `PUBLISHED`, plus `createdAt`/`updatedAt` |

Options (`QuestionOption`) hold `text` and a `position`, unique per question.

PostgreSQL enforces the structure, so it also holds for writes outside Prisma:

- **Type and mode.** Multiple choice is always objective; extended responses and
  essays are never objective. A short response can be either.
- **Objective questions** require points and an explanation and forbid guidance
  and a rubric. **Written questions** require guidance and forbid points and an
  explanation, so written work can never carry a score.
- Accepted answers belong to objective short responses only; a correct option to
  multiple choice only; the rubric must be a JSON array; the prompt, option text,
  and published fields must be nonblank; points and positions are nonnegative.
- **Publication.** A draft may be incomplete. A published question needs an
  explanation (objective) or guidance (written), a correct option (multiple
  choice), and at least one accepted answer (objective short response). Further
  completeness rules, such as the number of options, belong to the publishing
  feature (#73).
- **Options only on multiple choice.** `QuestionOption` has a composite foreign
  key `(questionId, questionType)` to `Question(id, type)` plus a CHECK that the
  type is multiple choice. Changing the type of a question that has options is
  rejected.
- **Correct option.** `correctOptionId` is a plain foreign key, and a trigger
  requires the option to belong to the **same** question (Prisma cannot null
  part of a composite key that includes the primary key). Another trigger stops
  moving the correct option to a different question. The foreign key is
  `NO ACTION`, so deleting the correct option alone is rejected while deleting
  the whole question removes its options.

[`toQuestionDefinition`](../src/features/questions/server/question-definitions.ts)
turns a stored question with its options into the `QuestionDefinition` used by the
graders. It refuses records that cannot be graded yet, such as a draft multiple-choice
question without a correct option. The result contains answer keys and stays on the
server; public projections are a separate task (#77). Topic, work, and source links
are described in the section on question associations below, and attempt snapshots in
the section on question snapshots.

Integration tests cover multiple-choice and ungraded written records end to end
(store, map, grade) and assert the exact constraint behind each rejection.

## Question associations and provenance

Three tables connect a question to learning material and record where it came from.

**Topics.** `QuestionTopic` links a question to any number of topics (and a topic
to any number of questions); a link is unique per pair. The link stores the
`subject`, and composite foreign keys to both `Question(id, subject)` and
`Topic(id, subject)` force the question and the topic to share it, so a literature
question cannot be filed under a language topic. A linked question's subject cannot
change, and a topic that questions still use cannot be deleted: unlink it first.

**Works.** `QuestionWork` optionally links a question to relevant works. Works exist
only for literature, so the link's `subject` is fixed to `LITERATURE` (CHECK) and the
foreign key to `Question(id, subject)` rejects a language question. A linked work
cannot be deleted while questions use it. Deleting a question removes its topic and
work links and its provenance, never the topics or works themselves.

**Provenance.** `QuestionProvenance` is an optional one-to-one record; a question
without one is simply unclassified.

| Field | Visibility | Meaning |
| --- | --- | --- |
| `origin` | public | `ORIGINAL`, `ADAPTED`, or `OFFICIAL` |
| `attribution` | public | credit line shown to students |
| `sourceReference` | private | exact citation, such as document and page |
| `editorName` | private | who wrote or adapted the question |
| `reviewStatus`, `reviewedBy`, `reviewedAt`, `reviewNotes` | private | review metadata |

Constraints: optional text is absent or contains a visible character (tabs and line
breaks do not count as content); a review is either complete (`REVIEWED` with
reviewer and date) or absent (`UNREVIEWED` with neither); and adapted or official
material must have an attribution before it can be marked reviewed.

[`findPublishedQuestionAssociations`](../src/features/questions/server/question-associations.ts)
is the public projection. A draft question never resolves; only **published** topics
and works are listed, so unpublished content is not revealed through a published
question; and provenance is reduced to `origin` and `attribution`. Private editorial
fields are never selected, and an integration test checks that none of them can
appear in the output. Admin editing of links and provenance, and requiring review
before publication (#73), are separate issues.

## Question snapshots

`QuestionSnapshot` is an immutable copy of a published question as it was when an
attempt began, so completed results never change with later edits, unpublishing, or
deletion. Each row has the source `questionId`, a `formatVersion`, the `content` JSON,
a SHA-256 `contentHash`, and `createdAt`; a snapshot is unique per question and hash,
so an unchanged question is stored once and shared by its attempts.

- A trigger rejects every `UPDATE`. Rows are inserted, and deleted only by retention
  cleanup (#146).
- There is **no foreign key** to `Question`, so editing, unpublishing, or deleting a
  question can never alter or block a snapshot.
- CHECK constraints require a SHA-256 hash, a JSON object, a declared format version
  equal to the stored one, and a `definition.id` equal to `questionId`.
- `content` contains answer keys and stays on the server; it holds only public
  provenance, never editor names, source references, or review details.

The format, its rationale, and how attempts use it are described in
[question-snapshots.md](FEATURES/question-snapshots.md). Attempts will reference a
snapshot when they are modeled (#78, #110).

## Isolated persistence and browser tests

```sh
npm run db:test:start
npm run test:integration
npx playwright install chromium
npm run test:e2e
npm run db:test:stop
```

The dedicated test cluster lives under `.local/postgres/test`, with a separate
password, role/database **bgmatura_test**, and loopback port **55433**. Tests never
fall back to `DATABASE_URL` from the shell or development environment. A supplied
`TEST_DATABASE_URL` is accepted only for that exact local user/database/port with
no URL options. Remote hosts, development ports, other database names, and
connection-option injection are rejected **before** any migration or query.

The runner applies committed migrations to that target and sets a child-only
`DATABASE_URL`. Integration setup rechecks the target. Ordinary fixtures execute
inside transactions rolled back even after failed assertions; the concurrency
test cleans only its own randomly identified records. There is no truncate-all,
test reset, or production data cleanup. Test shutdown closes Prisma pools.

Playwright owns an isolated Next.js production server on loopback port **3102**
and refuses to reuse another server. Its database environment is the validated
test URL. The runner builds first. Chromium desktop, mobile, and tablet tests
check anonymous access, safe learning pages, URL search/filter state, draft
isolation, keyboard navigation, readable layout without overflow, and HTTP 404.
Failures can retain ignored traces; never upload traces containing sensitive
content without reviewing them.

`npm test` remains the database-free unit suite. Integration and browser tests
are explicit commands, with their service/browser prerequisites documented here.

Public pages additionally enforce published ancestry and safe stored blocks;
see [public learning](FEATURES/public-learning.md). They reuse the lesson model
and versioned content format introduced in #26/#30.

## Admin identities

Migration `20261103120000_admin_auth` adds `AdminUser`, `AdminSession`,
`AdminAccount`, and `AdminVerification`. Prisma model names follow Better Auth's
adapter contract; table mapping makes their admin purpose explicit. IDs are opaque
text; email/session token and provider/account pairs are unique. User removal
cascades only to that user's sessions/accounts. Better Auth encrypts OAuth tokens.
No student identity or attempt table is introduced. See
[authentication](FEATURES/admin-authentication.md) for provisioning/session behavior.

Editorial writes use serializable transactions and optimistic updatedAt checks.
Test-only session fixtures create UUID-scoped committed rows because writes are
exercised across HTTP connections; cleanup removes only their own identifiers.
The runner injects synthetic auth configuration into child processes, never
production OAuth credentials. Immutable snapshot fixtures remain rolled back.

## Assessment attempts

Migration `20261110100000_assessment_attempts` adds immutable exam configuration
versions, curated exams with ordered bank links, and anonymous attempts.
`AttemptQuestion` references the matching immutable bank snapshot and stores the
captured objective allocation, answer revision, and evaluation for one attempt.
Only a credential digest is stored. Exam drafts can change independently of
previous attempts, which retain their configuration version and ordered snapshots.
See [assessment attempts](FEATURES/assessment-attempts.md) for transaction,
ownership, and deadline behavior.
