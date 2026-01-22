import { PrismaClient } from "@prisma/client";
import { after } from "node:test";

const prisma = new PrismaClient();

beforeAll(async () => {
  // Run any setup code before all tests, e.g., migrations
  await prisma.$connect();
});

afterAll(async () => {
  // Clean up after all tests are done
  await prisma.$disconnect();
});

afterEach(async () => {
    const tableNames = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname='public';
    `;
    for (const { tablename } of tableNames) {
      if (tablename !== "_prisma_migrations") {
        try {
            await prisma.$executeRawUnsafe(
          `TRUNCATE TABLE "public"."${tablename}" CASCADE;`
        )
        } catch (error) {
            console.log({ error })
        }
      }
    }
})

export { prisma };