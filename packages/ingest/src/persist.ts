import { eq, sql } from "drizzle-orm";
import { createDbSession } from "@cumsevoteaza/db";
import * as schema from "@cumsevoteaza/db";
import type {
  Bill,
  BillEvent,
  BillSponsor,
  CompositionEvent,
  DocumentSource,
  Government,
  GovernmentRole,
  GroupVoteTotal,
  IndividualVote,
  Member,
  MemberCommitteeMembership,
  MemberGroupMembership,
  MemberMandate,
  MemberPartyAffiliation,
  MemberRole,
  ParliamentaryGroup,
  Party,
  Person,
  SourceSnapshot,
  Vote
} from "@cumsevoteaza/parliament-model";
import type { ParsedSenateBill } from "./parsers/senate-bill";
import type { ParsedSenateVote } from "./parsers/senate-vote";
import type { ParsedRoster } from "./parsers/roster";
import type { ParsedDeputiesBill } from "./parsers/deputies-bill";
import type { ParsedChamberVote } from "./parsers/chamber-vote";

const defaultLegislature = {
  id: "leg-2024-2028",
  label: "2024-2028",
  startsOn: "2024-12-01",
  endsOn: "2028-12-01"
};

type Db = ReturnType<typeof createDbSession>["db"];

export async function persistSenateBill(parsed: ParsedSenateBill) {
  const session = createDbSession();
  try {
    await upsertSourceSnapshot(session.db, parsed.sourceSnapshot);
    await upsertBill(session.db, parsed.bill);
    await Promise.all(parsed.events.map((event) => upsertBillEvent(session.db, event)));
    await Promise.all(parsed.sponsors.map((sponsor) => upsertBillSponsor(session.db, sponsor)));
    await Promise.all(parsed.documents.map((document) => upsertDocument(session.db, document)));

    return {
      billId: parsed.bill.id,
      sourceSnapshotId: parsed.sourceSnapshot.id,
      events: parsed.events.length,
      documents: parsed.documents.length
    };
  } finally {
    await session.close();
  }
}

export async function persistSenateVote(parsed: ParsedSenateVote) {
  const session = createDbSession();
  try {
    await upsertDefaultLegislature(session.db);
    await upsertSourceSnapshot(session.db, parsed.sourceSnapshot);

    if (parsed.vote.billId) {
      await ensurePlaceholderBill(session.db, {
        id: parsed.vote.billId,
        slug: parsed.vote.billId.replace(/^bill-/, ""),
        title: parsed.vote.title,
        identifiers: { senate: parsed.vote.title.split(" ")[0] ?? parsed.vote.billId },
        chamberOfOrigin: "senate",
        status: "unknown",
        sourceSnapshotIds: [parsed.sourceSnapshot.id]
      });
    }

    await Promise.all(parsed.groups.map((group) => upsertGroup(session.db, group)));
    await Promise.all(parsed.members.map((member) => upsertMember(session.db, member)));
    await Promise.all(parsed.individualVotes.map((vote) => upsertDerivedMandateAndMembership(session.db, vote, parsed)));
    await upsertVote(session.db, parsed.vote);
    await Promise.all(parsed.groupVoteTotals.map((total) => upsertGroupVoteTotal(session.db, total)));
    await Promise.all(parsed.individualVotes.map((vote) => upsertIndividualVote(session.db, vote)));

    return {
      voteId: parsed.vote.id,
      sourceSnapshotId: parsed.sourceSnapshot.id,
      members: parsed.members.length,
      groups: parsed.groups.length,
      individualVotes: parsed.individualVotes.length
    };
  } finally {
    await session.close();
  }
}

export async function persistDeputiesBill(parsed: ParsedDeputiesBill) {
  const session = createDbSession();
  try {
    await upsertSourceSnapshot(session.db, parsed.sourceSnapshot);
    await upsertBill(session.db, parsed.bill);
    await Promise.all(parsed.events.map((event) => upsertBillEvent(session.db, event)));
    await Promise.all(parsed.sponsors.map((sponsor) => upsertBillSponsor(session.db, sponsor)));
    await Promise.all(parsed.documents.map((document) => upsertDocument(session.db, document)));

    return {
      billId: parsed.bill.id,
      sourceSnapshotId: parsed.sourceSnapshot.id,
      events: parsed.events.length,
      documents: parsed.documents.length
    };
  } finally {
    await session.close();
  }
}

export async function persistChamberVote(parsed: ParsedChamberVote) {
  const session = createDbSession();
  try {
    await upsertDefaultLegislature(session.db);
    await upsertSourceSnapshot(session.db, parsed.sourceSnapshot);
    if (parsed.bill) {
      await ensurePlaceholderBill(session.db, {
        ...parsed.bill,
        sourceSnapshotIds: [parsed.sourceSnapshot.id]
      });
    }
    await upsertMembers(session.db, parsed.members);
    await upsertDerivedDeputiesMandates(session.db, parsed.members.map((member) => member.id));
    await upsertVote(session.db, parsed.vote);
    await upsertIndividualVotes(session.db, parsed.individualVotes);

    return {
      voteId: parsed.vote.id,
      sourceSnapshotId: parsed.sourceSnapshot.id,
      members: parsed.members.length,
      individualVotes: parsed.individualVotes.length,
      warnings: parsed.warnings
    };
  } finally {
    await session.close();
  }
}

export async function persistRoster(parsed: ParsedRoster) {
  const session = createDbSession();
  try {
    await upsertLegislature(session.db, parsed.legislature);
    await Promise.all(parsed.sourceSnapshots.map((source) => upsertSourceSnapshot(session.db, source)));
    await Promise.all(parsed.parties.map((party) => upsertParty(session.db, party)));
    await Promise.all(parsed.groups.map((group) => upsertGroup(session.db, group)));
    await Promise.all(parsed.members.map((member) => upsertMember(session.db, member)));
    await Promise.all(parsed.mandates.map((mandate) => upsertMemberMandate(session.db, mandate)));
    await Promise.all(parsed.groupMemberships.map((membership) => upsertMemberGroupMembership(session.db, membership)));
    await Promise.all(parsed.partyAffiliations.map((affiliation) => upsertMemberPartyAffiliation(session.db, affiliation)));
    await Promise.all(parsed.committeeMemberships.map((membership) => upsertMemberCommitteeMembership(session.db, membership)));
    await Promise.all(parsed.roles.map((role) => upsertMemberRole(session.db, role)));

    return {
      chamber: parsed.chamber,
      sources: parsed.sourceSnapshots.length,
      parties: parsed.parties.length,
      groups: parsed.groups.length,
      members: parsed.members.length,
      mandates: parsed.mandates.length,
      groupMemberships: parsed.groupMemberships.length,
      partyAffiliations: parsed.partyAffiliations.length,
      committeeMemberships: parsed.committeeMemberships.length,
      roles: parsed.roles.length,
      groupCounts: parsed.groupCounts
    };
  } finally {
    await session.close();
  }
}

async function upsertDefaultLegislature(db: Db) {
  await upsertLegislature(db, defaultLegislature);
}

async function upsertLegislature(db: Db, legislature: typeof defaultLegislature) {
  await db
    .insert(schema.legislatures)
    .values(legislature)
    .onConflictDoUpdate({
      target: schema.legislatures.id,
      set: legislature
    });
}

async function upsertSourceSnapshot(db: Db, source: SourceSnapshot) {
  await db
    .insert(schema.sourceSnapshots)
    .values({
      id: source.id,
      sourceUrl: source.sourceUrl,
      fetchedAt: new Date(source.fetchedAt),
      contentHash: source.contentHash,
      parser: source.parser,
      parserVersion: source.parserVersion,
      status: source.status,
      notes: source.notes
    })
    .onConflictDoUpdate({
      target: schema.sourceSnapshots.id,
      set: {
        sourceUrl: source.sourceUrl,
        fetchedAt: new Date(source.fetchedAt),
        contentHash: source.contentHash,
        parser: source.parser,
        parserVersion: source.parserVersion,
        status: source.status,
        notes: source.notes
      }
    });
}

async function upsertGroup(db: Db, group: ParliamentaryGroup) {
  await db
    .insert(schema.parliamentaryGroups)
    .values(group)
    .onConflictDoUpdate({
      target: schema.parliamentaryGroups.id,
      set: {
        partyId: group.partyId,
        chamber: group.chamber,
        shortName: group.shortName,
        name: group.name,
        color: group.color
      }
    });
}

async function upsertParty(db: Db, party: Party) {
  await db
    .insert(schema.parties)
    .values(party)
    .onConflictDoUpdate({
      target: schema.parties.id,
      set: {
        slug: party.slug,
        shortName: party.shortName,
        name: party.name,
        color: party.color
      }
    });
}

async function upsertMember(db: Db, member: Member) {
  const slugOwner = await db.select({ id: schema.members.id }).from(schema.members).where(eq(schema.members.slug, member.slug)).limit(1);
  const slug = slugOwner[0] && slugOwner[0].id !== member.id ? `${member.slug}-${member.id.replace(/^member-/, "")}` : member.slug;
  const values = { ...member, slug };

  await db
    .insert(schema.members)
    .values(values)
    .onConflictDoUpdate({
      target: schema.members.id,
      set: {
        personId: member.personId,
        slug,
        firstName: member.firstName,
        lastName: member.lastName,
        displayName: member.displayName,
        sourceIds: member.sourceIds
      }
    });
}

async function upsertMembers(db: Db, members: Member[]) {
  if (members.length === 0) return;
  await db
    .insert(schema.members)
    .values(members)
    .onConflictDoUpdate({
      target: schema.members.id,
      set: {
        personId: sql`excluded.person_id`,
        slug: sql`excluded.slug`,
        firstName: sql`excluded.first_name`,
        lastName: sql`excluded.last_name`,
        displayName: sql`excluded.display_name`,
        sourceIds: sql`excluded.source_ids`
      }
    });
}

export async function backfillPeopleFromMembers() {
  const session = createDbSession();
  try {
    const memberRows = await session.db.select().from(schema.members);
    const peopleById = new Map<
      string,
      {
        id: string;
        slug: string;
        displayName: string;
        normalizedName: string;
        sourceIds: Record<string, string>;
      }
    >();

    for (const member of memberRows) {
      const normalizedName = normalizePersonName(member.displayName);
      if (!normalizedName) continue;
      const id = `person-${normalizedName}`;
      const existing = peopleById.get(id);
      peopleById.set(id, {
        id,
        slug: id.replace(/^person-/, ""),
        displayName: existing?.displayName ?? member.displayName,
        normalizedName,
        sourceIds: {
          ...(existing?.sourceIds ?? {}),
          ...personSourceIds(member.id, member.sourceIds)
        }
      });
    }

    const people = [...peopleById.values()];
    if (people.length > 0) {
      await session.db
        .insert(schema.people)
        .values(people)
        .onConflictDoUpdate({
          target: schema.people.id,
          set: {
            slug: sql`excluded.slug`,
            displayName: sql`excluded.display_name`,
            normalizedName: sql`excluded.normalized_name`,
            sourceIds: sql`excluded.source_ids`
          }
        });
    }

    let linkedMembers = 0;
    for (const member of memberRows) {
      const normalizedName = normalizePersonName(member.displayName);
      if (!normalizedName) continue;
      const personId = `person-${normalizedName}`;
      await session.db
        .update(schema.members)
        .set({ personId })
        .where(eq(schema.members.id, member.id));
      linkedMembers += 1;
    }

    return {
      membersRead: memberRows.length,
      peopleUpserted: people.length,
      membersLinked: linkedMembers
    };
  } finally {
    await session.close();
  }
}

export async function persistGovernmentSkeleton(input: {
  people: Person[];
  governments: Government[];
  roles: GovernmentRole[];
  events: CompositionEvent[];
}) {
  const session = createDbSession();
  try {
    await Promise.all(input.people.map((person) => upsertPerson(session.db, person)));
    await Promise.all(input.governments.map((government) => upsertGovernment(session.db, government)));
    await Promise.all(input.roles.map((role) => upsertGovernmentRole(session.db, role)));
    await Promise.all(input.events.map((event) => upsertCompositionEvent(session.db, event)));
    return {
      people: input.people.length,
      governments: input.governments.length,
      roles: input.roles.length,
      events: input.events.length
    };
  } finally {
    await session.close();
  }
}

async function upsertPerson(db: Db, person: Person) {
  await db
    .insert(schema.people)
    .values({
      id: person.id,
      slug: person.slug,
      displayName: person.displayName,
      normalizedName: person.normalizedName,
      birthDate: person.birthDate,
      sourceIds: person.sourceIds
    })
    .onConflictDoUpdate({
      target: schema.people.id,
      set: {
        slug: person.slug,
        displayName: person.displayName,
        normalizedName: person.normalizedName,
        birthDate: person.birthDate,
        sourceIds: person.sourceIds
      }
    });
}

async function upsertGovernment(db: Db, government: Government) {
  await db
    .insert(schema.governments)
    .values({
      id: government.id,
      slug: government.slug,
      name: government.name,
      legislatureId: government.legislatureId,
      primeMinisterPersonId: government.primeMinisterPersonId,
      startsOn: government.startsOn,
      endsOn: government.endsOn,
      basis: government.basis,
      investitureVoteId: government.investitureVoteId,
      sourceSnapshotId: government.sourceSnapshotId
    })
    .onConflictDoUpdate({
      target: schema.governments.id,
      set: {
        slug: government.slug,
        name: government.name,
        legislatureId: government.legislatureId,
        primeMinisterPersonId: government.primeMinisterPersonId,
        startsOn: government.startsOn,
        endsOn: government.endsOn,
        basis: government.basis,
        investitureVoteId: government.investitureVoteId,
        sourceSnapshotId: government.sourceSnapshotId
      }
    });
}

async function upsertGovernmentRole(db: Db, role: GovernmentRole) {
  await db
    .insert(schema.governmentRoles)
    .values({
      id: role.id,
      governmentId: role.governmentId,
      personId: role.personId,
      title: role.title,
      ministry: role.ministry,
      startsOn: role.startsOn,
      endsOn: role.endsOn,
      sourceSnapshotId: role.sourceSnapshotId
    })
    .onConflictDoUpdate({
      target: schema.governmentRoles.id,
      set: {
        governmentId: role.governmentId,
        personId: role.personId,
        title: role.title,
        ministry: role.ministry,
        startsOn: role.startsOn,
        endsOn: role.endsOn,
        sourceSnapshotId: role.sourceSnapshotId
      }
    });
}

async function upsertCompositionEvent(db: Db, event: CompositionEvent) {
  await db
    .insert(schema.compositionEvents)
    .values({
      id: event.id,
      eventType: event.eventType,
      title: event.title,
      description: event.description,
      occurredOn: event.occurredOn,
      endsOn: event.endsOn,
      legislatureId: event.legislatureId,
      governmentId: event.governmentId,
      chamber: event.chamber,
      memberId: event.memberId,
      personId: event.personId,
      partyId: event.partyId,
      groupId: event.groupId,
      sourceSnapshotId: event.sourceSnapshotId
    })
    .onConflictDoUpdate({
      target: schema.compositionEvents.id,
      set: {
        eventType: event.eventType,
        title: event.title,
        description: event.description,
        occurredOn: event.occurredOn,
        endsOn: event.endsOn,
        legislatureId: event.legislatureId,
        governmentId: event.governmentId,
        chamber: event.chamber,
        memberId: event.memberId,
        personId: event.personId,
        partyId: event.partyId,
        groupId: event.groupId,
        sourceSnapshotId: event.sourceSnapshotId
      }
    });
}

function normalizePersonName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function personSourceIds(memberId: string, sourceIds: Record<string, string>): Record<string, string> {
  const ids: Record<string, string> = { [`member:${memberId}`]: memberId };
  for (const [key, value] of Object.entries(sourceIds)) {
    ids[`member:${memberId}:${key}`] = value;
  }
  return ids;
}

async function upsertMemberMandate(db: Db, mandate: MemberMandate) {
  await db
    .insert(schema.memberMandates)
    .values(mandate)
    .onConflictDoUpdate({
      target: schema.memberMandates.id,
      set: {
        memberId: mandate.memberId,
        legislatureId: mandate.legislatureId,
        chamber: mandate.chamber,
        startsOn: mandate.startsOn,
        endsOn: mandate.endsOn,
        constituency: mandate.constituency,
        status: mandate.status,
        sourceSnapshotId: mandate.sourceSnapshotId
      }
    });
}

async function upsertMemberGroupMembership(db: Db, membership: MemberGroupMembership) {
  await db
    .insert(schema.memberGroupMemberships)
    .values(membership)
    .onConflictDoUpdate({
      target: schema.memberGroupMemberships.id,
      set: {
        memberId: membership.memberId,
        groupId: membership.groupId,
        startsOn: membership.startsOn,
        endsOn: membership.endsOn,
        sourceSnapshotId: membership.sourceSnapshotId
      }
    });
}

async function upsertMemberPartyAffiliation(db: Db, affiliation: MemberPartyAffiliation) {
  await db
    .insert(schema.memberPartyAffiliations)
    .values(affiliation)
    .onConflictDoUpdate({
      target: schema.memberPartyAffiliations.id,
      set: {
        memberId: affiliation.memberId,
        partyId: affiliation.partyId,
        startsOn: affiliation.startsOn,
        endsOn: affiliation.endsOn,
        sourceSnapshotId: affiliation.sourceSnapshotId
      }
    });
}

async function upsertMemberCommitteeMembership(db: Db, membership: MemberCommitteeMembership) {
  await db
    .insert(schema.memberCommitteeMemberships)
    .values(membership)
    .onConflictDoUpdate({
      target: schema.memberCommitteeMemberships.id,
      set: {
        memberId: membership.memberId,
        committeeName: membership.committeeName,
        chamber: membership.chamber,
        role: membership.role,
        startsOn: membership.startsOn,
        endsOn: membership.endsOn,
        sourceSnapshotId: membership.sourceSnapshotId
      }
    });
}

async function upsertMemberRole(db: Db, role: MemberRole) {
  await db
    .insert(schema.memberRoles)
    .values(role)
    .onConflictDoUpdate({
      target: schema.memberRoles.id,
      set: {
        memberId: role.memberId,
        title: role.title,
        chamber: role.chamber,
        startsOn: role.startsOn,
        endsOn: role.endsOn,
        sourceSnapshotId: role.sourceSnapshotId
      }
    });
}

async function upsertBill(db: Db, bill: Bill) {
  await db
    .insert(schema.bills)
    .values({
      id: bill.id,
      slug: bill.slug,
      title: bill.title,
      identifiers: bill.identifiers,
      chamberOfOrigin: bill.chamberOfOrigin,
      status: bill.status,
      sourceSnapshotIds: bill.sourceSnapshotIds
    })
    .onConflictDoUpdate({
      target: schema.bills.id,
      set: {
        slug: bill.slug,
        title: bill.title,
        identifiers: bill.identifiers,
        chamberOfOrigin: bill.chamberOfOrigin,
        status: bill.status,
        sourceSnapshotIds: bill.sourceSnapshotIds
      }
    });
}

async function ensurePlaceholderBill(db: Db, bill: Bill) {
  await db
    .insert(schema.bills)
    .values({
      id: bill.id,
      slug: bill.slug,
      title: bill.title,
      identifiers: bill.identifiers,
      chamberOfOrigin: bill.chamberOfOrigin,
      status: bill.status,
      sourceSnapshotIds: bill.sourceSnapshotIds
    })
    .onConflictDoNothing({
      target: schema.bills.id
    });
}

async function upsertBillEvent(db: Db, event: BillEvent) {
  await db
    .insert(schema.billEvents)
    .values(event)
    .onConflictDoUpdate({
      target: schema.billEvents.id,
      set: {
        billId: event.billId,
        occurredOn: event.occurredOn,
        chamber: event.chamber,
        label: event.label,
        sourceUrl: event.sourceUrl
      }
    });
}

async function upsertBillSponsor(db: Db, sponsor: BillSponsor) {
  await db
    .insert(schema.billSponsors)
    .values(sponsor)
    .onConflictDoUpdate({
      target: schema.billSponsors.id,
      set: {
        billId: sponsor.billId,
        sponsorType: sponsor.sponsorType,
        memberId: sponsor.memberId,
        name: sponsor.name
      }
    });
}

async function upsertDocument(db: Db, document: DocumentSource) {
  await db
    .insert(schema.documents)
    .values(document)
    .onConflictDoUpdate({
      target: schema.documents.id,
      set: {
        billId: document.billId,
        label: document.label,
        url: document.url
      }
    });
}

async function upsertVote(db: Db, vote: Vote) {
  await db
    .insert(schema.votes)
    .values({
      id: vote.id,
      billId: vote.billId,
      chamber: vote.chamber,
      title: vote.title,
      heldOn: vote.heldOn,
      voteType: vote.voteType,
      present: vote.totals.present,
      forCount: vote.totals.for,
      against: vote.totals.against,
      abstention: vote.totals.abstention,
      presentNotVoting: vote.totals.presentNotVoting,
      absent: vote.totals.absent,
      sourceSnapshotId: vote.sourceSnapshotId
    })
    .onConflictDoUpdate({
      target: schema.votes.id,
      set: {
        billId: vote.billId,
        chamber: vote.chamber,
        title: vote.title,
        heldOn: vote.heldOn,
        voteType: vote.voteType,
        present: vote.totals.present,
        forCount: vote.totals.for,
        against: vote.totals.against,
        abstention: vote.totals.abstention,
        presentNotVoting: vote.totals.presentNotVoting,
        absent: vote.totals.absent,
        sourceSnapshotId: vote.sourceSnapshotId
      }
    });
}

async function upsertGroupVoteTotal(db: Db, total: GroupVoteTotal) {
  await db
    .insert(schema.groupVoteTotals)
    .values({
      id: total.id,
      voteId: total.voteId,
      groupId: total.groupId,
      forCount: total.for,
      against: total.against,
      abstention: total.abstention,
      presentNotVoting: total.presentNotVoting
    })
    .onConflictDoUpdate({
      target: schema.groupVoteTotals.id,
      set: {
        voteId: total.voteId,
        groupId: total.groupId,
        forCount: total.for,
        against: total.against,
        abstention: total.abstention,
        presentNotVoting: total.presentNotVoting
      }
    });
}

async function upsertIndividualVote(db: Db, vote: IndividualVote) {
  await db
    .insert(schema.individualVotes)
    .values(vote)
    .onConflictDoUpdate({
      target: schema.individualVotes.id,
      set: {
        voteId: vote.voteId,
        memberId: vote.memberId,
        groupId: vote.groupId,
        choice: vote.choice,
        voteMethod: vote.voteMethod
      }
    });
}

async function upsertIndividualVotes(db: Db, votes: IndividualVote[]) {
  if (votes.length === 0) return;
  await db
    .insert(schema.individualVotes)
    .values(votes)
    .onConflictDoUpdate({
      target: schema.individualVotes.id,
      set: {
        voteId: sql`excluded.vote_id`,
        memberId: sql`excluded.member_id`,
        groupId: sql`excluded.group_id`,
        choice: sql`excluded.choice`,
        voteMethod: sql`excluded.vote_method`
      }
    });
}

async function upsertDerivedMandateAndMembership(db: Db, vote: IndividualVote, parsed: ParsedSenateVote) {
  if (!vote.groupId) return;
  const startsOn = parsed.vote.heldOn;
  await db
    .insert(schema.memberMandates)
    .values({
      id: `mandate-${vote.memberId}-2024-2028-senate`,
      memberId: vote.memberId,
      legislatureId: defaultLegislature.id,
      chamber: "senate",
      startsOn: defaultLegislature.startsOn,
      status: "active"
    })
    .onConflictDoUpdate({
      target: schema.memberMandates.id,
      set: {
        memberId: vote.memberId,
        legislatureId: defaultLegislature.id,
        chamber: "senate",
        startsOn: defaultLegislature.startsOn,
        status: "active"
      }
    });

  const membershipId = `group-membership-${vote.memberId}-${vote.groupId}`;
  const existing = await db
    .select({ id: schema.memberGroupMemberships.id })
    .from(schema.memberGroupMemberships)
    .where(eq(schema.memberGroupMemberships.id, membershipId))
    .limit(1);
  if (existing.length > 0) return;

  await db.insert(schema.memberGroupMemberships).values({
    id: membershipId,
    memberId: vote.memberId,
    groupId: vote.groupId,
    startsOn,
    sourceSnapshotId: parsed.sourceSnapshot.id
  });
}

async function upsertDerivedDeputiesMandates(db: Db, memberIds: string[]) {
  const uniqueMemberIds = [...new Set(memberIds)];
  if (uniqueMemberIds.length === 0) return;
  await db
    .insert(schema.memberMandates)
    .values(
      uniqueMemberIds.map((memberId) => ({
        id: `mandate-${memberId}-2024-2028-deputies`,
        memberId,
        legislatureId: defaultLegislature.id,
        chamber: "deputies" as const,
        startsOn: defaultLegislature.startsOn,
        status: "active" as const
      }))
    )
    .onConflictDoUpdate({
      target: schema.memberMandates.id,
      set: {
        memberId: sql`excluded.member_id`,
        legislatureId: sql`excluded.legislature_id`,
        chamber: sql`excluded.chamber`,
        startsOn: sql`excluded.starts_on`,
        status: sql`excluded.status`
      }
    });
}
