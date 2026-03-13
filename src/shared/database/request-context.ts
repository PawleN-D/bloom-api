import { AsyncLocalStorage } from "node:async_hooks";

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

const requestContextStorage = new AsyncLocalStorage<DatabaseRequestContext>();
const workerEnvStorage = new AsyncLocalStorage<WorkerEnv>();

export const defaultDatabaseRequestContext: DatabaseRequestContext = {
  tenantId: null,
  userId: null,
  bypassRls: false,
};

export function setDatabaseRequestContext(context: DatabaseRequestContext) {
  requestContextStorage.enterWith(context);
}

export function getDatabaseRequestContext() {
  return requestContextStorage.getStore();
}

export function runWithWorkerEnv<T>(env: WorkerEnv, callback: () => T): T {
  return workerEnvStorage.run(env, callback);
}

export function getWorkerEnv(): WorkerEnv | undefined {
  return workerEnvStorage.getStore();
}
