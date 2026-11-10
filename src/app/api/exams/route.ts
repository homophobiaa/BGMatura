import { z } from "zod";
import type { NextRequest } from "next/server";
import { parseAttemptInput } from "@/features/attempts/server/errors";
import { attemptJson, attemptResponse } from "@/features/attempts/server/http";
import { listPublicExams } from "@/features/exams/server/catalog";

export function GET(request: NextRequest) {
  return attemptResponse(async () => {
    const after = parseAttemptInput(z.uuid().optional(), request.nextUrl.searchParams.get("after") ?? undefined);
    return attemptJson(await listPublicExams(after));
  });
}
