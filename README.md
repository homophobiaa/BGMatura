# BG Matura

A Bulgarian-language platform for preparing for the 12th-grade Bulgarian language and literature matriculation exam — **ДЗИ по БЕЛ**.

BG Matura brings study material, interactive practice, timed exam simulations, and clear explanations into one place. The core student experience is planned to be free and available without registration.

**Learn → Practice → Simulate an exam → Review mistakes.**

## Project status

The product scope and engineering direction are defined. The capabilities below describe the planned MVP, not a list of completed features.

The planning target is a usable release ahead of the May 2027 exam period.

## Planned features

- **Literature catalog:** authors, works, summaries, themes, characters, and interpretation notes.
- **Bulgarian language lessons:** exam-relevant rules, explanations, and examples linked to practice.
- **Interactive practice:** topic-based questions with immediate feedback and meaningful answer explanations.
- **Practice matura:** curated exam sets with a timer, question navigation, and feedback after submission.
- **Results and review:** submitted answers, scored points, explanations, and links back to relevant lessons.
- **Admin panel:** authenticated tools for creating, reviewing, and publishing lessons, questions, and exams.

Practice and exams use a shared question bank and grading foundation. Objective answers are graded on the server. Essays and extended responses receive reference guidance and an explicit self-review or ungraded status; they are not presented as a complete official exam score.

## Technology direction

| Area | Technology |
| --- | --- |
| Application | Next.js App Router, React, TypeScript |
| Database | PostgreSQL |
| ORM | Prisma |
| Styling and UI | Tailwind CSS, shadcn/ui, Lucide |
| Input validation | Zod |
| Forms | React Hook Form where appropriate |
| Server behavior | Server Components, Server Actions, and Route Handlers |

One full-stack application owns the public experience and administration. Database access, authorization, and authoritative grading stay on the server. Hosting and admin authentication providers remain to be selected.

## Repository organization

Source code is organized by feature. Routes compose the application; feature modules own their UI and business behavior; shared infrastructure lives separately.

| Path | Purpose |
| --- | --- |
| `src/app/` | Routes, layouts, loading/error states, and server entry points |
| `src/features/` | Literature, language, questions, exams, results, and administration |
| `src/components/` | Shared UI and layout components |
| `src/lib/` | Shared configuration, helpers, and infrastructure |
| `src/server/` | Shared server-only services and infrastructure |
| `prisma/` | Database schema, migrations, and seed data |
| `public/` | Static assets |
| `tests/` | Cross-feature integration and end-to-end tests, when needed |
| `.claude/` | Product direction, design direction, and engineering instructions |
| `documentation/` | Architecture, database, and feature documentation |

This is the intended organization. Directories and documents should be added when they serve an implemented need.

## Development setup

### Runtime and package manager

| Tool | Version | Why |
| --- | --- | --- |
| Node.js | **24.x (LTS)** | Active LTS line supported until April 2028, which covers the May 2027 release target and the following year. Node.js 22 leaves support in April 2027, right before launch. |
| npm | Bundled with Node.js 24 | Ships with Node.js, so contributors install nothing extra. It is the default in the Next.js documentation and is supported by every mainstream host. |

The required Node.js major version is pinned in [`.nvmrc`](.nvmrc). With [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm), run `nvm use` or `fnm use` in the repository root.

Lockfile and version-pinning conventions:

- **Use npm only.** Do not commit `yarn.lock`, `pnpm-lock.yaml`, or `bun.lockb`.
- **Commit `package-lock.json`.** Every dependency change updates it in the same commit.
- **Install from the lockfile.** Use `npm ci` for a clean install and in CI; use `npm install <package>` only when intentionally adding or changing a dependency.
- **Pin the runtime, range the libraries.** `.nvmrc` and the `engines` field in `package.json` (added when the app is initialized) pin the Node.js major version. Dependencies use npm's default caret ranges; the lockfile fixes the exact installed versions.
- **Upgrade deliberately.** Bump Node.js or major dependency versions in a dedicated change that updates this section and passes the project's checks.

### Remaining setup

The application is not initialized yet. Once it is, this section must also include:

1. Dependency installation command.
2. PostgreSQL setup and an `.env.example` containing required variable names without secret values.
3. Database migration, seed, and initial admin setup instructions.
4. Development server command and local URL.
5. Available lint, type-check, test, and production build commands.

Use the repository's actual `package.json`, Prisma configuration, and environment example as the source of truth. Never commit credentials or production secrets.

## Working on the project

Read these documents before making changes:

- [.claude/PROJECT_DIRECTION.md](.claude/PROJECT_DIRECTION.md) — product requirements, MVP boundaries, and milestones.
- [.claude/CLAUDE.md](.claude/CLAUDE.md) — coding, architecture, testing, documentation, and issue workflow rules.
- `.claude/DESIGN.md` — visual and UX direction, when available.
- `documentation/` — relevant system and feature explanations, as they are added.

Code and technical documentation use English. Student-facing text and educational content use Bulgarian.

Prioritize code a human can follow from page or interaction through validation, authorization, business logic, database access, and back to the UI. Use explicit names, focused modules, and straightforward control flow. Document non-obvious connections and decisions alongside meaningful changes.

Work from issues with observable acceptance criteria. Inspect existing patterns, implement within scope, run the available checks appropriate to the change, update affected documentation, and report what was actually verified. Grading correctness, admin authorization, answer visibility, result privacy, and exam recovery deserve particular attention.

## MVP boundaries

The first release focuses on БЕЛ preparation. Student accounts, payments, AI tutoring or essay scoring, other subjects, leaderboards, and personalized progress systems are outside the MVP.

Educational content must be reviewed before publication. Exam composition and scoring must be checked against the official specification for the targeted year. Official past papers, adapted material, and original practice content must be clearly distinguished, with sources and usage rights reviewed before republication.
