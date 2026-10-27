import type { Prisma } from "@/generated/prisma/client";
import { getDatabase } from "@/server/database";

/** Successful and failing assertions both roll back all fixture writes. */
export async function withDatabaseFixture(
  exercise: (transaction: Prisma.TransactionClient) => Promise<void>,
): Promise<void> {
  const completed = new Error("Fixture completed; roll back its changes");

  try {
    await getDatabase().$transaction(async (transaction) => {
      await exercise(transaction);
      throw completed;
    }, { timeout: 10000 });
  } catch (error) {
    if (error !== completed) throw error;
  }
}
