export type QuestionType =
  | "multiple-choice"
  | "short-response"
  | "extended-response"
  | "argumentative-writing";

interface QuestionPrompt {
  readonly id: string;
  readonly prompt: string;
}

export interface QuestionOption {
  readonly id: string;
  readonly text: string;
}

export interface MultipleChoiceQuestion extends QuestionPrompt {
  readonly type: "multiple-choice";
  readonly options: readonly QuestionOption[];
}

export interface ShortResponseQuestion extends QuestionPrompt {
  readonly type: "short-response";
}

export interface ExtendedResponseQuestion extends QuestionPrompt {
  readonly type: "extended-response";
}

export interface ArgumentativeWritingQuestion extends QuestionPrompt {
  readonly type: "argumentative-writing";
}

/** Presentation data only. Keys, explanations, and grading rules live on the server. */
export type Question =
  | MultipleChoiceQuestion
  | ShortResponseQuestion
  | ExtendedResponseQuestion
  | ArgumentativeWritingQuestion;

export type SubmittedAnswer =
  | {
      readonly questionId: string;
      readonly type: "multiple-choice";
      readonly selectedOptionId: string | null;
    }
  | {
      readonly questionId: string;
      readonly type: "short-response";
      readonly text: string;
    }
  | {
      readonly questionId: string;
      readonly type: "extended-response";
      readonly text: string;
    }
  | {
      readonly questionId: string;
      readonly type: "argumentative-writing";
      readonly text: string;
    };
