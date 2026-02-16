import { Prisma, PrismaClient } from "@prisma/client";
import {
  defaultDatabaseRequestContext,
  getDatabaseRequestContext,
} from "./request-context";

const basePrisma = new PrismaClient({
  log:
    process.env.NODE_ENV === "development"
      ? ["query", "error", "warn"]
      : ["error"],
});

const outOfRequestContext = {
  ...defaultDatabaseRequestContext,
  bypassRls: true,
};

const resolveDatabaseContext = () =>
  getDatabaseRequestContext() ?? outOfRequestContext;

const modelToDelegateName = (model: string) =>
  model.charAt(0).toLowerCase() + model.slice(1);

const applyDatabaseContext = async (
  tx: Prisma.TransactionClient,
  context: {
    tenantId: string | null;
    userId: string | null;
    bypassRls: boolean;
  }
) => {
  await tx.$executeRaw`
    SELECT
      set_config('app.current_tenant', ${context.tenantId ?? ""}, true),
      set_config('app.current_user_id', ${context.userId ?? ""}, true),
      set_config('app.bypass_rls', ${context.bypassRls ? "on" : "off"}, true)
  `;
};

const runModelOperation = async (
  tx: Prisma.TransactionClient,
  model: string,
  operation: string,
  args: any,
  context: {
    tenantId: string | null;
    userId: string | null;
    bypassRls: boolean;
  }
) => {
  const delegate = (tx as Record<string, any>)[modelToDelegateName(model)];
  if (!delegate || typeof delegate[operation] !== "function") {
    throw new Error(`Unsupported Prisma operation: ${model}.${operation}`);
  }

  if (!context.bypassRls && model === "User" && operation === "delete") {
    return delegate.update({
      where: args.where,
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });
  }

  if (!context.bypassRls && model === "User" && operation === "deleteMany") {
    return delegate.updateMany({
      where: args?.where,
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });
  }

  return delegate[operation](args);
};

const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args }) {
        const context = resolveDatabaseContext();
        return basePrisma.$transaction(async (tx) => {
          await applyDatabaseContext(tx, context);
          return runModelOperation(tx, model, operation, args, context);
        });
      },
    },
  },
});

export async function runInTenantTransaction<T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>
) {
  const context = resolveDatabaseContext();
  return basePrisma.$transaction(async (tx) => {
    await applyDatabaseContext(tx, context);
    return callback(tx);
  });
}

export { prisma };
