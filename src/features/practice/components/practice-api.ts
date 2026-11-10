import { z } from "zod";
import type { SubmittedAnswer } from "@/features/questions/types";
import { attemptQuestionSchema, attemptViewSchema, type AttemptQuestionView, type AttemptView } from "../attempt-view";

/** Browser calls to the attempt API. The HttpOnly cookie travels with them automatically. */
export type ApiResult<T> = { ok: true; value: T } | { ok: false; code: string; message: string };

const failureSchema = z.object({ error: z.string(), message: z.string() });
const offline = { ok: false as const, code: "network", message: "Няма връзка със сървъра. Провери интернета и опитай отново." };
const unexpected = { ok: false as const, code: "unexpected", message: "Отговорът на сървъра е неочакван. Презареди страницата." };

async function call<T>(path: string, init: RequestInit, schema: z.ZodType<T>): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(path, { ...init, cache: "no-store", ...(init.body ? { headers: { "Content-Type": "application/json" } } : {}) });
  } catch {
    return offline;
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const failure = failureSchema.safeParse(body);
    return failure.success ? { ok: false, code: failure.data.error, message: failure.data.message } : unexpected;
  }
  const parsed = schema.safeParse(body);
  return parsed.success ? { ok: true, value: parsed.data } : unexpected;
}

export function startPracticeAttempt(topicId: string) {
  return call("/api/attempts", { method: "POST", body: JSON.stringify({ mode: "practice", topicId }) }, z.object({ id: z.uuid() }));
}

export function readPracticeAttempt(attemptId: string): Promise<ApiResult<AttemptView>> {
  return call(`/api/attempts/${attemptId}`, { method: "GET" }, attemptViewSchema);
}

export function submitPracticeAnswer(attemptId: string, answer: SubmittedAnswer, expectedRevision: number): Promise<ApiResult<AttemptQuestionView>> {
  return call(`/api/attempts/${attemptId}`, { method: "POST", body: JSON.stringify({ operation: "save", answer, expectedRevision }) }, attemptQuestionSchema);
}

export function savePracticePosition(attemptId: string, position: number, expectedPosition: number) {
  return call(`/api/attempts/${attemptId}`, { method: "POST", body: JSON.stringify({ operation: "position", position, expectedPosition }) }, z.object({ position: z.number() }));
}

export function finishPracticeAttempt(attemptId: string): Promise<ApiResult<AttemptView>> {
  return call(`/api/attempts/${attemptId}`, { method: "POST", body: JSON.stringify({ operation: "finish" }) }, attemptViewSchema);
}
