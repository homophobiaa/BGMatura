import { editorialResponse } from "@/features/admin/server/http";
import { readExamDraft } from "@/features/exams/server/editorial";

export function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return editorialResponse(async () => readExamDraft((await context.params).id, request.headers));
}
