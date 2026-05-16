import { drizzle } from "drizzle-orm/postgres-js";
import { readFileSync } from "node:fs";
import postgres from "postgres";
import * as schema from "./schema";

export function createDb(databaseUrl = process.env.DATABASE_URL) {
  return createDbSession(databaseUrl).db;
}

export function createDbSession(databaseUrl = process.env.DATABASE_URL) {
  const resolvedUrl = databaseUrl ?? readRootEnv().DATABASE_URL;
  if (!resolvedUrl) {
    throw new Error("DATABASE_URL is required to create the database client.");
  }

  const client = postgres(resolvedUrl, { max: 1 });
  return {
    db: drizzle(client, { schema }),
    close: () => client.end()
  };
}

function readRootEnv(): Record<string, string> {
  try {
    const raw = readFileSync(new URL("../../../.env", import.meta.url), "utf8");
    return Object.fromEntries(
      raw
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#") && line.includes("="))
        .map((line) => {
          const index = line.indexOf("=");
          return [line.slice(0, index), line.slice(index + 1).replace(/^"|"$/g, "")];
        })
    );
  } catch {
    return {};
  }
}
