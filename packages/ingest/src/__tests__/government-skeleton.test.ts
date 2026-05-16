import { describe, expect, it } from "vitest";
import { governmentSkeletonData } from "../government-skeleton";

describe("government skeleton", () => {
  it("contains unique deterministic ids", () => {
    const data = governmentSkeletonData();
    expect(new Set(data.people.map((item) => item.id)).size).toBe(data.people.length);
    expect(new Set(data.governments.map((item) => item.id)).size).toBe(data.governments.length);
    expect(new Set(data.roles.map((item) => item.id)).size).toBe(data.roles.length);
    expect(new Set(data.events.map((item) => item.id)).size).toBe(data.events.length);
  });

  it("keeps the current period first and all governments manual-curated", () => {
    const data = governmentSkeletonData();
    expect(data.governments[0]?.slug).toBe("bolojan-2025-present");
    expect(data.governments[0]?.endsOn).toBeUndefined();
    expect(data.governments.every((item) => item.basis === "manual_curation")).toBe(true);
  });

  it("sorts government starts newest to oldest", () => {
    const starts = governmentSkeletonData().governments.map((item) => item.startsOn);
    expect(starts).toEqual([...starts].sort((a, b) => b.localeCompare(a)));
  });
});
