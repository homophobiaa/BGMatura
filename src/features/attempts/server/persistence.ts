import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { getDatabase } from "@/server/database";
import { AttemptError } from "./errors";

export const accessLifetimeSeconds = 30 * 24 * 60 * 60;
const ownerTokenPattern = /^[A-Za-z0-9_-]{43}$/;

export interface AttemptAccess {
  readonly id: string;
  readonly token?: string | undefined;
  /**
   * A signed-in student's own id, set only by server code that has verified the session. It opens an attempt linked to
   * that account from any device, without the browser token, and without the 30-day token expiry.
   */
  readonly userId?: string | undefined;
}

export function createOwnerToken() {
  return randomBytes(32).toString("base64url");
}

export function ownerDigest(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function databaseClock(transaction: Prisma.TransactionClient): Promise<Date> {
  const [row] = await transaction.$queryRaw<{ now: Date }[]>`
    SELECT date_trunc('milliseconds', clock_timestamp()) AS "now"
  `;
  if (!row) throw new Error("Database clock unavailable");
  return row.now;
}

export const attemptWithQuestions = {
  questions: { orderBy: { position: "asc" }, include: { snapshot: true } },
  configuration: { select: { targetYear: true, session: true, version: true, verification: true } },
} satisfies Prisma.AttemptInclude;

export type CapturedAttempt = Prisma.AttemptGetPayload<{ include: typeof attemptWithQuestions }>;
export type CapturedQuestion = CapturedAttempt["questions"][number];

export async function startTransaction<T>(database: PrismaClient, operation: (transaction: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let retry = 0; ; retry++) {
    try {
      return await database.$transaction(operation, { isolationLevel: "Serializable", timeout: 15000 });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2034") throw error;
      if (retry === 2) throw new AttemptError("conflict");
    }
  }
}

/** One lock per attempt orders all answer, navigation, and finalization operations. */
export async function withOwnedAttempt<T>(
  access: AttemptAccess,
  operation: (transaction: Prisma.TransactionClient, attempt: CapturedAttempt, now: Date) => Promise<T>,
  database?: PrismaClient,
): Promise<T> {
  const tokenValid = Boolean(access.token) && ownerTokenPattern.test(access.token ?? "");
  const userValid = typeof access.userId === "string" && access.userId.length > 0;
  if (!z.uuid().safeParse(access.id).success || (!tokenValid && !userValid)) throw new AttemptError("not-found");
  // A digest that matches nothing when only the user is known, so one query serves both ways in.
  const digest = tokenValid ? ownerDigest(access.token ?? "") : "";
  const userId = userValid ? access.userId : null;
  return await (database ?? getDatabase()).$transaction(async (transaction) => {
    const rows = await transaction.$queryRaw<{ id: string; viaUser: boolean }[]>`
      SELECT "id", ("userId" IS NOT NULL AND "userId" = ${userId}) AS "viaUser" FROM "Attempt"
      WHERE "id" = ${access.id}::uuid AND (("ownerDigest" = ${digest} AND ${digest} <> '') OR ("userId" IS NOT NULL AND "userId" = ${userId}))
      FOR UPDATE
    `;
    const row = rows[0];
    if (!row) throw new AttemptError("not-found");
    const now = await databaseClock(transaction);
    const attempt = await transaction.attempt.findUniqueOrThrow({ where: { id: access.id }, include: attemptWithQuestions });
    // The browser token expires; an attempt a student chose to keep does not.
    if (!row.viaUser && now >= attempt.accessUntil) throw new AttemptError("not-found");
    return operation(transaction, attempt, now);
  }, { isolationLevel: "ReadCommitted", timeout: 15000 });
}
