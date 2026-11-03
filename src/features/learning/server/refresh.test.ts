import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { revalidatePath } from "next/cache";
import { refreshLearningPages } from "./refresh";

it.each(["author", "work"] as const)("refreshes literature lists, details and author relationships after %s changes", (kind) => {
  refreshLearningPages(kind);
  expect(vi.mocked(revalidatePath).mock.calls).toEqual([["/literatura"], ["/literatura/[slug]", "page"], ["/avtori/[slug]", "page"]]);
});
it.each(["topic", "lesson"] as const)("refreshes language lists and lesson details after %s changes", (kind) => {
  refreshLearningPages(kind);
  expect(vi.mocked(revalidatePath).mock.calls).toEqual([["/balgarski-ezik"], ["/balgarski-ezik/[slug]", "page"]]);
});
