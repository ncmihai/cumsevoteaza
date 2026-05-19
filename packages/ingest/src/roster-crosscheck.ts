import { sql } from "drizzle-orm";
import { createDbSession } from "@cumsevoteaza/db";
import type { ChamberId } from "@cumsevoteaza/parliament-model";
import { normalize } from "./parsers/roster";
import type { WikipediaRosterPage, WikipediaRosterRow } from "./parsers/wikipedia-roster";

interface OfficialRosterRow {
  chamber: ChamberId;
  memberId: string;
  displayName: string;
  normalizedName: string;
  partyId?: string;
  partyShortName?: string;
  constituency?: string;
}

interface OfficialRosterSqlRow extends Record<string, unknown> {
  chamber: string;
  member_id: string;
  display_name: string;
  party_id: string | null;
  party_short_name: string | null;
  constituency: string | null;
}

export interface RosterCrosscheckResult {
  source: "wikipedia";
  legislatureId: string;
  legislatureLabel: string;
  totals: {
    wikipediaRows: number;
    officialRows: number;
    matched: number;
    missingOfficial: number;
    missingWikipedia: number;
    partyMismatches: number;
  };
  byChamber: Record<ChamberId, {
    wikipediaRows: number;
    officialRows: number;
    expectedCount?: number;
    matched: number;
    missingOfficial: WikipediaRosterRow[];
    missingWikipedia: OfficialRosterRow[];
    partyMismatches: Array<{
      name: string;
      chamber: ChamberId;
      wikipediaParty?: string;
      officialParty?: string;
      wikipediaConstituency?: string;
      officialConstituency?: string;
      memberId: string;
    }>;
  }>;
}

export async function crosscheckWikipediaRoster(page: WikipediaRosterPage): Promise<RosterCrosscheckResult> {
  const session = createDbSession();
  try {
    const officialRows = await loadOfficialRoster(session.db, page.legislatureId);
    const result: RosterCrosscheckResult = {
      source: "wikipedia",
      legislatureId: page.legislatureId,
      legislatureLabel: page.legislatureLabel,
      totals: {
        wikipediaRows: page.rows.length,
        officialRows: officialRows.length,
        matched: 0,
        missingOfficial: 0,
        missingWikipedia: 0,
        partyMismatches: 0
      },
      byChamber: {
        deputies: emptyChamberResult(page.counts.deputies),
        senate: emptyChamberResult(page.counts.senate)
      }
    };

    for (const chamber of ["deputies", "senate"] as const) {
      const wikipediaRows = page.rows.filter((row) => row.chamber === chamber);
      const officialChamberRows = officialRows.filter((row) => row.chamber === chamber);
      const officialByName = new Map(officialChamberRows.map((row) => [row.normalizedName, row]));
      const officialByTokenKey = bucketBy(officialChamberRows, (row) => tokenKey(row.normalizedName));
      const wikipediaByName = new Map(wikipediaRows.map((row) => [row.normalizedName, row]));
      const wikipediaTokenKeys = new Set(wikipediaRows.map((row) => tokenKey(row.normalizedName)));
      const chamberResult = result.byChamber[chamber];

      chamberResult.wikipediaRows = wikipediaRows.length;
      chamberResult.officialRows = officialChamberRows.length;

      for (const row of wikipediaRows) {
        const official = officialByName.get(row.normalizedName) ?? uniqueBucketItem(officialByTokenKey.get(tokenKey(row.normalizedName)));
        if (!official) {
          chamberResult.missingOfficial.push(row);
          continue;
        }
        chamberResult.matched += 1;
        if (row.partyId && official.partyId && row.partyId !== official.partyId) {
          chamberResult.partyMismatches.push({
            name: row.displayName,
            chamber,
            wikipediaParty: row.partyLabel,
            officialParty: official.partyShortName,
            wikipediaConstituency: row.constituency,
            officialConstituency: official.constituency,
            memberId: official.memberId
          });
        }
      }

      for (const row of officialChamberRows) {
        if (!wikipediaByName.has(row.normalizedName) && !wikipediaTokenKeys.has(tokenKey(row.normalizedName))) {
          chamberResult.missingWikipedia.push(row);
        }
      }
    }

    result.totals.matched = result.byChamber.deputies.matched + result.byChamber.senate.matched;
    result.totals.missingOfficial =
      result.byChamber.deputies.missingOfficial.length + result.byChamber.senate.missingOfficial.length;
    result.totals.missingWikipedia =
      result.byChamber.deputies.missingWikipedia.length + result.byChamber.senate.missingWikipedia.length;
    result.totals.partyMismatches =
      result.byChamber.deputies.partyMismatches.length + result.byChamber.senate.partyMismatches.length;

    return result;
  } finally {
    await session.close();
  }
}

function bucketBy<T>(items: T[], getKey: (item: T) => string): Map<string, T[]> {
  const buckets = new Map<string, T[]>();
  for (const item of items) {
    const key = getKey(item);
    const bucket = buckets.get(key) ?? [];
    bucket.push(item);
    buckets.set(key, bucket);
  }
  return buckets;
}

function uniqueBucketItem<T>(items: T[] | undefined): T | undefined {
  return items?.length === 1 ? items[0] : undefined;
}

function tokenKey(value: string): string {
  return value
    .replace(/[-']/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

function emptyChamberResult(expectedCount?: number): RosterCrosscheckResult["byChamber"][ChamberId] {
  return {
    wikipediaRows: 0,
    officialRows: 0,
    expectedCount,
    matched: 0,
    missingOfficial: [],
    missingWikipedia: [],
    partyMismatches: []
  };
}

async function loadOfficialRoster(db: ReturnType<typeof createDbSession>["db"], legislatureId: string): Promise<OfficialRosterRow[]> {
  const result = await db.execute<OfficialRosterSqlRow>(sql`
    select
      mm.chamber,
      m.id as member_id,
      m.display_name,
      coalesce(party.party_id, group_party.party_id) as party_id,
      coalesce(party.party_short_name, group_party.party_short_name) as party_short_name,
      mm.constituency
    from member_mandates mm
    join members m on m.id = mm.member_id
    left join lateral (
      select p.id as party_id, p.short_name as party_short_name
      from member_party_affiliations mpa
      join parties p on p.id = mpa.party_id
      where mpa.member_id = m.id
        and mpa.starts_on <= mm.starts_on
        and coalesce(mpa.ends_on, mm.starts_on) >= mm.starts_on
      order by mpa.starts_on desc
      limit 1
    ) party on true
    left join lateral (
      select p.id as party_id, p.short_name as party_short_name
      from member_group_memberships mgm
      join parliamentary_groups pg on pg.id = mgm.group_id
      left join parties p on p.id = pg.party_id
      where mgm.member_id = m.id
        and mgm.starts_on <= mm.starts_on
        and coalesce(mgm.ends_on, mm.starts_on) >= mm.starts_on
      order by mgm.starts_on desc
      limit 1
    ) group_party on true
    where mm.legislature_id = ${legislatureId}
  `);

  return result.map((row) => ({
    chamber: row.chamber as ChamberId,
    memberId: String(row.member_id),
    displayName: String(row.display_name),
    normalizedName: normalize(String(row.display_name)),
    partyId: row.party_id ? String(row.party_id) : undefined,
    partyShortName: row.party_short_name ? String(row.party_short_name) : undefined,
    constituency: row.constituency ? String(row.constituency) : undefined
  }));
}
