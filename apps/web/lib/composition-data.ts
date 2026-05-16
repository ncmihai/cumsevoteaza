import { createDbSession } from "@cumsevoteaza/db";
import * as schema from "@cumsevoteaza/db";
import {
  demoDataset,
  type AlignmentBasis,
  type ChamberId,
  type GovernanceAlignment,
  type Member,
  type MemberGroupMembership,
  type MemberMandate,
  type ParliamentaryGroup,
  type Party
} from "@cumsevoteaza/parliament-model";

export type CompositionMode = "official" | "computed";

export interface CompositionSeat {
  member: Member;
  mandate: MemberMandate;
  group?: ParliamentaryGroup;
  party?: Party;
  alignment: GovernanceAlignment;
  alignmentBasis: AlignmentBasis;
}

export interface ChamberComposition {
  chamber: ChamberId;
  seats: CompositionSeat[];
  groups: Array<{
    group: ParliamentaryGroup;
    party?: Party;
    seats: number;
    alignment: GovernanceAlignment;
  }>;
}

export interface CompositionPageData {
  mode: CompositionMode;
  asOf: string;
  chambers: ChamberComposition[];
  sourceKind: "database" | "demo";
}

interface AlignmentRow {
  targetId: string;
  alignment: GovernanceAlignment;
  basis: AlignmentBasis;
  startsOn: string;
  endsOn?: string | null;
}

export async function getCurrentCompositionData(mode: CompositionMode): Promise<CompositionPageData> {
  const dbData = await tryDatabaseCurrentComposition(mode);
  if (dbData) return dbData;
  return demoComposition(mode);
}

async function tryDatabaseCurrentComposition(mode: CompositionMode): Promise<CompositionPageData | undefined> {
  if (!process.env.DATABASE_URL) return undefined;

  const session = createDbSession();
  try {
    const today = new Date().toISOString().slice(0, 10);
    const [memberRows, mandateRows, membershipRows, groupRows, partyRows, memberAlignmentRows, groupAlignmentRows, partyAlignmentRows] =
      await Promise.all([
        session.db.select().from(schema.members),
        session.db.select().from(schema.memberMandates),
        session.db.select().from(schema.memberGroupMemberships),
        session.db.select().from(schema.parliamentaryGroups),
        session.db.select().from(schema.parties),
        session.db.select().from(schema.memberGovernanceAlignments),
        session.db.select().from(schema.governmentGroupAlignments),
        session.db.select().from(schema.governmentPartyAlignments)
      ]);

    const members = memberRows.map((row) => ({
      id: row.id,
      personId: row.personId ?? undefined,
      slug: row.slug,
      firstName: row.firstName,
      lastName: row.lastName,
      displayName: row.displayName,
      sourceIds: row.sourceIds
    }));
    const mandates = mandateRows.map((row) => ({
      id: row.id,
      memberId: row.memberId,
      legislatureId: row.legislatureId,
      chamber: row.chamber,
      startsOn: row.startsOn,
      endsOn: row.endsOn ?? undefined,
      constituency: row.constituency ?? undefined,
      status: row.status as MemberMandate["status"],
      sourceSnapshotId: row.sourceSnapshotId ?? undefined
    }));
    const memberships = membershipRows.map((row) => ({
      id: row.id,
      memberId: row.memberId,
      groupId: row.groupId,
      startsOn: row.startsOn,
      endsOn: row.endsOn ?? undefined,
      sourceSnapshotId: row.sourceSnapshotId ?? undefined
    }));
    const groups = groupRows.map((row) => ({
      id: row.id,
      partyId: row.partyId ?? undefined,
      chamber: row.chamber,
      shortName: row.shortName,
      name: row.name,
      color: row.color
    }));
    const parties = partyRows.map((row) => ({
      id: row.id,
      slug: row.slug,
      shortName: row.shortName,
      name: row.name,
      color: row.color
    }));
    const memberAlignments = memberAlignmentRows.map((row) => ({
      targetId: row.memberId,
      alignment: row.alignment,
      basis: row.basis,
      startsOn: row.startsOn,
      endsOn: row.endsOn
    }));
    const groupAlignments = groupAlignmentRows.map((row) => ({
      targetId: row.groupId,
      alignment: row.alignment,
      basis: row.basis,
      startsOn: row.startsOn,
      endsOn: row.endsOn
    }));
    const partyAlignments = partyAlignmentRows.map((row) => ({
      targetId: row.partyId,
      alignment: row.alignment,
      basis: row.basis,
      startsOn: row.startsOn,
      endsOn: row.endsOn
    }));

    return buildComposition({
      mode,
      asOf: today,
      members,
      mandates,
      memberships,
      groups,
      parties,
      memberAlignments,
      groupAlignments,
      partyAlignments,
      sourceKind: "database"
    });
  } catch {
    return undefined;
  } finally {
    await session.close();
  }
}

function demoComposition(mode: CompositionMode): CompositionPageData {
  const asOf = new Date().toISOString().slice(0, 10);
  return buildComposition({
    mode,
    asOf,
    members: demoDataset.members,
    mandates: demoDataset.mandates,
    memberships: demoDataset.groupMemberships,
    groups: demoDataset.groups,
    parties: demoDataset.parties,
    memberAlignments: [],
    groupAlignments: [],
    partyAlignments: [],
    sourceKind: "demo"
  });
}

function buildComposition(input: {
  mode: CompositionMode;
  asOf: string;
  members: Member[];
  mandates: MemberMandate[];
  memberships: MemberGroupMembership[];
  groups: ParliamentaryGroup[];
  parties: Party[];
  memberAlignments: AlignmentRow[];
  groupAlignments: AlignmentRow[];
  partyAlignments: AlignmentRow[];
  sourceKind: "database" | "demo";
}): CompositionPageData {
  const memberById = new Map(input.members.map((member) => [member.id, member]));
  const groupById = new Map(input.groups.map((group) => [group.id, group]));
  const partyById = new Map(input.parties.map((party) => [party.id, party]));

  const chambers: ChamberComposition[] = (["deputies", "senate"] as ChamberId[]).map((chamber) => {
    const seats = input.mandates
      .filter((mandate) => mandate.chamber === chamber && activeOn(mandate.startsOn, mandate.endsOn, input.asOf))
      .flatMap((mandate) => {
        const member = memberById.get(mandate.memberId);
        if (!member) return [];
        const membership = latestActiveMembership(
          input.memberships.filter((item) => item.memberId === member.id),
          input.asOf
        );
        const group = membership ? groupById.get(membership.groupId) : undefined;
        const party = group?.partyId ? partyById.get(group.partyId) : undefined;
        const alignment = resolveAlignment({
          mode: input.mode,
          asOf: input.asOf,
          memberId: member.id,
          groupId: group?.id,
          partyId: party?.id,
          memberAlignments: input.memberAlignments,
          groupAlignments: input.groupAlignments,
          partyAlignments: input.partyAlignments
        });
        return [{ member, mandate, group, party, ...alignment }];
      })
      .sort(
        (a, b) =>
          groupSortKey(a.group).localeCompare(groupSortKey(b.group), "ro") ||
          a.member.displayName.localeCompare(b.member.displayName, "ro")
      );

    const groups = [...new Set(seats.flatMap((seat) => (seat.group ? [seat.group.id] : [])))]
      .flatMap((groupId) => {
        const group = groupById.get(groupId);
        if (!group) return [];
        const party = group.partyId ? partyById.get(group.partyId) : undefined;
        const groupSeats = seats.filter((seat) => seat.group?.id === group.id);
        return [
          {
            group,
            party,
            seats: groupSeats.length,
            alignment: mostCommonAlignment(groupSeats.map((seat) => seat.alignment))
          }
        ];
      })
      .sort((a, b) => b.seats - a.seats || a.group.shortName.localeCompare(b.group.shortName, "ro"));

    return { chamber, seats, groups };
  });

  return {
    mode: input.mode,
    asOf: input.asOf,
    chambers,
    sourceKind: input.sourceKind
  };
}

function resolveAlignment(input: {
  mode: CompositionMode;
  asOf: string;
  memberId: string;
  groupId?: string;
  partyId?: string;
  memberAlignments: AlignmentRow[];
  groupAlignments: AlignmentRow[];
  partyAlignments: AlignmentRow[];
}): { alignment: GovernanceAlignment; alignmentBasis: AlignmentBasis } {
  const member = latestAlignment(input.memberAlignments.filter((row) => row.targetId === input.memberId), input.mode, input.asOf);
  if (member) return { alignment: member.alignment, alignmentBasis: member.basis };
  const group = input.groupId
    ? latestAlignment(input.groupAlignments.filter((row) => row.targetId === input.groupId), input.mode, input.asOf)
    : undefined;
  if (group) return { alignment: group.alignment, alignmentBasis: group.basis };
  const party = input.partyId
    ? latestAlignment(input.partyAlignments.filter((row) => row.targetId === input.partyId), input.mode, input.asOf)
    : undefined;
  if (party) return { alignment: party.alignment, alignmentBasis: party.basis };
  return { alignment: "unknown", alignmentBasis: "unknown" };
}

function latestAlignment(rows: AlignmentRow[], mode: CompositionMode, asOf: string): AlignmentRow | undefined {
  return rows
    .filter((row) => activeOn(row.startsOn, row.endsOn ?? undefined, asOf))
    .filter((row) => (mode === "computed" ? row.basis === "computed_vote_support" : row.basis !== "computed_vote_support"))
    .sort((a, b) => b.startsOn.localeCompare(a.startsOn))[0];
}

function latestActiveMembership(rows: MemberGroupMembership[], asOf: string): MemberGroupMembership | undefined {
  const active = rows.filter((row) => activeOn(row.startsOn, row.endsOn, asOf));
  return [...(active.length > 0 ? active : rows)].sort((a, b) => b.startsOn.localeCompare(a.startsOn))[0];
}

function activeOn(startsOn: string, endsOn: string | undefined | null, date: string): boolean {
  return startsOn <= date && (!endsOn || endsOn >= date);
}

function groupSortKey(group?: ParliamentaryGroup): string {
  if (!group) return "zzzz";
  return `${group.chamber}-${group.shortName}`;
}

function mostCommonAlignment(values: GovernanceAlignment[]): GovernanceAlignment {
  const counts = new Map<GovernanceAlignment, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "unknown";
}
