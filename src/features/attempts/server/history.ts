import "server-only";

import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { getDatabase } from "@/server/database";
import type { HistoryItem } from "../history-item";
import { attemptResultSchema } from "./result";

const pageSize = 10;
const cursorSchema = z.tuple([z.iso.datetime(), z.uuid()]);

function encodeCursor(completedAt: Date, id: string) {
  return Buffer.from(JSON.stringify([completedAt.toISOString(), id])).toString("base64url");
}

function decodeCursor(value: string | undefined) {
  if (!value) return null;
  try {
    const [completedAt, id] = cursorSchema.parse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
    return { completedAt: new Date(completedAt), id };
  } catch {
    return null;
  }
}

/**
 * A signed-in student's finished attempts, newest first. Only the student's own rows are ever selected: the account id
 * comes from the verified session, never from the request.
 */
export async function listStudentHistory(userId: string, cursor?: string, database: PrismaClient = getDatabase()) {
  const after = decodeCursor(cursor);
  const rows = await database.attempt.findMany({
    where: {
      userId, state: { in: ["SUBMITTED", "EXPIRED"] }, completedAt: { not: null },
      ...(after ? { OR: [{ completedAt: { lt: after.completedAt } }, { completedAt: after.completedAt, id: { lt: after.id } }] } : {}),
    },
    orderBy: [{ completedAt: "desc" }, { id: "desc" }],
    take: pageSize + 1,
    select: { id: true, mode: true, title: true, completedAt: true, result: true, _count: { select: { questions: true } } },
  });
  const page = rows.slice(0, pageSize);
  const items: HistoryItem[] = page.map((row) => {
    const result = row.result === null ? null : attemptResultSchema.parse(row.result);
    return {
      id: row.id, mode: row.mode, title: row.title, completedAt: (row.completedAt as Date).toISOString(),
      totalQuestions: row._count.questions, answered: result?.answered ?? 0, selfReview: result?.selfReview ?? 0,
      points: result !== null && result.objectiveMaximumPoints > 0 ? { earned: result.earnedPoints, maximum: result.objectiveMaximumPoints } : null,
    };
  });
  const last = page.at(-1);
  const nextCursor = rows.length > pageSize && last?.completedAt ? encodeCursor(last.completedAt, last.id) : null;
  return { items, nextCursor };
}
