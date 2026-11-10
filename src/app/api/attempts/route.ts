import { z } from "zod";
import type { NextRequest } from "next/server";
import { parseAttemptInput } from "@/features/attempts/server/errors";
import { attemptResponse, createdAttemptResponse, requireAttemptOrigin } from "@/features/attempts/server/http";
import { startExam, startPractice } from "@/features/attempts/server/start";
import { getSignedInUser } from "@/features/admin/server/authorization";
import { getDatabase } from "@/server/database";
import { readBoundedJson } from "@/server/http";

const start = z.discriminatedUnion("mode", [
  z.strictObject({ mode: z.literal("practice"), topicId: z.uuid() }),
  z.strictObject({ mode: z.literal("exam"), examId: z.uuid() }),
]);

export function POST(request: NextRequest) {
  return attemptResponse(async () => {
    const origin = requireAttemptOrigin(request);
    const command = parseAttemptInput(start, await readBoundedJson(request));
    // Starting while signed in links the attempt to the student; no account, or sign-in being down, never blocks it.
    const userId = (await getSignedInUser(request.headers).catch(() => null))?.id;
    const attempt = command.mode === "practice"
      ? await startPractice({ topicId: command.topicId }, getDatabase(), userId)
      : await startExam({ examId: command.examId }, getDatabase(), userId);
    return createdAttemptResponse(attempt, origin);
  });
}
