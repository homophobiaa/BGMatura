# Admin learning editors

Issues #24, #32, #34, #36, #38, #39, #43 and #56. The editor pages are the frontend
for the server contracts in [editorial-operations.md](editorial-operations.md).
They add no new write path: every change still goes through
`POST /api/admin/learning/[kind]`, which authorizes, validates and refreshes pages.

## Where things live

| Part | File | Owns |
| --- | --- | --- |
| Shell | `src/app/admin/(editorial)/layout.tsx` | Identity, sign-out, „Редакторски режим“ label, navigation |
| Page guard | `src/features/admin/server/page-authorization.ts` | `requireAdminPage()`: authorize or redirect to sign-in. Every page calls it, not only the layout |
| Lists | `src/app/admin/(editorial)/learning/[kind]/page.tsx`, `src/features/admin/server/learning-lists.ts` | Search, status filter, 20 per page, delete control |
| Filters | `src/features/admin/learning-list-filters.ts` | Reads `q`, `status`, `page` from the URL; builds links that keep them |
| Editors | `src/app/admin/(editorial)/learning/[kind]/new` and `[id]`, `src/features/admin/components/*-form.tsx` | One form per kind |
| Save/publish state | `src/features/admin/components/use-editorial-editor.ts` | Sends commands, keeps `expectedUpdatedAt`, blocks double submits |
| Shared frame | `src/features/admin/components/editor-frame.tsx` | Status, feedback, save button, preview/publish/unpublish |
| Client API | `src/features/admin/components/editorial-request.ts` | `fetch` + typed response parsing |
| Messages | `src/features/admin/editorial-messages.ts` | Bulgarian text for the services' English messages |

The route group `(editorial)` keeps `/admin/sign-in` outside the protected layout
without changing any URL. `/admin/preview/...` moved into the group unchanged.

## Flow

`Form → useLearningEditor.save → POST /api/admin/learning/[kind] → requireAdmin + origin check →
save*Draft service → Prisma transaction → { record } or { error, message, fields } → form`

- **Create** saves a draft, then replaces the URL with the edit page (`?created=1`).
- **Edit** sends the last `updatedAt` it saw. A stale save gets a conflict and asks
  the editor to reload instead of overwriting someone else's change.
- **Validation** errors come back as field paths (`themes.1`, `content.blocks.2.content.0.text`).
  `fieldMessages` shows them under the matching field or lesson block. Entered values stay.
- **Publish** is disabled while there are unsaved changes, so what is published is
  always the saved, previewed version. Missing publication fields are shown per field.
- **Published records are read-only.** Unpublish needs a second, explicit confirmation.
- **Delete** is offered only for drafts in the list, and needs the slug typed in.
  Linked or published records show the server's reason and a link to the record.
  After deletion the list reloads with the same filters and a `deleted` notice.

## Editing formats

- Slugs: „Предложи от заглавието“ uses the official Bulgarian transliteration
  (`src/features/admin/slug.ts`). Editors can always type their own.
- Work themes, characters and important ideas: one item per line.
- Lessons are a list of blocks (paragraph, heading, list, example, quotation) that can
  be added, moved and removed. Inline links are written `[текст](/адрес)` and converted
  by `src/features/admin/inline-text.ts`; whitespace between two links is attached to
  the first link because stored text parts may not be blank.

## Not here yet

Question and exam editors (#70–#76, #100–#106) will add their own entries to
`AdminNavigation`. There is no autosave and no rich-text editor.

## Verification

- Unit: slug transliteration, inline links, lesson block round-trips, list filters, messages.
- Integration: `tests/integration/admin-learning-lists.test.ts` (authorization, search,
  status filter, pagination and page clamping, editor choices).
- Browser: `tests/browser/admin-editor.spec.ts` creates, validates, publishes, unpublishes
  and deletes through the real pages on desktop, mobile and tablet. Its tests run serially
  because they share one allowlisted editor account per project.
