import { editorialResponse } from "@/features/admin/server/http";
import { readLearningPreview } from "@/features/learning/server/previews";

export async function GET(request: Request, context: { params: Promise<{ kind: string; id: string }> }) {
  return editorialResponse(async () => {
    const { kind, id } = await context.params;
    return readLearningPreview(kind, id, request.headers);
  });
}
