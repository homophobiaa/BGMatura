import "server-only";

import type { Prisma, QuestionOrigin, QuestionType, ReviewStatus } from "@/generated/prisma/client";
import { getDatabase } from "@/server/database";

import { InvalidQuestionDefinitionError } from "./grading-errors";
import { normalizeShortResponse } from "./normalize-short-response";
import { parseRubric } from "./question-definitions";

type PublicationDatabase = Pick<Prisma.TransactionClient, "question">;

/** Stable codes, so an editor interface can show each reason next to the field it concerns. */
export type PublicationProblemCode =
  | "prompt-missing"
  | "explanation-missing"
  | "guidance-missing"
  | "rubric-malformed"
  | "multiple-choice-needs-two-options"
  | "multiple-choice-duplicate-options"
  | "multiple-choice-correct-option-missing"
  | "short-response-needs-accepted-answers"
  | "short-response-blank-accepted-answer"
  | "topic-link-missing"
  | "source-missing"
  | "editor-missing"
  | "attribution-missing"
  | "review-missing";

export interface PublicationProblem {
  readonly code: PublicationProblemCode;
  /** Says what to fix, written for the editor. */
  readonly message: string;
}

/** Everything the publication rules look at, gathered in one plain value so the rules are easy to test. */
export interface PublicationCandidate {
  readonly type: QuestionType;
  readonly assessmentMode: "OBJECTIVE" | "SELF_REVIEW" | "UNGRADED";
  readonly prompt: string;
  readonly explanation: string | null;
  readonly referenceGuidance: string | null;
  readonly rubric: unknown;
  readonly acceptedAnswers: readonly string[];
  readonly correctOptionId: string | null;
  readonly options: readonly { readonly id: string; readonly text: string }[];
  readonly topicLinkCount: number;
  readonly provenance: {
    readonly origin: QuestionOrigin;
    readonly attribution: string | null;
    readonly editorName: string | null;
    readonly reviewStatus: ReviewStatus;
  } | null;
}

/** A draft may be incomplete; a published question may not. This lists everything still missing. */
export class QuestionNotReadyToPublishError extends Error {
  readonly problems: readonly PublicationProblem[];

  constructor(questionId: string, problems: readonly PublicationProblem[]) {
    super(
      `Question ${questionId} cannot be published yet: ${problems.map((problem) => problem.message).join(" ")}`,
    );
    this.name = "QuestionNotReadyToPublishError";
    this.problems = problems;
  }
}

function isBlank(value: string | null): boolean {
  return value === null || !/\S/.test(value);
}

function comparableOptionText(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLocaleLowerCase("bg-BG");
}

/**
 * The rules a question must meet before students can see it. The database already rejects
 * structurally impossible rows, such as points on a written question. These rules add what
 * only makes sense at publication: the question can be answered and graded, it is explained,
 * it is filed under a topic, its source and editor are known, and an editor has reviewed it.
 */
export function checkPublicationReadiness(candidate: PublicationCandidate): PublicationProblem[] {
  const problems: PublicationProblem[] = [];
  const report = (code: PublicationProblemCode, message: string) => problems.push({ code, message });

  if (isBlank(candidate.prompt)) {
    report("prompt-missing", "Write the question prompt.");
  }

  if (candidate.assessmentMode === "OBJECTIVE") {
    if (isBlank(candidate.explanation)) {
      report("explanation-missing", "Add the explanation students see after they answer.");
    }
  } else {
    if (isBlank(candidate.referenceGuidance)) {
      report("guidance-missing", "Add reference guidance for the written response.");
    }

    checkRubric(candidate, report);
  }

  if (candidate.type === "MULTIPLE_CHOICE") {
    checkMultipleChoice(candidate, report);
  }

  if (candidate.type === "SHORT_RESPONSE" && candidate.assessmentMode === "OBJECTIVE") {
    checkAcceptedAnswers(candidate, report);
  }

  if (candidate.topicLinkCount === 0) {
    report("topic-link-missing", "Link the question to at least one topic.");
  }

  checkProvenance(candidate, report);

  return problems;
}

type Report = (code: PublicationProblemCode, message: string) => unknown;

function checkRubric(candidate: PublicationCandidate, report: Report): void {
  if (candidate.rubric === null || candidate.rubric === undefined) {
    return;
  }

  try {
    parseRubric(candidate.rubric, "this question");
  } catch (error) {
    if (!(error instanceof InvalidQuestionDefinitionError)) {
      throw error;
    }

    report("rubric-malformed", "Fix the rubric: every criterion needs an identifier and a description.");
  }
}

function checkMultipleChoice(candidate: PublicationCandidate, report: Report): void {
  if (candidate.options.length < 2) {
    report("multiple-choice-needs-two-options", "Add at least two answer options.");
  }

  const optionTexts = candidate.options.map((option) => comparableOptionText(option.text));

  if (new Set(optionTexts).size !== optionTexts.length) {
    report("multiple-choice-duplicate-options", "Two options have the same text; make every option distinct.");
  }

  if (!candidate.options.some((option) => option.id === candidate.correctOptionId)) {
    report("multiple-choice-correct-option-missing", "Mark which option is the correct answer.");
  }
}

function checkAcceptedAnswers(candidate: PublicationCandidate, report: Report): void {
  const usableAnswers = candidate.acceptedAnswers.filter((answer) => normalizeShortResponse(answer) !== "");

  if (usableAnswers.length === 0) {
    report("short-response-needs-accepted-answers", "Add at least one accepted answer.");
  }

  if (usableAnswers.length !== candidate.acceptedAnswers.length) {
    report("short-response-blank-accepted-answer", "Remove the accepted answers that are blank.");
  }
}

function checkProvenance(candidate: PublicationCandidate, report: Report): void {
  const { provenance } = candidate;

  if (provenance === null) {
    report("source-missing", "Record where the question comes from: its origin, editor, and review.");
    return;
  }

  if (isBlank(provenance.editorName)) {
    report("editor-missing", "Record the editor who wrote or adapted the question.");
  }

  if (provenance.origin !== "ORIGINAL" && isBlank(provenance.attribution)) {
    report("attribution-missing", "Add the attribution that credits the source of adapted or official material.");
  }

  if (provenance.reviewStatus !== "REVIEWED") {
    report("review-missing", "Have an editor review the question and record the review before publishing.");
  }
}

async function loadPublicationCandidate(
  database: PublicationDatabase,
  questionId: string,
): Promise<PublicationCandidate> {
  const question = await database.question.findUnique({
    where: { id: questionId },
    select: {
      type: true,
      assessmentMode: true,
      prompt: true,
      explanation: true,
      referenceGuidance: true,
      rubric: true,
      acceptedAnswers: true,
      correctOptionId: true,
      options: { select: { id: true, text: true } },
      _count: { select: { topics: true } },
      provenance: { select: { origin: true, attribution: true, editorName: true, reviewStatus: true } },
    },
  });

  if (question === null) {
    throw new InvalidQuestionDefinitionError(`Question ${questionId} does not exist.`);
  }

  const { _count, ...fields } = question;

  return { ...fields, topicLinkCount: _count.topics };
}

/** Lists what is still missing before the question can be published, for an editor's checklist. */
export async function findQuestionPublicationProblems(
  questionId: string,
  database: PublicationDatabase = getDatabase(),
): Promise<PublicationProblem[]> {
  return checkPublicationReadiness(await loadPublicationCandidate(database, questionId));
}

/**
 * Publishes a question once it is complete and reviewed, and refuses with every missing
 * item otherwise. Publishing an already published question changes nothing. Callers must
 * authorize the editor first (#74); this service does not.
 */
export async function publishQuestion(questionId: string, database?: PublicationDatabase) {
  if (database === undefined) {
    return getDatabase().$transaction((transaction) => publishWithin(transaction, questionId));
  }

  return publishWithin(database, questionId);
}

async function publishWithin(database: PublicationDatabase, questionId: string) {
  const problems = checkPublicationReadiness(await loadPublicationCandidate(database, questionId));

  if (problems.length > 0) {
    throw new QuestionNotReadyToPublishError(questionId, problems);
  }

  return database.question.update({
    where: { id: questionId },
    data: { status: "PUBLISHED" },
    select: { id: true, status: true },
  });
}
