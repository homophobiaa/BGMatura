import "server-only";

import type {
  ArgumentativeWritingQuestion,
  ExtendedResponseQuestion,
  MultipleChoiceQuestion,
  ShortResponseQuestion,
} from "../types";

interface ObjectiveAssessment {
  readonly mode: "objective";
  readonly maximumPoints: number;
  readonly explanation: string;
}

interface WrittenAssessment {
  readonly mode: "self-review" | "ungraded";
  readonly referenceGuidance: string;
}

export type MultipleChoiceDefinition = MultipleChoiceQuestion & {
  readonly assessment: ObjectiveAssessment & {
    readonly correctOptionId: string;
  };
};

export type ShortResponseDefinition = ShortResponseQuestion & {
  readonly assessment:
    | (ObjectiveAssessment & { readonly acceptedAnswers: readonly string[] })
    | WrittenAssessment;
};

export type ExtendedResponseDefinition = ExtendedResponseQuestion & {
  readonly assessment: WrittenAssessment;
};

export type ArgumentativeWritingDefinition = ArgumentativeWritingQuestion & {
  readonly assessment: WrittenAssessment;
};

/** Authoritative editorial definitions must never be used as client props. */
export type QuestionDefinition =
  | MultipleChoiceDefinition
  | ShortResponseDefinition
  | ExtendedResponseDefinition
  | ArgumentativeWritingDefinition;
