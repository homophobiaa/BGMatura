# Public learning pages

This batch implements #16–20 and #44–53. It reuses the existing content-format
and lesson-model work from #26/#30 (commits `78a3ac5` and `b007cb2`, by Radoslav
Mitov), included as dependencies on this branch. Their assignments and original
branches remain intact. Editorial CRUD/publishing remains separate work; this
slice never seeds or publishes educational material.

## Boundaries and data flow

`public page -> server-only published query -> selected study fields -> safe renderer`

- `literature/server/catalog.ts` lists published works and published author/genre
  facets. `authors.ts` and `works.ts` own direct public reading. A published work
  may remain visible after its author is unpublished, but its author's name/link
  disappear. Missing relations during concurrent deletion also produce no link.
- `language/server/published-lessons.ts` walks published language-topic ancestry
  from roots, excluding descendants of drafts. `lessons.ts` validates stored
  documents and requires a visible topic. The catalog omits content bodies and
  edit metadata. Malformed documents are unavailable even if SQL bypassed editors.
- No public query exposes draft previews, writes, admin notes, or grading keys.
  Publication status already exists in the schema; authenticated publication
  actions (#41) are still a separate dependency for editors.
- Reads occur per request (`connection()`), with no cross-request publication
  cache. `page-reading.ts` uses React `cache` to share each public reading between
  its metadata and page during the same request. Database availability is required
  for learning pages; the homepage and project/development information are static.

## Safe rendering

The existing [version-1 block contract](learning-content.md) is unchanged.
`src/components/learning-content.tsx` maps its headings, inline text/links, lists,
examples, and attributed quotations to semantic React elements. Unknown formats,
empty public documents, and unsafe links fail closed. Raw HTML is never executed.
Existing author/work strings stay plain text; `StudyText` renders them as text
with preserved line breaks, without imposing the block editor's text limits.
Reading width is at most 70ch, with long-word wrapping and Bulgarian typography.

## Routes, navigation, and search

| Route | Behavior |
| --- | --- |
| `/`, `/uchi` | Bulgarian preparation choices and learning hub |
| `/literatura` | Published works, URL-backed title/author search and author/genre facets |
| `/literatura/[slug]` | Author, genre, summary, themes, applicable characters, ideas, interpretation |
| `/avtori/[slug]` | Published author context and available published works |
| `/balgarski-ezik` | Published language-topic hierarchy and lesson links |
| `/balgarski-ezik/[slug]` | Validated lesson blocks with topic/return links |
| `/za-proekta` | Free anonymous access and honest written-response assessment |
| `/testove`, `/matura` | Explicit development-status entry pages; session engines are unfinished |

Literature GET filters use `q`, `author` (slug), and `genre`. Values are bounded,
trimmed, and NFC-normalized; repeated parameters become empty. Search folds public
titles and visible author names with Bulgarian Unicode lowercase in Node because
PostgreSQL C-collation ILIKE does not fold Cyrillic. This scans the small MVP
catalog; introduce indexed locale-aware search/pagination when size warrants it,
retaining the Cyrillic behavior tests.

Breadcrumbs never invent draft/missing relations. Work pages link their available
author and literature catalog; there is no work/topic relation in this schema.
Lessons link the visible topic's catalog anchor. Optional empty literary sections
are omitted. Unknown and unpublished slugs resolve to the same missing view.

The shared public shell includes current-location markers, skip-to-content,
44px controls, responsive menu, Escape/focus return, and useful footer links.
Buttons/inputs follow shadcn/ui composition with Radix Slot for link buttons;
Lucide feedback icons supplement text. `src/lib/utils.ts` contains only the
conventional class-merging helper `cn`. Native disabled/busy buttons cannot fire;
use `asChild` only for enabled navigation links. Future admin routes need their
own route-group shell rather than reusing public navigation.

## Metadata and recovery

Learning pages generate Bulgarian titles/descriptions from published data only.
Set **`SITE_URL`** to the actual application origin before building/deploying to
emit absolute canonical URLs. It accepts HTTP(S) origins without credentials,
path/query/fragment. It is intentionally optional for database-free local/CI
builds: when absent, no canonical is emitted rather than inventing a production
domain. Test runs explicitly use their loopback server origin. Filtered catalogs
canonicalize to the unfiltered catalog. Missing content has no canonical and is
marked noindex, with no draft title/description leakage.

`loading.tsx` announces loading; `error.tsx` offers retry/navigation without
rendering or logging raw error values. This Next.js release supplies `retry`, not
the older `reset` prop. `global-error.tsx` handles root-layout failures. Unknown
routes return HTTP 404; streaming dynamic pages may send HTTP 200 before a later
not-found result. The framework still supplies the missing view/noindex signal;
publication checks always happen in the server query.

## Verification

Unit tests cover HTML escaping, unsafe links/formats, metadata configuration,
filter parsing, and control states. Real PostgreSQL tests cover published-only
projections, ancestor unpublication, malformed stored blocks, and Cyrillic search
and facets, in addition to the reused lesson constraints. Browser tests use
UUID-scoped synthetic records and remove only those records, child links first.
Desktop/mobile/tablet Chromium exercises the production build: navigation,
filter URLs, author/work/topic/lesson links, draft slugs, metadata, semantic blocks,
keyboard access, and long text without overflow. Temporary local QA also exercises
loading, database failure/retry, empty catalogs, and visual layouts.
