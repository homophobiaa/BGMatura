import "server-only";
import { cache } from "react";

import { findPublishedAuthorBySlug } from "@/features/literature/server/authors";
import { findPublishedWorkBySlug } from "@/features/literature/server/works";
import { findPublishedLessonBySlug } from "@/features/language/server/lessons";

// Request-scoped React memoization shares one public reading between metadata/page.
export const readPublicAuthor = cache((slug: string) => findPublishedAuthorBySlug(slug));
export const readPublicWork = cache((slug: string) => findPublishedWorkBySlug(slug));
export const readPublicLesson = cache((slug: string) => findPublishedLessonBySlug(slug));
