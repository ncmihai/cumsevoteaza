import { eq, or } from "drizzle-orm";
import { createDbSession } from "@cumsevoteaza/db";
import * as schema from "@cumsevoteaza/db";
import {
  demoDataset,
  type Bill,
  type BillEvent,
  type DocumentSource,
  type GroupVoteTotal,
  type IndividualVote,
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
  sourceKind: "database" | "demo";
}

export interface MemberPageData {
  member: Member;
  mandate?: MemberMandate;
  group?: ParliamentaryGroup;
  party?: Party;
  source?: SourceSnapshot;
  history: MemberHistoryRow[];
  votes: IndividualVote[];
  voteRecords: Vote[];
  sponsoredBills: Bill[];
  sourceKind: "database" | "demo";
}

export interface PartyPageData {
  party: Party;
  groups: ParliamentaryGroup[];
  members: Member[];
  groupTotals: GroupVoteTotal[];
  votes: Vote[];
  sourceKind: "database" | "demo";
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

export async function getMemberDirectoryData(filters?: { chamber?: string; group?: string }): Promise<MemberDirectoryData> {
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
    groups: demoDataset.groups,
    parties: demoDataset.parties,
    sourceKind: "demo"
  };
}

export async function getMemberPageData(slug: string): Promise<MemberPageData | undefined> {
  const dbData = await tryDatabaseMember(slug);
  if (dbData) return dbData;

  const member = demoDataset.members.find((item) => item.slug === slug || item.id === slug);
  if (!member) return undefined;
  const history = demoDataset.memberHistory[member.id] ?? [];
  const groupMembership = demoDataset.groupMemberships.find((item) => item.memberId === member.id && !item.endsOn);
  const group = demoDataset.groups.find((item) => item.id === groupMembership?.groupId);
  const party = demoDataset.parties.find((item) => item.id === group?.partyId);
  const mandate = demoDataset.mandates.find((item) => item.memberId === member.id);
  const source = demoDataset.sourceSnapshots.find((item) => item.id === groupMembership?.sourceSnapshotId);
  const votes = demoDataset.individualVotes.filter((vote) => vote.memberId === member.id);
  const voteRecords = demoDataset.votes.filter((vote) => votes.some((individualVote) => individualVote.voteId === vote.id));
  const sponsoredBills = demoDataset.billSponsors
    .filter((sponsor) => sponsor.memberId === member.id)
    .flatMap((sponsor) => demoDataset.bills.filter((bill) => bill.id === sponsor.billId));

  return { member, mandate, group, party, source, history, votes, voteRecords, sponsoredBills, sourceKind: "demo" };
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
    const groupTotalRows = await session.db
      .select()
      .from(schema.groupVoteTotals)
      .where(eq(schema.groupVoteTotals.voteId, voteRow.id));
    const individualVoteRows = await session.db
      .select()
      .from(schema.individualVotes)
      .where(eq(schema.individualVotes.voteId, voteRow.id));

    return {
      vote: mapVote(voteRow),
      bill: billRow ? mapBill(billRow) : undefined,
      source: sourceRow ? mapSource(sourceRow) : undefined,
      groups: groupRows.map(mapGroup),
      members: memberRows.map(mapMember),
      groupTotals: groupTotalRows.map(mapGroupVoteTotal),
      individualVotes: individualVoteRows.map(mapIndividualVote),
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

async function tryDatabaseMemberDirectory(filters?: { chamber?: string; group?: string }): Promise<MemberDirectoryData | undefined> {
  if (!process.env.DATABASE_URL) return undefined;

  const session = createDbSession();
  try {
    const memberRows = await session.db.select().from(schema.members);
    const mandateRows = await session.db.select().from(schema.memberMandates);
    const membershipRows = await session.db.select().from(schema.memberGroupMemberships);
    const groupRows = await session.db.select().from(schema.parliamentaryGroups);
    const partyRows = await session.db.select().from(schema.parties);
    const groups = groupRows.map(mapGroup);
    const parties = partyRows.map(mapParty);
    const items = memberRows.map((memberRow) => {
      const member = mapMember(memberRow);
      const mandate = mandateRows
        .map(mapMemberMandate)
        .find((item) => item.memberId === member.id && (!filters?.chamber || item.chamber === filters.chamber));
      const membership = latestMembership(membershipRows.map(mapMemberGroupMembership).filter((item) => item.memberId === member.id));
      const group = groups.find((item) => item.id === membership?.groupId);
      const party = parties.find((item) => item.id === group?.partyId);
      return { member, mandate, group, party };
    });
    return { members: filterDirectoryItems(items, filters), groups, parties, sourceKind: "database" };
  } catch {
    return undefined;
  } finally {
    await session.close();
  }
}

async function tryDatabaseMember(slug: string): Promise<MemberPageData | undefined> {
  if (!process.env.DATABASE_URL) return undefined;

  const session = createDbSession();
  try {
    const [memberRow] = await session.db
      .select()
      .from(schema.members)
      .where(or(eq(schema.members.slug, slug), eq(schema.members.id, slug)))
      .limit(1);
    if (!memberRow) return undefined;

    const member = mapMember(memberRow);
    const mandateRows = await session.db.select().from(schema.memberMandates).where(eq(schema.memberMandates.memberId, member.id));
    const membershipRows = await session.db
      .select()
      .from(schema.memberGroupMemberships)
      .where(eq(schema.memberGroupMemberships.memberId, member.id));
    const partyAffiliationRows = await session.db
      .select()
      .from(schema.memberPartyAffiliations)
      .where(eq(schema.memberPartyAffiliations.memberId, member.id));
    const committeeRows = await session.db
      .select()
      .from(schema.memberCommitteeMemberships)
      .where(eq(schema.memberCommitteeMemberships.memberId, member.id));
    const roleRows = await session.db.select().from(schema.memberRoles).where(eq(schema.memberRoles.memberId, member.id));
    const individualVoteRows = await session.db
      .select()
      .from(schema.individualVotes)
      .where(eq(schema.individualVotes.memberId, member.id));
    const billSponsorRows = await session.db.select().from(schema.billSponsors).where(eq(schema.billSponsors.memberId, member.id));
    const groups = (await session.db.select().from(schema.parliamentaryGroups)).map(mapGroup);
    const parties = (await session.db.select().from(schema.parties)).map(mapParty);
    const votes = individualVoteRows.map(mapIndividualVote);
    const voteRows = await session.db.select().from(schema.votes);
    const billRows = await session.db.select().from(schema.bills);
    const memberships = membershipRows.map(mapMemberGroupMembership);
    const currentMembership = latestMembership(memberships);
    const group = groups.find((item) => item.id === currentMembership?.groupId);
    const party = parties.find((item) => item.id === group?.partyId);
    const mandates = mandateRows.map(mapMemberMandate);
    const mandate = mandates.find((item) => !item.endsOn) ?? mandates[0];
    const sourceId =
      currentMembership?.sourceSnapshotId ??
      mandate?.sourceSnapshotId ??
      membershipRows.find((item) => item.sourceSnapshotId)?.sourceSnapshotId;
    const [sourceRow] = sourceId
      ? await session.db.select().from(schema.sourceSnapshots).where(eq(schema.sourceSnapshots.id, sourceId)).limit(1)
      : [];

    return {
      member,
      mandate,
      group,
      party,
      source: sourceRow ? mapSource(sourceRow) : undefined,
      history: buildMemberHistory({
        mandates,
        groupMemberships: memberships,
        partyAffiliations: partyAffiliationRows.map(mapMemberPartyAffiliation),
        committees: committeeRows.map(mapMemberCommitteeMembership),
        roles: roleRows.map(mapMemberRole),
        groups,
        parties,
        votes
      }),
      votes,
      voteRecords: voteRows.map(mapVote).filter((vote) => votes.some((individualVote) => individualVote.voteId === vote.id)),
      sponsoredBills: billRows.map(mapBill).filter((bill) => billSponsorRows.some((sponsor) => sponsor.billId === bill.id)),
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

function latestMembership(memberships: MemberGroupMembership[]): MemberGroupMembership | undefined {
  return [...memberships]
    .sort((a, b) => {
      if (!a.endsOn && b.endsOn) return -1;
      if (a.endsOn && !b.endsOn) return 1;
      return b.startsOn.localeCompare(a.startsOn);
    })
    .at(0);
}

function filterDirectoryItems(
  items: MemberDirectoryItem[],
  filters?: { chamber?: string; group?: string }
): MemberDirectoryItem[] {
  return items
    .filter((item) => !filters?.chamber || item.mandate?.chamber === filters.chamber)
    .filter((item) => !filters?.group || item.group?.id === filters.group)
    .sort((a, b) => a.member.displayName.localeCompare(b.member.displayName, "ro"));
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
        chamber: "senate" as const,
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
