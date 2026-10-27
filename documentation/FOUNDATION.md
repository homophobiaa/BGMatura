# Application foundation

This foundation implements issues #6, #7, #8, #11, and #61 on top of the
Node.js 24/npm decision already merged for #1. That initial batch introduced no
database schema, authentication provider, exam rules, or final visual identity.
The next batch (#9, #10, #12, #27, #29) adds the [database foundation](DATABASE.md),
author/topic persistence, and isolated integration/browser test infrastructure.

## Tooling decisions

- Next.js 16 App Router and React 19 provide a single full-stack application.
  Routes live in `src/app/`; pages are Server Components unless interactivity
  requires otherwise. TypeScript uses strict checking and the `@/*` source alias.
- Tailwind CSS 4 supplies the agreed styling foundation. The initial page uses
  the documented cream canvas and system serif/sans fallbacks. Final branding,
  typography, navigation, and shared controls remain in their own issues.
- ESLint 10 uses the first-party Next.js Core Web Vitals plugin, React Hooks
  rules, and type-aware typescript-eslint rules. This avoids the ESLint 9-only
  peer dependencies in the aggregate `eslint-config-next` package. Unsafe typing
  and explicit `any` fail lint; unresolved imports and type errors fail strict
  TypeScript checking. Next.js builds do not replace the separate lint command.
- TypeScript 5.9 stays within the installed typescript-eslint compatibility
  range. Upgrade the compiler together with its tooling rather than adopting
  an unsupported compiler/parser combination.
- Zod 4 validates server environment values. `server-only` protects modules
  that read secrets or define authoritative grading data from client imports.
- Vitest 5 runs focused Node.js unit tests. It supports the selected Node.js 24
  runtime and needs neither production secrets nor a running database.
- npm caret ranges follow the existing repository policy. `package-lock.json`
  records exact versions; use `npm ci` for reproducible installation.

## Boundaries

`src/app/` owns routing, the root layout, page composition, and metadata.
`src/server/` owns shared server configuration. Question contracts belong to
`src/features/questions/`; privileged answer definitions belong under its
`server/` directory. There is no parallel API application or empty feature tree.

## Environment validation

`src/server/environment.ts` imports `server-only` and exports
`getServerEnvironment()`. Call it at the server boundary of a feature that needs
configuration. It accepts `postgresql:`/`postgres:` connection URLs with a host
and database name, and validates `NODE_ENV`. Its error lists invalid variable
names, never raw values or Zod input details. It returns only declared fields.

Validation is deliberately lazy: the static introductory page needs no database
and must build without credentials. The database client now calls this function
before constructing its connection, lazily at the first server query.
Authentication variables will be introduced when the provider
is chosen; no `NEXT_PUBLIC_*` configuration is required now.

The environment tests pass explicit sample values or restore any process stubs.
They do not load `.env.local` or use real production services. The test file mocks
only the `server-only` marker so Node can exercise the function; Next.js retains
the real client-import guard in application builds.

## Question and evaluation contracts

- `src/features/questions/types.ts` defines presentation-safe question variants
  and submitted-answer variants. These types contain no answer keys or accepted
  answers. A type alone is not a serialization whitelist: server projection and
  submission validators remain work for their own issues (#77 and #83).
- `src/features/questions/server/contracts.ts` imports `server-only` and holds
  authoritative question definitions: points, keys, accepted answers,
  explanations, and written reference guidance. Do not pass these objects to
  Client Components or import their modules from client code. Use type-only
  imports only in server code/tests; a type-only import cannot enforce a runtime
  boundary because TypeScript erases it.
- `src/features/questions/evaluation.ts` defines the evaluation discriminant and
  its Zod schema. Scored evaluations have finite nonnegative points within a
  nonnegative maximum, including explicitly configured zero-point items.
  Ungraded/self-review evaluations reject numeric scoring
  fields. The schema validates shape, not grading authority: only future server
  grading services may produce authoritative evaluations.

These contracts do not choose short-answer normalization (#64), implement a
grading algorithm (#65–#67), or invent official exam totals. Extended responses
and argumentative writing support only ungraded/self-review assessment.

Read the README for executable setup and verification commands.
