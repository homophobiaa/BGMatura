import { z } from "zod";
import type { LearningKind } from "@/features/learning/kinds";
import { translateEditorialMessage } from "../editorial-messages";

/** Client side of the editorial API: one place that sends commands and reads the typed response. */
export type EditorialFailure = { ok: false; error: string; message: string; fields: Record<string, string[]> };
export type EditorialResult<T> = { ok: true; record: T } | EditorialFailure;

export type LearningCommand =
  | { operation: "save"; draft: Record<string, unknown> }
  | { operation: "publish" | "unpublish"; id: string }
  | { operation: "delete"; id: string; confirmation: string };

const failureSchema = z.object({
  error: z.string(),
  message: z.string(),
  fields: z.record(z.string(), z.array(z.string())).optional(),
});

export const savedRecordSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  status: z.enum(["DRAFT", "PUBLISHED"]),
  updatedAt: z.string(),
});
export type SavedRecord = z.infer<typeof savedRecordSchema>;

const networkFailure: EditorialFailure = { ok: false, error: "network", message: "Няма връзка със сървъра. Провери интернета и опитай отново.", fields: {} };

export async function sendLearningCommand<T>(kind: LearningKind, command: LearningCommand, recordSchema: z.ZodType<T>): Promise<EditorialResult<T>> {
  let response: Response;
  try {
    response = await fetch(`/api/admin/learning/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(command),
    });
  } catch {
    return networkFailure;
  }
  const body: unknown = await response.json().catch(() => null);
  if (response.ok) {
    const parsed = z.object({ record: recordSchema }).safeParse(body);
    if (parsed.success) return { ok: true, record: parsed.data.record };
    return { ok: false, error: "unavailable", message: "Отговорът на сървъра е неочакван. Презареди страницата.", fields: {} };
  }
  const failure = failureSchema.safeParse(body);
  if (!failure.success) return { ok: false, error: "unavailable", message: "Операцията не бе изпълнена. Опитай отново.", fields: {} };
  return { ok: false, error: failure.data.error, message: translateEditorialMessage(failure.data.message), fields: failure.data.fields ?? {} };
}
