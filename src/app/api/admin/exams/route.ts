import { z } from "zod";
import { requireAdmin, requireMutationOrigin } from "@/features/admin/server/authorization";
import { editorialResponse, readEditorialJson } from "@/features/admin/server/http";
import { createExamConfiguration } from "@/features/exams/server/configuration";
import { saveExamDraft, setExamPublication } from "@/features/exams/server/editorial";
import { editorialId, parseEditorialInput } from "@/server/editorial";

const action = z.discriminatedUnion("operation", [
  z.strictObject({ operation: z.literal("configuration"), configuration: z.unknown() }),
  z.strictObject({ operation: z.literal("save"), draft: z.unknown() }),
  z.strictObject({ operation: z.enum(["publish", "unpublish"]), id: editorialId }),
]);

export function POST(request: Request) {
  return editorialResponse(async () => {
    await requireAdmin(request.headers);
    requireMutationOrigin(request.headers);
    const command = parseEditorialInput(action, await readEditorialJson(request));
    if (command.operation === "configuration") return createExamConfiguration(command.configuration, request.headers);
    if (command.operation === "save") return saveExamDraft(command.draft, request.headers);
    return setExamPublication({ id: command.id, publish: command.operation === "publish" }, request.headers);
  });
}
