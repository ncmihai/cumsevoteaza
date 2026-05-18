import type { ChamberId, Legislature } from "@cumsevoteaza/parliament-model";

type CountedChamber = Extract<ChamberId, "deputies" | "senate">;

export const chamberSeatCountsByLegislature: Record<string, Record<CountedChamber, number>> = {
  "2024-2028": { senate: 134, deputies: 331 },
  "2020-2024": { senate: 136, deputies: 330 },
  "2016-2020": { senate: 136, deputies: 329 },
  "2012-2016": { senate: 176, deputies: 412 },
  "2008-2012": { senate: 137, deputies: 334 },
  "2004-2008": { senate: 137, deputies: 314 },
  "2000-2004": { senate: 140, deputies: 345 },
  "1996-2000": { senate: 143, deputies: 343 },
  "1992-1996": { senate: 143, deputies: 341 },
  "1990-1992": { senate: 119, deputies: 396 }
};

export function chamberSeatCount(chamber: ChamberId, date: string, legislatures: Legislature[]): number | undefined {
  if (chamber !== "deputies" && chamber !== "senate") return undefined;
  const legislature = legislatures.find((item) => item.startsOn <= date && item.endsOn >= date);
  return legislature ? chamberSeatCountForLegislature(chamber, legislature) : undefined;
}

export function chamberSeatCountForLegislature(chamber: ChamberId, legislature: Legislature): number | undefined {
  if (chamber !== "deputies" && chamber !== "senate") return undefined;
  return chamberSeatCountsByLegislature[legislature.label]?.[chamber];
}
