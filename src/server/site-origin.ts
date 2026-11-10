import "server-only";

/** A configured origin avoids trusting arbitrary Host headers or inventing a domain. */
export function getSiteOrigin(environment: Record<string, string | undefined> = process.env): URL | undefined {
  const value = environment.SITE_URL;
  if (!value) return undefined;
  if (!URL.canParse(value)) throw new Error("Invalid SITE_URL configuration.");
  const url = new URL(value);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("SITE_URL must be an HTTP(S) origin without credentials, path, query, or fragment.");
  }
  return url;
}
