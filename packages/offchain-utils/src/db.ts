import knex, { Knex } from "knex";
import { intFromEnv } from "./configuration";

const DEFAULT_MIN_POOL_CONNECTIONS = 0;
const DEFAULT_MAX_POOL_CONNECTIONS = 1;
const DEFAULT_CONNECTION_STRING =
  "postgresql://nocturne_db_user:password@localhost:5432/nocturne?searchPath=nocturne";

/**
 * Creates a Knex pool for the offchain database.
 *
 * Env configuration
 * - PG_CONNECTION_STRING: the connection string for the database
 * - CONNECTION_POOL_MIN: the minimum number of connections in the pool, default = 0
 * - CONNECTION_POOL_MAX: the maximum number of connections in the pool, default = 1
 * - ASYNC_STACK_TRACES: whether to enable async stack traces (performance hit), default = false
 * - ACQUIRE_CONNECTION_TIMEOUT_MS: the timeout for acquiring a connection, default = 10
 * - COMPILE_SQL_ON_ERROR: whether to compile SQL on error, default = false (this can leak secrets)
 *
 * @returns a Knex pool
 * @throws if PG_CONNECTION_STRING is not set
 */
export function createPool(): Knex<any, unknown[]> {
  const connectionString =
    process.env.PG_CONNECTION_STRING ?? DEFAULT_CONNECTION_STRING;

  let minPoolConnecttions = intFromEnv("CONNECTION_POOL_MIN");
  if (!minPoolConnecttions) {
    minPoolConnecttions = DEFAULT_MIN_POOL_CONNECTIONS;
  }

  let maxPoolConnecttions = intFromEnv("CONNECTION_POOL_MAX");
  if (!maxPoolConnecttions) {
    maxPoolConnecttions = DEFAULT_MAX_POOL_CONNECTIONS;
  }

  const asyncStackTraces = process.env.ASYNC_STACK_TRACES;

  let acquireConnectionTimeout = intFromEnv("ACQUIRE_CONNECTION_TIMEOUT_MS");
  if (!acquireConnectionTimeout) {
    acquireConnectionTimeout = 10000;
  }

  const compileSqlOnError = process.env.COMPILE_SQL_ON_ERROR;

  const db = knex({
    client: "pg",
    connection: connectionString,
    searchPath: ["nocturne", "nocturne"],
    asyncStackTraces: asyncStackTraces?.toLowerCase() === "true",
    compileSqlOnError: compileSqlOnError?.toLowerCase() === "true",
    acquireConnectionTimeout: acquireConnectionTimeout,
    pool: {
      min: minPoolConnecttions,
      max: maxPoolConnecttions,
    },
  });

  process.on("SIGINT", () => {
    console.log("Received SIGINT. Cleaning up database connection pool...");
    db.destroy()
      .then(() => {
        console.log("Database connection pool cleaned up. Exiting...");
        process.exit(0);
      })
      .catch((err) => {
        console.error("Error cleaning up database connection pool:", err);
        process.exit(1);
      });
  });

  process.on("SIGTERM", () => {
    console.log("Received SIGTERM. Cleaning up database connection pool...");
    db.destroy()
      .then(() => {
        console.log("Database connection pool cleaned up. Exiting...");
        process.exit(0);
      })
      .catch((err) => {
        console.error("Error cleaning up database connection pool:", err);
        process.exit(1);
      });
  });

  return db;
}
