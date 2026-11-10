import { z } from "zod";
import type { NextRequest } from "next/server";
import { parseAttemptInput } from "@/features/attempts/server/errors";
import { attemptAccess, attemptJson, attemptResponse, requireAttemptOrigin } from "@/features/attempts/server/http";
import { claimAttempt, finishAttempt, readAttempt, saveAttemptAnswer, saveAttemptPosition } from "@/features/attempts/server/session";
import { getSignedInUser } from "@/features/admin/server/authorization";
import { privateHeaders, readBoundedJson } from "@/server/http";

type Context = { params: Promise<{ id: string }> };
const action = z.discriminatedUnion("operation", [
  z.strictObject({ operation: z.literal("save"), answer: z.unknown(), expectedRevision: z.unknown() }),
  z.strictObject({ operation: z.literal("position"), position: z.unknown(), expectedPosition: z.unknown() }),
  z.strictObject({ operation: z.literal("finish") }),
  z.strictObject({ operation: z.literal("claim") }),
]);

export function GET(request: NextRequest, context: Context) {
  return attemptResponse(async () => attemptJson(await readAttempt(attemptAccess(request, (await context.params).id))));
}

export function POST(request: NextRequest, context: Context) {
  return attemptResponse(async () => {
    requireAttemptOrigin(request);
    const access = attemptAccess(request, (await context.params).id);
    const command = parseAttemptInput(action, await readBoundedJson(request));
    switch (command.operation) {
      case "save": return attemptJson(await saveAttemptAnswer(access, { answer: command.answer, expectedRevision: command.expectedRevision }));
      case "position": return attemptJson(await saveAttemptPosition(access, { position: command.position, expectedPosition: command.expectedPosition }));
      case "finish": return attemptJson(await finishAttempt(access));
      case "claim": {
        const user = await getSignedInUser(request.headers).catch(() => null);
        if (!user) return Response.json({ error: "sign-in-required", message: "Влез, за да запазиш резултата в профила си." }, { status: 401, headers: privateHeaders });
        return attemptJson(await claimAttempt(access, user.id));
      }
    }
  });
}
