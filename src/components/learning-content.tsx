import { learningContentSchema, type LearningContent as LearningDocument } from "@/features/learning/content";

type Inline = Extract<LearningDocument["blocks"][number], { type: "paragraph" }>["content"][number];

function InlineText({ content }: { content: Inline[] }) {
  return <>{content.map((inline, index) => inline.type === "text" ? inline.text :
    <a key={index} className="text-primary underline underline-offset-4" href={inline.href}>{inline.text}</a>)}</>;
}

/** Render only validated blocks as React text nodes. Raw HTML is never interpreted. */
export function LearningContent({ content }: { content: unknown }) {
  const parsed = learningContentSchema.safeParse(content);
  if (!parsed.success || parsed.data.blocks.length === 0) return <p role="status">Материалът временно не е достъпен.</p>;

  return (
    <div className="learning-content max-w-reading space-y-6 font-serif text-body-lg">
      {parsed.data.blocks.map((block, index) => {
        switch (block.type) {
          case "heading":
            return block.level === 2 ? <h2 key={index}>{block.text}</h2> : <h3 key={index}>{block.text}</h3>;
          case "paragraph":
            return <p key={index} className="whitespace-pre-wrap"><InlineText content={block.content} /></p>;
          case "list": {
            const List = block.ordered ? "ol" : "ul";
            return <List key={index} className={block.ordered ? "list-decimal space-y-2 pl-6" : "list-disc space-y-2 pl-6"}>
              {block.items.map((item, itemIndex) => <li key={itemIndex}><InlineText content={item} /></li>)}
            </List>;
          }
          case "example":
            return <aside key={index} aria-label={block.title} className="rounded-lg bg-surface-soft p-6">
              <p className="mb-2 font-sans text-label text-muted">{block.title}</p>
              <p className="whitespace-pre-wrap"><InlineText content={block.content} /></p>
            </aside>;
          case "quotation":
            return <figure key={index} className="border-l-2 border-border-control pl-6">
              <blockquote className="whitespace-pre-wrap"><InlineText content={block.content} /></blockquote>
              {block.attribution && <figcaption className="mt-2 font-sans text-caption text-muted">{block.attribution}</figcaption>}
            </figure>;
        }
      })}
    </div>
  );
}

/** Existing author/work fields are plain text; they share the same safe renderer. */
export function StudyText({ text }: { text: string }) {
  return <p className="study-text max-w-reading whitespace-pre-wrap font-serif text-body-lg">{text}</p>;
}
