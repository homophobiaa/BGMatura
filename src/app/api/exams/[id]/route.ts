import { z } from "zod";
import { AttemptError, parseAttemptInput } from "@/features/attempts/server/errors";
import { attemptJson, attemptResponse } from "@/features/attempts/server/http";
import { findPublicExam } from "@/features/exams/server/catalog";

export function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return attemptResponse(async () => {
    const id = parseAttemptInput(z.uuid(), (await context.params).id);
    const exam = await findPublicExam(id);
    if (!exam) throw new AttemptError("not-found");
    return attemptJson(exam);
  });
}
