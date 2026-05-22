import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { PoliticalFormationEvent } from "@cumsevoteaza/parliament-model";

const events = JSON.parse(readFileSync("../../data/curated/political-formation-events.json", "utf8")) as PoliticalFormationEvent[];

describe("curated political formation events", () => {
  it("keeps deterministic unique event and relation ids", () => {
    expect(new Set(events.map((event) => event.id)).size).toBe(events.length);

    const relationIds = events.flatMap((event) =>
      event.entities.map((entity) => `${event.id}-${entity.entityType}-${entity.entityId}-${entity.role}`)
    );
    expect(new Set(relationIds).size).toBe(relationIds.length);
  });

  it("covers the reviewed high-impact post-1989 party roots", () => {
    const ids = new Set(events.map((event) => event.id));

    expect(ids).toContain("formation-event-fdsn-splits-from-fsn-1992-04-07");
    expect(ids).toContain("formation-event-fsn-renamed-pd-1993-05-28");
    expect(ids).toContain("formation-event-pntcd-reestablished-1989-12-22");
    expect(ids).toContain("formation-event-punr-founded-1990-03-15");
    expect(ids).toContain("formation-event-psm-founded-1990-11-16");
    expect(ids).toContain("formation-event-ppdd-founded-2011-09-19");
    expect(ids).toContain("formation-event-usr-founded-2016-08-21");
    expect(ids).toContain("formation-event-plus-founded-2018-12-15");
  });

  it("keeps alliances as formation entities, not party entities", () => {
    const allianceEvents = events.filter((event) => event.eventType === "alliance_formed" || event.eventType === "alliance_dissolved");

    expect(allianceEvents.length).toBeGreaterThan(0);
    for (const event of allianceEvents) {
      expect(event.entities.some((entity) => entity.entityType === "formation" && entity.role === "subject")).toBe(true);
    }
  });
});
