import { randomUUID } from "node:crypto";

import pg from "pg";
import { describe, expect, it, vi } from "vitest";

import { listTopicChildren } from "@/features/topics/server/topics";
import type { Prisma } from "@/generated/prisma/client";
import { getDatabase } from "@/server/database";

import { withDatabaseFixture } from "./fixtures";

function topicData(title: string, parentId?: string) {
  return {
    title, slug: `fixture-${randomUUID()}`, subject: "BULGARIAN_LANGUAGE" as const,
    ...(parentId ? { parentId } : {}),
  };
}

async function createHierarchy(database: Prisma.TransactionClient) {
  const parent = await database.topic.create({ data: topicData("Корен") });
  const child = await database.topic.create({ data: topicData("Подтема", parent.id) });
  const grandchild = await database.topic.create({ data: topicData("Вложена подтема", child.id) });
  return { parent, child, grandchild };
}

describe("topic hierarchy integrity", () => {
  it("persists subtopics and draft metadata with stable sibling ordering", async () => {
    await withDatabaseFixture(async (database) => {
      const root = await database.topic.create({ data: topicData("Корен") });
      const later = await database.topic.create({ data: { ...topicData("Б", root.id), position: 2 } });
      const earlier = await database.topic.create({ data: { ...topicData("А", root.id), position: 1 } });
      const topics = await listTopicChildren("BULGARIAN_LANGUAGE", root.id, database);
      expect(topics.map((topic) => topic.id)).toEqual([earlier.id, later.id]);
      expect(topics.every((topic) => topic.status === "DRAFT")).toBe(true);
      expect(topics[0]?.createdAt).toBeInstanceOf(Date);
    });
  });

  it("rejects a missing parent", async () => {
    await withDatabaseFixture(async (database) => {
      await expect(database.topic.create({ data: topicData("Подтема", randomUUID()) }))
        .rejects.toMatchObject({ code: "P2003" });
    });
  });

  it("uses the ID as a stable tie-breaker for equally named siblings", async () => {
    await withDatabaseFixture(async (database) => {
      const root = await database.topic.create({ data: topicData("Корен") });
      const first = await database.topic.create({ data: topicData("Еднакво заглавие", root.id) });
      const second = await database.topic.create({ data: topicData("Еднакво заглавие", root.id) });
      const ordered = await listTopicChildren("BULGARIAN_LANGUAGE", root.id, database);
      expect(ordered.map((topic) => topic.id)).toEqual([first.id, second.id].sort());
    });
  });

  it("rejects a parent from another subject", async () => {
    await withDatabaseFixture(async (database) => {
      const parent = await database.topic.create({ data: { ...topicData("Литература"), subject: "LITERATURE" } });
      await expect(database.topic.create({ data: topicData("Език", parent.id) })).rejects.toThrow();
    });
  });

  it("rejects self-parenting", async () => {
    await withDatabaseFixture(async (database) => {
      const topic = await database.topic.create({ data: topicData("Корен") });
      await expect(database.topic.update({ where: { id: topic.id }, data: { parentId: topic.id } }))
        .rejects.toThrow();
    });
  });

  it("rejects a cycle through multiple ancestors", async () => {
    await withDatabaseFixture(async (database) => {
      const { parent, grandchild } = await createHierarchy(database);
      await expect(database.topic.update({ where: { id: parent.id }, data: { parentId: grandchild.id } }))
        .rejects.toThrow();
    });
  });

  it("allows valid reparenting", async () => {
    await withDatabaseFixture(async (database) => {
      const { parent, child, grandchild } = await createHierarchy(database);
      const moved = await database.topic.update({ where: { id: grandchild.id }, data: { parentId: parent.id } });
      expect(moved.parentId).toBe(parent.id);
      expect((await listTopicChildren("BULGARIAN_LANGUAGE", child.id, database)).length).toBe(0);
    });
  });

  it("restricts deletion of a topic that still has children", async () => {
    await withDatabaseFixture(async (database) => {
      const { parent } = await createHierarchy(database);
      await expect(database.topic.delete({ where: { id: parent.id } })).rejects.toMatchObject({ code: "P2003" });
    });
  });

  it("allows deletion of an unused leaf", async () => {
    await withDatabaseFixture(async (database) => {
      const { grandchild } = await createHierarchy(database);
      await database.topic.delete({ where: { id: grandchild.id } });
      expect(await database.topic.findUnique({ where: { id: grandchild.id } })).toBeNull();
    });
  });

  it("enforces a unique slug within each subject", async () => {
    await withDatabaseFixture(async (database) => {
      const data = topicData("Тема");
      await database.topic.create({ data });
      await expect(database.topic.create({ data })).rejects.toMatchObject({ code: "P2002" });
    });
  });

  it("rejects a cycle formed by concurrent reparenting transactions", async () => {
    const database = getDatabase();
    const firstId = randomUUID();
    const secondId = randomUUID();
    const ownedIds = [firstId, secondId];
    const firstConnection = new pg.Client({ connectionString: process.env.DATABASE_URL });
    const secondConnection = new pg.Client({ connectionString: process.env.DATABASE_URL });

    try {
      await database.topic.createMany({ data: [
        { ...topicData("Първа тестова тема"), id: firstId },
        { ...topicData("Втора тестова тема"), id: secondId },
      ] });
      await firstConnection.connect();
      await secondConnection.connect();
      const identity = await secondConnection.query<{ pid: number }>("SELECT pg_backend_pid() AS pid");
      const secondPid = identity.rows[0]?.pid;
      if (!secondPid) throw new Error("The test connection did not return a backend ID");

      await firstConnection.query("BEGIN");
      await secondConnection.query("BEGIN");
      await firstConnection.query('UPDATE "Topic" SET "parentId" = $1 WHERE "id" = $2', [secondId, firstId]);
      const competingUpdate = secondConnection
        .query('UPDATE "Topic" SET "parentId" = $1 WHERE "id" = $2', [firstId, secondId])
        .then(() => null, (error: unknown) => error);

      await vi.waitFor(async () => {
        const locks = await firstConnection.query<{ waiting: boolean }>(
          "SELECT EXISTS (SELECT 1 FROM pg_locks WHERE pid = $1 AND locktype = 'advisory' AND NOT granted) AS waiting",
          [secondPid],
        );
        expect(locks.rows[0]?.waiting).toBe(true);
      }, { timeout: 3000, interval: 25 });

      await firstConnection.query("COMMIT");
      expect(await competingUpdate).toMatchObject({ code: "23514" });
      await secondConnection.query("ROLLBACK");
    } finally {
      await firstConnection.end();
      await secondConnection.end();
      // Only records created by this test are touched; all normal fixtures use rollback.
      await database.topic.updateMany({ where: { id: { in: ownedIds } }, data: { parentId: null } });
      await database.topic.deleteMany({ where: { id: { in: ownedIds } } });
    }
  });
});
