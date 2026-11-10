import "server-only";

import type { Prisma } from "@/generated/prisma/client";

/** Only roots and descendants with an entirely published ancestry are visible. */
export async function publishedTopicIds(database: Pick<Prisma.TransactionClient, "topic">) {
  const topics = await database.topic.findMany({
    where: { status: "PUBLISHED" },
    select: { id: true, parentId: true },
  });
  const children = new Map<string | null, string[]>();
  for (const topic of topics) {
    const siblings = children.get(topic.parentId) ?? [];
    siblings.push(topic.id);
    children.set(topic.parentId, siblings);
  }
  const visible = new Set<string>();
  const remaining = [...(children.get(null) ?? [])];
  for (const id of remaining) {
    visible.add(id);
    for (const child of children.get(id) ?? []) remaining.push(child);
  }
  return visible;
}
