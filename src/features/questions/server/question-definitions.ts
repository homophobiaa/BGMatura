import "server-only";

import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";

import type { QuestionDefinition, RubricCriterion } from "./contracts";
import { InvalidQuestionDefinitionError } from "./grading-errors";

export type QuestionRecord = Prisma.QuestionGetPayload<{ include: { options: true } }>;

const rubricSchema = z.array(
  z.strictObject({
    id: z.string().min(1),
    description: z.string().min(1),
    indicativePoints: z.number().finite().nonnegative().optional(),
  }),
);

/**
 * Turns a stored question into the authoritative server-side definition the graders
 * use. The database constraints already guarantee the type-specific structure; this
 * additionally refuses records that cannot be graded yet, such as a draft multiple-choice
 * question with no correct option. The result holds answer keys and must stay on the server.
 */
export function toQuestionDefinition(record: QuestionRecord): QuestionDefinition {
  switch (record.type) {
    case "MULTIPLE_CHOICE":
      return toMultipleChoiceDefinition(record);
    case "SHORT_RESPONSE":
      return toShortResponseDefinition(record);
    case "EXTENDED_RESPONSE":
      return { id: record.id, type: "extended-response", prompt: record.prompt, assessment: toWrittenAssessment(record) };
    case "ARGUMENTATIVE_WRITING":
      return {
        id: record.id,
        type: "argumentative-writing",
        prompt: record.prompt,
        assessment: toWrittenAssessment(record),
      };
  }
}

function toMultipleChoiceDefinition(record: QuestionRecord): QuestionDefinition {
  if (record.correctOptionId === null) {
    throw new InvalidQuestionDefinitionError(`Question ${record.id} has no correct option yet.`);
  }

  const options = [...record.options]
    .sort((first, second) => first.position - second.position)
    .map((option) => ({ id: option.id, text: option.text }));

  return {
    id: record.id,
    type: "multiple-choice",
    prompt: record.prompt,
    options,
    assessment: { ...readObjectiveAssessment(record), correctOptionId: record.correctOptionId },
  };
}

function toShortResponseDefinition(record: QuestionRecord): QuestionDefinition {
  if (record.assessmentMode !== "OBJECTIVE") {
    return { id: record.id, type: "short-response", prompt: record.prompt, assessment: toWrittenAssessment(record) };
  }

  return {
    id: record.id,
    type: "short-response",
    prompt: record.prompt,
    assessment: { ...readObjectiveAssessment(record), acceptedAnswers: record.acceptedAnswers },
  };
}

function readObjectiveAssessment(record: QuestionRecord) {
  if (record.maximumPoints === null || record.explanation === null) {
    throw new InvalidQuestionDefinitionError(`Objective question ${record.id} is missing points or an explanation.`);
  }

  return {
    mode: "objective" as const,
    maximumPoints: record.maximumPoints.toNumber(),
    explanation: record.explanation,
  };
}

function toWrittenAssessment(record: QuestionRecord) {
  if (record.referenceGuidance === null) {
    throw new InvalidQuestionDefinitionError(`Written question ${record.id} is missing reference guidance.`);
  }

  const assessment = {
    mode: record.assessmentMode === "SELF_REVIEW" ? ("self-review" as const) : ("ungraded" as const),
    referenceGuidance: record.referenceGuidance,
  };
  const rubric = readRubric(record);

  return rubric ? { ...assessment, rubric } : assessment;
}

function readRubric(record: QuestionRecord): RubricCriterion[] | undefined {
  if (record.rubric === null) {
    return undefined;
  }

  const parsed = rubricSchema.safeParse(record.rubric);

  if (!parsed.success) {
    throw new InvalidQuestionDefinitionError(`Question ${record.id} has a malformed rubric.`);
  }

  // exactOptionalPropertyTypes forbids an explicit undefined, so omit absent points.
  return parsed.data.map(({ id, description, indicativePoints }) =>
    indicativePoints === undefined ? { id, description } : { id, description, indicativePoints },
  );
}
