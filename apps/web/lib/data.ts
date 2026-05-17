import { eq, inArray, or, sql } from "drizzle-orm";
import { createDbSession } from "@cumsevoteaza/db";
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
  type MemberPartyAffiliation,
  type MemberRole,
  type ParliamentaryGroup,
  type Party,
  type SourceSnapshot,
  type Vote
} from "@cumsevoteaza/parliament-model";

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

export async function getVoteDirectoryData(limit = 30): Promise<VoteDirectoryData> {
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

  const session = createDbSession();
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
    const groupRows = await session.db.select().from(schema.parliamentaryGroups);
    const memberRows = await session.db.select().from(schema.members);
    const mandateRows = await session.db.select().from(schema.memberMandates);
    const membershipRows = await session.db.select().from(schema.memberGroupMemberships);
    const legislatureRows = await session.db.select().from(schema.legislatures);
    const groupTotalRows = await session.db
      .select()
      .from(schema.groupVoteTotals)
      .where(eq(schema.groupVoteTotals.voteId, voteRow.id));
    const individualVoteRows = await session.db
      .select()
      .from(schema.individualVotes)
      .where(eq(schema.individualVotes.voteId, voteRow.id));
    const individualVotes = individualVoteRows.map(mapIndividualVote);

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
        mandates: mandateRows.map(mapMemberMandate),
        memberships: membershipRows.map(mapMemberGroupMembership),
        legislatures: legislatureRows.map(mapLegislature)
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

  const session = createDbSession();
  try {
    const voteRows = await session.db.select().from(schema.votes);
    const billRows = await session.db.select().from(schema.bills);
    const sourceRows = await session.db.select().from(schema.sourceSnapshots);
    const bills = billRows.map(mapBill);
    const sources = sourceRows.map(mapSource);

    return {
      items: voteRows
        .map(mapVote)
        .sort((a, b) => b.heldOn.localeCompare(a.heldOn))
        .slice(0, limit)
        .map((vote) => ({
          vote,
          bill: bills.find((bill) => bill.id === vote.billId),
          source: sources.find((source) => source.id === vote.sourceSnapshotId)
        })),
      sourceKind: "database"
    };
  } catch {
    return undefined;
  } finally {
    await session.close();
  }
}

async function tryDatabaseBillDirectory(limit: number): Promise<BillDirectoryData | undefined> {
  if (!process.env.DATABASE_URL) return undefined;

  const session = createDbSession();
  try {
    const billRows = await session.db.select().from(schema.bills);
    const eventRows = await session.db.select().from(schema.billEvents);
    const voteRows = await session.db.select().from(schema.votes);
    const sourceRows = await session.db.select().from(schema.sourceSnapshots);
    const events = eventRows.map(mapBillEvent);
    const votes = voteRows.map(mapVote);
    const sources = sourceRows.map(mapSource);

    return {
      items: billRows
        .map(mapBill)
        .map((bill) =>
          directoryBillItem({
            bill,
            events: events.filter((event) => event.billId === bill.id),
            votes: votes.filter((vote) => vote.billId === bill.id),
            sources
          })
        )
        .sort((a, b) => (b.submittedOn ?? b.latestEventOn ?? "").localeCompare(a.submittedOn ?? a.latestEventOn ?? ""))
        .slice(0, limit),
      sourceKind: "database"
    };
  } catch {
    return undefined;
  } finally {
    await session.close();
  }
}

async function tryDatabaseBill(id: string): Promise<BillPageData | undefined> {
  if (!process.env.DATABASE_URL) return undefined;

  const session = createDbSession();
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

  const session = createDbSession();
  try {
    const memberRows = await session.db.select().from(schema.members);
    const mandateRows = await session.db.select().from(schema.memberMandates);
    const membershipRows = await session.db.select().from(schema.memberGroupMemberships);
    const legislatureRows = await session.db.select().from(schema.legislatures);
    const groupRows = await session.db.select().from(schema.parliamentaryGroups);
    const partyRows = await session.db.select().from(schema.parties);
    const groups = groupRows.map(mapGroup);
    const parties = partyRows.map(mapParty);
    const legislatures = legislatureRows.map(mapLegislature).sort((a, b) => b.startsOn.localeCompare(a.startsOn));
    const legislatureById = new Map(legislatures.map((legislature) => [legislature.id, legislature]));
    const mandates = mandateRows.map(mapMemberMandate);
    const memberships = membershipRows.map(mapMemberGroupMembership);
    const items = memberRows.map((memberRow) => {
      const member = mapMember(memberRow);
      const memberMandates = mandates.filter(
        (item) =>
          item.memberId === member.id &&
          (!filters?.chamber || item.chamber === filters.chamber) &&
          (!filters?.legislature || item.legislatureId === filters.legislature)
      );
      const mandate = latestMandate(memberMandates);
      const legislature = mandate ? legislatureById.get(mandate.legislatureId) : undefined;
      const memberMemberships = memberships.filter((item) => item.memberId === member.id);
      const membership =
        mandate && filters?.legislature
          ? latestMembershipDuring(memberMemberships, mandate.startsOn, earliestDate(mandate.endsOn, legislature?.endsOn))
          : latestMembership(memberMemberships);
      const group = groups.find((item) => item.id === membership?.groupId);
      const party = parties.find((item) => item.id === group?.partyId);
      return { member, mandate, group, party };
    });
    return {
      members: filterDirectoryItems(items, filters),
      groups: filterMemberDirectoryGroups(groups, mandates, memberships, legislatures, filters),
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

  const session = createDbSession();
  try {
    const [memberRow] = await session.db
      .select()
      .from(schema.members)
      .where(or(eq(schema.members.slug, slug), eq(schema.members.id, slug)))
      .limit(1);
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

  const session = createDbSession();
  try {
    const [partyRow] = await session.db
      .select()
      .from(schema.parties)
      .where(or(eq(schema.parties.slug, slug), eq(schema.parties.id, slug)))
      .limit(1);
    if (!partyRow) return undefined;
    const party = mapParty(partyRow);
    const groups = (await session.db.select().from(schema.parliamentaryGroups)).map(mapGroup).filter((group) => group.partyId === party.id);
    const groupIds = new Set(groups.map((group) => group.id));
    const memberships = (await session.db.select().from(schema.memberGroupMemberships)).map(mapMemberGroupMembership);
    const memberIds = new Set(memberships.filter((membership) => groupIds.has(membership.groupId)).map((membership) => membership.memberId));
    const members = (await session.db.select().from(schema.members)).map(mapMember).filter((member) => memberIds.has(member.id));
    const groupTotals = (await session.db.select().from(schema.groupVoteTotals))
      .map(mapGroupVoteTotal)
      .filter((total) => groupIds.has(total.groupId));
    const votes = (await session.db.select().from(schema.votes)).map(mapVote).filter((vote) => groupTotals.some((total) => total.voteId === vote.id));
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
  db: ReturnType<typeof createDbSession>["db"],
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
  db: ReturnType<typeof createDbSession>["db"],
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
  db: ReturnType<typeof createDbSession>["db"],
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

async function getVoteCoverage(db: ReturnType<typeof createDbSession>["db"], voteIds: string[]): Promise<Record<string, VoteCoverageData>> {
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

  const currentMembershipByMember = new Map<string, MemberGroupMembership | undefined>();
  for (const memberId of chamberMemberIds) {
    currentMembershipByMember.set(
      memberId,
      latestMembershipOn(input.memberships.filter((membership) => membership.memberId === memberId), input.vote.heldOn)
    );
  }

  return [...chamberMemberIds]
    .sort((a, b) => {
      const groupA = votedByMember.get(a)?.groupId ?? currentMembershipByMember.get(a)?.groupId ?? "";
      const groupB = votedByMember.get(b)?.groupId ?? currentMembershipByMember.get(b)?.groupId ?? "";
      return groupA.localeCompare(groupB, "ro") || a.localeCompare(b, "ro");
    })
    .map((memberId) => {
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
      chamber: mandate.chamber,
      type: "mandate" as const,
      label: "Mandat parlamentar",
      details: mandate.constituency ?? mandate.status,
      ...counts
    })),
    ...input.groupMemberships.map((membership) => {
      const group = input.groups.find((item) => item.id === membership.groupId);
      return {
        id: `history-${membership.id}`,
        startsOn: membership.startsOn,
        endsOn: membership.endsOn,
        chamber: group?.chamber ?? "senate",
        type: "group" as const,
        label: group?.shortName ?? membership.groupId,
        details: group?.name ?? "Grup parlamentar",
        ...counts
      };
    }),
    ...input.partyAffiliations.map((affiliation) => {
      const party = input.parties.find((item) => item.id === affiliation.partyId);
      return {
        id: `history-${affiliation.id}`,
        startsOn: affiliation.startsOn,
        endsOn: affiliation.endsOn,
        chamber: chamberForMemberPeriod(input.mandates, affiliation.memberId, affiliation.startsOn),
        type: "party" as const,
        label: party?.shortName ?? affiliation.partyId,
        details: party?.name ?? "Formațiune politică",
        ...counts
      };
    }),
    ...input.committees.map((committee) => ({
      id: `history-${committee.id}`,
      startsOn: committee.startsOn,
      endsOn: committee.endsOn,
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
      chamber: role.chamber,
      type: "role" as const,
      label: role.title,
      details: "Rol parlamentar",
      ...counts
    }))
  ].sort((a, b) => b.startsOn.localeCompare(a.startsOn));
}

function chamberForMemberPeriod(mandates: MemberMandate[], memberId: string, date: string): MemberMandate["chamber"] {
  return (
    mandates
      .filter((mandate) => mandate.memberId === memberId && mandate.startsOn <= date && (!mandate.endsOn || mandate.endsOn >= date))
      .sort((a, b) => b.startsOn.localeCompare(a.startsOn))[0]?.chamber ??
    mandates.filter((mandate) => mandate.memberId === memberId).sort((a, b) => b.startsOn.localeCompare(a.startsOn))[0]?.chamber ??
    "deputies"
  );
}

type DateValue = Date | string;

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
