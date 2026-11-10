import { z } from "zod";

/** Query-string filters for admin learning lists. Invalid values fall back to defaults. */
export const learningListPageSize = 20;

const filtersSchema = z.object({
  query: z.string().trim().max(200).catch(""),
  status: z.enum(["all", "DRAFT", "PUBLISHED"]).catch("all"),
  page: z.coerce.number().int().min(1).max(10000).catch(1),
});

export type LearningListFilters = z.infer<typeof filtersSchema>;

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function readLearningListFilters(searchParams: Record<string, string | string[] | undefined>): LearningListFilters {
  return filtersSchema.parse({
    query: single(searchParams.q) ?? "",
    status: single(searchParams.status) ?? "all",
    page: single(searchParams.page) ?? 1,
  });
}

/** Builds a list URL that keeps the current search state, so links and redirects never lose filters. */
export function learningListHref(basePath: string, filters: LearningListFilters, changes: Partial<LearningListFilters> & { deleted?: string } = {}): string {
  const next = { ...filters, ...changes };
  const parameters = new URLSearchParams();
  if (next.query) parameters.set("q", next.query);
  if (next.status !== "all") parameters.set("status", next.status);
  if (next.page > 1) parameters.set("page", String(next.page));
  if (changes.deleted) parameters.set("deleted", changes.deleted);
  const search = parameters.toString();
  return search ? `${basePath}?${search}` : basePath;
}
