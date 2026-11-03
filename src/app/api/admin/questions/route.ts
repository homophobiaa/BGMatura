import { z } from "zod";
import { requireAdmin } from "@/features/admin/server/authorization";
import { editorialResponse, readEditorialJson } from "@/features/admin/server/http";
import { saveQuestionDraft } from "@/features/questions/server/question-drafts";
import { setQuestionPublication } from "@/features/questions/server/question-status";
import { editorialId, parseEditorialInput } from "@/server/editorial";

const schema = z.discriminatedUnion("operation", [
  z.strictObject({ operation: z.literal("save"), draft: z.unknown() }),
  z.strictObject({ operation: z.enum(["publish", "unpublish"]), id: editorialId }),
]);

export async function POST(request: Request) {
  return editorialResponse(async () => {
    await requireAdmin(request.headers);
    const command = parseEditorialInput(schema, await readEditorialJson(request));
    if (command.operation === "save") return saveQuestionDraft(command.draft, request.headers);
    return setQuestionPublication({ id: command.id, publish: command.operation === "publish" }, request.headers);
  });
}
