import "server-only";

import type { z } from "zod";

type AttemptErrorCode = "not-found" | "invalid" | "no-questions" | "closed" | "conflict" | "origin" | "unavailable";

export class AttemptError extends Error {
  constructor(public readonly code: AttemptErrorCode) {
    super(code);
  }
}

export function parseAttemptInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new AttemptError("invalid");
  return parsed.data;
}
