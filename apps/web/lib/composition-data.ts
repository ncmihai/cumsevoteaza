import { createDbSession } from "@cumsevoteaza/db";
import * as schema from "@cumsevoteaza/db";
import {
  type CompositionEvent,
  demoDataset,
  type AlignmentBasis,
  type ChamberId,
  type Government,
  type GovernmentRole,
  type GovernanceAlignment,
  type Legislature,
  type Member,
  type MemberGroupMembership,
  type MemberMandate,
  type ParliamentaryGroup,
  type Party,
  type Person
} from "@cumsevoteaza/parliament-model";

export type CompositionMode = "official" | "computed";

export interface CompositionSeat {
  member: Pick<Member, "id" | "slug" | "displayName">;
  group?: Pick<ParliamentaryGroup, "id" | "shortName" | "name" | "color">;
  alignment: GovernanceAlignment;
  alignmentBasis: AlignmentBasis;
}

export interface ChamberComposition {
  chamber: ChamberId;
  seats: CompositionSeat[];
  groups: Array<{
    group: Pick<ParliamentaryGroup, "id" | "shortName" | "name" | "color">;
    party?: Pick<Party, "id" | "slug" | "shortName" | "name" | "color">;
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

export interface CompositionTimelineStop {
  id: string;
  legislature: Legislature;
  activeGovernment?: Government;
  governments: Government[];
  primeMinister?: Person;
  primeMinisterRole?: GovernmentRole;
  events: CompositionEvent[];
  sourceStatus: "manual" | "verified";
  chambers: ChamberComposition[];
}

export interface CompositionTimelineData {
  mode: CompositionMode;
  asOf: string;
  stops: CompositionTimelineStop[];
  currentComposition?: CompositionPageData;
  sourceKind: "database" | "demo";
}

interface AlignmentRow {
  targetId: string;
  alignment: GovernanceAlignment;
  basis: AlignmentBasis;
  startsOn: string;
  endsOn?: string | null;
}

interface CompositionSourceRows {
  legislatures: Legislature[];
  members: Member[];
  mandates: MemberMandate[];
  memberships: MemberGroupMembership[];
  groups: ParliamentaryGroup[];
  parties: Party[];
  memberAlignments: AlignmentRow[];
  groupAlignments: AlignmentRow[];
  partyAlignments: AlignmentRow[];
}

export async function getCurrentCompositionData(mode: CompositionMode): Promise<CompositionPageData> {
  const dbData = await tryDatabaseCurrentComposition(mode);
  if (dbData) return dbData;
  return demoComposition(mode);
}

export async function getCompositionTimelineData(mode: CompositionMode): Promise<CompositionTimelineData> {
  const currentComposition = await getCurrentCompositionData(mode);
  const dbData = await tryDatabaseCompositionTimeline(mode, currentComposition);
  if (dbData) return dbData;
  return {
    mode,
    asOf: currentComposition.asOf,
    stops: [],
    currentComposition,
    sourceKind: currentComposition.sourceKind
  };
}

async function tryDatabaseCompositionTimeline(
  mode: CompositionMode,
  currentComposition: CompositionPageData
): Promise<CompositionTimelineData | undefined> {
  if (!process.env.DATABASE_URL) return undefined;

  const session = createDbSession();
  try {
    const [
      governmentRows,
      peopleRows,
      roleRows,
      eventRows,
      memberRows,
      mandateRows,
      membershipRows,
      legislatureRows,
      groupRows,
      partyRows,
      memberAlignmentRows,
      groupAlignmentRows,
      partyAlignmentRows
    ] = await Promise.all([
      session.db.select().from(schema.governments),
      session.db.select().from(schema.people),
      session.db.select().from(schema.governmentRoles),
      session.db.select().from(schema.compositionEvents),
      session.db.select().from(schema.members),
      session.db.select().from(schema.memberMandates),
      session.db.select().from(schema.memberGroupMemberships),
      session.db.select().from(schema.legislatures),
      session.db.select().from(schema.parliamentaryGroups),
      session.db.select().from(schema.parties),
      session.db.select().from(schema.memberGovernanceAlignments),
      session.db.select().from(schema.governmentGroupAlignments),
      session.db.select().from(schema.governmentPartyAlignments)
    ]);
    const compositionRows = mapCompositionRows({
      memberRows,
      mandateRows,
      membershipRows,
      legislatureRows,
      groupRows,
      partyRows,
      memberAlignmentRows,
      groupAlignmentRows,
      partyAlignmentRows
    });
    const people = peopleRows.map(mapPerson);
    const peopleById = new Map(people.map((person) => [person.id, person]));
    const roles = roleRows.map(mapGovernmentRole);
    const governments = governmentRows.map(mapGovernment);
    const governmentsById = new Map(governments.map((government) => [government.id, government]));
    const events = eventRows
      .map(mapCompositionEvent)
      .filter((event) => isTimelineEvent(event.eventType))
      .sort((a, b) => a.occurredOn.localeCompare(b.occurredOn) || a.title.localeCompare(b.title, "ro"));
    const legislatures = legislatureRows.map(mapLegislature).sort((a, b) => b.startsOn.localeCompare(a.startsOn));
    const today = new Date().toISOString().slice(0, 10);

    return {
      mode,
      asOf: currentComposition.asOf,
      currentComposition,
      sourceKind: "database",
      stops: legislatures.flatMap((legislature) => {
        const legislatureGovernments = governments
          .filter((government) => government.legislatureId === legislature.id)
          .sort((a, b) => b.startsOn.localeCompare(a.startsOn));
        const legislatureEvents = events.filter((event) => {
          if (event.legislatureId === legislature.id) return true;
          const government = event.governmentId ? governmentsById.get(event.governmentId) : undefined;
          return government?.legislatureId === legislature.id;
        });
        if (legislatureGovernments.length === 0 && legislatureEvents.length === 0) return [];

        const compositionDate = today >= legislature.startsOn && today < legislature.endsOn
          ? today
          : legislatureGovernments[0]?.startsOn ?? legislature.startsOn;
        const activeGovernment =
          legislatureGovernments.find((government) => isActiveGovernment(government, compositionDate)) ?? legislatureGovernments[0];
        const primeMinister = activeGovernment?.primeMinisterPersonId ? peopleById.get(activeGovernment.primeMinisterPersonId) : undefined;
        const primeMinisterRole = activeGovernment
          ? roles.find((role) => role.governmentId === activeGovernment.id && role.personId === activeGovernment.primeMinisterPersonId)
          : undefined;
        const stopComposition = buildComposition({
          mode,
          asOf: compositionDate,
          ...compositionRows,
          sourceKind: "database"
        });
        return [
          {
            id: legislature.id,
            legislature,
            activeGovernment,
            governments: legislatureGovernments,
            primeMinister,
            primeMinisterRole,
            events: legislatureEvents,
            sourceStatus: legislatureGovernments.some((government) => government.sourceSnapshotId) || legislatureEvents.some((event) => event.sourceSnapshotId) ? "verified" : "manual",
            chambers: hasCompositionSeats(stopComposition) ? stopComposition.chambers : []
          }
        ];
      })
    };
  } catch {
    return undefined;
  } finally {
    await session.close();
  }
}

async function tryDatabaseCurrentComposition(mode: CompositionMode): Promise<CompositionPageData | undefined> {
  if (!process.env.DATABASE_URL) return undefined;

  const session = createDbSession();
  try {
    const today = new Date().toISOString().slice(0, 10);
    const [memberRows, mandateRows, membershipRows, legislatureRows, groupRows, partyRows, memberAlignmentRows, groupAlignmentRows, partyAlignmentRows] =
      await Promise.all([
        session.db.select().from(schema.members),
        session.db.select().from(schema.memberMandates),
        session.db.select().from(schema.memberGroupMemberships),
        session.db.select().from(schema.legislatures),
        session.db.select().from(schema.parliamentaryGroups),
        session.db.select().from(schema.parties),
        session.db.select().from(schema.memberGovernanceAlignments),
        session.db.select().from(schema.governmentGroupAlignments),
        session.db.select().from(schema.governmentPartyAlignments)
      ]);

    const compositionRows = mapCompositionRows({
      memberRows,
      mandateRows,
      membershipRows,
      legislatureRows,
      groupRows,
      partyRows,
      memberAlignmentRows,
      groupAlignmentRows,
      partyAlignmentRows
    });

    return buildComposition({
      mode,
      asOf: today,
      ...compositionRows,
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
    legislatures: demoDataset.legislatures,
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
  legislatures: Legislature[];
  groups: ParliamentaryGroup[];
  parties: Party[];
  memberAlignments: AlignmentRow[];
  groupAlignments: AlignmentRow[];
  partyAlignments: AlignmentRow[];
  sourceKind: "database" | "demo";
}): CompositionPageData {
  const memberById = new Map(input.members.map((member) => [member.id, member]));
  const legislatureById = new Map(input.legislatures.map((legislature) => [legislature.id, legislature]));
  const groupById = new Map(input.groups.map((group) => [group.id, group]));
  const partyById = new Map(input.parties.map((party) => [party.id, party]));

  const chambers: ChamberComposition[] = (["deputies", "senate"] as ChamberId[]).map((chamber) => {
    const seats = input.mandates
      .filter((mandate) => mandate.chamber === chamber && activeMandateOn(mandate, legislatureById.get(mandate.legislatureId), input.asOf))
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
        return [
          {
            member: compactMember(member),
            group: group ? compactGroup(group) : undefined,
            ...alignment
          }
        ];
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
            group: compactGroup(group),
            party: party ? compactParty(party) : undefined,
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

function compactMember(member: Member): Pick<Member, "id" | "slug" | "displayName"> {
  return {
    id: member.id,
    slug: member.slug,
    displayName: member.displayName
  };
}

function compactGroup(group: ParliamentaryGroup): Pick<ParliamentaryGroup, "id" | "shortName" | "name" | "color"> {
  return {
    id: group.id,
    shortName: group.shortName,
    name: group.name,
    color: group.color
  };
}

function compactParty(party: Party): Pick<Party, "id" | "slug" | "shortName" | "name" | "color"> {
  return {
    id: party.id,
    slug: party.slug,
    shortName: party.shortName,
    name: party.name,
    color: party.color
  };
}

function hasCompositionSeats(composition: CompositionPageData): boolean {
  return composition.chambers.some((chamber) => chamber.seats.length > 0);
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

function activeMandateOn(mandate: MemberMandate, legislature: Legislature | undefined, date: string): boolean {
  const boundedEndsOn = earliestDate(mandate.endsOn, legislature?.endsOn);
  return activeOn(mandate.startsOn, boundedEndsOn, date);
}

function earliestDate(...dates: Array<string | undefined | null>): string | undefined {
  return dates.filter((date): date is string => Boolean(date)).sort()[0];
}

function groupSortKey(group?: Pick<ParliamentaryGroup, "shortName">): string {
  if (!group) return "zzzz";
  return group.shortName;
}

function mostCommonAlignment(values: GovernanceAlignment[]): GovernanceAlignment {
  const counts = new Map<GovernanceAlignment, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "unknown";
}

function mapCompositionRows(input: {
  memberRows: Array<typeof schema.members.$inferSelect>;
  mandateRows: Array<typeof schema.memberMandates.$inferSelect>;
  membershipRows: Array<typeof schema.memberGroupMemberships.$inferSelect>;
  legislatureRows: Array<typeof schema.legislatures.$inferSelect>;
  groupRows: Array<typeof schema.parliamentaryGroups.$inferSelect>;
  partyRows: Array<typeof schema.parties.$inferSelect>;
  memberAlignmentRows: Array<typeof schema.memberGovernanceAlignments.$inferSelect>;
  groupAlignmentRows: Array<typeof schema.governmentGroupAlignments.$inferSelect>;
  partyAlignmentRows: Array<typeof schema.governmentPartyAlignments.$inferSelect>;
}): CompositionSourceRows {
  return {
    legislatures: input.legislatureRows.map((row) => ({
      id: row.id,
      label: row.label,
      startsOn: row.startsOn,
      endsOn: row.endsOn
    })),
    members: input.memberRows.map((row) => ({
      id: row.id,
      personId: row.personId ?? undefined,
      slug: row.slug,
      firstName: row.firstName,
      lastName: row.lastName,
      displayName: row.displayName,
      sourceIds: row.sourceIds
    })),
    mandates: input.mandateRows.map((row) => ({
      id: row.id,
      memberId: row.memberId,
      legislatureId: row.legislatureId,
      chamber: row.chamber,
      startsOn: row.startsOn,
      endsOn: row.endsOn ?? undefined,
      constituency: row.constituency ?? undefined,
      status: row.status as MemberMandate["status"],
      sourceSnapshotId: row.sourceSnapshotId ?? undefined
    })),
    memberships: input.membershipRows.map((row) => ({
      id: row.id,
      memberId: row.memberId,
      groupId: row.groupId,
      startsOn: row.startsOn,
      endsOn: row.endsOn ?? undefined,
      sourceSnapshotId: row.sourceSnapshotId ?? undefined
    })),
    groups: input.groupRows.map((row) => ({
      id: row.id,
      partyId: row.partyId ?? undefined,
      chamber: row.chamber,
      shortName: row.shortName,
      name: row.name,
      color: row.color
    })),
    parties: input.partyRows.map((row) => ({
      id: row.id,
      slug: row.slug,
      shortName: row.shortName,
      name: row.name,
      color: row.color
    })),
    memberAlignments: input.memberAlignmentRows.map((row) => ({
      targetId: row.memberId,
      alignment: row.alignment,
      basis: row.basis,
      startsOn: row.startsOn,
      endsOn: row.endsOn
    })),
    groupAlignments: input.groupAlignmentRows.map((row) => ({
      targetId: row.groupId,
      alignment: row.alignment,
      basis: row.basis,
      startsOn: row.startsOn,
      endsOn: row.endsOn
    })),
    partyAlignments: input.partyAlignmentRows.map((row) => ({
      targetId: row.partyId,
      alignment: row.alignment,
      basis: row.basis,
      startsOn: row.startsOn,
      endsOn: row.endsOn
    }))
  };
}

function mapPerson(row: typeof schema.people.$inferSelect): Person {
  return {
    id: row.id,
    slug: row.slug,
    displayName: row.displayName,
    normalizedName: row.normalizedName,
    birthDate: row.birthDate ?? undefined,
    sourceIds: row.sourceIds
  };
}

function mapGovernment(row: typeof schema.governments.$inferSelect): Government {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    legislatureId: row.legislatureId ?? undefined,
    primeMinisterPersonId: row.primeMinisterPersonId ?? undefined,
    startsOn: row.startsOn,
    endsOn: row.endsOn ?? undefined,
    basis: row.basis,
    investitureVoteId: row.investitureVoteId ?? undefined,
    sourceSnapshotId: row.sourceSnapshotId ?? undefined
  };
}

function mapGovernmentRole(row: typeof schema.governmentRoles.$inferSelect): GovernmentRole {
  return {
    id: row.id,
    governmentId: row.governmentId,
    personId: row.personId,
    title: row.title,
    ministry: row.ministry ?? undefined,
    startsOn: row.startsOn,
    endsOn: row.endsOn ?? undefined,
    sourceSnapshotId: row.sourceSnapshotId ?? undefined
  };
}

function mapCompositionEvent(row: typeof schema.compositionEvents.$inferSelect): CompositionEvent {
  return {
    id: row.id,
    eventType: row.eventType,
    title: row.title,
    description: row.description ?? undefined,
    occurredOn: row.occurredOn,
    endsOn: row.endsOn ?? undefined,
    legislatureId: row.legislatureId ?? undefined,
    governmentId: row.governmentId ?? undefined,
    chamber: row.chamber ?? undefined,
    memberId: row.memberId ?? undefined,
    personId: row.personId ?? undefined,
    partyId: row.partyId ?? undefined,
    groupId: row.groupId ?? undefined,
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

function isTimelineEvent(type: CompositionEvent["eventType"]): boolean {
  return [
    "legislature_start",
    "legislature_end",
    "government_designated",
    "government_invested",
    "government_ended",
    "no_confidence_motion",
    "confidence_vote",
    "coalition_change",
    "reshuffle"
  ].includes(type);
}

function isActiveGovernment(government: Government, date: string): boolean {
  return activeOn(government.startsOn, government.endsOn, date);
}
