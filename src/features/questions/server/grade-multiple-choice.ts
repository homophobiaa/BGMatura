import "server-only";

import type { Evaluation } from "../evaluation";
import type { SubmittedAnswer } from "../types";
import type { MultipleChoiceDefinition } from "./contracts";
import { InvalidQuestionDefinitionError, InvalidSubmittedAnswerError } from "./grading-errors";

/**
 * Single source of truth for scoring multiple-choice answers. Practice and exam
 * flows both call this; the answer key never leaves the server.
 *
 * A missing answer (`selectedOptionId: null`) is a valid submission worth 0 points.
 * An option the question does not offer is not a wrong answer but an invalid
 * submission, so it throws instead of being scored.
 */
export function gradeMultipleChoice(
  definition: MultipleChoiceDefinition,
  submittedAnswer: SubmittedAnswer,
): Evaluation {
  assertDefinitionIsGradable(definition);

  const selectedOptionId = readSelectedOptionId(definition, submittedAnswer);
  const { correctOptionId, maximumPoints } = definition.assessment;
  const earnedPoints = selectedOptionId === correctOptionId ? maximumPoints : 0;

  return { status: "scored", earnedPoints, maximumPoints };
}

function assertDefinitionIsGradable(definition: MultipleChoiceDefinition): void {
  const { correctOptionId, maximumPoints } = definition.assessment;

  if (!Number.isFinite(maximumPoints) || maximumPoints < 0) {
    throw new InvalidQuestionDefinitionError(
      `Question ${definition.id} must have a finite, non-negative maximum point value.`,
    );
  }

  const optionIds = definition.options.map((option) => option.id);

  if (new Set(optionIds).size !== optionIds.length) {
    throw new InvalidQuestionDefinitionError(`Question ${definition.id} has duplicate option identifiers.`);
  }

  if (!optionIds.includes(correctOptionId)) {
    throw new InvalidQuestionDefinitionError(
      `Question ${definition.id} names a correct option that is not among its options.`,
    );
  }
}

function readSelectedOptionId(
  definition: MultipleChoiceDefinition,
  submittedAnswer: SubmittedAnswer,
): string | null {
  if (submittedAnswer.questionId !== definition.id) {
    throw new InvalidSubmittedAnswerError(
      `Answer for question ${submittedAnswer.questionId} cannot be graded against question ${definition.id}.`,
    );
  }

  if (submittedAnswer.type !== "multiple-choice") {
    throw new InvalidSubmittedAnswerError(
      `Question ${definition.id} expects a multiple-choice answer but received ${submittedAnswer.type}.`,
    );
  }

  const { selectedOptionId } = submittedAnswer;

  if (selectedOptionId === null) {
    return null;
  }

  if (!definition.options.some((option) => option.id === selectedOptionId)) {
    throw new InvalidSubmittedAnswerError(
      `Option ${selectedOptionId} is not offered by question ${definition.id}.`,
    );
  }

  return selectedOptionId;
}
