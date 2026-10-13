# BG Matura — Claude Code Engineering Instructions

> Purpose: Rules for implementing and maintaining BG Matura. This file governs **how** work is done; `.claude/PROJECT_DIRECTION.md` governs **what** is built, and `.claude/DESIGN.md` governs visual/UX direction when it exists.
>
> Scope: The entire repository. Follow these instructions for all code changes, reviews, and GitHub issues.

## 1. Read the project before changing it

1. Read `.claude/PROJECT_DIRECTION.md` for product scope, intended behavior, and MVP boundaries.
2. Read `.claude/DESIGN.md` when present for interface and experience decisions. Do not invent visual rules in its absence.
3. Read relevant files under `documentation/` and inspect the existing feature implementation before editing.
4. Check `README.md`, `package.json`, project configuration, and the actual codebase for valid commands and established patterns.
5. Treat a GitHub issue as the **task**, project direction as the **scope authority**, and the current code as the **implementation reality**. Do not let one silently contradict another.

If documents conflict, preserve correctness and security, then explain the conflict and request a decision if it materially changes product scope or architecture. Do not silently rewrite product direction to rationalize an implementation.

## 2. Non-negotiable engineering principles

- **Readable by humans first.** Prefer explicit, boring, easily traceable code to clever or compressed code. Optimize for understanding and maintainability, not minimum line count.
- **Understandable connections.** A developer should be able to locate a feature and trace user interaction -> server entry point -> domain logic -> database -> response/UI without guesswork.
- **Feature-first organization.** Keep feature-specific behavior together, with genuinely shared infrastructure separate.
- **One responsibility per module.** UI renders and collects input; server entry points validate and authorize; services implement business rules; database access persists and retrieves data.
- **Reuse established patterns.** Inspect before creating new abstractions, helpers, components, or dependencies.
- **No speculative architecture.** No microservices, new layers, generalized frameworks, or package additions without a concrete need.
- **Small, coherent changes.** Do the requested work fully, but avoid unrelated rewrites and surprise scope expansion.
- **Keep the repository orderly.** Use consistent names, locations, imports, and documentation. Don't leave dead code, unused exports, temporary files, or overlapping implementations behind.

## 3. Agreed technology and architecture

- One full-stack **Next.js App Router** application using **React + TypeScript**.
- **PostgreSQL** database accessed server-side through **Prisma**.
- **Tailwind CSS** and **shadcn/ui** for UI foundations; **Lucide** icons where suitable.
- **Zod** for validating untrusted input. Use **React Hook Form** where forms merit it; don't introduce unnecessary form machinery for trivial forms.
- Prefer **Server Components** for pages/data presentation; use **Client Components** for genuine interactivity.
- Use **Server Actions** or **Route Handlers** according to the interaction: choose whichever gives clear, safe boundaries. Do not add a parallel API layer solely for uniformity.
- Authentication is required for administration; public studying/practice must not require student accounts in the MVP.
- No separate ASP.NET backend, microservices, student accounts, payments, AI scoring, or other non-MVP systems unless product direction is explicitly changed.

Versions, package manager, commands, auth provider, deployment provider, and testing libraries are **not fixed by this document**. Follow the repository's actual setup; when missing, choose a mainstream maintainable option and record the decision before spreading it across the codebase.

## 4. Repository structure

```text
/
├── .claude/
│   ├── CLAUDE.md                 # Engineering rules (this file)
│   ├── PROJECT_DIRECTION.md      # Product vision and MVP boundaries
│   └── DESIGN.md                 # Visual/UX direction (when created)
├── documentation/               # Living, human-readable technical documentation
│   ├── ARCHITECTURE.md           # System overview and important data flows (when needed)
│   ├── DATABASE.md               # Data model and relationships (when needed)
│   └── FEATURES/                 # Non-trivial feature explanations (as needed)
├── prisma/                      # Prisma schema, migrations, seeds (per installed version)
├── public/                      # Static assets
├── src/
│   ├── app/                     # Routes, layouts, loading/error boundaries, entry points
│   ├── features/                # Feature-owned components, logic, types, validation
│   ├── components/              # Truly shared UI/layout components
│   ├── lib/                     # Shared configuration, helpers, infrastructure
│   └── server/                  # Shared server-only services and infrastructure
├── tests/                       # Cross-feature/integration/e2e tests if needed
├── README.md                    # Setup, commands, high-level developer orientation
└── package.json
```

This is a **guide, not permission to generate empty scaffolding**. Create folders and documents only as needed. Prisma's generated/client configuration may differ by installed version.

### Feature-first rules

- Put literature code under `src/features/literature/`, language under `src/features/language/`, questions under `src/features/questions/`, exams under `src/features/exams/`, results under `src/features/results/`, and admin-specific behavior under `src/features/admin/` as appropriate.
- Feature folders may contain `components/`, `server/`, `schemas/`, `types.ts`, and tests **when useful**. Don't create every subfolder automatically.
- Keep `src/app/` entry points relatively thin: routing, server composition, page metadata, and delegation. Business rules do not belong in page components.
- Promote code to `src/components/`, `src/lib/`, or shared `src/server/` only when it is genuinely cross-feature. Avoid a catch-all `utils.ts` and giant global `types.ts`.
- Keep server-only modules server-only; never import Prisma, secrets, auth internals, or grading keys into Client Components.
- Use a consistent import approach and clear dependency direction. Avoid circular imports and feature-to-feature internal coupling; expose a small explicit interface where features must collaborate.

## 5. Coding style: clarity over cleverness

- **English** for source code, identifiers, comments, commits, and technical documentation. **Bulgarian** for student-facing UI text, accessible labels, and educational material.
- Use full, precise names: `calculateAttemptScore`, `submittedAnswers`, `questionOptions`, not `calc`, `data2`, or `opts` when clarity suffers.
- Prefer straightforward control flow, early returns, and short focused functions. Avoid deeply nested conditions, chained ternaries, and dense one-liners.
- Use TypeScript's types to communicate domain meaning. Prefer precise types, discriminated unions for question variants, and explicit contracts at boundaries.
- Avoid `any`, unsafe casts, non-null assertions, and ignored compiler errors. If unavoidable, explain why narrowly at the site.
- Represent domain constants explicitly; no unexplained magic values, string statuses, or implicit scoring assumptions.
- Do not hide business logic in React JSX, hooks, UI components, database queries, or generic utilities.
- Error messages should be actionable. Handle expected failure states intentionally; don't blanket-catch and silently suppress errors.
- Write comments for **why**, constraints, surprising edge cases, and invariants—not a line-by-line translation of obvious code.
- Don't over-engineer. A simple function is preferable to abstract factories, registries, or a dependency-injection framework without a proven need.
- Prefer incremental changes that match existing repository conventions over broad cosmetic rewrites.

### Make connections visible

For a substantial feature, names and boundaries should make this chain easy to find:

`route/page or UI -> action/handler -> validation + authorization -> feature service -> database access -> typed result -> UI`

For assessment, the grading service is a single source of truth shared by practice and exam flows. Do **not** calculate authoritative scores in multiple routes or in the browser. Avoid files that mix unrelated layers to save a few imports.

## 6. Data, assessment, and content integrity

- Respect `.claude/PROJECT_DIRECTION.md` for the actual MVP behavior and scoring boundaries.
- Use a reusable question bank for practice and exams. Keep exam ordering and point allocation explicit.
- Never send hidden correct answers, answer keys, or privileged grading rules to the client before an exam is submitted. A server component must not accidentally serialize them into Client Component props.
- Grade objective items on the server using validated submissions. Never fabricate a numeric score for ungraded essays or written responses; explicitly represent `pending`, `self-review`, or `ungraded` state as appropriate.
- Preserve the meaning of completed attempts when questions or scoring rules are later edited; use snapshots, versions, or another deliberate documented approach.
- Make exam submission safe against duplicate requests, timer edge cases, page refreshes, and partial failures. Define idempotency and transaction boundaries where relevant.
- Treat lesson content, questions, answers, and rubric data as editorial content requiring review; do not silently publish unverified generated material.
- Model relationships explicitly and maintain them through migrations. Never edit an applied migration in a way that corrupts existing environments. Review destructive schema changes and ensure data safety.
- Seed/demo data must be clearly identified and never presented as real verified exam content.

## 7. Security, access, and privacy

- Validate **all** externally controlled data server-side, even if the browser already validates it.
- Authenticate and authorize **every** admin action and write operation on the server. Hiding buttons or guarding pages is not sufficient.
- Public attempts and results must use properly scoped ownership/session checks or unguessable, securely handled access tokens; sequential IDs alone are not access control.
- Keep database credentials, session secrets, admin credentials, and answer keys out of client bundles, logs, source control, and public responses.
- Follow safe session/cookie handling and protect state-changing requests using the chosen framework/auth library's safeguards.
- Avoid raw HTML and unsafe rendering of untrusted Markdown/content. Sanitize or restrict renderers where needed.
- Minimize student data collection: anonymous-first MVP, no unnecessary profiling or personal information.
- Do not log sensitive submissions, credentials, or session tokens. Provide safe errors to users without exposing internals.

## 8. UI and accessibility

- Follow `.claude/DESIGN.md` once available; otherwise maintain a restrained, consistent design rather than inventing a new style per feature.
- Prioritize mobile usability without compromising desktop exam taking.
- Use semantic HTML, keyboard-accessible interactions, visible focus states, proper labels, and readable contrast.
- Handle loading, empty, error, submitted, expired, and disabled states explicitly where applicable.
- Reuse shared controls and design tokens; avoid random per-page styling conventions.
- Public educational pages should have appropriate metadata, sensible URLs, and server-rendered/indexable content.

## 9. Testing and verification

Every meaningful change requires verification appropriate to its risk. First inspect `package.json` and the existing tooling; **never invent a command or claim it passed without running it**.

- Run available lint and TypeScript checks for affected code; build checks when warranted.
- Add focused unit tests for grading rules, scoring boundaries, answer normalization, exam state transitions, and other important pure logic.
- Use integration tests for persistence, authorization, transactions, and server entry points where behavior depends on those layers.
- Cover critical user journeys with end-to-end tests once the project has the infrastructure: practicing questions, completing a timed exam, reviewing a result, and administering content.
- Test expected behavior, errors, edge cases, and regressions—not just happy paths.
- Never weaken/remove tests merely to make a change pass. Fix the implementation or explain a justified test change.
- If required services or commands cannot run, report exactly what was and wasn't verified, and what remains to be checked.

## 10. Documentation that explains the system

Documentation should be **balanced, useful, and maintained**—not a duplicate of the source code.

- `README.md`: purpose, prerequisites, environment variable names (never secret values), local setup, migration/seed commands, scripts, and how to run tests.
- `documentation/ARCHITECTURE.md`: main modules, boundaries, and major data flows when the application has enough complexity to justify it.
- `documentation/DATABASE.md`: key entities, relationships, important constraints, and decisions that a schema alone does not explain.
- `documentation/FEATURES/`: concise documentation for non-obvious features, particularly exam sessions, grading, result access, and content workflows.
- For significant features or architecture changes, document **where the implementation lives, what each part owns, how parts interact, data flow, and unusual design decisions**. Include links to relevant files when helpful.
- Keep docs synchronized with behavioral or architectural changes as part of the same task. Don't create long documents for trivial UI edits or repeat self-evident code.
- Record important decisions and trade-offs rather than burying them in chat history.
- Do not automatically modify `PROJECT_DIRECTION.md` or `DESIGN.md` to suit an implementation shortcut; propose product/design changes explicitly.

## 11. GitHub issue implementation workflow

For each issue:

1. **Understand.** Read the issue description, acceptance criteria, relevant project direction/design, and existing documentation. Identify scope and dependencies.
2. **Inspect.** Find related routes, components, services, schema, tests, and patterns before coding. Search for code that should be reused.
3. **Plan proportionately.** For non-trivial changes, outline the files/boundaries and relevant tests. Keep small tasks lightweight.
4. **Implement.** Work autonomously inside the approved issue scope. Make the smallest coherent change that completely meets its acceptance criteria.
5. **Verify.** Run available checks and relevant tests; review for security, scoring correctness, readability, and regressions.
6. **Document.** Update affected architecture, database, feature documentation, and README instructions where necessary.
7. **Report.** Summarize what changed, where to find it, tests actually run, and any limitations or unresolved decisions.

### Autonomy and escalation

- Decide routine implementation details independently. Do not ask permission for every component, naming choice, refactor, or dependency-free design decision.
- Ask for guidance **only** when a decision materially affects product scope, user-visible behavior not settled by the direction, security/privacy, destructive data changes, major architecture, or significant ongoing costs.
- If blocked by missing information, make a reasonable reversible assumption when safe; explicitly record it. Do not invent facts, examination rules, or legal permissions.
- Do not opportunistically add non-MVP features, redesign unrelated areas, replace the stack, or create speculative infrastructure.
- Don't change unrelated files unless truly necessary; if necessary, explain why.
- Respect existing work. Do not overwrite uncommitted user changes or run destructive Git commands without explicit authorization.
- Do not commit, push, merge, close issues, or deploy unless the current request or agreed workflow authorizes that action.

## 12. Definition of done

An issue is complete when:

- Its acceptance criteria are satisfied without violating MVP scope.
- Its code is readable, appropriately typed, properly located, and consistent with nearby modules.
- Business logic has clear ownership and the data flow can be followed by a human developer.
- Validation, authorization, privacy, and grading integrity are handled where applicable.
- Appropriate tests are added/updated and available relevant checks have been run—or blockers are explicitly reported.
- Documentation reflects meaningful changes; no dead code or abandoned scaffolding remains.
- The final report is concise and truthful about implementation and verification.

**The standard:** A competent TypeScript developer should be able to open BG Matura, find any feature, follow its connections from page to database, understand why it works that way, and safely change it without first asking an AI to decode the project.
