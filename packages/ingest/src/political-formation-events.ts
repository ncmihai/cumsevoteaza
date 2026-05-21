import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { createDbSession } from "@cumsevoteaza/db";
import * as schema from "@cumsevoteaza/db";
import type { PoliticalFormationEvent } from "@cumsevoteaza/parliament-model";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultEventsPath = path.join(repoRoot, "data/curated/political-formation-events.json");

export async function loadPoliticalFormationEvents(eventsPath = defaultEventsPath): Promise<PoliticalFormationEvent[]> {
  return JSON.parse(await readFile(eventsPath, "utf8")) as PoliticalFormationEvent[];
}

export async function seedPoliticalFormationEvents(options: { eventsPath?: string } = {}) {
  const events = await loadPoliticalFormationEvents(options.eventsPath);
  const session = createDbSession();
  try {
    for (const event of events) {
      await session.db
        .insert(schema.politicalFormationEvents)
        .values({
          id: event.id,
          date: event.date,
          eventType: event.eventType,
          titleRo: event.titleRo,
          titleEn: event.titleEn,
          descriptionRo: event.descriptionRo,
          descriptionEn: event.descriptionEn,
          sourceUrl: event.sourceUrl,
          sourceKind: event.sourceKind
        })
        .onConflictDoUpdate({
          target: schema.politicalFormationEvents.id,
          set: {
            date: event.date,
            eventType: event.eventType,
            titleRo: event.titleRo,
            titleEn: event.titleEn,
            descriptionRo: event.descriptionRo,
            descriptionEn: event.descriptionEn,
            sourceUrl: event.sourceUrl,
            sourceKind: event.sourceKind
          }
        });

      if (event.entities.length > 0) {
        await session.db
          .insert(schema.politicalFormationEventEntities)
          .values(
            event.entities.map((entity) => ({
              id: `${event.id}-${entity.entityType}-${entity.entityId}-${entity.role}`,
              eventId: event.id,
              entityType: entity.entityType,
              entityId: entity.entityId,
              role: entity.role
            }))
          )
          .onConflictDoUpdate({
            target: schema.politicalFormationEventEntities.id,
            set: {
              eventId: sql`excluded.event_id`,
              entityType: sql`excluded.entity_type`,
              entityId: sql`excluded.entity_id`,
              role: sql`excluded.role`
            }
          });
      }
    }

    return {
      events: events.length,
      entities: events.reduce((sum, event) => sum + event.entities.length, 0)
    };
  } finally {
    await session.close();
  }
}
