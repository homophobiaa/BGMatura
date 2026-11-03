import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { checkDraftVersion, draftIdentity, EditorialError, editorialId, editorialMutation, parseEditorialInput } from "@/server/editorial";

const text = z.string().trim().min(1).max(20000);
const identifiers = z.array(editorialId).max(100).refine((ids) => new Set(ids).size === ids.length, "Remove duplicate links.").default([]);
const optionalText = text.nullable().default(null);
const criterion = z.strictObject({ id: z.string().trim().min(1).max(100), description: text, indicativePoints: z.number().finite().nonnegative().max(9999.99).optional() });
const rubric = z.array(criterion).max(100).refine((items) => new Set(items.map((item) => item.id)).size === items.length, "Use unique criterion identifiers.");
const common = {
  ...draftIdentity, subject: z.enum(["BULGARIAN_LANGUAGE", "LITERATURE"]), prompt: text,
  topicIds: identifiers, workIds: identifiers,
  provenance: z.strictObject({
    origin: z.enum(["ORIGINAL", "ADAPTED", "OFFICIAL"]), editorName: optionalText,
    attribution: optionalText, sourceReference: optionalText, reviewNotes: optionalText,
    reviewed: z.boolean().default(false),
  }).nullable().default(null),
};
const objective = {
  assessmentMode: z.literal("OBJECTIVE"),
  maximumPoints: z.number().finite().min(0).max(9999.99).refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8, "Use at most two decimal places."),
  explanation: z.string().max(20000).default(""),
};
const written = { assessmentMode: z.enum(["SELF_REVIEW", "UNGRADED"]), referenceGuidance: z.string().max(20000).default(""), rubric: rubric.nullable().default(null) };
const shortResponseSchema = z.discriminatedUnion("assessmentMode", [
  z.strictObject({ ...common, type: z.literal("SHORT_RESPONSE"), ...objective, acceptedAnswers: z.array(text).max(100).default([]) }),
  z.strictObject({ ...common, type: z.literal("SHORT_RESPONSE"), ...written }),
]);
export const questionDraftSchema = z.discriminatedUnion("type", [
  z.strictObject({ ...common, type: z.literal("MULTIPLE_CHOICE"), ...objective,
    options: z.array(z.strictObject({ text })).max(20).default([]), correctOptionIndex: z.number().int().min(0).nullable().default(null),
  }).refine((draft) => draft.correctOptionIndex === null || draft.correctOptionIndex < draft.options.length, { path: ["correctOptionIndex"], message: "Select an option in this draft." }),
  shortResponseSchema,
  z.strictObject({ ...common, type: z.literal("EXTENDED_RESPONSE"), ...written }),
  z.strictObject({ ...common, type: z.literal("ARGUMENTATIVE_WRITING"), ...written }),
]);

export function saveQuestionDraft(input: unknown, requestHeaders: Headers, database?: PrismaClient) {
  return editorialMutation(requestHeaders, async (transaction, admin) => {
    const draft = parseEditorialInput(questionDraftSchema, input);
    const id = draft.id ?? randomUUID();
    if (draft.id) {
      const previous = await transaction.question.findUniqueOrThrow({ where: { id } });
      checkDraftVersion(previous, draft.expectedUpdatedAt);
    }
    const topics = await transaction.topic.findMany({ where: { id: { in: draft.topicIds }, subject: draft.subject }, select: { id: true } });
    if (topics.length !== draft.topicIds.length) throw new EditorialError("invalid", "Choose existing topics of the question's subject.", { topicIds: ["A topic is missing or belongs to another subject."] });
    if (draft.workIds.length && draft.subject !== "LITERATURE") throw new EditorialError("invalid", "Only literature questions can link to works.", { workIds: ["Remove work links from language questions."] });
    if (await transaction.work.count({ where: { id: { in: draft.workIds } } }) !== draft.workIds.length) throw new EditorialError("invalid", "A linked work is missing.", { workIds: ["Choose existing works."] });
    if (draft.id) {
      // Clear the own-option reference before replacing options or changing type/subject.
      await transaction.question.update({ where: { id }, data: { correctOptionId: null } });
      await transaction.questionOption.deleteMany({ where: { questionId: id } });
      await transaction.questionTopic.deleteMany({ where: { questionId: id } });
      await transaction.questionWork.deleteMany({ where: { questionId: id } });
    }
    const data = {
      subject: draft.subject, type: draft.type, prompt: draft.prompt, assessmentMode: draft.assessmentMode,
      maximumPoints: draft.assessmentMode === "OBJECTIVE" ? draft.maximumPoints : null,
      explanation: draft.assessmentMode === "OBJECTIVE" ? draft.explanation : null,
      referenceGuidance: draft.assessmentMode === "OBJECTIVE" ? null : draft.referenceGuidance,
      rubric: draft.assessmentMode === "OBJECTIVE" || draft.rubric === null ? Prisma.DbNull : draft.rubric,
      acceptedAnswers: "acceptedAnswers" in draft ? draft.acceptedAnswers : [],
    };
    if (draft.id) await transaction.question.update({ where: { id }, data });
    else await transaction.question.create({ data: { id, ...data } });
    if (draft.type === "MULTIPLE_CHOICE") {
      const options = draft.options.map((option, position) => ({ id: randomUUID(), questionId: id, questionType: "MULTIPLE_CHOICE" as const, text: option.text, position }));
      await transaction.questionOption.createMany({ data: options });
      const correctOption = draft.correctOptionIndex === null ? undefined : options[draft.correctOptionIndex];
      if (correctOption) await transaction.question.update({ where: { id }, data: { correctOptionId: correctOption.id } });
    }
    await transaction.questionTopic.createMany({ data: draft.topicIds.map((topicId) => ({ questionId: id, topicId, subject: draft.subject })) });
    await transaction.questionWork.createMany({ data: draft.workIds.map((workId) => ({ questionId: id, workId, subject: "LITERATURE" })) });
    await transaction.questionProvenance.deleteMany({ where: { questionId: id } });
    if (draft.provenance) {
      const { reviewed, ...source } = draft.provenance;
      if (reviewed && (!source.editorName || (source.origin !== "ORIGINAL" && !source.attribution))) {
        throw new EditorialError("invalid", "Record the editor and source attribution before confirming review.", { provenance: ["Review requires an editor and appropriate attribution."] });
      }
      await transaction.questionProvenance.create({ data: {
        questionId: id, ...source, reviewStatus: reviewed ? "REVIEWED" : "UNREVIEWED",
        reviewedBy: reviewed ? admin.id : null, reviewedAt: reviewed ? new Date() : null,
      } });
    }
    return transaction.question.findUniqueOrThrow({ where: { id }, include: { options: { orderBy: { position: "asc" } }, topics: true, works: true, provenance: true } });
  }, database);
}
