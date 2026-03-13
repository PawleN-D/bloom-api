import { AsyncLocalStorage } from "node:async_hooks";
import type { PrismaClient } from "@prisma/client";

export type DatabaseRequestContext = {
  tenantId: string | null;
  userId: string | null;
  bypassRls: boolean;
};

export type WorkerEnv = {
  HYPERDRIVE?: {
    connectionString: string;
  };
};

type RequestContextStore = {
  database: DatabaseRequestContext;
  env?: WorkerEnv;
  prisma?: PrismaClient;
};

const requestContextStorage = new AsyncLocalStorage<RequestContextStore>();
const requestContextStorage = new AsyncLocalStorage<DatabaseRequestContext>();
const workerEnvStorage = new AsyncLocalStorage<WorkerEnv>();

export const defaultDatabaseRequestContext: DatabaseRequestContext = {
  tenantId: null,
  userId: null,
  bypassRls: false,
};

function getOrCreateStore(): RequestContextStore {
  return requestContextStorage.getStore() ?? { database: { ...defaultDatabaseRequestContext } };
}

export function runWithRequestContext<T>(
  store: RequestContextStore,
  callback: () => T
): T {
  return requestContextStorage.run(store, callback);
}

export function setDatabaseRequestContext(context: DatabaseRequestContext) {
  const store = getOrCreateStore();
  store.database = context;
  requestContextStorage.enterWith(store);
}

export function getDatabaseRequestContext() {
  return requestContextStorage.getStore()?.database;
}

export function setWorkerEnv(env: WorkerEnv) {
  const store = getOrCreateStore();
  store.env = env;
  requestContextStorage.enterWith(store);
}

export function getWorkerEnv(): WorkerEnv | undefined {
  return requestContextStorage.getStore()?.env;
}

export function setRequestPrisma(prisma: PrismaClient) {
  const store = getOrCreateStore();
  store.prisma = prisma;
  requestContextStorage.enterWith(store);
}

export function getRequestPrisma(): PrismaClient | undefined {
  return requestContextStorage.getStore()?.prisma;
}

export function runWithWorkerEnv<T>(env: WorkerEnv, callback: () => T): T {
  return workerEnvStorage.run(env, callback);
}

export function getWorkerEnv(): WorkerEnv | undefined {
  return workerEnvStorage.getStore();
}
