import "server-only";
import type { Metadata } from "next";
import { getSiteOrigin } from "@/server/site-origin";
export { getSiteOrigin } from "@/server/site-origin";

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
