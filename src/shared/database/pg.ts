import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";
import { getWorkerEnv } from "./request-context";

type HyperdriveConnection = {
  connectionString: string;
};

const pools = new Map<string, Pool>();

function resolveConnection(): HyperdriveConnection {
  const envConnection = getWorkerEnv()?.HYPERDRIVE?.connectionString;
  const connectionString = envConnection || process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "No database connection string available. Expected env.HYPERDRIVE.connectionString or DATABASE_URL."
    );
  }

  return { connectionString };
}

export function getDbPool() {
  const { connectionString } = resolveConnection();
  let pool = pools.get(connectionString);

  if (!pool) {
    pool = new Pool({ connectionString });
    pools.set(connectionString, pool);
  }

  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  return getDbPool().query<T>(sql, params);
}

export async function withDbClient<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getDbPool().connect();
  try {
    return await callback(client);
  } finally {
    client.release();
  }
}
