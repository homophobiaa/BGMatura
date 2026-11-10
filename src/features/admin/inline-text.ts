import type { LearningContent } from "@/features/learning/content";

type Inline = Extract<LearningContent["blocks"][number], { type: "paragraph" }>["content"][number];

/**
 * Editors type lesson text as plain text where links are written as [text](address).
 * These two functions convert between that text and the stored inline format.
 * A literal "[x](y)" in plain text is therefore always read as a link.
 */
const linkPattern = /\[([^\]\n]+)\]\(([^)\s]+)\)/g;

export function inlinesToText(inlines: readonly Inline[]): string {
  return inlines.map((inline) => inline.type === "link" ? `[${inline.text}](${inline.href})` : inline.text).join("");
}

export function textToInlines(text: string): Inline[] {
  const inlines: Inline[] = [];
  let position = 0;
  for (const match of text.matchAll(linkPattern)) {
    appendText(inlines, text.slice(position, match.index));
    inlines.push({ type: "link", text: match[1] ?? "", href: match[2] ?? "" });
    position = match.index + match[0].length;
  }
  appendText(inlines, text.slice(position));
  return inlines;
}

/** Stored text must not be blank, so whitespace between links joins the previous part. */
function appendText(inlines: Inline[], text: string) {
  if (!text) return;
  const previous = inlines.at(-1);
  if (!text.trim()) {
    if (previous) previous.text += text;
    return;
  }
  if (previous?.type === "text") previous.text += text;
  else inlines.push({ type: "text", text });
}
