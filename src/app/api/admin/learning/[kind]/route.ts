import { z } from "zod";
import { requireAdmin } from "@/features/admin/server/authorization";
import { editorialResponse, readEditorialJson } from "@/features/admin/server/http";
import { saveAuthorDraft } from "@/features/literature/server/author-drafts";
import { saveWorkDraft } from "@/features/literature/server/work-drafts";
import { saveTopicDraft } from "@/features/topics/server/topic-drafts";
import { saveLessonDraft } from "@/features/language/server/lesson-drafts";
import { deleteLearningDraft } from "@/features/learning/server/deletion";
import { learningKindSchema, setLearningPublication } from "@/features/learning/server/publication";
import { refreshLearningPages } from "@/features/learning/server/refresh";
import { editorialId, parseEditorialInput } from "@/server/editorial";

const commandSchema = z.discriminatedUnion("operation", [
  z.strictObject({ operation: z.literal("save"), draft: z.unknown() }),
  z.strictObject({ operation: z.enum(["publish", "unpublish"]), id: editorialId }),
  z.strictObject({ operation: z.literal("delete"), id: editorialId, confirmation: z.string() }),
]);

export async function POST(request: Request, context: { params: Promise<{ kind: string }> }) {
  return editorialResponse(async () => {
    await requireAdmin(request.headers);
    const kind = parseEditorialInput(learningKindSchema, (await context.params).kind);
    const command = parseEditorialInput(commandSchema, await readEditorialJson(request));
    let result;
    if (command.operation === "save") {
      switch (kind) {
        case "author": result = await saveAuthorDraft(command.draft, request.headers); break;
        case "work": result = await saveWorkDraft(command.draft, request.headers); break;
        case "topic": result = await saveTopicDraft(command.draft, request.headers); break;
        case "lesson": result = await saveLessonDraft(command.draft, request.headers); break;
      }
    } else if (command.operation === "delete") {
      result = await deleteLearningDraft({ kind, id: command.id, confirmation: command.confirmation }, request.headers);
    } else {
      result = await setLearningPublication({ kind, id: command.id, publish: command.operation === "publish" }, request.headers);
    }
    refreshLearningPages(kind);
    return result;
  });
}
