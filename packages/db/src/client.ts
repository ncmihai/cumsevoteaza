import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export function createDb(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to create the database client.");
  }

  const client = postgres(databaseUrl, { max: 1 });
  return drizzle(client, { schema });
}
