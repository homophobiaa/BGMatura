import { z } from "zod";

/** Query-string filters for the admin question list. Invalid values fall back to defaults. */
export const questionTypes = ["MULTIPLE_CHOICE", "SHORT_RESPONSE", "EXTENDED_RESPONSE", "ARGUMENTATIVE_WRITING"] as const;
export type QuestionTypeValue = (typeof questionTypes)[number];

export const questionTypeLabels: Record<QuestionTypeValue, string> = {
  MULTIPLE_CHOICE: "Избираем отговор",
  SHORT_RESPONSE: "Кратък отговор",
  EXTENDED_RESPONSE: "Разширен отговор",
  ARGUMENTATIVE_WRITING: "Аргументативен текст",
};

export const assessmentModeLabels = {
  OBJECTIVE: "Автоматична проверка",
  SELF_REVIEW: "Самооценка",
  UNGRADED: "Без оценка",
} as const;

export const questionListPageSize = 20;

const filtersSchema = z.object({
  query: z.string().trim().max(200).catch(""),
  status: z.enum(["all", "DRAFT", "PUBLISHED"]).catch("all"),
  type: z.enum(["all", ...questionTypes]).catch("all"),
  topicId: z.uuid().or(z.literal("")).catch(""),
  page: z.coerce.number().int().min(1).max(10000).catch(1),
});

export type QuestionListFilters = z.infer<typeof filtersSchema>;

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function readQuestionListFilters(searchParams: Record<string, string | string[] | undefined>): QuestionListFilters {
  return filtersSchema.parse({
    query: single(searchParams.q) ?? "",
    status: single(searchParams.status) ?? "all",
    type: single(searchParams.type) ?? "all",
    topicId: single(searchParams.topic) ?? "",
    page: single(searchParams.page) ?? 1,
  });
}

export function questionListHref(filters: QuestionListFilters, changes: Partial<QuestionListFilters> = {}): string {
  const next = { ...filters, ...changes };
  const parameters = new URLSearchParams();
  if (next.query) parameters.set("q", next.query);
  if (next.status !== "all") parameters.set("status", next.status);
  if (next.type !== "all") parameters.set("type", next.type);
  if (next.topicId) parameters.set("topic", next.topicId);
  if (next.page > 1) parameters.set("page", String(next.page));
  const search = parameters.toString();
  return search ? `/admin/questions?${search}` : "/admin/questions";
}
