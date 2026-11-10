/** One finished attempt in a student's history. Shared by the server query and the list component. */
export interface HistoryItem {
  readonly id: string;
  readonly mode: "PRACTICE" | "EXAM";
  readonly title: string;
  readonly completedAt: string;
  readonly totalQuestions: number;
  readonly answered: number;
  readonly selfReview: number;
  /** Present only when something was graded automatically; written work never adds to it. */
  readonly points: { readonly earned: number; readonly maximum: number } | null;
}
