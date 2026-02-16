import { AsyncLocalStorage } from 'node:async_hooks';

export type DatabaseRequestContext = {
  tenantId: string | null;
  userId: string | null;
  bypassRls: boolean;
};

const requestContextStorage = new AsyncLocalStorage<DatabaseRequestContext>();

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
