import "server-only";

import { createHash } from "node:crypto";

import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { getDatabase } from "@/server/database";

import type { QuestionDefinition } from "./contracts";
import { InvalidQuestionDefinitionError } from "./grading-errors";
import type { PublicQuestionSource } from "./question-associations";
import { parseRubric, toQuestionDefinition, type QuestionRecord } from "./question-definitions";

type QuestionSnapshotDatabase = Pick<Prisma.TransactionClient, "question" | "questionSnapshot">;

/**
 * Version of the layout of a snapshot's `content`. Increase it, and keep reading the old
 * versions, whenever the layout changes: stored snapshots are never rewritten.
 */
const SNAPSHOT_FORMAT_VERSION = 1;

/** What a snapshot remembers about a question, read back for grading and answer review. */
export interface QuestionSnapshotView {
  readonly subject: "BULGARIAN_LANGUAGE" | "LITERATURE";
  /** The prompt, options, answer rules, points, and explanation or guidance, as they were. */
  readonly definition: QuestionDefinition;
  /** Public provenance only; editor names, source references, and review details are never captured. */
  readonly source: PublicQuestionSource | null;
}

/**
 * Captures the current version of a published question. Call it when an attempt begins,
 * before any answer is evaluated, and grade and review that attempt only from the returned
 * snapshot. An unchanged question reuses its existing snapshot; an edited one gets a new
 * snapshot, and older snapshots are left exactly as they were.
 *
 * The snapshot contains answer keys and must stay on the server.
 */
export async function captureQuestionSnapshot(questionId: string, database: QuestionSnapshotDatabase = getDatabase()) {
  const [snapshot] = await captureQuestionSnapshots([questionId], database);
  if (!snapshot) throw new InvalidQuestionDefinitionError("Question snapshot could not be captured.");
  return snapshot;
}

export async function captureQuestionSnapshots(questionIds: readonly string[], database: QuestionSnapshotDatabase) {
  if (!questionIds.length) return [];
  const questions = await database.question.findMany({
    where: { id: { in: [...questionIds] } },
    include: { options: true, provenance: { select: { origin: true, attribution: true } } },
  });
  const byId = new Map(questions.map((question) => [question.id, question]));
  const data = questionIds.map((questionId) => {
    const question = byId.get(questionId);
    if (!question) throw new InvalidQuestionDefinitionError(`Question ${questionId} does not exist, so it cannot be captured.`);
    if (question.status !== "PUBLISHED") {
      throw new InvalidQuestionDefinitionError(`Question ${questionId} must be published before an attempt can capture it.`);
    }
    return snapshotData(question);
  });
  const keys = data.map(({ questionId, contentHash }) => ({ questionId, contentHash }));
  // Use a consistent insertion order when simultaneous attempts share bank questions.
  await database.questionSnapshot.createMany({
    data: [...data].sort((first, second) => first.questionId.localeCompare(second.questionId)),
    skipDuplicates: true,
  });
  const stored = await database.questionSnapshot.findMany({ where: { OR: keys } });
  const byQuestion = new Map(stored.map((snapshot) => [snapshot.questionId, snapshot]));
  return questionIds.map((questionId) => {
    const snapshot = byQuestion.get(questionId);
    if (!snapshot) throw new InvalidQuestionDefinitionError("Question snapshot could not be captured.");
    return snapshot;
  });
}

function snapshotData(question: QuestionRecord & { provenance: PublicQuestionSource | null }) {

  // Key order is fixed by the code below and by toQuestionDefinition, so equal questions
  // always produce equal text and therefore equal hashes.
  const contentText = JSON.stringify({
    formatVersion: SNAPSHOT_FORMAT_VERSION,
    subject: question.subject,
    definition: toQuestionDefinition(question),
    source: question.provenance,
  });
  return {
    questionId: question.id,
    formatVersion: SNAPSHOT_FORMAT_VERSION,
    content: z.record(z.string(), z.json()).parse(JSON.parse(contentText)),
    contentHash: createHash("sha256").update(contentText).digest("hex"),
  };
}

const optionSchema = z.strictObject({ id: z.string(), text: z.string() });

const objectiveAssessmentFields = {
  mode: z.literal("objective"),
  maximumPoints: z.number().finite().nonnegative(),
  explanation: z.string(),
};

const writtenAssessmentSchema = z.strictObject({
  mode: z.enum(["self-review", "ungraded"]),
  referenceGuidance: z.string(),
  // Validated by parseRubric, which also resolves optional points for exactOptionalPropertyTypes.
  rubric: z.unknown().optional(),
});

const definitionSchema = z.discriminatedUnion("type", [
  z.strictObject({
    id: z.string(),
    type: z.literal("multiple-choice"),
    prompt: z.string(),
    options: z.array(optionSchema),
    assessment: z.strictObject({ ...objectiveAssessmentFields, correctOptionId: z.string() }),
  }),
  z.strictObject({
    id: z.string(),
    type: z.literal("short-response"),
    prompt: z.string(),
    assessment: z.union([
      z.strictObject({ ...objectiveAssessmentFields, acceptedAnswers: z.array(z.string()) }),
      writtenAssessmentSchema,
    ]),
  }),
  z.strictObject({
    id: z.string(),
    type: z.literal("extended-response"),
    prompt: z.string(),
    assessment: writtenAssessmentSchema,
  }),
  z.strictObject({
    id: z.string(),
    type: z.literal("argumentative-writing"),
    prompt: z.string(),
    assessment: writtenAssessmentSchema,
  }),
]);

const snapshotContentSchema = z.strictObject({
  formatVersion: z.literal(SNAPSHOT_FORMAT_VERSION),
  subject: z.enum(["BULGARIAN_LANGUAGE", "LITERATURE"]),
  definition: definitionSchema,
  source: z.strictObject({ origin: z.enum(["ORIGINAL", "ADAPTED", "OFFICIAL"]), attribution: z.string().nullable() }).nullable(),
});

type ParsedWrittenAssessment = z.infer<typeof writtenAssessmentSchema>;

/**
 * Reads a stored snapshot back into the definition the graders and the answer review use.
 * Refuses a layout version it does not know instead of guessing at its meaning.
 */
export function readQuestionSnapshot(snapshot: { formatVersion: number; content: Prisma.JsonValue }): QuestionSnapshotView {
  if (snapshot.formatVersion !== SNAPSHOT_FORMAT_VERSION) {
    throw new InvalidQuestionDefinitionError(
      `Question snapshot format version ${snapshot.formatVersion} is not supported.`,
    );
  }

  const parsed = snapshotContentSchema.safeParse(snapshot.content);

  if (!parsed.success) {
    throw new InvalidQuestionDefinitionError("A stored question snapshot does not match its declared format.");
  }

  const { subject, definition, source } = parsed.data;

  switch (definition.type) {
    case "multiple-choice":
    case "short-response":
      return { subject, source, definition: toDefinition(definition) };
    case "extended-response":
    case "argumentative-writing":
      return {
        subject,
        source,
        definition: { ...definition, assessment: toWrittenAssessment(definition.id, definition.assessment) },
      };
  }
}

function toDefinition(definition: Extract<z.infer<typeof definitionSchema>, { type: "multiple-choice" | "short-response" }>): QuestionDefinition {
  if (definition.type === "multiple-choice") {
    return definition;
  }

  if (definition.assessment.mode === "objective") {
    return { ...definition, assessment: definition.assessment };
  }

  return { ...definition, assessment: toWrittenAssessment(definition.id, definition.assessment) };
}

function toWrittenAssessment(questionId: string, assessment: ParsedWrittenAssessment) {
  const base = { mode: assessment.mode, referenceGuidance: assessment.referenceGuidance };

  return assessment.rubric === undefined ? base : { ...base, rubric: parseRubric(assessment.rubric, questionId) };
}
