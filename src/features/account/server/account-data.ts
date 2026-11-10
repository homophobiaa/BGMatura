import "server-only";

import { deleteAccountAndData as deleteWith, removeStaleAccountData as removeWith } from "@/features/account/data-removal";
import type { PrismaClient } from "@/generated/prisma/client";
import { getDatabase } from "@/server/database";

export const deleteAccountAndData = (userId: string, database: PrismaClient = getDatabase()) => deleteWith(userId, database);
export const removeStaleAccountData = (now?: Date, database: PrismaClient = getDatabase()) => removeWith(database, now);
