import { describe, expect, it } from "vitest";
import { governmentSkeletonData } from "../government-skeleton";

describe("government skeleton", () => {
  it("contains unique deterministic ids", () => {
    const data = governmentSkeletonData();
    expect(new Set(data.people.map((item) => item.id)).size).toBe(data.people.length);
    expect(new Set(data.governments.map((item) => item.id)).size).toBe(data.governments.length);
    expect(new Set(data.roles.map((item) => item.id)).size).toBe(data.roles.length);
    expect(new Set(data.events.map((item) => item.id)).size).toBe(data.events.length);
    expect(new Set(data.partyAlignments.map((item) => item.id)).size).toBe(data.partyAlignments.length);
  });

  it("keeps the current period first and all governments manual-curated", () => {
    const data = governmentSkeletonData();
    expect(data.governments[0]?.slug).toBe("bolojan-acting-2026");
    expect(data.governments[0]?.endsOn).toBeUndefined();
    expect(data.governments.every((item) => item.basis === "manual_curation")).toBe(true);
  });

  it("seeds dated party alignments for known coalitions and support", () => {
    const data = governmentSkeletonData();
    expect(data.partyAlignments).toContainEqual(
      expect.objectContaining({
        governmentId: "government-bolojan-2025-present",
        partyId: "party-psd",
        alignment: "government",
        startsOn: "2025-06-23",
        endsOn: "2026-04-24"
      })
    );
    expect(data.partyAlignments).toContainEqual(
      expect.objectContaining({
        governmentId: "government-vacaroiu-1992-1996",
        partyId: "party-prm",
        alignment: "governing_support"
      })
    );
  });

  it("sorts government starts newest to oldest", () => {
    const starts = governmentSkeletonData().governments.map((item) => item.startsOn);
    expect(starts).toEqual([...starts].sort((a, b) => b.localeCompare(a)));
  });
});
