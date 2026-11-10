import { z } from "zod";
import type { NextRequest } from "next/server";
import { parseAttemptInput } from "@/features/attempts/server/errors";
import { attemptResponse, createdAttemptResponse, requireAttemptOrigin } from "@/features/attempts/server/http";
import { startExam, startPractice } from "@/features/attempts/server/start";
import { readBoundedJson } from "@/server/http";

const start = z.discriminatedUnion("mode", [
  z.strictObject({ mode: z.literal("practice"), topicId: z.uuid() }),
  z.strictObject({ mode: z.literal("exam"), examId: z.uuid() }),
]);

export function POST(request: NextRequest) {
  return attemptResponse(async () => {
    const origin = requireAttemptOrigin(request);
    const command = parseAttemptInput(start, await readBoundedJson(request));
    const attempt = command.mode === "practice"
      ? await startPractice({ topicId: command.topicId })
      : await startExam({ examId: command.examId });
    return createdAttemptResponse(attempt, origin);
  });
}
