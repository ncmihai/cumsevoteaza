import { describe, expect, it } from "vitest";
import { normalizeText } from "../current-legislature-audit";

describe("current legislature audit helpers", () => {
  it("normalizes Romanian titles for fuzzy bill/vote matching", () => {
    expect(normalizeText("Lege privind înființarea unor măsuri - PL-x 42/2025")).toBe(
      "lege privind infiintarea unor masuri pl x 42 2025"
    );
  });
});
