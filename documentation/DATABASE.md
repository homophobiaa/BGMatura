# Database foundation

This batch implements issues #9, #10, #12, #27, and #29. The database is
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

These models do not yet attach works, lessons, questions, or attempts. Add those
relationships deliberately in later migrations, including deletion constraints.

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

Playwright owns an isolated Next.js development server on loopback port **3102**
and refuses to reuse another server. Its database environment is the validated
test URL. Chromium desktop and mobile smoke tests check anonymous page access,
Bulgarian metadata, readable layout without horizontal overflow, and HTTP 404.
Failures can retain ignored traces; never upload traces containing sensitive
content without reviewing them.

`npm test` remains the database-free unit suite. Integration and browser tests
are explicit commands, with their service/browser prerequisites documented here.
