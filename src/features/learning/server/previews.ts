import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { requireAdmin } from "@/features/admin/server/authorization";
import { getDatabase } from "@/server/database";
import { editorialId, parseEditorialInput } from "@/server/editorial";
import { learningKindSchema } from "./publication";

export async function readLearningPreview(kindInput: unknown, idInput: unknown, requestHeaders: Headers, database?: PrismaClient) {
  await requireAdmin(requestHeaders);
  const kind = parseEditorialInput(learningKindSchema, kindInput);
  const id = parseEditorialInput(editorialId, idInput);
  const connection = database ?? getDatabase();
  switch (kind) {
    case "author": return { kind, record: await connection.author.findUniqueOrThrow({ where: { id } }) };
    case "work": return { kind, record: await connection.work.findUniqueOrThrow({ where: { id }, include: { author: { select: { name: true } } } }) };
    case "topic": return { kind, record: await connection.topic.findUniqueOrThrow({ where: { id } }) };
    case "lesson": return { kind, record: await connection.lesson.findUniqueOrThrow({ where: { id }, include: { topic: { select: { title: true } } } }) };
  }
}
