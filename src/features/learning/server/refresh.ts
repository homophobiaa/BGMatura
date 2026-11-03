import "server-only";
import { revalidatePath } from "next/cache";
import type { LearningKind } from "./publication";

/** Only affected learning page families; static homepage and unrelated features stay cached. */
export function refreshLearningPages(kind: LearningKind) {
  if (kind === "author" || kind === "work") {
    revalidatePath("/literatura");
    revalidatePath("/literatura/[slug]", "page");
    revalidatePath("/avtori/[slug]", "page");
  } else {
    revalidatePath("/balgarski-ezik");
    revalidatePath("/balgarski-ezik/[slug]", "page");
  }
}
