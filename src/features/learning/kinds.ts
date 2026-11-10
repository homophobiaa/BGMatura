/** Learning record kinds shared by the editorial API, admin pages, and client forms. */
export const learningKinds = ["author", "work", "topic", "lesson"] as const;
export type LearningKind = (typeof learningKinds)[number];

export function isLearningKind(value: string): value is LearningKind {
  return (learningKinds as readonly string[]).includes(value);
}
