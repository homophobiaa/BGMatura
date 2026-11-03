import "server-only";
import { z } from "zod";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { requireAdmin, requireMutationOrigin } from "@/features/admin/server/authorization";
import { getDatabase } from "./database";

export class EditorialError extends Error {
  constructor(public readonly code: "invalid" | "conflict" | "not-found" | "linked" | "unpublish-required", message: string,
    public readonly fields: Readonly<Record<string, string[]>> = {}) {
    super(message);
  }
}

export function parseEditorialInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const name = issue.path.join(".") || "input";
      (fields[name] ??= []).push(issue.message);
    }
    throw new EditorialError("invalid", "Check the highlighted fields.", fields);
  }
  return parsed.data;
}

/** Authorization and CSRF checks apply even to direct service calls. */
export async function editorialMutation<T>(requestHeaders: Headers,
  operation: (transaction: Prisma.TransactionClient, admin: Awaited<ReturnType<typeof requireAdmin>>) => Promise<T>,
  database?: PrismaClient,
): Promise<T> {
  const admin = await requireAdmin(requestHeaders);
  requireMutationOrigin(requestHeaders);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await (database ?? getDatabase()).$transaction((transaction) => operation(transaction, admin), {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2034" && attempt < 2) continue;
        if (error.code === "P2002") throw new EditorialError("conflict", "This slug or identifier is already in use.", { slug: ["Choose a unique slug."] });
        if (error.code === "P2003") throw new EditorialError("linked", "A required relation is missing or still in use.");
        if (error.code === "P2025") throw new EditorialError("not-found", "The record no longer exists.");
        if (error.code === "P2034") throw new EditorialError("conflict", "The record changed. Reload and try again.");
      }
      throw error;
    }
  }
  throw new EditorialError("conflict", "The record changed. Reload and try again.");
}

export const editorialId = z.uuid();
export const editorialSlug = z.string().trim().max(200).transform((value) => value.normalize("NFC").toLowerCase())
  .pipe(z.string().regex(/^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u, "Use letters, numbers, and single hyphens."));
export const editorialTitle = z.string().trim().min(1).max(200);
export const draftIdentity = { id: editorialId.optional(), expectedUpdatedAt: z.iso.datetime().optional() };

export function checkDraftVersion(record: { status: string; updatedAt: Date }, expectedUpdatedAt: string | undefined) {
  if (record.status !== "DRAFT") throw new EditorialError("unpublish-required", "Unpublish this record before editing it.");
  if (!expectedUpdatedAt || record.updatedAt.toISOString() !== expectedUpdatedAt) {
    throw new EditorialError("conflict", "The draft changed. Reload it before saving.");
  }
}
