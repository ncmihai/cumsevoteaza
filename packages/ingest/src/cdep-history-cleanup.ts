import { sql } from "drizzle-orm";
import { createDbSession } from "@cumsevoteaza/db";
import type { ChamberId } from "@cumsevoteaza/parliament-model";
import { legislatureFromFlag } from "./parsers/roster";

export type CleanupSupersededCdepHistoryOptions = {
  legislature?: string;
  chamber?: ChamberId;
  confirm?: boolean;
};

export type CleanupSupersededCdepHistoryResult = {
  dryRun: boolean;
  filters: {
    legislature?: string;
    chamber?: ChamberId;
  };
  before: CleanupSupersededRow[];
  deleted?: {
    mandates: number;
    memberGroupMemberships: number;
    memberPartyAffiliations: number;
    memberCommitteeMemberships: number;
    memberRoles: number;
    memberMandateRelations: number;
    memberGovernanceAlignments: number;
    compositionEvents: number;
  };
  after: CleanupSupersededRow[];
};

type CleanupSupersededRow = {
  legislature: string;
  chamber: ChamberId;
  parser: string;
  mandates: number;
};

export async function cleanupSupersededCdepHistoryRows(
  options: CleanupSupersededCdepHistoryOptions
): Promise<CleanupSupersededCdepHistoryResult> {
  const session = createDbSession();
  const legislature = options.legislature ? legislatureFromFlag(options.legislature) : undefined;
  const filters = {
    legislature: legislature?.label,
    chamber: options.chamber
  };

  try {
    const before = await supersededRows(session.db, filters);
    let deleted: CleanupSupersededCdepHistoryResult["deleted"];

    if (options.confirm) {
      deleted = await deleteSupersededRows(session.db, filters);
    }

    const after = await supersededRows(session.db, filters);
    return {
      dryRun: !options.confirm,
      filters,
      before,
      deleted,
      after
    };
  } finally {
    await session.close();
  }
}

async function supersededRows(
  db: ReturnType<typeof createDbSession>["db"],
  filters: CleanupSupersededCdepHistoryResult["filters"]
): Promise<CleanupSupersededRow[]> {
  const rows = await db.execute<{
    legislature: string;
    chamber: ChamberId;
    parser: string | null;
    mandates: number | string;
  }>(sql`
    with canonical as (
      select distinct mm.legislature_id, mm.chamber
      from member_mandates mm
      join source_snapshots ss on ss.id = mm.source_snapshot_id
      join legislatures l on l.id = mm.legislature_id
      where ss.parser = 'cdep-history-probe'
        and (${filters.legislature ?? null}::text is null or l.label = ${filters.legislature ?? null})
        and (${filters.chamber ?? null}::chamber is null or mm.chamber = ${filters.chamber ?? null}::chamber)
    )
    select
      l.label as legislature,
      mm.chamber,
      coalesce(ss.parser, 'unknown') as parser,
      count(*)::int as mandates
    from member_mandates mm
    join canonical c on c.legislature_id = mm.legislature_id and c.chamber = mm.chamber
    join legislatures l on l.id = mm.legislature_id
    left join source_snapshots ss on ss.id = mm.source_snapshot_id
    where coalesce(ss.parser, 'unknown') <> 'cdep-history-probe'
    group by l.label, mm.chamber, coalesce(ss.parser, 'unknown')
    order by l.label, mm.chamber, parser
  `);

  return rows.map((row) => ({
    legislature: row.legislature,
    chamber: row.chamber,
    parser: row.parser ?? "unknown",
    mandates: Number(row.mandates)
  }));
}

async function deleteSupersededRows(
  db: ReturnType<typeof createDbSession>["db"],
  filters: CleanupSupersededCdepHistoryResult["filters"]
): Promise<NonNullable<CleanupSupersededCdepHistoryResult["deleted"]>> {
  const [row] = await db.execute<{
    mandates: number | string;
    member_group_memberships: number | string;
    member_party_affiliations: number | string;
    member_committee_memberships: number | string;
    member_roles: number | string;
    member_mandate_relations: number | string;
    member_governance_alignments: number | string;
    composition_events: number | string;
  }>(sql`
    with canonical as (
      select distinct mm.legislature_id, mm.chamber
      from member_mandates mm
      join source_snapshots ss on ss.id = mm.source_snapshot_id
      join legislatures l on l.id = mm.legislature_id
      where ss.parser = 'cdep-history-probe'
        and (${filters.legislature ?? null}::text is null or l.label = ${filters.legislature ?? null})
        and (${filters.chamber ?? null}::chamber is null or mm.chamber = ${filters.chamber ?? null}::chamber)
    ),
    legacy_mandates as (
      select mm.id, mm.member_id
      from member_mandates mm
      join canonical c on c.legislature_id = mm.legislature_id and c.chamber = mm.chamber
      left join source_snapshots ss on ss.id = mm.source_snapshot_id
      where coalesce(ss.parser, 'unknown') <> 'cdep-history-probe'
    ),
    legacy_members as (
      select distinct member_id from legacy_mandates
    ),
    deleted_relations as (
      delete from member_mandate_relations mr
      using legacy_mandates lm
      where mr.mandate_id = lm.id
      returning mr.id
    ),
    legacy_governance as (
      select mga.id
      from member_governance_alignments mga
      join legacy_members lm on lm.member_id = mga.member_id
      left join source_snapshots ss on ss.id = mga.source_snapshot_id
      where coalesce(ss.parser, 'unknown') <> 'cdep-history-probe'
    ),
    deleted_governance as (
      delete from member_governance_alignments mga
      using legacy_governance lg
      where mga.id = lg.id
      returning mga.id
    ),
    legacy_composition_events as (
      select ce.id
      from composition_events ce
      join legacy_members lm on lm.member_id = ce.member_id
      left join source_snapshots ss on ss.id = ce.source_snapshot_id
      where coalesce(ss.parser, 'unknown') <> 'cdep-history-probe'
    ),
    deleted_composition_events as (
      delete from composition_events ce
      using legacy_composition_events lce
      where ce.id = lce.id
      returning ce.id
    ),
    legacy_group_memberships as (
      select mgm.id
      from member_group_memberships mgm
      join legacy_members lm on lm.member_id = mgm.member_id
      left join source_snapshots ss on ss.id = mgm.source_snapshot_id
      where coalesce(ss.parser, 'unknown') <> 'cdep-history-probe'
    ),
    deleted_group_memberships as (
      delete from member_group_memberships mgm
      using legacy_group_memberships lgm
      where mgm.id = lgm.id
      returning mgm.id
    ),
    legacy_party_affiliations as (
      select mpa.id
      from member_party_affiliations mpa
      join legacy_members lm on lm.member_id = mpa.member_id
      left join source_snapshots ss on ss.id = mpa.source_snapshot_id
      where coalesce(ss.parser, 'unknown') <> 'cdep-history-probe'
    ),
    deleted_party_affiliations as (
      delete from member_party_affiliations mpa
      using legacy_party_affiliations lpa
      where mpa.id = lpa.id
      returning mpa.id
    ),
    legacy_committees as (
      select mcm.id
      from member_committee_memberships mcm
      join legacy_members lm on lm.member_id = mcm.member_id
      left join source_snapshots ss on ss.id = mcm.source_snapshot_id
      where coalesce(ss.parser, 'unknown') <> 'cdep-history-probe'
    ),
    deleted_committees as (
      delete from member_committee_memberships mcm
      using legacy_committees lc
      where mcm.id = lc.id
      returning mcm.id
    ),
    legacy_roles as (
      select mr.id
      from member_roles mr
      join legacy_members lm on lm.member_id = mr.member_id
      left join source_snapshots ss on ss.id = mr.source_snapshot_id
      where coalesce(ss.parser, 'unknown') <> 'cdep-history-probe'
    ),
    deleted_roles as (
      delete from member_roles mr
      using legacy_roles lr
      where mr.id = lr.id
      returning mr.id
    ),
    deleted_mandates as (
      delete from member_mandates mm
      using legacy_mandates lm
      where mm.id = lm.id
      returning mm.id
    )
    select
      (select count(*)::int from deleted_mandates) as mandates,
      (select count(*)::int from deleted_group_memberships) as member_group_memberships,
      (select count(*)::int from deleted_party_affiliations) as member_party_affiliations,
      (select count(*)::int from deleted_committees) as member_committee_memberships,
      (select count(*)::int from deleted_roles) as member_roles,
      (select count(*)::int from deleted_relations) as member_mandate_relations,
      (select count(*)::int from deleted_governance) as member_governance_alignments,
      (select count(*)::int from deleted_composition_events) as composition_events
  `);

  return {
    mandates: Number(row?.mandates ?? 0),
    memberGroupMemberships: Number(row?.member_group_memberships ?? 0),
    memberPartyAffiliations: Number(row?.member_party_affiliations ?? 0),
    memberCommitteeMemberships: Number(row?.member_committee_memberships ?? 0),
    memberRoles: Number(row?.member_roles ?? 0),
    memberMandateRelations: Number(row?.member_mandate_relations ?? 0),
    memberGovernanceAlignments: Number(row?.member_governance_alignments ?? 0),
    compositionEvents: Number(row?.composition_events ?? 0)
  };
}
