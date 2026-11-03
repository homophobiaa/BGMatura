import "server-only";

import type { Prisma, QuestionType } from "@/generated/prisma/client";
import { getDatabase } from "@/server/database";

import type { Question } from "../types";
import type { QuestionDefinition } from "./contracts";

type PublicQuestionDatabase = Pick<Prisma.TransactionClient, "question">;

const publicTypeByStoredType = {
  MULTIPLE_CHOICE: "multiple-choice",
  SHORT_RESPONSE: "short-response",
  EXTENDED_RESPONSE: "extended-response",
  ARGUMENTATIVE_WRITING: "argumentative-writing",
} as const satisfies Record<QuestionType, Question["type"]>;

/**
 * Whitelists what a student may see while answering: the id, type, prompt, and for
 * multiple choice the option ids and texts. Every public object is built field by field,
 * never by spreading a definition, so a field added to the server contract later (an
 * answer key, an explanation, points) cannot reach the browser by accident. Answer keys,
 * accepted answers, explanations, reference guidance, rubrics, and points are withheld
 * until authorized feedback.
 *
 * Use it for an attempt's snapshot definition. The result is safe to pass to Client
 * Components.
 */
export function toPublicQuestion(definition: QuestionDefinition): Question {
  switch (definition.type) {
    case "multiple-choice":
      return {
        id: definition.id,
        type: "multiple-choice",
        prompt: definition.prompt,
        options: definition.options.map((option) => ({ id: option.id, text: option.text })),
      };
    case "short-response":
      return { id: definition.id, type: "short-response", prompt: definition.prompt };
    case "extended-response":
      return { id: definition.id, type: "extended-response", prompt: definition.prompt };
    case "argumentative-writing":
      return { id: definition.id, type: "argumentative-writing", prompt: definition.prompt };
  }
}

/**
 * Reads one published question for presentation. The query selects only the whitelisted
 * columns, so answer keys and grading rules are never even loaded, and a draft never
 * resolves. Options come back in their stored order.
 */
export async function findPublishedPublicQuestion(
  questionId: string,
  database: PublicQuestionDatabase = getDatabase(),
): Promise<Question | null> {
  const question = await database.question.findFirst({
    where: { id: questionId, status: "PUBLISHED" },
    select: {
      id: true,
      type: true,
      prompt: true,
      options: { select: { id: true, text: true }, orderBy: { position: "asc" } },
    },
  });

  if (question === null) {
    return null;
  }

  const type = publicTypeByStoredType[question.type];

  if (type === "multiple-choice") {
    return {
      id: question.id,
      type,
      prompt: question.prompt,
      options: question.options.map((option) => ({ id: option.id, text: option.text })),
    };
  }

  return { id: question.id, type, prompt: question.prompt };
}
