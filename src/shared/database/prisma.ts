import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import {
  defaultDatabaseRequestContext,
  getDatabaseRequestContext,
  getRequestPrisma,
} from "./request-context";

const outOfRequestContext = {
  ...defaultDatabaseRequestContext,
  bypassRls: true,
};

const resolveDatabaseContext = () =>
  getDatabaseRequestContext() ?? outOfRequestContext;

function getActivePrismaClient() {
  const requestPrisma = getRequestPrisma();
  if (requestPrisma) {
    return requestPrisma;
  }

  throw new Error(
    "Prisma client is not available in this request context. Create it inside fetch and bind it per request."
  );
}

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

export function createRequestPrismaClient(env: { HYPERDRIVE?: { connectionString: string } }) {
  const connectionString = env.HYPERDRIVE?.connectionString;

  if (!connectionString) {
    throw new Error("Missing env.HYPERDRIVE.connectionString for Prisma adapter initialization.");
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);

  const basePrisma = new PrismaClient({
    adapter: adapter as any,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  } as any);

  return basePrisma.$extends({
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
  }) as PrismaClient;
}

const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getActivePrismaClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
}) as PrismaClient;

export async function runInTenantTransaction<T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>
) {
  const context = resolveDatabaseContext();
  const requestPrisma = getActivePrismaClient();

  return requestPrisma.$transaction(async (tx) => {
    await applyDatabaseContext(tx, context);
    return callback(tx);
  });
}

export { prisma };
