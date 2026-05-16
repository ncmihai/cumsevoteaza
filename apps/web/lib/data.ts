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
  type ParliamentaryGroup,
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
