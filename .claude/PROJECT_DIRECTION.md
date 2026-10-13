# BG Matura — Project Direction

> **Status:** Product direction v1.0  
> **Last updated:** 2026-10-13  
> **Purpose:** Define what BG Matura is, who it serves, what the first release must accomplish, and the boundaries that keep implementation focused. This document is the source of truth for planning features and creating GitHub issues. It is **not** an implementation guide, coding-style guide, or agent instruction file.

## 1. Product at a glance

**BG Matura** is a Bulgarian-language web platform for preparing for the 12th-grade **Държавен зрелостен изпит по български език и литература (ДЗИ по БЕЛ)**.

Its value is to bring **studying, practicing, realistic exam simulation, and understandable feedback** into one straightforward, modern place. Students should be able to use the core experience for free and without mandatory registration.

**Product promise:** A student can find what to study, practice it, take a representative exam, and understand what they got right or wrong.

**Initial audience:** Bulgarian 12th-grade students preparing for the БЕЛ matura. The product should also be useful for earlier revision, but this is not an independent MVP audience.

**Initial scope:** БЕЛ only. Other subjects and exams are excluded.

**Target:** Work toward a usable release for preparation ahead of the **May 2027** exam period; this is a planning target, not a hard delivery promise.

## 2. Guiding principles

1. **Exam preparation first.** Every major feature must directly help a student learn, practice, simulate, or review БЕЛ exam material.
2. **Accuracy over volume.** A smaller, verified question bank with clear explanations beats thousands of unreliable or AI-generated items.
3. **Start without friction.** Public lessons, questions, and practice should be accessible without student signup.
4. **Explain, don't just score.** Feedback must help users understand their mistakes.
5. **Honest assessment.** Do not present self-assessed or ungraded written work as if it received an official score.
6. **One coherent system.** Practice tests and simulated exams share a reusable question bank and grading foundation.
7. **Content is manageable without code.** Admins must be able to add and maintain core learning material and questions via an admin panel.
8. **Keep the MVP narrow.** Avoid engagement gimmicks, AI features, and extra products until the core loop works.
9. **Mobile-friendly and fast.** Usable on a phone, comfortable on desktop, with readable Bulgarian typography.
10. **Design for change without premature complexity.** Keep clean separation of concerns while avoiding microservices and speculative abstractions.

## 3. The core student journey

1. Student opens BG Matura and immediately sees the learning and practice options.
2. Student browses **Литература** or **Български език** to study a specific topic.
3. Student starts a topic-based interactive practice test.
4. After each practice answer, the student sees whether it is correct and why.
5. Student can take a timed **Пробна матура** with exam-style navigation and delayed feedback.
6. Student submits and reviews a result containing scores where grading is reliable, unanswered/ungraded items, correct answers where applicable, and explanations.
7. Student can return to the relevant lessons and try again.

**MVP core loop:** **Learn → Practice → Get feedback → Simulate exam → Review mistakes → Learn again.**

The MVP does **not** need user accounts, long-term personalized analytics, or automated recommendations to deliver this loop.

## 4. Confirmed MVP capabilities

All seven areas below are **in scope**. The support behaviors in each section are part of making them useful, not separate product expansions.

### 4.1 Каталог с произведения — literature catalog

- Browse literary authors and works relevant to the current БЕЛ curriculum and exam specification.
- Author entries with essential context and linked works.
- Work entries with structured study material: author, genre, summary, key themes, characters where applicable, important ideas, and interpretation notes.
- Clear cross-links between authors, works, and related material.
- Find content through simple search, filtering, or well-organized navigation.
- Admins can create, edit, and publish entries.

**Not required:** Full book hosting, audio narration, user annotations, sophisticated semantic search.

### 4.2 Български език — language learning

- Browse language topics and subtopics relevant to the БЕЛ exam.
- Read concise lessons containing rules, explanations, and illustrative examples.
- Move from lessons into related questions/practice.
- Admins can create, edit, and publish lessons and topic organization.

**Not required:** A full Bulgarian grammar encyclopedia, video courses, automated writing tutor.

### 4.3 Интерактивни тестове — practice tests

- Start practice by topic/category, based on a shared question bank.
- Answer supported question types through an intuitive interface.
- Receive immediate grading when an answer can be assessed reliably.
- Navigate the session and finish it with a clear summary.
- Support repeated practice; no student account required.

**Not required:** Adaptive testing, spaced repetition, streaks, global rankings.

### 4.4 Обяснения към отговорите — answer explanations

- Every automatically graded question intended for public use has a correct answer/accepted-answer definition and a meaningful explanation.
- Practice mode shows feedback after the answer; exam mode delays feedback until submission.
- Explain the correct reasoning, not merely show a green/red indicator.
- Where a question cannot be objectively auto-graded, clearly explain the limitation and provide appropriate reference guidance instead.

### 4.5 Пробна матура — exam simulation

- Offer curated, explicitly labeled **practice exam sets** built from the shared question bank.
- Provide an exam-like experience with a timer, question navigation, ability to revisit answers, and final submission.
- Keep exam answers and correct answers hidden until the attempt is submitted.
- Preserve an active attempt across accidental refreshes or navigation where feasible, without relying on registration.
- Align the exam composition, duration, and scoring with the **official specification applicable to the targeted exam year**, not hard-coded assumptions about previous years.
- Clearly distinguish **official past papers**, **adapted questions**, and **original practice exams** when such material is used.

**Not required:** Automated creation of unlimited randomized exams or an official-equivalent certification of performance.

### 4.6 Резултати — results and review

- Show an attempt summary: questions answered, correct/incorrect where determinable, scored points, and ungraded/pending-self-review components.
- Allow question-by-question review with the user's submitted answer, reference/correct answer where relevant, and explanation.
- Show an honest scoring basis: if essays or extended responses are not professionally graded, do **not** pretend the user has a complete official 100-point result.
- Let the student return to related lessons or begin another attempt.
- Protect results against casual enumeration: session-bound access or unguessable result links; do not expose answer details to unrelated visitors.

**Not required:** Persistent cross-device history, accounts, progress dashboards, percentile rankings, predictive exam grades.

### 4.7 Административен панел — admin panel

- Private, server-authorized admin access.
- Create, read, update, draft, preview, publish/unpublish core content: authors, works, topics, lessons, questions, and exams.
- For questions, manage prompt, type, options/accepted answers, points, topic links, explanation, and status.
- For exam sets, choose questions, define order and applicable scoring, and preview before publication.
- Validate data and prevent incomplete or malformed public content.
- Support basic filtering/search for managing growing content.

**Not required:** Multi-organization CMS, editorial approval workflow, complex role hierarchy, bulk AI content generation.

## 5. Exam and scoring integrity

The platform must be **exam-informed**, not merely a collection of generic quizzes.

- Use the official МОН curriculum, exam model/specification, and scoring criteria for the relevant school year as editorial references.
- Treat the exact question counts, point distribution, exam duration, and task types as **versioned exam configuration**, subject to yearly verification.
- Support a future-proof content model for multiple-choice, short response, extended response, and argumentative writing, even if only some types can be automatically scored at launch.
- **Objective answers:** grade deterministically on the server.
- **Short free text:** only auto-grade when the accepted-answer rules are explicit and reliable; normalization must not silently change meaning.
- **Extended responses and essays:** provide prompts, reference guidance, and transparent self-review or ungraded status in the MVP. No fake machine-assigned official scores.
- Preserve the original question/scoring version used in an attempt so editing content later does not rewrite old results.
- Review usage rights and attribution before republishing official questions, passages, or other copyrighted material.

## 6. Technical direction (decisions, not coding instructions)

| Area | Direction |
| --- | --- |
| App architecture | **One full-stack Next.js application** using the App Router |
| Language | **TypeScript** |
| Frontend | React via Next.js |
| Styling | Tailwind CSS and shadcn/ui |
| Database | **PostgreSQL** |
| ORM | **Prisma** |
| Input validation | Zod |
| Forms | React Hook Form when appropriate |
| Server features | Next.js Server Components, Server Actions, and Route Handlers as appropriate |
| Authentication | **Admin authentication required**; student authentication **not required for MVP** |
| Hosting direction | Managed Next.js hosting and managed PostgreSQL; Vercel is a likely option, not an irreversible commitment |

**Architectural principles:**

- No separate ASP.NET backend for this project.
- No unnecessary microservices or independently deployed API at MVP stage.
- Keep database access, grading, authorization, and privileged operations server-side.
- Do not expose correct answers before exam submission.
- Public learning pages should be fast, indexable, and SEO-friendly.
- Structure the app so content, questions, exam attempts, and presentation are separable concerns.
- Secure admin mutations server-side, regardless of what the UI hides.

## 7. Conceptual data domains

These are **planning entities**, not a frozen physical schema or instruction to make exactly one table per item.

**Learning content**
- Authors
- Literary works
- Language/literature topics and subtopics
- Lessons/content blocks

**Assessment**
- Questions and question types
- Answer options or accepted-answer rules
- Question-to-topic/work associations
- Exam definitions and ordered exam questions
- Grading criteria, explanations, publication/source metadata

**Sessions and results**
- Practice/exam attempts
- Submitted answers
- Scoring/evaluation status and result access
- Version/snapshot information necessary to keep submitted results stable

**Administration**
- Admin identity/session and permissions
- Draft/published status
- Created/updated metadata

A question may belong to multiple topics. Practice tests and exams should use the same bank, not duplicate question records. The schema must handle both objectively graded and ungraded written responses.

## 8. Public information architecture

**Proposed user-facing routes** (labels and exact URLs may be refined during design):

- `/` — homepage / entry into preparation
- `/literatura` — works catalog
- `/avtori/[slug]` — author details
- `/literatura/[slug]` — work details
- `/balgarski-ezik` — language topics
- `/balgarski-ezik/[slug]` — lesson details
- `/testove` — choose practice topic
- `/testove/[id]` — practice session
- `/matura` — available simulations
- `/matura/[id]` — exam session
- `/rezultati/[id]` — result review
- `/admin/*` — protected editorial dashboard

The public product is **in Bulgarian**. Route slugs and internal code conventions may use Latin characters for developer ergonomics.

## 9. Content strategy and minimum launch quality

**Content quality is the principal product risk.** The website is not useful if its question bank is small, wrong, inconsistent, or poorly explained.

- Build an admin-first workflow that makes producing accurate content practical.
- Start with representative coverage of both literature and language, rather than filling just one category.
- Each published question should have an owner/editorial source, topic tagging, a confirmed answer or appropriate assessment guidance, and an explanation.
- Review materials against the current official exam model.
- Avoid publishing unreviewed generated content.
- Label original content versus materials adapted from external sources.

**Initial content planning target (not a contractual release gate):** approximately **100–200 reviewed questions**, core literature entries, key Bulgarian language lessons, and enough carefully assembled exam material to exercise the simulation feature. Coverage and correctness outrank arbitrary quotas.

## 10. UX direction

- Modern, calm, simple, and student-focused — not a generic school portal.
- Bulgarian navigation, plain language, short paths to useful action.
- Responsive/mobile-friendly layout, without compromising desktop exam-taking.
- Visual clarity for answers, corrections, and remaining exam time.
- Accessible contrast, keyboard support, and readable content formatting.
- No mandatory sign-up wall for learning or practice.
- Do not gamify everything or bury learning under dashboards and animations.

The main navigation should make **Учи**, **Тестове**, and **Пробна матура** easy to find, with literature and language content discoverable from learning pages.

## 11. Explicitly out of scope for MVP

Do **not** create MVP GitHub issues for the following unless scope is deliberately revised:

- Other matura subjects; lower-grade exams
- Student registration, permanent profiles, cross-device history, and long-term progress analytics
- Personalized/adaptive learning, weak-topic recommendations, revision planning
- AI-generated questions, AI essays scoring, AI chatbot/tutor
- Flashcards, spaced repetition, streaks, achievements, leaderboards
- Payments, subscriptions, advertising, monetization
- Teacher accounts, classrooms, school management
- Native mobile apps, social sharing/community features
- Audio/video courses, full book hosting
- Elaborate analytics dashboards, microservices, unnecessary external APIs

These may be considered **post-MVP opportunities**, not implied MVP requirements.

## 12. Delivery milestones and outcomes

These milestones are **outcome-based planning units** for later conversion into GitHub epics/issues. They are not prescriptive task tickets.

### M1 — Working foundation

**Outcome:** A deployable Next.js application connected to PostgreSQL, with the basic site shell and protected admin entry.

Includes foundational project setup, database/migration workflow, authorization boundary, and public/admin layout.

**Done when:** An admin can securely access an admin area; public pages load; the app can perform a server-side database operation in development and a representative hosted environment.

### M2 — Publishable learning content

**Outcome:** Editors can publish structured Bulgarian language and literature content that students can navigate and read.

Includes author/work relationships, topics, lessons, content forms, publishing, and public browsing/search.

**Done when:** An admin can create and publish a complete author/work entry and a language lesson; a student can discover and read both on mobile or desktop.

### M3 — Question bank and practice engine

**Outcome:** Editors create high-quality questions; students answer them in interactive topic-based tests and receive useful explanations.

Includes question types, admin question editor, validation, topic links, presentation, answer submission, deterministic grading, and practice feedback.

**Done when:** An admin creates and publishes a supported question; a student can find it through relevant practice, answer, and see accurate feedback and explanation.

### M4 — Exam simulation and review

**Outcome:** A student completes a timed practice matura using the shared bank and reviews an honest result.

Includes curated exam sets, ordering, timer, navigation, safe answer persistence, submission, grading status, and per-question result review.

**Done when:** A student can finish a representative mixed-question exam, recover from a refresh, submit once, and view correct/incorrect/ungraded distinctions without premature answer disclosure.

### M5 — Content completion, verification, and public release

**Outcome:** A stable, polished, useful free MVP is publicly available with trustworthy exam-relevant content.

Includes editorial QA, representative coverage, mobile/desktop testing, admin/security testing, performance, indexing metadata, basic operational readiness, and deployment.

**Done when:** The public experience works end-to-end; content has been checked against current materials; the platform has enough meaningful content to practice and simulate exams; critical flows are not broken.

## 13. How to derive GitHub issues from this document

Another AI or contributor can translate this direction into GitHub issues using these rules:

1. **Use M1–M5 as milestone/epic groupings.** Break them into reasonably sized, independently verifiable issues.
2. **Map every issue to a specific requirement or enabling dependency** in this document. If it cannot be mapped, challenge whether it is MVP scope.
3. **State an observable outcome and acceptance criteria** for each issue. Avoid vague tickets like “build backend” or “improve UI.”
4. **Declare dependencies** only where necessary (e.g. questions before practice sessions, practice/attempt foundations before exams).
5. **Separate content entry from feature implementation.** “Build the lesson editor” and “write/review Bulgarian grammar lessons” are different deliverables.
6. **Do not silently decide open product questions.** Surface materially different choices as explicit decisions before creating dependent work.
7. **Prioritize one vertical slice early:** admin creates a question → it is stored/published → student answers → server grades → explanation appears.
8. **Preserve boundaries and non-goals.** Do not turn optional future enhancements into required issues.
9. **Test actual behavior.** Cover grading correctness, answer visibility, result privacy, admin authorization, exam recovery, and content publication.
10. **Keep technology versions and code conventions out of the project direction.** Those belong in a later technical design and `CLAUDE.md`.

**Suggested issue fields:** title, objective, user/admin scenario, scope, acceptance criteria, dependencies, priority, milestone, and out-of-scope notes (when useful).

## 14. Decisions deliberately left open

These choices should be resolved close to implementation rather than asserted as product facts:

- Exact admin authentication provider/implementation.
- Exact hosting provider and database service.
- Whether question/exam attempts use database-backed anonymous sessions, signed tokens, or a hybrid; required properties are privacy, persistence, and refresh recovery.
- Final physical database schema and content-editor approach (Markdown/rich text).
- Details of short-answer normalization and which written items can be graded reliably.
- How essays and ungraded written responses are entered and reviewed in the first public exam UI.
- Exact official exam blueprint for the target year, subject to verification of current МОН materials.
- Final visual identity and exact navigation wording.

These are **open implementation/product details**, not permission to expand the MVP.

## 15. Scope-change rule

A proposed new feature should answer **yes** to at least one of:

- Is it necessary for the core Learn → Practice → Simulate → Review loop?
- Is it necessary to safely and accurately publish/administer that loop?
- Is it necessary for a minimally usable public release?

If not, put it in a post-MVP backlog. If a new feature conflicts with the explicit exclusions in §11, amend this file deliberately before treating it as MVP work.

---

**One-sentence north star:** *BG Matura helps Bulgarian students prepare for the БЕЛ matura through accurate study material, interactive practice, realistic exam simulations, and clear explanations — with minimal friction and no misleading scores.*
