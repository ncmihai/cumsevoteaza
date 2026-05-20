import { eq, ilike, inArray, or, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import type { DbClient } from "@cumsevoteaza/db";
import * as schema from "@cumsevoteaza/db";
import {
  demoDataset,
  type Bill,
  type BillEvent,
  type DocumentSource,
  type GroupVoteTotal,
  type IndividualVote,
  type Legislature,
  type Member,
  type MemberCommitteeMembership,
  type MemberGroupMembership,
  type MemberHistoryRow,
  type MemberMandate,
  type MemberMandateRelation,
  type MemberPartyAffiliation,
  type MemberRole,
  type ParliamentaryGroup,
  type Party,
  type SourceSnapshot,
  type Vote
} from "@cumsevoteaza/parliament-model";
import { chamberSeatCount } from "./chamber-seat-counts";
import { getBillExplorerData, getVoteExplorerData } from "./explorer-data";
import { CACHE_TAGS, createWebDbSession, timed } from "./server-db";

export interface VotePageData {
  vote: Vote;
  bill?: Bill;
  source?: SourceSnapshot;
  groups: ParliamentaryGroup[];
  members: Member[];
  groupTotals: GroupVoteTotal[];
  individualVotes: IndividualVote[];
  seatVotes: IndividualVote[];
  sourceKind: "database" | "demo";
}

export interface VoteDirectoryItem {
  vote: Vote;
  bill?: Bill;
  source?: SourceSnapshot;
}

export interface VoteDirectoryData {
  items: VoteDirectoryItem[];
  sourceKind: "database" | "demo";
}

export interface BillDirectoryItem {
  bill: Bill;
  submittedOn?: string;
  latestEventOn?: string;
  source?: SourceSnapshot;
  voteCount: number;
}

export interface BillDirectoryData {
  items: BillDirectoryItem[];
  sourceKind: "database" | "demo";
}

export interface BillPageData {
  bill: Bill;
  events: BillEvent[];
  documents: DocumentSource[];
  votes: Vote[];
  source?: SourceSnapshot;
  sourceKind: "database" | "demo";
}

export interface MemberDirectoryItem {
  member: Member;
  mandate?: MemberMandate;
  group?: ParliamentaryGroup;
  party?: Party;
}

export interface MemberDirectoryData {
  members: MemberDirectoryItem[];
  groups: ParliamentaryGroup[];
  parties: Party[];
  legislatures: Legislature[];
  sourceKind: "database" | "demo";
}

export interface MemberPageData {
  member: Member;
  mandate?: MemberMandate;
  group?: ParliamentaryGroup;
  party?: Party;
  currentLogoUrl?: string;
  source?: SourceSnapshot;
  legislatures: Legislature[];
  selectedLegislature?: Legislature;
  activity?: MemberLegislatureActivityData;
  voteCoverage: Record<string, VoteCoverageData>;
  history: MemberHistoryRow[];
  votes: IndividualVote[];
  voteRecords: Vote[];
  sponsoredBills: Bill[];
  sourceKind: "database" | "demo";
}

export interface MemberLegislatureActivityData {
  votesFor: number;
  votesAgainst: number;
  abstentions: number;
  presentNotVoting: number;
  absent: number;
  unknown: number;
  proposals: number;
  committees: number;
  roles: number;
  firstActivityOn?: string;
  lastActivityOn?: string;
}

export interface VoteCoverageData {
  coverageLevel: "nominal" | "group_totals" | "result_only" | "source_only";
  nominalVotes: number;
  groupTotals: number;
  sourceStatus: "parsed" | "partial" | "failed";
}

export interface PartyPageData {
  party: Party;
  groups: ParliamentaryGroup[];
  members: Member[];
  groupTotals: GroupVoteTotal[];
  votes: Vote[];
  sourceKind: "database" | "demo";
}

const getCachedVoteDirectoryData = unstable_cache(
  async (limit: number) => timed("data.vote-directory", () => getVoteDirectoryDataUncached(limit)),
  ["vote-directory-data"],
  { revalidate: 600, tags: [CACHE_TAGS.votes] }
);

const getCachedBillDirectoryData = unstable_cache(
  async (limit: number) => timed("data.bill-directory", () => getBillDirectoryDataUncached(limit)),
  ["bill-directory-data"],
  { revalidate: 600, tags: [CACHE_TAGS.bills] }
);

const getCachedVotePageData = unstable_cache(
  async (id: string) => timed(`data.vote.${id}`, () => getVotePageDataUncached(id)),
  ["vote-page-data"],
  { revalidate: 900, tags: [CACHE_TAGS.votes] }
);

const getCachedBillPageData = unstable_cache(
  async (id: string) => timed(`data.bill.${id}`, () => getBillPageDataUncached(id)),
  ["bill-page-data"],
  { revalidate: 900, tags: [CACHE_TAGS.bills] }
);

const getCachedMemberDirectoryData = unstable_cache(
  async (filters?: { chamber?: string; group?: string; q?: string; legislature?: string }) =>
    timed("data.member-directory", () => getMemberDirectoryDataUncached(filters)),
  ["member-directory-data"],
  { revalidate: 600, tags: [CACHE_TAGS.members, CACHE_TAGS.search] }
);

const getCachedMemberPageData = unstable_cache(
  async (slug: string, options: { legislature?: string } = {}) =>
    timed(`data.member.${slug}`, () => getMemberPageDataUncached(slug, options)),
  ["member-page-data"],
  { revalidate: 900, tags: [CACHE_TAGS.members] }
);

const getCachedPartyPageData = unstable_cache(
  async (slug: string) => timed(`data.party.${slug}`, () => getPartyPageDataUncached(slug)),
  ["party-page-data"],
  { revalidate: 900, tags: [CACHE_TAGS.parties, CACHE_TAGS.members] }
);

export async function getVoteDirectoryData(limit = 30): Promise<VoteDirectoryData> {
  return getCachedVoteDirectoryData(limit);
}

async function getVoteDirectoryDataUncached(limit = 30): Promise<VoteDirectoryData> {
  const dbData = await tryDatabaseVoteDirectory(limit);
  if (dbData) return dbData;

  return {
    items: [...demoDataset.votes]
      .sort((a, b) => b.heldOn.localeCompare(a.heldOn))
      .slice(0, limit)
      .map((vote) => ({
        vote,
        bill: demoDataset.bills.find((bill) => bill.id === vote.billId),
        source: demoDataset.sourceSnapshots.find((source) => source.id === vote.sourceSnapshotId)
      })),
    sourceKind: "demo"
  };
}

export async function getBillDirectoryData(limit = 30): Promise<BillDirectoryData> {
  return getCachedBillDirectoryData(limit);
}

async function getBillDirectoryDataUncached(limit = 30): Promise<BillDirectoryData> {
  const dbData = await tryDatabaseBillDirectory(limit);
  if (dbData) return dbData;

  return {
    items: demoDataset.bills
      .map((bill) => directoryBillItem({
        bill,
        events: demoDataset.billEvents.filter((event) => event.billId === bill.id),
        votes: demoDataset.votes.filter((vote) => vote.billId === bill.id),
        sources: demoDataset.sourceSnapshots
      }))
      .sort((a, b) => (b.submittedOn ?? b.latestEventOn ?? "").localeCompare(a.submittedOn ?? a.latestEventOn ?? ""))
      .slice(0, limit),
    sourceKind: "demo"
  };
}

export async function getVotePageData(id: string): Promise<VotePageData | undefined> {
  return getCachedVotePageData(id);
}

async function getVotePageDataUncached(id: string): Promise<VotePageData | undefined> {
  const dbData = await tryDatabaseVote(id);
  if (dbData) return dbData;

  const vote = demoDataset.votes.find((item) => item.id === id);
  if (!vote) return undefined;

  return {
    vote,
    bill: demoDataset.bills.find((item) => item.id === vote.billId),
    source: demoDataset.sourceSnapshots.find((item) => item.id === vote.sourceSnapshotId),
    groups: demoDataset.groups,
    members: demoDataset.members,
    groupTotals: demoDataset.groupVoteTotals.filter((item) => item.voteId === vote.id),
    individualVotes: demoDataset.individualVotes.filter((item) => item.voteId === vote.id),
    seatVotes: demoDataset.individualVotes.filter((item) => item.voteId === vote.id),
    sourceKind: "demo"
  };
}

export async function getBillPageData(id: string): Promise<BillPageData | undefined> {
  return getCachedBillPageData(id);
}

async function getBillPageDataUncached(id: string): Promise<BillPageData | undefined> {
  const dbData = await tryDatabaseBill(id);
  if (dbData) return dbData;

  const bill = demoDataset.bills.find((item) => item.slug === id || item.id === id);
  if (!bill) return undefined;

  return {
    bill,
    events: demoDataset.billEvents.filter((event) => event.billId === bill.id),
    documents: demoDataset.documents.filter((document) => document.billId === bill.id),
    votes: demoDataset.votes.filter((vote) => vote.billId === bill.id),
    source: demoDataset.sourceSnapshots.find((item) => bill.sourceSnapshotIds.includes(item.id)),
    sourceKind: "demo"
  };
}

export async function getMemberDirectoryData(filters?: { chamber?: string; group?: string; q?: string; legislature?: string }): Promise<MemberDirectoryData> {
  return getCachedMemberDirectoryData(filters);
}

async function getMemberDirectoryDataUncached(filters?: { chamber?: string; group?: string; q?: string; legislature?: string }): Promise<MemberDirectoryData> {
  const dbData = await tryDatabaseMemberDirectory(filters);
  if (dbData) return dbData;

  const items = demoDataset.members.map((member) => {
    const mandate = demoDataset.mandates.find((item) => item.memberId === member.id);
    const membership = demoDataset.groupMemberships.find((item) => item.memberId === member.id && !item.endsOn);
    const group = demoDataset.groups.find((item) => item.id === membership?.groupId);
    const party = demoDataset.parties.find((item) => item.id === group?.partyId);
    return { member, mandate, group, party };
  });

  return {
    members: filterDirectoryItems(items, filters),
    groups: filterMemberDirectoryGroups(demoDataset.groups, demoDataset.mandates, demoDataset.groupMemberships, demoDataset.legislatures, filters),
    parties: demoDataset.parties,
    legislatures: demoDataset.legislatures,
    sourceKind: "demo"
  };
}

export async function getMemberPageData(slug: string, options: { legislature?: string } = {}): Promise<MemberPageData | undefined> {
  return getCachedMemberPageData(slug, options);
}

async function getMemberPageDataUncached(slug: string, options: { legislature?: string } = {}): Promise<MemberPageData | undefined> {
  const dbData = await tryDatabaseMember(slug, options);
  if (dbData) return dbData;

  const member = demoDataset.members.find((item) => item.slug === slug || item.id === slug);
  if (!member) return undefined;
  const history = demoDataset.memberHistory[member.id] ?? [];
  const groupMembership = demoDataset.groupMemberships.find((item) => item.memberId === member.id && !item.endsOn);
  const group = demoDataset.groups.find((item) => item.id === groupMembership?.groupId);
  const party = demoDataset.parties.find((item) => item.id === group?.partyId);
  const mandate = demoDataset.mandates.find((item) => item.memberId === member.id);
  const legislatures = demoDataset.legislatures.filter((legislature) => demoDataset.mandates.some((item) => item.memberId === member.id && item.legislatureId === legislature.id));
  const selectedLegislature = legislatures.find((legislature) => legislature.id === options.legislature) ?? legislatures[0];
  const selectedMandate = selectedLegislature
    ? demoDataset.mandates.find((item) => item.memberId === member.id && item.legislatureId === selectedLegislature.id)
    : mandate;
  const source = demoDataset.sourceSnapshots.find((item) => item.id === groupMembership?.sourceSnapshotId);
  const votes = demoDataset.individualVotes.filter((vote) => {
    const record = demoDataset.votes.find((item) => item.id === vote.voteId);
    return vote.memberId === member.id && (!selectedLegislature || (record && record.heldOn >= selectedLegislature.startsOn && record.heldOn < selectedLegislature.endsOn));
  });
  const voteRecords = demoDataset.votes.filter((vote) => votes.some((individualVote) => individualVote.voteId === vote.id));
  const sponsoredBills = demoDataset.billSponsors
    .filter((sponsor) => sponsor.memberId === member.id)
    .flatMap((sponsor) => demoDataset.bills.filter((bill) => bill.id === sponsor.billId))
    .filter((bill) => {
      const events = demoDataset.billEvents.filter((event) => event.billId === bill.id);
      return !selectedLegislature || events.some((event) => event.occurredOn >= selectedLegislature.startsOn && event.occurredOn < selectedLegislature.endsOn);
    });

  return {
    member,
    mandate: selectedMandate,
    group,
    party,
    currentLogoUrl: groupMembership?.logoUrl,
    source,
    legislatures,
    selectedLegislature,
    activity: activityFromRows(votes, sponsoredBills.length, history),
    voteCoverage: {},
    history,
    votes,
    voteRecords,
    sponsoredBills,
    sourceKind: "demo"
  };
}

export async function getPartyPageData(slug: string): Promise<PartyPageData | undefined> {
  return getCachedPartyPageData(slug);
}

async function getPartyPageDataUncached(slug: string): Promise<PartyPageData | undefined> {
  const dbData = await tryDatabaseParty(slug);
  if (dbData) return dbData;

  const party = demoDataset.parties.find((item) => item.slug === slug || item.id === slug);
  if (!party) return undefined;
  const groups = demoDataset.groups.filter((group) => group.partyId === party.id);
  const groupIds = new Set(groups.map((group) => group.id));
  const members = demoDataset.members.filter((member) =>
    demoDataset.groupMemberships.some((membership) => membership.memberId === member.id && groupIds.has(membership.groupId))
  );
  const groupTotals = demoDataset.groupVoteTotals.filter((total) => groupIds.has(total.groupId));
  const votes = demoDataset.votes.filter((vote) => groupTotals.some((total) => total.voteId === vote.id));
  return { party, groups, members, groupTotals, votes, sourceKind: "demo" };
}

async function tryDatabaseVote(id: string): Promise<VotePageData | undefined> {
  if (!process.env.DATABASE_URL) return undefined;

  const session = createWebDbSession();
  try {
    const [voteRow] = await session.db.select().from(schema.votes).where(eq(schema.votes.id, id)).limit(1);
    if (!voteRow) return undefined;

    const [billRow] = voteRow.billId
      ? await session.db.select().from(schema.bills).where(eq(schema.bills.id, voteRow.billId)).limit(1)
      : [];
    const [sourceRow] = await session.db
      .select()
      .from(schema.sourceSnapshots)
      .where(eq(schema.sourceSnapshots.id, voteRow.sourceSnapshotId))
      .limit(1);
    const groupTotalRows = await session.db
      .select()
      .from(schema.groupVoteTotals)
      .where(eq(schema.groupVoteTotals.voteId, voteRow.id));
    const individualVoteRows = await session.db
      .select()
      .from(schema.individualVotes)
      .where(eq(schema.individualVotes.voteId, voteRow.id));
    const individualVotes = individualVoteRows.map(mapIndividualVote);
    const rosterRows = await session.db.execute<VoteRosterRow>(sql`
      select
        mm.id as mandate_id,
        mm.member_id as mandate_member_id,
        mm.legislature_id as mandate_legislature_id,
        mm.chamber as mandate_chamber,
        mm.starts_on as mandate_starts_on,
        mm.ends_on as mandate_ends_on,
        mm.constituency as mandate_constituency,
        mm.status as mandate_status,
        mm.source_snapshot_id as mandate_source_snapshot_id,
        l.id as legislature_id,
        l.label as legislature_label,
        l.starts_on as legislature_starts_on,
        l.ends_on as legislature_ends_on,
        mgm.id as membership_id,
        mgm.member_id as membership_member_id,
        mgm.group_id as membership_group_id,
        mgm.starts_on as membership_starts_on,
        mgm.ends_on as membership_ends_on,
        mgm.logo_url as membership_logo_url,
        mgm.source_snapshot_id as membership_source_snapshot_id
      from member_mandates mm
      join legislatures l on l.id = mm.legislature_id
      left join lateral (
        select mgm.*
        from member_group_memberships mgm
        where mgm.member_id = mm.member_id
          and mgm.starts_on <= ${voteRow.heldOn}::date
          and coalesce(mgm.ends_on, date '9999-12-31') >= ${voteRow.heldOn}::date
        order by mgm.starts_on desc, mgm.id desc
        limit 1
      ) mgm on true
      where mm.chamber = ${voteRow.chamber}
        and mm.starts_on <= ${voteRow.heldOn}::date
        and coalesce(mm.ends_on, l.ends_on) >= ${voteRow.heldOn}::date
        and ${voteRow.heldOn}::date >= l.starts_on
        and ${voteRow.heldOn}::date < l.ends_on
    `);
    const scopedMemberIds = uniqueStrings([
      ...individualVoteRows.map((row) => row.memberId),
      ...rosterRows.map((row) => row.mandate_member_id)
    ]);
    const scopedGroupIds = uniqueStrings([
      ...individualVoteRows.map((row) => row.groupId ?? ""),
      ...groupTotalRows.map((row) => row.groupId),
      ...rosterRows.map((row) => row.membership_group_id ?? "")
    ]);
    const [memberRows, groupRows] = await Promise.all([
      scopedMemberIds.length > 0
        ? session.db.select().from(schema.members).where(inArray(schema.members.id, scopedMemberIds))
        : [],
      scopedGroupIds.length > 0
        ? session.db.select().from(schema.parliamentaryGroups).where(inArray(schema.parliamentaryGroups.id, scopedGroupIds))
        : []
    ]);
    const mandates = rosterRows.map(mapVoteRosterMandate);
    const memberships = rosterRows.flatMap((row) => row.membership_id ? [mapVoteRosterMembership(row)] : []);
    const legislatures = uniqueBy(rosterRows.map(mapVoteRosterLegislature), (legislature) => legislature.id);

    return {
      vote: mapVote(voteRow),
      bill: billRow ? mapBill(billRow) : undefined,
      source: sourceRow ? mapSource(sourceRow) : undefined,
      groups: groupRows.map(mapGroup),
      members: memberRows.map(mapMember),
      groupTotals: groupTotalRows.map(mapGroupVoteTotal),
      individualVotes,
      seatVotes: buildVoteSeatRows({
        vote: mapVote(voteRow),
        individualVotes,
        mandates,
        memberships,
        legislatures
      }),
      sourceKind: "database"
    };
  } catch {
    return undefined;
  } finally {
    await session.close();
  }
}

async function tryDatabaseVoteDirectory(limit: number): Promise<VoteDirectoryData | undefined> {
  if (!process.env.DATABASE_URL) return undefined;

  try {
    const data = await getVoteExplorerData({ limit });
    if (data.sourceKind !== "database") return undefined;
    return {
      items: data.items.map(({ vote, bill, source }) => ({ vote, bill, source })),
      sourceKind: "database"
    };
  } catch {
    return undefined;
  }
}

async function tryDatabaseBillDirectory(limit: number): Promise<BillDirectoryData | undefined> {
  if (!process.env.DATABASE_URL) return undefined;

  try {
    const data = await getBillExplorerData({ limit });
    if (data.sourceKind !== "database") return undefined;
    return {
      items: data.items.map(({ bill, submittedOn, latestEventOn, source, voteCount }) => ({
        bill,
        submittedOn,
        latestEventOn,
        source,
        voteCount
      })),
      sourceKind: "database"
    };
  } catch {
    return undefined;
  }
}

async function tryDatabaseBill(id: string): Promise<BillPageData | undefined> {
  if (!process.env.DATABASE_URL) return undefined;

  const session = createWebDbSession();
  try {
    const [billRow] = await session.db
      .select()
      .from(schema.bills)
      .where(or(eq(schema.bills.id, id), eq(schema.bills.slug, id)))
      .limit(1);
    if (!billRow) return undefined;

    const eventRows = await session.db.select().from(schema.billEvents).where(eq(schema.billEvents.billId, billRow.id));
    const documentRows = await session.db.select().from(schema.documents).where(eq(schema.documents.billId, billRow.id));
    const voteRows = await session.db.select().from(schema.votes).where(eq(schema.votes.billId, billRow.id));
    const sourceId = Array.isArray(billRow.sourceSnapshotIds) ? billRow.sourceSnapshotIds[0] : undefined;
    const [sourceRow] = sourceId
      ? await session.db.select().from(schema.sourceSnapshots).where(eq(schema.sourceSnapshots.id, sourceId)).limit(1)
      : [];

    return {
      bill: mapBill(billRow),
      events: eventRows.map(mapBillEvent),
      documents: documentRows.map(mapDocument),
      votes: voteRows.map(mapVote),
      source: sourceRow ? mapSource(sourceRow) : undefined,
      sourceKind: "database"
    };
  } catch {
    return undefined;
  } finally {
    await session.close();
  }
}

async function tryDatabaseMemberDirectory(filters?: { chamber?: string; group?: string; q?: string; legislature?: string }): Promise<MemberDirectoryData | undefined> {
  if (!process.env.DATABASE_URL) return undefined;

  const session = createWebDbSession();
  try {
    const conditions = memberDirectoryConditions(filters);
    const where = conditions.length ? sql`where ${sql.join(conditions, sql` and `)}` : sql``;
    const [memberRows, groupRows, partyRows, legislatureRows] = await Promise.all([
      session.db.execute<MemberDirectoryRow>(sql`
        with scoped as (
          select
            m.id as member_id,
            m.person_id as member_person_id,
            m.slug as member_slug,
            m.first_name as member_first_name,
            m.last_name as member_last_name,
            m.display_name as member_display_name,
            m.source_ids as member_source_ids,
            mm.id as mandate_id,
            mm.member_id as mandate_member_id,
            mm.legislature_id as mandate_legislature_id,
            mm.chamber as mandate_chamber,
            mm.starts_on as mandate_starts_on,
            mm.ends_on as mandate_ends_on,
            mm.constituency as mandate_constituency,
            mm.status as mandate_status,
            mm.source_snapshot_id as mandate_source_snapshot_id,
            pg.id as group_id,
            pg.party_id as group_party_id,
            pg.chamber as group_chamber,
            pg.short_name as group_short_name,
            pg.name as group_name,
            pg.color as group_color,
            p.id as party_id,
            p.slug as party_slug,
            p.short_name as party_short_name,
            p.name as party_name,
            p.color as party_color,
            row_number() over (partition by m.id order by mm.starts_on desc, mm.id desc) as rn
          from member_mandates mm
          join members m on m.id = mm.member_id
          left join lateral (
            select mgm.*
            from member_group_memberships mgm
            join parliamentary_groups pg_filter on pg_filter.id = mgm.group_id
            where mgm.member_id = mm.member_id
              and mgm.starts_on <= coalesce(mm.ends_on, date '9999-12-31')
              and coalesce(mgm.ends_on, date '9999-12-31') >= mm.starts_on
              and pg_filter.chamber = mm.chamber
            order by mgm.starts_on desc, mgm.id desc
            limit 1
          ) mgm on true
          left join parliamentary_groups pg on pg.id = mgm.group_id
          left join parties p on p.id = pg.party_id
          ${where}
        )
        select *
        from scoped
        where rn = 1
        order by member_display_name asc, member_id asc
        limit 500
      `),
      session.db.execute<typeof schema.parliamentaryGroups.$inferSelect>(memberDirectoryGroupsSql(filters)),
      session.db.select().from(schema.parties),
      session.db.select().from(schema.legislatures)
    ]);
    const groups = groupRows.map(mapGroup);
    const parties = partyRows.map(mapParty);
    const legislatures = legislatureRows.map(mapLegislature).sort((a, b) => b.startsOn.localeCompare(a.startsOn));
    return {
      members: memberRows.map(mapMemberDirectoryRow),
      groups,
      parties,
      legislatures,
      sourceKind: "database"
    };
  } catch {
    return undefined;
  } finally {
    await session.close();
  }
}

async function tryDatabaseMember(slug: string, options: { legislature?: string } = {}): Promise<MemberPageData | undefined> {
  if (!process.env.DATABASE_URL) return undefined;

  const session = createWebDbSession();
  try {
    let [memberRow] = await session.db
      .select()
      .from(schema.members)
      .where(or(eq(schema.members.slug, slug), eq(schema.members.id, slug)))
      .limit(1);
    if (!memberRow) {
      memberRow = await findMemberByLegacySlug(session.db, slug);
    }
    if (!memberRow) return undefined;

    const relatedMemberRows = memberRow.personId
      ? await session.db.select().from(schema.members).where(eq(schema.members.personId, memberRow.personId))
      : [memberRow];
    const relatedMembers = relatedMemberRows.map(mapMember);
    const memberIds = relatedMembers.map((member) => member.id);
    const mandateRows = await session.db.select().from(schema.memberMandates).where(inArray(schema.memberMandates.memberId, memberIds));
    const membershipRows = await session.db
      .select()
      .from(schema.memberGroupMemberships)
      .where(inArray(schema.memberGroupMemberships.memberId, memberIds));
    const partyAffiliationRows = await session.db
      .select()
      .from(schema.memberPartyAffiliations)
      .where(inArray(schema.memberPartyAffiliations.memberId, memberIds));
    const committeeRows = await session.db
      .select()
      .from(schema.memberCommitteeMemberships)
      .where(inArray(schema.memberCommitteeMemberships.memberId, memberIds));
    const roleRows = await session.db.select().from(schema.memberRoles).where(inArray(schema.memberRoles.memberId, memberIds));
    const mandateIds = mandateRows.map((item) => item.id);
    const relationRows =
      mandateIds.length > 0
        ? await session.db.select().from(schema.memberMandateRelations).where(inArray(schema.memberMandateRelations.mandateId, mandateIds))
        : [];
    const groups = (await session.db.select().from(schema.parliamentaryGroups)).map(mapGroup);
    const parties = (await session.db.select().from(schema.parties)).map(mapParty);
    const memberships = membershipRows.map(mapMemberGroupMembership);
    const mandates = mandateRows.map(mapMemberMandate);
    const legislatureRows = await session.db.select().from(schema.legislatures);
    const legislatures = legislatureRows
      .map(mapLegislature)
      .filter((legislature) => mandates.some((mandate) => mandate.legislatureId === legislature.id))
      .sort((a, b) => b.startsOn.localeCompare(a.startsOn));
    const selectedLegislature = legislatures.find((legislature) => legislature.id === options.legislature) ?? legislatures[0];
    const mandate = latestMandate(mandates.filter((item) => !selectedLegislature || item.legislatureId === selectedLegislature.id)) ?? latestMandate(mandates);
    const member = relatedMembers.find((item) => item.id === mandate?.memberId) ?? mapMember(memberRow);
    const currentMembership =
      mandate && selectedLegislature
        ? latestMembershipDuring(
            memberships.filter((membership) => membership.memberId === mandate.memberId),
            mandate.startsOn,
            earliestDate(mandate.endsOn, selectedLegislature.endsOn)
          )
        : latestMembership(memberships.filter((membership) => !mandate || membership.memberId === mandate.memberId));
    const group = groups.find((item) => item.id === currentMembership?.groupId);
    const party = parties.find((item) => item.id === group?.partyId);
    const sourceId =
      currentMembership?.sourceSnapshotId ??
      mandate?.sourceSnapshotId ??
      membershipRows.find((item) => item.sourceSnapshotId)?.sourceSnapshotId;
    const [sourceRow] = sourceId
      ? await session.db.select().from(schema.sourceSnapshots).where(eq(schema.sourceSnapshots.id, sourceId)).limit(1)
      : [];

    const selectedVotes = selectedLegislature
      ? await getMemberVotesForLegislature(session.db, memberIds, selectedLegislature.id)
      : { individualVotes: [], voteRecords: [] };
    const sponsoredBills = selectedLegislature
      ? await getMemberSponsoredBillsForLegislature(session.db, memberIds, selectedLegislature.id)
      : [];
    const activity = selectedLegislature
      ? await getMemberLegislatureActivity(session.db, memberIds, selectedLegislature.id)
      : undefined;
    const voteCoverage = await getVoteCoverage(session.db, selectedVotes.voteRecords.map((vote) => vote.id));
    const history = buildMemberHistory({
      mandates,
      groupMemberships: memberships,
      partyAffiliations: partyAffiliationRows.map(mapMemberPartyAffiliation),
      mandateRelations: relationRows.map(mapMemberMandateRelation),
      committees: committeeRows.map(mapMemberCommitteeMembership),
      roles: roleRows.map(mapMemberRole),
      groups,
      parties,
      votes: selectedVotes.individualVotes
    });

    return {
      member,
      mandate,
      group,
      party,
      currentLogoUrl: currentMembership?.logoUrl,
      source: sourceRow ? mapSource(sourceRow) : undefined,
      legislatures,
      selectedLegislature,
      activity: activity ?? activityFromRows(selectedVotes.individualVotes, sponsoredBills.length, history),
      voteCoverage,
      history,
      votes: selectedVotes.individualVotes,
      voteRecords: selectedVotes.voteRecords,
      sponsoredBills,
      sourceKind: "database"
    };
  } catch {
    return undefined;
  } finally {
    await session.close();
  }
}

async function tryDatabaseParty(slug: string): Promise<PartyPageData | undefined> {
  if (!process.env.DATABASE_URL) return undefined;

  const session = createWebDbSession();
  try {
    const [partyRow] = await session.db
      .select()
      .from(schema.parties)
      .where(or(eq(schema.parties.slug, slug), eq(schema.parties.id, slug)))
      .limit(1);
    if (!partyRow) return undefined;
    const party = mapParty(partyRow);
    const groups = (await session.db.select().from(schema.parliamentaryGroups).where(eq(schema.parliamentaryGroups.partyId, party.id))).map(mapGroup);
    const groupIds = groups.map((group) => group.id);
    const [memberRows, totalRows, voteRows] = groupIds.length > 0
      ? await Promise.all([
          session.db.execute<typeof schema.members.$inferSelect>(sql`
            select distinct
              m.id,
              m.person_id as "personId",
              m.slug,
              m.first_name as "firstName",
              m.last_name as "lastName",
              m.display_name as "displayName",
              m.source_ids as "sourceIds"
            from members m
            join member_group_memberships mgm on mgm.member_id = m.id
            where mgm.group_id in (${sql.join(groupIds.map((groupId) => sql`${groupId}`), sql`, `)})
            order by m.display_name asc
            limit 500
          `),
          session.db.select().from(schema.groupVoteTotals).where(inArray(schema.groupVoteTotals.groupId, groupIds)).limit(200),
          session.db.execute<typeof schema.votes.$inferSelect>(sql`
            select distinct
              v.id,
              v.bill_id as "billId",
              v.chamber,
              v.title,
              v.held_on as "heldOn",
              v.vote_type as "voteType",
              v.present,
              v.for_count as "forCount",
              v.against,
              v.abstention,
              v.present_not_voting as "presentNotVoting",
              v.absent,
              v.source_snapshot_id as "sourceSnapshotId"
            from votes v
            join group_vote_totals gvt on gvt.vote_id = v.id
            where gvt.group_id in (${sql.join(groupIds.map((groupId) => sql`${groupId}`), sql`, `)})
            order by v.held_on desc, v.id desc
            limit 200
          `)
        ])
      : [[], [], []];
    const members = memberRows.map(mapMember);
    const groupTotals = totalRows.map(mapGroupVoteTotal);
    const votes = voteRows.map(mapVote);
    return { party, groups, members, groupTotals, votes, sourceKind: "database" };
  } catch {
    return undefined;
  } finally {
    await session.close();
  }
}

function mapBill(row: typeof schema.bills.$inferSelect): Bill {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    identifiers: row.identifiers,
    chamberOfOrigin: row.chamberOfOrigin === "senate" || row.chamberOfOrigin === "deputies" ? row.chamberOfOrigin : "unknown",
    status: row.status,
    sourceSnapshotIds: row.sourceSnapshotIds
  };
}

function mapVote(row: typeof schema.votes.$inferSelect): Vote {
  return {
    id: row.id,
    billId: row.billId ?? undefined,
    chamber: row.chamber,
    title: row.title,
    heldOn: row.heldOn,
    voteType: row.voteType,
    totals: {
      present: row.present,
      for: row.forCount,
      against: row.against,
      abstention: row.abstention,
      presentNotVoting: row.presentNotVoting,
      absent: row.absent ?? undefined
    },
    sourceSnapshotId: row.sourceSnapshotId
  };
}

function mapSource(row: typeof schema.sourceSnapshots.$inferSelect): SourceSnapshot {
  return {
    id: row.id,
    sourceUrl: row.sourceUrl,
    fetchedAt: row.fetchedAt.toISOString(),
    contentHash: row.contentHash,
    parser: row.parser,
    parserVersion: row.parserVersion,
    status: row.status,
    notes: row.notes ?? undefined
  };
}

function mapGroup(row: typeof schema.parliamentaryGroups.$inferSelect): ParliamentaryGroup {
  return {
    id: row.id,
    partyId: row.partyId ?? undefined,
    chamber: row.chamber,
    shortName: row.shortName,
    name: row.name,
    color: row.color
  };
}

function mapParty(row: typeof schema.parties.$inferSelect): Party {
  return {
    id: row.id,
    slug: row.slug,
    shortName: row.shortName,
    name: row.name,
    color: row.color
  };
}

function mapMember(row: typeof schema.members.$inferSelect): Member {
  return {
    id: row.id,
    personId: row.personId ?? undefined,
    slug: row.slug,
    firstName: row.firstName,
    lastName: row.lastName,
    displayName: row.displayName,
    sourceIds: row.sourceIds
  };
}

function mapMemberDirectoryRow(row: MemberDirectoryRow): MemberDirectoryItem {
  return {
    member: {
      id: row.member_id,
      personId: row.member_person_id ?? undefined,
      slug: row.member_slug,
      firstName: row.member_first_name,
      lastName: row.member_last_name,
      displayName: row.member_display_name,
      sourceIds: jsonRecord(row.member_source_ids)
    },
    mandate: {
      id: row.mandate_id,
      memberId: row.mandate_member_id,
      legislatureId: row.mandate_legislature_id,
      chamber: row.mandate_chamber,
      startsOn: dateString(row.mandate_starts_on),
      endsOn: row.mandate_ends_on ? dateString(row.mandate_ends_on) : undefined,
      constituency: row.mandate_constituency ?? undefined,
      status: row.mandate_status === "active" || row.mandate_status === "ended" || row.mandate_status === "unknown" ? row.mandate_status : "unknown",
      sourceSnapshotId: row.mandate_source_snapshot_id ?? undefined
    },
    group: row.group_id
      ? {
          id: row.group_id,
          partyId: row.group_party_id ?? undefined,
          chamber: row.group_chamber!,
          shortName: row.group_short_name!,
          name: row.group_name!,
          color: row.group_color!
        }
      : undefined,
    party: row.party_id
      ? {
          id: row.party_id,
          slug: row.party_slug!,
          shortName: row.party_short_name!,
          name: row.party_name!,
          color: row.party_color!
        }
      : undefined
  };
}

function mapVoteRosterMandate(row: VoteRosterRow): MemberMandate {
  return {
    id: row.mandate_id,
    memberId: row.mandate_member_id,
    legislatureId: row.mandate_legislature_id,
    chamber: row.mandate_chamber,
    startsOn: dateString(row.mandate_starts_on),
    endsOn: row.mandate_ends_on ? dateString(row.mandate_ends_on) : undefined,
    constituency: row.mandate_constituency ?? undefined,
    status: row.mandate_status === "active" || row.mandate_status === "ended" || row.mandate_status === "unknown" ? row.mandate_status : "unknown",
    sourceSnapshotId: row.mandate_source_snapshot_id ?? undefined
  };
}

function mapVoteRosterMembership(row: VoteRosterRow): MemberGroupMembership {
  return {
    id: row.membership_id!,
    memberId: row.membership_member_id!,
    groupId: row.membership_group_id!,
    startsOn: dateString(row.membership_starts_on!),
    endsOn: row.membership_ends_on ? dateString(row.membership_ends_on) : undefined,
    logoUrl: row.membership_logo_url ?? undefined,
    sourceSnapshotId: row.membership_source_snapshot_id ?? undefined
  };
}

function mapVoteRosterLegislature(row: VoteRosterRow): Legislature {
  return {
    id: row.legislature_id,
    label: row.legislature_label,
    startsOn: dateString(row.legislature_starts_on),
    endsOn: dateString(row.legislature_ends_on)
  };
}

function mapGroupVoteTotal(row: typeof schema.groupVoteTotals.$inferSelect): GroupVoteTotal {
  return {
    id: row.id,
    voteId: row.voteId,
    groupId: row.groupId,
    for: row.forCount,
    against: row.against,
    abstention: row.abstention,
    presentNotVoting: row.presentNotVoting
  };
}

function mapIndividualVote(row: typeof schema.individualVotes.$inferSelect): IndividualVote {
  return {
    id: row.id,
    voteId: row.voteId,
    memberId: row.memberId,
    groupId: row.groupId ?? undefined,
    choice: row.choice,
    voteMethod: row.voteMethod ?? undefined
  };
}

function mapMemberMandate(row: typeof schema.memberMandates.$inferSelect): MemberMandate {
  return {
    id: row.id,
    memberId: row.memberId,
    legislatureId: row.legislatureId,
    chamber: row.chamber,
    startsOn: row.startsOn,
    endsOn: row.endsOn ?? undefined,
    constituency: row.constituency ?? undefined,
    status: row.status === "active" || row.status === "ended" || row.status === "unknown" ? row.status : "unknown",
    sourceSnapshotId: row.sourceSnapshotId ?? undefined
  };
}

function mapLegislature(row: typeof schema.legislatures.$inferSelect): Legislature {
  return {
    id: row.id,
    label: row.label,
    startsOn: row.startsOn,
    endsOn: row.endsOn
  };
}

function mapMemberGroupMembership(row: typeof schema.memberGroupMemberships.$inferSelect): MemberGroupMembership {
  return {
    id: row.id,
    memberId: row.memberId,
    groupId: row.groupId,
    startsOn: row.startsOn,
    endsOn: row.endsOn ?? undefined,
    logoUrl: row.logoUrl ?? undefined,
    sourceSnapshotId: row.sourceSnapshotId ?? undefined
  };
}

function mapMemberPartyAffiliation(row: typeof schema.memberPartyAffiliations.$inferSelect): MemberPartyAffiliation {
  return {
    id: row.id,
    memberId: row.memberId,
    partyId: row.partyId,
    startsOn: row.startsOn,
    endsOn: row.endsOn ?? undefined,
    logoUrl: row.logoUrl ?? undefined,
    sourceSnapshotId: row.sourceSnapshotId ?? undefined
  };
}

function mapMemberMandateRelation(row: typeof schema.memberMandateRelations.$inferSelect) {
  return {
    id: row.id,
    mandateId: row.mandateId,
    relation: "replaces" as const,
    relatedMemberId: row.relatedMemberId ?? undefined,
    relatedName: row.relatedName,
    relatedOfficialUrl: row.relatedOfficialUrl ?? undefined,
    sourceSnapshotId: row.sourceSnapshotId ?? undefined
  };
}

function mapMemberCommitteeMembership(row: typeof schema.memberCommitteeMemberships.$inferSelect): MemberCommitteeMembership {
  return {
    id: row.id,
    memberId: row.memberId,
    committeeName: row.committeeName,
    chamber: row.chamber,
    role: row.role ?? undefined,
    startsOn: row.startsOn,
    endsOn: row.endsOn ?? undefined,
    sourceSnapshotId: row.sourceSnapshotId ?? undefined
  };
}

function mapMemberRole(row: typeof schema.memberRoles.$inferSelect): MemberRole {
  return {
    id: row.id,
    memberId: row.memberId,
    title: row.title,
    chamber: row.chamber,
    startsOn: row.startsOn,
    endsOn: row.endsOn ?? undefined,
    sourceSnapshotId: row.sourceSnapshotId ?? undefined
  };
}

function mapBillEvent(row: typeof schema.billEvents.$inferSelect): BillEvent {
  return {
    id: row.id,
    billId: row.billId,
    occurredOn: row.occurredOn,
    chamber:
      row.chamber === "senate" || row.chamber === "deputies" || row.chamber === "joint" || row.chamber === "unknown"
        ? row.chamber
        : "unknown",
    label: row.label,
    sourceUrl: row.sourceUrl ?? undefined
  };
}

function mapDocument(row: typeof schema.documents.$inferSelect): DocumentSource {
  return {
    id: row.id,
    billId: row.billId,
    label: row.label,
    url: row.url
  };
}

async function getMemberVotesForLegislature(
  db: DbClient,
  memberIds: string[],
  legislatureId: string
): Promise<{ individualVotes: IndividualVote[]; voteRecords: Vote[] }> {
  if (memberIds.length === 0) return { individualVotes: [], voteRecords: [] };
  const rows = await db.execute<MemberVoteRow>(sql`
    select
      iv.id as individual_vote_id,
      iv.vote_id as individual_vote_vote_id,
      iv.member_id as individual_vote_member_id,
      iv.group_id as individual_vote_group_id,
      iv.choice as individual_vote_choice,
      iv.vote_method as individual_vote_method,
      v.id as vote_id,
      v.bill_id as vote_bill_id,
      v.chamber as vote_chamber,
      v.title as vote_title,
      v.held_on as vote_held_on,
      v.vote_type as vote_type,
      v.present as vote_present,
      v.for_count as vote_for_count,
      v.against as vote_against,
      v.abstention as vote_abstention,
      v.present_not_voting as vote_present_not_voting,
      v.absent as vote_absent,
      v.source_snapshot_id as vote_source_snapshot_id
    from individual_votes iv
    join votes v on v.id = iv.vote_id
    join legislatures l on l.id = ${legislatureId}
    where iv.member_id in (${sql.join(memberIds.map((memberId) => sql`${memberId}`), sql`, `)})
      and v.held_on >= l.starts_on
      and v.held_on < l.ends_on
    order by v.held_on desc, v.id desc
    limit 100
  `);
  const voteById = new Map<string, Vote>();
  const individualVotes = rows.map((row) => {
    const vote = voteFromMemberVoteRow(row);
    voteById.set(vote.id, vote);
    return {
      id: row.individual_vote_id,
      voteId: row.individual_vote_vote_id,
      memberId: row.individual_vote_member_id,
      groupId: row.individual_vote_group_id ?? undefined,
      choice: row.individual_vote_choice,
      voteMethod: row.individual_vote_method ?? undefined
    };
  });
  return { individualVotes, voteRecords: [...voteById.values()] };
}

async function getMemberSponsoredBillsForLegislature(
  db: DbClient,
  memberIds: string[],
  legislatureId: string
): Promise<Bill[]> {
  if (memberIds.length === 0) return [];
  const rows = await db.execute<MemberBillRow>(sql`
    select distinct
      b.id,
      b.slug,
      b.title,
      b.identifiers,
      b.chamber_of_origin,
      b.status,
      b.source_snapshot_ids,
      coalesce(min(be.occurred_on), date '0001-01-01') as sort_date
    from bill_sponsors bs
    join bills b on b.id = bs.bill_id
    left join bill_events be on be.bill_id = b.id
    join legislatures l on l.id = ${legislatureId}
    where bs.member_id in (${sql.join(memberIds.map((memberId) => sql`${memberId}`), sql`, `)})
      and exists (
        select 1
        from bill_events be2
        where be2.bill_id = b.id
          and be2.occurred_on >= l.starts_on
          and be2.occurred_on < l.ends_on
      )
    group by b.id, b.slug, b.title, b.identifiers, b.chamber_of_origin, b.status, b.source_snapshot_ids
    order by sort_date desc, b.id desc
    limit 100
  `);
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    identifiers: jsonRecord(row.identifiers),
    chamberOfOrigin: row.chamber_of_origin === "senate" || row.chamber_of_origin === "deputies" ? row.chamber_of_origin : "unknown",
    status: row.status,
    sourceSnapshotIds: jsonStringArray(row.source_snapshot_ids)
  }));
}

async function getMemberLegislatureActivity(
  db: DbClient,
  memberIds: string[],
  legislatureId: string
): Promise<MemberLegislatureActivityData | undefined> {
  if (memberIds.length === 0) return undefined;
  try {
    const rows = await db.execute<MemberActivityRow>(sql`
      select
        sum(votes_for)::int as votes_for,
        sum(votes_against)::int as votes_against,
        sum(abstentions)::int as abstentions,
        sum(present_not_voting)::int as present_not_voting,
        sum(absent)::int as absent,
        sum(unknown)::int as unknown,
        sum(proposals)::int as proposals,
        sum(committees)::int as committees,
        sum(roles)::int as roles,
        min(first_activity_on) as first_activity_on,
        max(last_activity_on) as last_activity_on
      from member_legislature_activity
      where member_id in (${sql.join(memberIds.map((memberId) => sql`${memberId}`), sql`, `)})
        and legislature_id = ${legislatureId}
    `);
    const row = rows[0];
    if (!row) return undefined;
    return {
      votesFor: Number(row.votes_for ?? 0),
      votesAgainst: Number(row.votes_against ?? 0),
      abstentions: Number(row.abstentions ?? 0),
      presentNotVoting: Number(row.present_not_voting ?? 0),
      absent: Number(row.absent ?? 0),
      unknown: Number(row.unknown ?? 0),
      proposals: Number(row.proposals ?? 0),
      committees: Number(row.committees ?? 0),
      roles: Number(row.roles ?? 0),
      firstActivityOn: row.first_activity_on ? dateString(row.first_activity_on) : undefined,
      lastActivityOn: row.last_activity_on ? dateString(row.last_activity_on) : undefined
    };
  } catch {
    return undefined;
  }
}

async function getVoteCoverage(db: DbClient, voteIds: string[]): Promise<Record<string, VoteCoverageData>> {
  if (voteIds.length === 0) return {};
  try {
    const rows = await db.execute<VoteCoverageRow>(sql`
      select vote_id, coverage_level, nominal_votes, group_totals, source_status
      from vote_coverage_summaries
      where vote_id in (${sql.join(voteIds.map((voteId) => sql`${voteId}`), sql`, `)})
    `);
    return Object.fromEntries(
      rows.map((row) => [
        row.vote_id,
        {
          coverageLevel: row.coverage_level,
          nominalVotes: Number(row.nominal_votes),
          groupTotals: Number(row.group_totals),
          sourceStatus: row.source_status
        }
      ])
    );
  } catch {
    return {};
  }
}

function activityFromRows(votes: IndividualVote[], proposals: number, history: MemberHistoryRow[]): MemberLegislatureActivityData {
  return {
    votesFor: votes.filter((vote) => vote.choice === "for").length,
    votesAgainst: votes.filter((vote) => vote.choice === "against").length,
    abstentions: votes.filter((vote) => vote.choice === "abstention").length,
    presentNotVoting: votes.filter((vote) => vote.choice === "present_not_voting").length,
    absent: votes.filter((vote) => vote.choice === "absent").length,
    unknown: votes.filter((vote) => vote.choice === "unknown").length,
    proposals,
    committees: history.filter((row) => row.type === "committee").length,
    roles: history.filter((row) => row.type === "role").length
  };
}

function voteFromMemberVoteRow(row: MemberVoteRow): Vote {
  return {
    id: row.vote_id,
    billId: row.vote_bill_id ?? undefined,
    chamber: row.vote_chamber,
    title: row.vote_title,
    heldOn: dateString(row.vote_held_on),
    voteType: row.vote_type,
    totals: {
      present: Number(row.vote_present),
      for: Number(row.vote_for_count),
      against: Number(row.vote_against),
      abstention: Number(row.vote_abstention),
      presentNotVoting: Number(row.vote_present_not_voting),
      absent: row.vote_absent === null || row.vote_absent === undefined ? undefined : Number(row.vote_absent)
    },
    sourceSnapshotId: row.vote_source_snapshot_id
  };
}

function dateString(value: Date | string): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function jsonRecord(value: unknown): Record<string, string> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, string>;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, string> : {};
    } catch {
      return {};
    }
  }
  return {};
}

function jsonStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
    } catch {
      return [];
    }
  }
  return [];
}

function directoryBillItem(input: {
  bill: Bill;
  events: BillEvent[];
  votes: Vote[];
  sources: SourceSnapshot[];
}): BillDirectoryItem {
  const sortedEvents = [...input.events].sort((a, b) => a.occurredOn.localeCompare(b.occurredOn));
  const submittedOn = sortedEvents[0]?.occurredOn;
  const latestEventOn = sortedEvents.at(-1)?.occurredOn;
  const sourceId = input.bill.sourceSnapshotIds[0];

  return {
    bill: input.bill,
    submittedOn,
    latestEventOn,
    source: input.sources.find((source) => source.id === sourceId),
    voteCount: input.votes.length
  };
}

function buildVoteSeatRows(input: {
  vote: Vote;
  individualVotes: IndividualVote[];
  mandates: MemberMandate[];
  memberships: MemberGroupMembership[];
  legislatures: Legislature[];
}): IndividualVote[] {
  const votedByMember = new Map(input.individualVotes.map((vote) => [vote.memberId, vote]));
  const legislatureById = new Map(input.legislatures.map((legislature) => [legislature.id, legislature]));
  const chamberMemberIds = new Set(
    input.mandates
      .filter(
        (mandate) =>
          mandate.chamber === input.vote.chamber &&
          activeMandateOnDate(mandate, legislatureById.get(mandate.legislatureId), input.vote.heldOn)
      )
      .map((mandate) => mandate.memberId)
  );

  for (const vote of input.individualVotes) {
    chamberMemberIds.add(vote.memberId);
  }

  const targetSeats = chamberSeatCount(input.vote.chamber, input.vote.heldOn, input.legislatures);
  const currentMembershipByMember = new Map<string, MemberGroupMembership | undefined>();
  for (const memberId of chamberMemberIds) {
    currentMembershipByMember.set(
      memberId,
      latestMembershipOn(input.memberships.filter((membership) => membership.memberId === memberId), input.vote.heldOn)
    );
  }

  const orderedMemberIds = [...chamberMemberIds]
    .sort((a, b) => {
      const groupA = votedByMember.get(a)?.groupId ?? currentMembershipByMember.get(a)?.groupId ?? "";
      const groupB = votedByMember.get(b)?.groupId ?? currentMembershipByMember.get(b)?.groupId ?? "";
      return groupA.localeCompare(groupB, "ro") || a.localeCompare(b, "ro");
    });
  const visibleMemberIds =
    targetSeats && input.individualVotes.length <= targetSeats
      ? [
          ...input.individualVotes.map((vote) => vote.memberId),
          ...orderedMemberIds.filter((memberId) => !votedByMember.has(memberId)).slice(0, Math.max(0, targetSeats - input.individualVotes.length))
        ]
      : orderedMemberIds;

  return visibleMemberIds.map((memberId) => {
      const existing = votedByMember.get(memberId);
      const membership = currentMembershipByMember.get(memberId);
      if (existing) {
        return {
          ...existing,
          groupId: existing.groupId ?? membership?.groupId
        };
      }
      return {
        id: `${input.vote.id}-${memberId}-absent`,
        voteId: input.vote.id,
        memberId,
        groupId: membership?.groupId,
        choice: "absent"
      };
    });
}

function latestMembership(memberships: MemberGroupMembership[]): MemberGroupMembership | undefined {
  return [...memberships]
    .sort((a, b) => {
      if (!a.endsOn && b.endsOn) return -1;
      if (a.endsOn && !b.endsOn) return 1;
      return b.startsOn.localeCompare(a.startsOn);
    })
    .at(0);
}

function latestMembershipOn(memberships: MemberGroupMembership[], date: string): MemberGroupMembership | undefined {
  const active = memberships.filter((membership) => activeOnDate(membership.startsOn, membership.endsOn, date));
  return [...(active.length > 0 ? active : [])].sort((a, b) => b.startsOn.localeCompare(a.startsOn)).at(0);
}

function latestMembershipDuring(memberships: MemberGroupMembership[], startsOn: string, endsOn: string | undefined): MemberGroupMembership | undefined {
  const active = memberships.filter((membership) => {
    const membershipEndsOn = membership.endsOn ?? "9999-12-31";
    const periodEndsOn = endsOn ?? "9999-12-31";
    return membership.startsOn <= periodEndsOn && membershipEndsOn >= startsOn;
  });
  return [...active].sort((a, b) => b.startsOn.localeCompare(a.startsOn)).at(0);
}

function activeMandateOnDate(mandate: MemberMandate, legislature: Legislature | undefined, date: string): boolean {
  return activeOnDate(mandate.startsOn, earliestDate(mandate.endsOn, legislature?.endsOn), date);
}

function activeOnDate(startsOn: string, endsOn: string | undefined | null, date: string): boolean {
  return startsOn <= date && (!endsOn || endsOn >= date);
}

function earliestDate(...dates: Array<string | undefined | null>): string | undefined {
  return dates.filter((date): date is string => Boolean(date)).sort()[0];
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function uniqueBy<T>(values: T[], key: (value: T) => string): T[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const itemKey = key(value);
    if (seen.has(itemKey)) return false;
    seen.add(itemKey);
    return true;
  });
}

function latestMandate(mandates: MemberMandate[]): MemberMandate | undefined {
  return [...mandates]
    .sort((a, b) => {
      if (!a.endsOn && b.endsOn) return -1;
      if (a.endsOn && !b.endsOn) return 1;
      return b.startsOn.localeCompare(a.startsOn);
    })
    .at(0);
}

function filterDirectoryItems(
  items: MemberDirectoryItem[],
  filters?: { chamber?: string; group?: string; q?: string; legislature?: string }
): MemberDirectoryItem[] {
  const query = normalizeSearch(filters?.q);
  return items
    .filter((item) => !filters?.chamber || item.mandate?.chamber === filters.chamber)
    .filter((item) => !filters?.legislature || item.mandate?.legislatureId === filters.legislature)
    .filter((item) => !filters?.group || matchesMemberGroupFilter(item, filters.group))
    .filter((item) => {
      if (!query) return true;
      return [item.member.displayName, item.member.firstName, item.member.lastName, item.group?.shortName, item.party?.shortName]
        .map(normalizeSearch)
        .some((value) => value.includes(query));
    })
    .sort((a, b) => a.member.displayName.localeCompare(b.member.displayName, "ro"));
}

function memberDirectoryConditions(filters?: { chamber?: string; group?: string; q?: string; legislature?: string }) {
  const conditions = [];
  if (filters?.chamber === "senate" || filters?.chamber === "deputies") {
    conditions.push(sql`mm.chamber = ${filters.chamber}`);
  }
  if (filters?.legislature) {
    conditions.push(sql`mm.legislature_id = ${filters.legislature}`);
  }
  if (filters?.q?.trim()) {
    const pattern = `%${normalizeSearch(filters.q)}%`;
    conditions.push(sql`(
      ${normalizedSql(sql`m.display_name || ' ' || m.slug || ' ' || coalesce(pg.short_name, '') || ' ' || coalesce(p.short_name, '')`)} like ${pattern}
      or exists (
        select 1
        from entity_search_index esi
        where esi.entity_type = 'member'
          and esi.entity_id = m.id
          and esi.search_text like ${pattern}
      )
    )`);
  }
  if (filters?.group) {
    conditions.push(memberGroupCondition(filters.group));
  }
  return conditions;
}

function memberDirectoryGroupsSql(filters?: { chamber?: string; legislature?: string }) {
  const conditions = [];
  if (filters?.chamber === "senate" || filters?.chamber === "deputies") {
    conditions.push(sql`pg.chamber = ${filters.chamber}`);
  }
  if (filters?.legislature) {
    conditions.push(sql`exists (
      select 1
      from member_group_memberships mgm
      join member_mandates mm on mm.member_id = mgm.member_id and mm.chamber = pg.chamber
      where mgm.group_id = pg.id
        and mm.legislature_id = ${filters.legislature}
        and mgm.starts_on <= coalesce(mm.ends_on, date '9999-12-31')
        and coalesce(mgm.ends_on, date '9999-12-31') >= mm.starts_on
    )`);
  }
  const where = conditions.length ? sql`where ${sql.join(conditions, sql` and `)}` : sql``;
  return sql`
    select distinct
      pg.id,
      pg.party_id as "partyId",
      pg.chamber,
      pg.short_name as "shortName",
      pg.name,
      pg.color
    from parliamentary_groups pg
    ${where}
    order by pg.chamber, pg.short_name
  `;
}

function memberGroupCondition(groupFilter: string) {
  if (groupFilter.startsWith("group-name:")) {
    const key = groupFilter.replace(/^group-name:/, "");
    return sql`${normalizedGroupSql(sql`coalesce(p.short_name, pg.short_name)`)} = ${key}`;
  }
  return sql`(pg.id = ${groupFilter} or p.id = ${groupFilter})`;
}

function normalizedSql(value: ReturnType<typeof sql>) {
  return sql`lower(translate(${value}, 'ăâîșşțţĂÂÎȘŞȚŢ', 'aaissttAAISSTT'))`;
}

function normalizedGroupSql(value: ReturnType<typeof sql>) {
  return sql`regexp_replace(${normalizedSql(value)}, '[^a-z0-9]', '', 'g')`;
}

function matchesMemberGroupFilter(item: MemberDirectoryItem, groupFilter: string): boolean {
  if (item.group?.id === groupFilter) return true;
  if (item.party?.id === groupFilter) return true;
  return groupFilter.startsWith("group-name:")
    ? normalizeGroupFilterKey(item.group?.shortName) === groupFilter.replace(/^group-name:/, "")
    : false;
}

function normalizeGroupFilterKey(value?: string): string {
  return normalizeSearch(value).replace(/[^a-z0-9]/g, "");
}

function filterMemberDirectoryGroups(
  groups: ParliamentaryGroup[],
  mandates: MemberMandate[],
  memberships: MemberGroupMembership[],
  legislatures: Legislature[],
  filters?: { chamber?: string; legislature?: string }
): ParliamentaryGroup[] {
  const chamber = filters?.chamber === "senate" || filters?.chamber === "deputies" ? filters.chamber : undefined;
  const legislature = filters?.legislature ? legislatures.find((item) => item.id === filters.legislature) : undefined;
  if (!chamber && !legislature) return groups;

  return groups
    .filter((group) => !chamber || group.chamber === chamber)
    .filter((group) => {
      if (!legislature) return true;
      return memberships.some((membership) => {
        if (membership.groupId !== group.id) return false;
        return mandates.some(
          (mandate) =>
            mandate.memberId === membership.memberId &&
            mandate.legislatureId === legislature.id &&
            mandate.chamber === group.chamber &&
            membership.startsOn <= earliestDate(mandate.endsOn, legislature.endsOn)! &&
            (membership.endsOn ?? "9999-12-31") >= mandate.startsOn
        );
      });
    });
}

function normalizeSearch(value?: string): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function buildMemberHistory(input: {
  mandates: MemberMandate[];
  mandateRelations: MemberMandateRelation[];
  groupMemberships: MemberGroupMembership[];
  partyAffiliations: MemberPartyAffiliation[];
  committees: MemberCommitteeMembership[];
  roles: MemberRole[];
  groups: ParliamentaryGroup[];
  parties: Party[];
  votes: IndividualVote[];
}): MemberHistoryRow[] {
  const votesFor = input.votes.filter((vote) => vote.choice === "for").length;
  const votesAgainst = input.votes.filter((vote) => vote.choice === "against").length;
  const abstentions = input.votes.filter((vote) => vote.choice === "abstention").length;
  const counts = { votesFor, votesAgainst, abstentions, proposals: 0 };

  return [
    ...input.mandates.map((mandate) => ({
      id: `history-${mandate.id}`,
      startsOn: mandate.startsOn,
      endsOn: mandate.endsOn,
      legislatureId: mandate.legislatureId,
      chamber: mandate.chamber,
      type: "mandate" as const,
      label: "Mandat parlamentar",
      details: cleanHistoryDetail(mandate.constituency) ?? mandate.status,
      ...counts
    })),
    ...input.mandateRelations.flatMap((relation) => {
      const mandate = input.mandates.find((item) => item.id === relation.mandateId);
      if (!mandate) return [];
      return [
        {
          id: `history-${relation.id}`,
          startsOn: mandate.startsOn,
          endsOn: mandate.endsOn,
          legislatureId: mandate.legislatureId,
          chamber: mandate.chamber,
          type: "relation" as const,
          label: "Înlocuire mandat",
          details: `Înlocuiește pe ${relation.relatedName}`,
          sourceUrl: relation.relatedOfficialUrl,
          ...counts
        }
      ];
    }),
    ...input.groupMemberships.map((membership) => {
      const group = input.groups.find((item) => item.id === membership.groupId);
      const mandate = mandateForMemberPeriod(input.mandates, membership.memberId, membership.startsOn);
      return {
        id: `history-${membership.id}`,
        startsOn: membership.startsOn,
        endsOn: membership.endsOn,
        legislatureId: mandate?.legislatureId,
        chamber: mandate?.chamber ?? group?.chamber ?? "senate",
        type: "group" as const,
        label: group?.shortName ?? membership.groupId,
        details: group?.name ?? "Grup parlamentar",
        logoUrl: membership.logoUrl,
        ...counts
      };
    }),
    ...input.partyAffiliations.map((affiliation) => {
      const party = input.parties.find((item) => item.id === affiliation.partyId);
      const mandate = mandateForMemberPeriod(input.mandates, affiliation.memberId, affiliation.startsOn);
      return {
        id: `history-${affiliation.id}`,
        startsOn: affiliation.startsOn,
        endsOn: affiliation.endsOn,
        legislatureId: mandate?.legislatureId,
        chamber: mandate?.chamber ?? chamberForMemberPeriod(input.mandates, affiliation.memberId, affiliation.startsOn),
        type: "party" as const,
        label: party?.shortName ?? affiliation.partyId,
        details: party?.name ?? "Formațiune politică",
        logoUrl: affiliation.logoUrl,
        ...counts
      };
    }),
    ...input.committees.map((committee) => ({
      id: `history-${committee.id}`,
      startsOn: committee.startsOn,
      endsOn: committee.endsOn,
      legislatureId: mandateForMemberPeriod(input.mandates, committee.memberId, committee.startsOn)?.legislatureId,
      chamber: committee.chamber,
      type: "committee" as const,
      label: committee.committeeName,
      details: committee.role ?? "Membru",
      ...counts
    })),
    ...input.roles.map((role) => ({
      id: `history-${role.id}`,
      startsOn: role.startsOn,
      endsOn: role.endsOn,
      legislatureId: mandateForMemberPeriod(input.mandates, role.memberId, role.startsOn)?.legislatureId,
      chamber: role.chamber,
      type: "role" as const,
      label: role.title,
      details: "Rol parlamentar",
      ...counts
    }))
  ].sort((a, b) => b.startsOn.localeCompare(a.startsOn));
}

async function findMemberByLegacySlug(
  db: DbClient,
  slug: string
): Promise<typeof schema.members.$inferSelect | undefined> {
  const baseSlug = slug.replace(/-(deputies|senate)-[a-z0-9-]+$/i, "");
  if (!baseSlug || baseSlug === slug) return undefined;
  const rows = await db.select().from(schema.members).where(ilike(schema.members.slug, `${baseSlug}%`));
  return rows
    .filter((row) => row.slug === baseSlug || row.slug.startsWith(`${baseSlug}-`))
    .sort((a, b) => memberLegislatureRank(b) - memberLegislatureRank(a) || a.slug.length - b.slug.length)[0];
}

function memberLegislatureRank(row: typeof schema.members.$inferSelect): number {
  const sourceIds = row.sourceIds && typeof row.sourceIds === "object" && !Array.isArray(row.sourceIds) ? row.sourceIds : {};
  const key = Object.keys(sourceIds).find((item) => item.startsWith("deputies:") || item.startsWith("senate:"));
  const year = key?.match(/:(\d{4})$/)?.[1];
  return year ? Number(year) : row.id.includes("-2020-") ? 2020 : 2024;
}

function cleanHistoryDetail(value?: string): string | undefined {
  const cleaned = (value ?? "")
    .replace(/data validării.*$/i, "")
    .replace(/data validarii.*$/i, "")
    .replace(/\bn\.\s*\d.*$/i, "")
    .replace(/Formaţiunea politică.*$/i, "")
    .replace(/Formatiunea politica.*$/i, "")
    .trim();
  return cleaned || undefined;
}

function mandateForMemberPeriod(mandates: MemberMandate[], memberId: string, date: string): MemberMandate | undefined {
  const memberMandates = mandates.filter((mandate) => mandate.memberId === memberId);
  return (
    memberMandates
      .filter((mandate) => mandate.startsOn <= date && (!mandate.endsOn || mandate.endsOn >= date))
      .sort((a, b) => b.startsOn.localeCompare(a.startsOn))[0] ??
    memberMandates.sort((a, b) => b.startsOn.localeCompare(a.startsOn))[0]
  );
}

function chamberForMemberPeriod(mandates: MemberMandate[], memberId: string, date: string): MemberMandate["chamber"] {
  return mandateForMemberPeriod(mandates, memberId, date)?.chamber ?? "deputies";
}

type DateValue = Date | string;

type MemberDirectoryRow = {
  member_id: string;
  member_person_id: string | null;
  member_slug: string;
  member_first_name: string;
  member_last_name: string;
  member_display_name: string;
  member_source_ids: unknown;
  mandate_id: string;
  mandate_member_id: string;
  mandate_legislature_id: string;
  mandate_chamber: MemberMandate["chamber"];
  mandate_starts_on: DateValue;
  mandate_ends_on: DateValue | null;
  mandate_constituency: string | null;
  mandate_status: string;
  mandate_source_snapshot_id: string | null;
  group_id: string | null;
  group_party_id: string | null;
  group_chamber: ParliamentaryGroup["chamber"] | null;
  group_short_name: string | null;
  group_name: string | null;
  group_color: string | null;
  party_id: string | null;
  party_slug: string | null;
  party_short_name: string | null;
  party_name: string | null;
  party_color: string | null;
};

type VoteRosterRow = {
  mandate_id: string;
  mandate_member_id: string;
  mandate_legislature_id: string;
  mandate_chamber: MemberMandate["chamber"];
  mandate_starts_on: DateValue;
  mandate_ends_on: DateValue | null;
  mandate_constituency: string | null;
  mandate_status: string;
  mandate_source_snapshot_id: string | null;
  legislature_id: string;
  legislature_label: string;
  legislature_starts_on: DateValue;
  legislature_ends_on: DateValue;
  membership_id: string | null;
  membership_member_id: string | null;
  membership_group_id: string | null;
  membership_starts_on: DateValue | null;
  membership_ends_on: DateValue | null;
  membership_logo_url: string | null;
  membership_source_snapshot_id: string | null;
};

type MemberVoteRow = {
  individual_vote_id: string;
  individual_vote_vote_id: string;
  individual_vote_member_id: string;
  individual_vote_group_id: string | null;
  individual_vote_choice: IndividualVote["choice"];
  individual_vote_method: string | null;
  vote_id: string;
  vote_bill_id: string | null;
  vote_chamber: Vote["chamber"];
  vote_title: string;
  vote_held_on: DateValue;
  vote_type: string;
  vote_present: number;
  vote_for_count: number;
  vote_against: number;
  vote_abstention: number;
  vote_present_not_voting: number;
  vote_absent: number | null;
  vote_source_snapshot_id: string;
};

type MemberBillRow = {
  id: string;
  slug: string;
  title: string;
  identifiers: unknown;
  chamber_of_origin: string;
  status: string;
  source_snapshot_ids: unknown;
};

type MemberActivityRow = {
  votes_for: number | null;
  votes_against: number | null;
  abstentions: number | null;
  present_not_voting: number | null;
  absent: number | null;
  unknown: number | null;
  proposals: number | null;
  committees: number | null;
  roles: number | null;
  first_activity_on: DateValue | null;
  last_activity_on: DateValue | null;
};

type VoteCoverageRow = {
  vote_id: string;
  coverage_level: VoteCoverageData["coverageLevel"];
  nominal_votes: number;
  group_totals: number;
  source_status: VoteCoverageData["sourceStatus"];
};
