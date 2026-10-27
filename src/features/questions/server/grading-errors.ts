import "server-only";

/**
 * The submitted answer does not belong to the question being graded: wrong
 * question, wrong answer type, or an option the question does not offer.
 * Server entry points should reject the submission instead of scoring it.
 */
export class InvalidSubmittedAnswerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidSubmittedAnswerError";
  }
}

/**
 * The editorial definition cannot be graded reliably, for example because its
 * correct option is missing. This is a content or data defect, not a student error.
 */
export class InvalidQuestionDefinitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidQuestionDefinitionError";
  }
}
