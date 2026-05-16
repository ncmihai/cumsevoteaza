import { defineConfig } from "drizzle-kit";
import { readFileSync } from "node:fs";

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? readRootEnv().DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/cumsevoteaza"
  }
});

function readRootEnv(): Record<string, string> {
  try {
    const raw = readFileSync(new URL("../../.env", import.meta.url), "utf8");
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
