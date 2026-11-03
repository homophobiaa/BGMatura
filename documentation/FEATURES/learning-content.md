# Structured learning content

Decision for #26: store a small **versioned JSON block document**, validated by
`src/features/learning/content.ts`. A structured form edits these blocks in the
future lesson editor. This avoids asking editors to write HTML and keeps the
supported language small enough to validate at server write/read boundaries.

Markdown is familiar but needs a parser, HTML policy, and editor conventions;
a full rich-text editor/CMS adds dependencies and arbitrary document nodes.
Neither is needed for the MVP's headings, rules, examples, and quotations.
The chosen block form needs no upload system or general-purpose CMS.

## Version 1 contract

- Document: `{ version: 1, blocks: [...] }`, in reading order. An empty document
  is valid for a draft, not evidence that a lesson is publishable.
- `heading`: level 2 or 3 and plain `text`. The page owns the single h1.
- `paragraph`: `content` containing text/link inlines.
- `list`: `ordered` plus an ordered array of inline arrays (`items`).
- `example`: plain `title` and inline `content`; render as a labeled example.
- `quotation`: inline `content` and mandatory plain `attribution`.
- Inline text is `{ type: "text", text: "..." }`; a link is
  `{ type: "link", text: "...", href: "..." }`. No nested links or markup.

Unknown fields, raw HTML blocks, embeds, images, scripts, custom styles, and
unsupported versions are rejected. Size/count limits bound each document.
Text preserves Bulgarian spelling, punctuation, and whitespace. Render it as
React text, never `dangerouslySetInnerHTML`, including text that resembles HTML.
URLs allow http(s) without credentials and root-relative paths. Scheme-relative
URLs, backslashes, controls/whitespace, javascript/data/file/mailto schemes, and
URL credentials are rejected. Links are ordinary same-tab anchors; URL safety
does not certify a source's accuracy, rights, or continued availability.

Authenticated editors validate incoming documents server-side before persistence;
public reads parse stored JSON again and fail closed on unsupported formats.
The renderer (#52) must map these nodes to semantic h2/h3, p, ol/ul/li, aside,
blockquote/cite, and a elements, using the shared Bulgarian typography and
wrapping long words/URLs. No arbitrary HTML sanitization is necessary because
HTML is never interpreted. Existing literary plain-text fields remain plain
text; do not reinterpret them as this format or silently migrate them.

## Example draft lesson

Synthetic unverified illustration, not study material and not seeded/published:

```json
{
  "version": 1,
  "blocks": [
    { "type": "heading", "level": 2, "text": "Демонстрационен раздел" },
    { "type": "paragraph", "content": [{ "type": "text", "text": "Тук редакторът записва провереното правило." }] },
    { "type": "example", "title": "Пример", "content": [{ "type": "text", "text": "Тук се добавя проверен пример." }] },
    { "type": "list", "ordered": false, "items": [[{ "type": "text", "text": "Ключова стъпка" }]] },
    { "type": "quotation", "content": [{ "type": "text", "text": "Тук се добавя разрешен цитат." }], "attribution": "Източник и автор" },
    { "type": "paragraph", "content": [{ "type": "link", "text": "Начало", "href": "/" }] }
  ]
}
```

Publication completeness, editorial review, UI forms, and the public renderer
remain their own issues. Changing the structure requires a new version plus a
deliberate reader/migration strategy, rather than changing the meaning of v1.
