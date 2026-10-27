import "server-only";

import type { Evaluation } from "../evaluation";
import type { SubmittedAnswer } from "../types";
import type { ShortResponseDefinition } from "./contracts";
import { InvalidQuestionDefinitionError, InvalidSubmittedAnswerError } from "./grading-errors";
import { normalizeShortResponse } from "./normalize-short-response";

type ObjectiveShortResponseAssessment = Extract<
  ShortResponseDefinition["assessment"],
  { readonly mode: "objective" }
>;

const LATIN_LETTER = /\p{Script=Latin}/u;

/**
 * Grades a short response with the rules in
 * documentation/FEATURES/short-response-grading.md. A score is produced only when
 * the comparison is reliable; otherwise the result says why it is not graded.
 */
export function gradeShortResponse(
  definition: ShortResponseDefinition,
  submittedAnswer: SubmittedAnswer,
): Evaluation {
  const responseText = readResponseText(definition, submittedAnswer);
  const { assessment } = definition;

  if (assessment.mode === "objective") {
    return gradeAgainstAcceptedAnswers(definition.id, assessment, responseText);
  }

  if (assessment.mode === "self-review") {
    return { status: "self-review" };
  }

  return { status: "ungraded", reason: "not-auto-gradable" };
}

function readResponseText(definition: ShortResponseDefinition, submittedAnswer: SubmittedAnswer): string {
  if (submittedAnswer.questionId !== definition.id) {
    throw new InvalidSubmittedAnswerError(
      `Answer for question ${submittedAnswer.questionId} cannot be graded against question ${definition.id}.`,
    );
  }

  if (submittedAnswer.type !== "short-response") {
    throw new InvalidSubmittedAnswerError(
      `Question ${definition.id} expects a short-response answer but received ${submittedAnswer.type}.`,
    );
  }

  return submittedAnswer.text;
}

function gradeAgainstAcceptedAnswers(
  questionId: string,
  assessment: ObjectiveShortResponseAssessment,
  responseText: string,
): Evaluation {
  const { maximumPoints, acceptedAnswers } = assessment;

  if (!Number.isFinite(maximumPoints) || maximumPoints < 0) {
    throw new InvalidQuestionDefinitionError(
      `Question ${questionId} must have a finite, non-negative maximum point value.`,
    );
  }

  const usableAcceptedAnswers = acceptedAnswers
    .map((acceptedAnswer) => ({
      original: acceptedAnswer,
      normalized: normalizeShortResponse(acceptedAnswer),
    }))
    .filter((acceptedAnswer) => acceptedAnswer.normalized !== "");

  if (usableAcceptedAnswers.length === 0) {
    return { status: "ungraded", reason: "answer-rules-unavailable" };
  }

  const normalizedResponse = normalizeShortResponse(responseText);

  if (normalizedResponse === "") {
    return { status: "scored", earnedPoints: 0, maximumPoints };
  }

  const matchesAcceptedAnswer = usableAcceptedAnswers.some(
    (acceptedAnswer) => acceptedAnswer.normalized === normalizedResponse,
  );

  if (matchesAcceptedAnswer) {
    return { status: "scored", earnedPoints: maximumPoints, maximumPoints };
  }

  // Look-alike Latin letters (a/а, o/о, c/с) usually mean a wrong keyboard layout, not a
  // wrong answer, so marking the response incorrect would be unreliable.
  const acceptedAnswersUseLatin = usableAcceptedAnswers.some((acceptedAnswer) =>
    LATIN_LETTER.test(acceptedAnswer.original),
  );

  if (LATIN_LETTER.test(responseText) && !acceptedAnswersUseLatin) {
    return { status: "ungraded", reason: "not-auto-gradable" };
  }

  return { status: "scored", earnedPoints: 0, maximumPoints };
}
