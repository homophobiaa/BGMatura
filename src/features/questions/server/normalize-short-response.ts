import "server-only";

// Combining grave and acute accents only. The breve in "й" (U+0306) is part of the
// letter and must survive, which is why the text is recomposed after removal.
const STRESS_MARKS = /[̀́]/g;
const DASH_VARIANTS = /[‐‑‒–—−]/g;
const WHITESPACE_RUNS = /\s+/g;
const SURROUNDING_PUNCTUATION_AND_SPACE = /^[\p{P}\p{S}\s]+|[\p{P}\p{S}\s]+$/gu;

/**
 * Applies the agreed short-response normalization to a student response or to an
 * accepted answer. See documentation/FEATURES/short-response-grading.md; any change
 * here changes students' scores, so keep that document and its tests in step.
 *
 * Spelling is deliberately left untouched: there is no correction or fuzzy matching.
 */
export function normalizeShortResponse(text: string): string {
  return text
    .normalize("NFD")
    .replace(STRESS_MARKS, "")
    .normalize("NFC")
    .replace(WHITESPACE_RUNS, " ")
    .toLocaleLowerCase("bg-BG")
    .replace(DASH_VARIANTS, "-")
    .replace(SURROUNDING_PUNCTUATION_AND_SPACE, "");
}
