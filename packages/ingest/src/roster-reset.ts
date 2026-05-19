import { sql } from "drizzle-orm";
import { createDbSession } from "@cumsevoteaza/db";

export interface RosterResetSummary {
  dryRun: boolean;
  before: RosterTableCounts;
  after?: RosterTableCounts;
}

interface RosterTableCounts {
  memberMandates: number;
  memberGroupMemberships: number;
  memberPartyAffiliations: number;
  memberCommitteeMemberships: number;
  memberRoles: number;
  memberGovernanceAlignments: number;
  memberLegislatureActivity: number;
}

export async function resetRosterData(options: { dryRun?: boolean } = {}): Promise<RosterResetSummary> {
  const session = createDbSession();
  try {
    const before = await rosterTableCounts(session.db);
    if (options.dryRun) {
      return { dryRun: true, before };
    }

    await session.db.execute(sql`delete from member_legislature_activity`);
    await session.db.execute(sql`delete from member_governance_alignments`);
    await session.db.execute(sql`delete from member_roles`);
    await session.db.execute(sql`delete from member_committee_memberships`);
    await session.db.execute(sql`delete from member_party_affiliations`);
    await session.db.execute(sql`delete from member_group_memberships`);
    await session.db.execute(sql`delete from member_mandates`);

    return {
      dryRun: false,
      before,
      after: await rosterTableCounts(session.db)
    };
  } finally {
    await session.close();
  }
}

async function rosterTableCounts(db: ReturnType<typeof createDbSession>["db"]): Promise<RosterTableCounts> {
  const [row] = await db.execute(sql`
    select
      (select count(*)::int from member_mandates) as member_mandates,
      (select count(*)::int from member_group_memberships) as member_group_memberships,
      (select count(*)::int from member_party_affiliations) as member_party_affiliations,
      (select count(*)::int from member_committee_memberships) as member_committee_memberships,
      (select count(*)::int from member_roles) as member_roles,
      (select count(*)::int from member_governance_alignments) as member_governance_alignments,
      (select count(*)::int from member_legislature_activity) as member_legislature_activity
  `);

  return {
    memberMandates: Number(row?.member_mandates ?? 0),
    memberGroupMemberships: Number(row?.member_group_memberships ?? 0),
    memberPartyAffiliations: Number(row?.member_party_affiliations ?? 0),
    memberCommitteeMemberships: Number(row?.member_committee_memberships ?? 0),
    memberRoles: Number(row?.member_roles ?? 0),
    memberGovernanceAlignments: Number(row?.member_governance_alignments ?? 0),
    memberLegislatureActivity: Number(row?.member_legislature_activity ?? 0)
  };
}
