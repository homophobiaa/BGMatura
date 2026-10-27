import "server-only";

import type { Evaluation } from "../evaluation";
import type { SubmittedAnswer } from "../types";
import type {
  ArgumentativeWritingDefinition,
  ExtendedResponseDefinition,
  RubricCriterion,
} from "./contracts";
import { InvalidQuestionDefinitionError, InvalidSubmittedAnswerError } from "./grading-errors";

type WrittenResponseDefinition = ExtendedResponseDefinition | ArgumentativeWritingDefinition;

type WrittenEvaluation = Extract<Evaluation, { status: "self-review" | "ungraded" }>;

/**
 * What the attempt flow records for an extended response or essay: the submitted
 * text, an explicit non-scored state, and the editor's guidance. It deliberately
 * has no earned or maximum points, so these items can never count as correct or
 * fully scored in a mixed result.
 */
export interface WrittenResponseReview {
  readonly questionId: string;
  readonly submittedText: string;
  readonly evaluation: WrittenEvaluation;
  readonly referenceGuidance: string;
  readonly rubric: readonly RubricCriterion[];
}

/**
 * Honest handling of written work: the system never invents a score for it. A
 * `self-review` question is shown with its guidance and rubric for the student to
 * assess their own text; an `ungraded` question is simply recorded.
 */
export function evaluateWrittenResponse(
  definition: WrittenResponseDefinition,
  submittedAnswer: SubmittedAnswer,
): WrittenResponseReview {
  const submittedText = readSubmittedText(definition, submittedAnswer);
  const rubric = definition.assessment.rubric ?? [];

  assertRubricIsValid(definition.id, rubric);

  return {
    questionId: definition.id,
    submittedText,
    evaluation: evaluateStatus(definition),
    referenceGuidance: definition.assessment.referenceGuidance,
    rubric,
  };
}

function evaluateStatus(definition: WrittenResponseDefinition): WrittenEvaluation {
  if (definition.assessment.mode === "self-review") {
    return { status: "self-review" };
  }

  return { status: "ungraded", reason: "not-auto-gradable" };
}

function readSubmittedText(definition: WrittenResponseDefinition, submittedAnswer: SubmittedAnswer): string {
  if (submittedAnswer.questionId !== definition.id) {
    throw new InvalidSubmittedAnswerError(
      `Answer for question ${submittedAnswer.questionId} cannot be recorded against question ${definition.id}.`,
    );
  }

  if (submittedAnswer.type !== definition.type) {
    throw new InvalidSubmittedAnswerError(
      `Question ${definition.id} expects an answer of type ${definition.type} but received ${submittedAnswer.type}.`,
    );
  }

  return submittedAnswer.text;
}

function assertRubricIsValid(questionId: string, rubric: readonly RubricCriterion[]): void {
  const criterionIds = rubric.map((criterion) => criterion.id);

  if (new Set(criterionIds).size !== criterionIds.length) {
    throw new InvalidQuestionDefinitionError(`Question ${questionId} has duplicate rubric criterion identifiers.`);
  }

  for (const criterion of rubric) {
    const { indicativePoints } = criterion;

    if (indicativePoints !== undefined && (!Number.isFinite(indicativePoints) || indicativePoints < 0)) {
      throw new InvalidQuestionDefinitionError(
        `Rubric criterion ${criterion.id} of question ${questionId} must have finite, non-negative indicative points.`,
      );
    }
  }
}
