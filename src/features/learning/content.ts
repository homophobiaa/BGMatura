import { z } from "zod";

/** Only explicit web links and same-site paths; never interpret editorial HTML. */
export function isSafeContentLink(value: string): boolean {
  if (/[\s\\\u0000-\u001f\u007f]/u.test(value)) return false;
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password;
  } catch {
    return false;
  }
}

const text = z.string().max(10000).refine((value) => value.trim().length > 0, "Text must not be blank.");
const inlineSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("text"), text }),
  z.strictObject({ type: z.literal("link"), text, href: z.string().max(2048).refine(isSafeContentLink, "Use an http(s) URL or a same-site path.") }),
]);
const inlines = z.array(inlineSchema).min(1).max(100);

/** Versioned, deliberately small structured editor format. Empty blocks are valid drafts. */
export const learningContentSchema = z.strictObject({
  version: z.literal(1),
  blocks: z.array(z.discriminatedUnion("type", [
    z.strictObject({ type: z.literal("paragraph"), content: inlines }),
    z.strictObject({ type: z.literal("heading"), level: z.union([z.literal(2), z.literal(3)]), text }),
    z.strictObject({ type: z.literal("list"), ordered: z.boolean(), items: z.array(inlines).min(1).max(100) }),
    z.strictObject({ type: z.literal("example"), title: text, content: inlines }),
    z.strictObject({ type: z.literal("quotation"), content: inlines, attribution: text }),
  ])).max(500),
});

export type LearningContent = z.infer<typeof learningContentSchema>;
