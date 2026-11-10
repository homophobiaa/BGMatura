import type { LearningKind } from "@/features/learning/kinds";

/** Bulgarian editorial names for each learning record kind. */
export const learningKindLabels: Record<LearningKind, { plural: string; singular: string; create: string; description: string }> = {
  author: { plural: "Автори", singular: "Автор", create: "Нов автор", description: "Име и кратък контекст за автора." },
  work: { plural: "Произведения", singular: "Произведение", create: "Ново произведение", description: "Резюме, теми, герои и насоки за прочит." },
  topic: { plural: "Теми", singular: "Тема", create: "Нова тема", description: "Теми и подтеми по литература и български език." },
  lesson: { plural: "Уроци", singular: "Урок", create: "Нов урок", description: "Уроци по български език с обяснения и примери." },
};

export const publicationStatusLabels = { DRAFT: "Чернова", PUBLISHED: "Публикуван" } as const;

export function learningListPath(kind: LearningKind) {
  return `/admin/learning/${kind}`;
}

export function learningEditPath(kind: LearningKind, id: string) {
  return `/admin/learning/${kind}/${id}`;
}

/** Everything an editor page can save: learning records and bank questions. */
export type EditorialKind = LearningKind | "question";

export function editorialEndpoint(kind: EditorialKind) {
  return kind === "question" ? "/api/admin/questions" : `/api/admin/learning/${kind}`;
}

export function editorialEditPath(kind: EditorialKind, id: string) {
  return kind === "question" ? `/admin/questions/${id}` : learningEditPath(kind, id);
}

export function editorialPreviewPath(kind: EditorialKind, id: string) {
  return `/admin/preview/${kind}/${id}`;
}
