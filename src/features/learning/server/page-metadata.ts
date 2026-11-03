import "server-only";
import type { Metadata } from "next";

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

export function learningPageMetadata(title: string, description: string, path: string): Metadata {
  const origin = getSiteOrigin();
  return {
    title: `${title} — BG Matura`,
    description,
    ...(origin ? { alternates: { canonical: new URL(path, origin).toString() } } : {}),
  };
}

export function missingLearningMetadata(): Metadata {
  return { title: "Материалът не е намерен — BG Matura", robots: { index: false, follow: false } };
}

export function studyDescription(text: string | null, fallback: string): string {
  return text?.trim().replace(/\s+/gu, " ").slice(0, 160) || fallback;
}
