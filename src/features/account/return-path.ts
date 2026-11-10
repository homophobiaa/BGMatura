/**
 * Where to send a student after signing in. The value comes from a link, so it is never trusted: only a plain path
 * on this site is accepted, and anything that could lead to another website, a script, or the sign-in page again
 * falls back to the home page.
 */
export function safeReturnPath(value: string | string[] | undefined): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 200) return "/";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  // Control characters, whitespace, and anything that makes the path ambiguous.
  if (/[\u0000- \u007f]/.test(value)) return "/";

  const path = value.split(/[?#]/)[0] ?? "/";
  const loops = ["/vhod", "/registraciya", "/api/"].some((blocked) => path === blocked || path.startsWith(blocked.endsWith("/") ? blocked : `${blocked}/`));

  return loops ? "/" : value;
}
