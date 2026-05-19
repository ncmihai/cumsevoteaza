import {
  date,
  integer,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar
} from "drizzle-orm/pg-core";

export const chamberEnum = pgEnum("chamber", ["senate", "deputies"]);
export const voteChoiceEnum = pgEnum("vote_choice", [
  "for",
  "against",
  "abstention",
  "present_not_voting",
  "absent",
  "unknown"
]);
export const sourceStatusEnum = pgEnum("source_status", ["parsed", "partial", "failed"]);
export const ingestionRunStatusEnum = pgEnum("ingestion_run_status", ["running", "completed", "partial", "failed"]);
export const sourceDiscoveryStatusEnum = pgEnum("source_discovery_status", ["pending", "imported", "partial", "failed", "skipped"]);
export const sourceDiscoveryKindEnum = pgEnum("source_discovery_kind", ["bill", "vote"]);
export const governanceAlignmentEnum = pgEnum("governance_alignment", [
  "government",
  "governing_support",
  "opposition",
  "mixed",
  "unaffiliated",
  "unknown"
]);
export const alignmentBasisEnum = pgEnum("alignment_basis", [
  "official_investiture",
  "official_coalition",
  "parliamentary_group_declaration",
  "computed_vote_support",
  "manual_curation",
  "unknown"
]);
export const compositionEventTypeEnum = pgEnum("composition_event_type", [
  "legislature_start",
  "legislature_end",
  "government_designated",
  "government_invested",
  "government_ended",
  "minister_appointed",
  "minister_ended",
  "reshuffle",
  "no_confidence_motion",
  "confidence_vote",
  "coalition_change",
  "group_change",
  "member_mandate_start",
  "member_mandate_end",
  "committee_change",
  "role_change",
  "other"
]);

export const legislatures = pgTable("legislatures", {
  id: text("id").primaryKey(),
  label: varchar("label", { length: 32 }).notNull(),
  startsOn: date("starts_on").notNull(),
  endsOn: date("ends_on").notNull()
});

export const parties = pgTable("parties", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull(),
  shortName: text("short_name").notNull(),
  name: text("name").notNull(),
  color: varchar("color", { length: 16 }).notNull()
}, (table) => ({
  slugIdx: uniqueIndex("parties_slug_idx").on(table.slug)
}));

export const parliamentaryGroups = pgTable("parliamentary_groups", {
  id: text("id").primaryKey(),
  partyId: text("party_id").references(() => parties.id),
  chamber: chamberEnum("chamber").notNull(),
  shortName: text("short_name").notNull(),
  name: text("name").notNull(),
  color: varchar("color", { length: 16 }).notNull()
});

export const people = pgTable("people", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull(),
  displayName: text("display_name").notNull(),
  normalizedName: text("normalized_name").notNull(),
  birthDate: date("birth_date"),
  sourceIds: jsonb("source_ids").$type<Record<string, string>>().notNull().default({})
}, (table) => ({
  slugIdx: uniqueIndex("people_slug_idx").on(table.slug),
  normalizedNameIdx: index("people_normalized_name_idx").on(table.normalizedName)
}));

export const members = pgTable("members", {
  id: text("id").primaryKey(),
  personId: text("person_id").references(() => people.id),
  slug: text("slug").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  displayName: text("display_name").notNull(),
  sourceIds: jsonb("source_ids").$type<Record<string, string>>().notNull().default({})
}, (table) => ({
  slugIdx: uniqueIndex("members_slug_idx").on(table.slug)
}));

export const sourceSnapshots = pgTable("source_snapshots", {
  id: text("id").primaryKey(),
  sourceUrl: text("source_url").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
  contentHash: text("content_hash").notNull(),
  parser: text("parser").notNull(),
  parserVersion: text("parser_version").notNull(),
  status: sourceStatusEnum("status").notNull(),
  notes: text("notes")
}, (table) => ({
  hashIdx: uniqueIndex("source_snapshots_content_hash_idx").on(table.contentHash)
}));

export const ingestionRuns = pgTable("ingestion_runs", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  status: ingestionRunStatusEnum("status").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  summary: jsonb("summary").$type<Record<string, unknown>>().notNull().default({}),
  error: text("error")
});

export const sourceDiscoveries = pgTable("source_discoveries", {
  id: text("id").primaryKey(),
  chamber: chamberEnum("chamber").notNull(),
  kind: sourceDiscoveryKindEnum("kind").notNull(),
  sourceUrl: text("source_url").notNull(),
  officialId: text("official_id"),
  title: text("title"),
  discoveredOn: date("discovered_on"),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
  lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
  importedAt: timestamp("imported_at", { withTimezone: true }),
  status: sourceDiscoveryStatusEnum("status").notNull().default("pending"),
  failureCount: integer("failure_count").notNull().default(0),
  lastError: text("last_error"),
  sourceSnapshotId: text("source_snapshot_id").references(() => sourceSnapshots.id)
}, (table) => ({
  sourceUrlIdx: uniqueIndex("source_discoveries_source_url_idx").on(table.sourceUrl)
}));

export const governments = pgTable("governments", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  legislatureId: text("legislature_id").references(() => legislatures.id),
  primeMinisterPersonId: text("prime_minister_person_id").references(() => people.id),
  startsOn: date("starts_on").notNull(),
  endsOn: date("ends_on"),
  basis: alignmentBasisEnum("basis").notNull().default("official_investiture"),
  investitureVoteId: text("investiture_vote_id"),
  sourceSnapshotId: text("source_snapshot_id").references(() => sourceSnapshots.id)
}, (table) => ({
  slugIdx: uniqueIndex("governments_slug_idx").on(table.slug),
  periodIdx: index("governments_period_idx").on(table.startsOn, table.endsOn),
  legislatureIdx: index("governments_legislature_idx").on(table.legislatureId)
}));

export const governmentRoles = pgTable("government_roles", {
  id: text("id").primaryKey(),
  governmentId: text("government_id").notNull().references(() => governments.id),
  personId: text("person_id").notNull().references(() => people.id),
  title: text("title").notNull(),
  ministry: text("ministry"),
  startsOn: date("starts_on").notNull(),
  endsOn: date("ends_on"),
  sourceSnapshotId: text("source_snapshot_id").references(() => sourceSnapshots.id)
}, (table) => ({
  governmentIdx: index("government_roles_government_idx").on(table.governmentId),
  personPeriodIdx: index("government_roles_person_period_idx").on(table.personId, table.startsOn, table.endsOn)
}));

export const governmentPartyAlignments = pgTable("government_party_alignments", {
  id: text("id").primaryKey(),
  governmentId: text("government_id").notNull().references(() => governments.id),
  partyId: text("party_id").notNull().references(() => parties.id),
  alignment: governanceAlignmentEnum("alignment").notNull().default("unknown"),
  basis: alignmentBasisEnum("basis").notNull().default("unknown"),
  startsOn: date("starts_on").notNull(),
  endsOn: date("ends_on"),
  sourceSnapshotId: text("source_snapshot_id").references(() => sourceSnapshots.id)
}, (table) => ({
  partyPeriodIdx: index("government_party_alignments_party_period_idx").on(table.partyId, table.startsOn, table.endsOn),
  governmentIdx: index("government_party_alignments_government_idx").on(table.governmentId)
}));

export const governmentGroupAlignments = pgTable("government_group_alignments", {
  id: text("id").primaryKey(),
  governmentId: text("government_id").notNull().references(() => governments.id),
  groupId: text("group_id").notNull().references(() => parliamentaryGroups.id),
  alignment: governanceAlignmentEnum("alignment").notNull().default("unknown"),
  basis: alignmentBasisEnum("basis").notNull().default("unknown"),
  startsOn: date("starts_on").notNull(),
  endsOn: date("ends_on"),
  sourceSnapshotId: text("source_snapshot_id").references(() => sourceSnapshots.id)
}, (table) => ({
  groupPeriodIdx: index("government_group_alignments_group_period_idx").on(table.groupId, table.startsOn, table.endsOn),
  governmentIdx: index("government_group_alignments_government_idx").on(table.governmentId)
}));

export const memberMandates = pgTable("member_mandates", {
  id: text("id").primaryKey(),
  memberId: text("member_id").notNull().references(() => members.id),
  legislatureId: text("legislature_id").notNull().references(() => legislatures.id),
  chamber: chamberEnum("chamber").notNull(),
  startsOn: date("starts_on").notNull(),
  endsOn: date("ends_on"),
  constituency: text("constituency"),
  status: text("status").notNull().default("unknown"),
  sourceSnapshotId: text("source_snapshot_id").references(() => sourceSnapshots.id)
}, (table) => ({
  memberLegislatureIdx: index("member_mandates_member_legislature_idx").on(table.memberId, table.legislatureId, table.chamber),
  legislatureChamberIdx: index("member_mandates_legislature_chamber_idx").on(table.legislatureId, table.chamber)
}));

export const memberMandateRelations = pgTable("member_mandate_relations", {
  id: text("id").primaryKey(),
  mandateId: text("mandate_id").notNull().references(() => memberMandates.id),
  relation: text("relation").notNull(),
  relatedMemberId: text("related_member_id").references(() => members.id),
  relatedName: text("related_name").notNull(),
  relatedOfficialUrl: text("related_official_url"),
  sourceSnapshotId: text("source_snapshot_id").references(() => sourceSnapshots.id)
}, (table) => ({
  mandateIdx: index("member_mandate_relations_mandate_idx").on(table.mandateId),
  relatedMemberIdx: index("member_mandate_relations_related_member_idx").on(table.relatedMemberId)
}));

export const memberGroupMemberships = pgTable("member_group_memberships", {
  id: text("id").primaryKey(),
  memberId: text("member_id").notNull().references(() => members.id),
  groupId: text("group_id").notNull().references(() => parliamentaryGroups.id),
  startsOn: date("starts_on").notNull(),
  endsOn: date("ends_on"),
  logoUrl: text("logo_url"),
  sourceSnapshotId: text("source_snapshot_id").references(() => sourceSnapshots.id)
}, (table) => ({
  memberPeriodIdx: index("member_group_memberships_member_period_idx").on(table.memberId, table.startsOn, table.endsOn),
  groupPeriodIdx: index("member_group_memberships_group_period_idx").on(table.groupId, table.startsOn, table.endsOn)
}));

export const memberPartyAffiliations = pgTable("member_party_affiliations", {
  id: text("id").primaryKey(),
  memberId: text("member_id").notNull().references(() => members.id),
  partyId: text("party_id").notNull().references(() => parties.id),
  startsOn: date("starts_on").notNull(),
  endsOn: date("ends_on"),
  logoUrl: text("logo_url"),
  sourceSnapshotId: text("source_snapshot_id").references(() => sourceSnapshots.id)
}, (table) => ({
  memberPeriodIdx: index("member_party_affiliations_member_period_idx").on(table.memberId, table.startsOn, table.endsOn),
  partyPeriodIdx: index("member_party_affiliations_party_period_idx").on(table.partyId, table.startsOn, table.endsOn)
}));

export const memberGovernanceAlignments = pgTable("member_governance_alignments", {
  id: text("id").primaryKey(),
  memberId: text("member_id").notNull().references(() => members.id),
  governmentId: text("government_id").references(() => governments.id),
  alignment: governanceAlignmentEnum("alignment").notNull().default("unknown"),
  basis: alignmentBasisEnum("basis").notNull().default("unknown"),
  startsOn: date("starts_on").notNull(),
  endsOn: date("ends_on"),
  sourceSnapshotId: text("source_snapshot_id").references(() => sourceSnapshots.id)
}, (table) => ({
  memberPeriodIdx: index("member_governance_alignments_member_period_idx").on(table.memberId, table.startsOn, table.endsOn),
  governmentIdx: index("member_governance_alignments_government_idx").on(table.governmentId)
}));

export const compositionEvents = pgTable("composition_events", {
  id: text("id").primaryKey(),
  eventType: compositionEventTypeEnum("event_type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  occurredOn: date("occurred_on").notNull(),
  endsOn: date("ends_on"),
  legislatureId: text("legislature_id").references(() => legislatures.id),
  governmentId: text("government_id").references(() => governments.id),
  chamber: chamberEnum("chamber"),
  memberId: text("member_id").references(() => members.id),
  personId: text("person_id").references(() => people.id),
  partyId: text("party_id").references(() => parties.id),
  groupId: text("group_id").references(() => parliamentaryGroups.id),
  sourceSnapshotId: text("source_snapshot_id").references(() => sourceSnapshots.id)
}, (table) => ({
  dateIdx: index("composition_events_date_idx").on(table.occurredOn, table.eventType),
  governmentIdx: index("composition_events_government_idx").on(table.governmentId),
  legislatureIdx: index("composition_events_legislature_idx").on(table.legislatureId)
}));

export const memberCommitteeMemberships = pgTable("member_committee_memberships", {
  id: text("id").primaryKey(),
  memberId: text("member_id").notNull().references(() => members.id),
  committeeName: text("committee_name").notNull(),
  chamber: chamberEnum("chamber").notNull(),
  role: text("role"),
  startsOn: date("starts_on").notNull(),
  endsOn: date("ends_on"),
  sourceSnapshotId: text("source_snapshot_id").references(() => sourceSnapshots.id)
});

export const memberRoles = pgTable("member_roles", {
  id: text("id").primaryKey(),
  memberId: text("member_id").notNull().references(() => members.id),
  title: text("title").notNull(),
  chamber: chamberEnum("chamber").notNull(),
  startsOn: date("starts_on").notNull(),
  endsOn: date("ends_on"),
  sourceSnapshotId: text("source_snapshot_id").references(() => sourceSnapshots.id)
});

export const bills = pgTable("bills", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  identifiers: jsonb("identifiers").$type<Record<string, string>>().notNull().default({}),
  chamberOfOrigin: text("chamber_of_origin").notNull().default("unknown"),
  status: text("status").notNull().default("unknown"),
  sourceSnapshotIds: jsonb("source_snapshot_ids").$type<string[]>().notNull().default([])
}, (table) => ({
  slugIdx: uniqueIndex("bills_slug_idx").on(table.slug),
  chamberOriginIdx: index("bills_chamber_origin_idx").on(table.chamberOfOrigin),
  statusIdx: index("bills_status_idx").on(table.status)
}));

export const billVoteSummaries = pgTable("bill_vote_summaries", {
  billId: text("bill_id").primaryKey().references(() => bills.id),
  submittedOn: date("submitted_on"),
  latestEventOn: date("latest_event_on"),
  voteCount: integer("vote_count").notNull().default(0),
  sourceStatus: sourceStatusEnum("source_status").notNull().default("partial"),
  refreshedAt: timestamp("refreshed_at", { withTimezone: true }).notNull()
}, (table) => ({
  submittedIdx: index("bill_vote_summaries_submitted_idx").on(table.submittedOn, table.billId),
  latestEventIdx: index("bill_vote_summaries_latest_event_idx").on(table.latestEventOn, table.billId),
  sourceStatusIdx: index("bill_vote_summaries_source_status_idx").on(table.sourceStatus)
}));

export const billEvents = pgTable("bill_events", {
  id: text("id").primaryKey(),
  billId: text("bill_id").notNull().references(() => bills.id),
  occurredOn: date("occurred_on").notNull(),
  chamber: text("chamber").notNull().default("unknown"),
  label: text("label").notNull(),
  sourceUrl: text("source_url")
}, (table) => ({
  billDateIdx: index("bill_events_bill_date_idx").on(table.billId, table.occurredOn),
  occurredOnIdx: index("bill_events_occurred_on_idx").on(table.occurredOn)
}));

export const billSponsors = pgTable("bill_sponsors", {
  id: text("id").primaryKey(),
  billId: text("bill_id").notNull().references(() => bills.id),
  sponsorType: text("sponsor_type").notNull().default("unknown"),
  memberId: text("member_id").references(() => members.id),
  name: text("name").notNull()
}, (table) => ({
  billIdx: index("bill_sponsors_bill_idx").on(table.billId),
  memberIdx: index("bill_sponsors_member_idx").on(table.memberId)
}));

export const documents = pgTable("documents", {
  id: text("id").primaryKey(),
  billId: text("bill_id").notNull().references(() => bills.id),
  label: text("label").notNull(),
  url: text("url").notNull()
});

export const votes = pgTable("votes", {
  id: text("id").primaryKey(),
  billId: text("bill_id").references(() => bills.id),
  chamber: chamberEnum("chamber").notNull(),
  title: text("title").notNull(),
  heldOn: date("held_on").notNull(),
  voteType: text("vote_type").notNull(),
  present: integer("present").notNull().default(0),
  forCount: integer("for_count").notNull().default(0),
  against: integer("against").notNull().default(0),
  abstention: integer("abstention").notNull().default(0),
  presentNotVoting: integer("present_not_voting").notNull().default(0),
  absent: integer("absent"),
  sourceSnapshotId: text("source_snapshot_id").notNull().references(() => sourceSnapshots.id)
}, (table) => ({
  heldOnIdx: index("votes_held_on_id_idx").on(table.heldOn, table.id),
  chamberHeldOnIdx: index("votes_chamber_held_on_idx").on(table.chamber, table.heldOn),
  billIdx: index("votes_bill_id_idx").on(table.billId),
  sourceSnapshotIdx: index("votes_source_snapshot_idx").on(table.sourceSnapshotId)
}));

export const voteCoverageSummaries = pgTable("vote_coverage_summaries", {
  voteId: text("vote_id").primaryKey().references(() => votes.id),
  coverageLevel: text("coverage_level").notNull().default("source_only"),
  nominalVotes: integer("nominal_votes").notNull().default(0),
  groupTotals: integer("group_totals").notNull().default(0),
  sourceStatus: sourceStatusEnum("source_status").notNull().default("partial"),
  refreshedAt: timestamp("refreshed_at", { withTimezone: true }).notNull()
}, (table) => ({
  coverageIdx: index("vote_coverage_summaries_coverage_idx").on(table.coverageLevel, table.sourceStatus),
  sourceStatusIdx: index("vote_coverage_summaries_source_status_idx").on(table.sourceStatus)
}));

export const groupVoteTotals = pgTable("group_vote_totals", {
  id: text("id").primaryKey(),
  voteId: text("vote_id").notNull().references(() => votes.id),
  groupId: text("group_id").notNull().references(() => parliamentaryGroups.id),
  forCount: integer("for_count").notNull().default(0),
  against: integer("against").notNull().default(0),
  abstention: integer("abstention").notNull().default(0),
  presentNotVoting: integer("present_not_voting").notNull().default(0)
}, (table) => ({
  voteIdx: index("group_vote_totals_vote_idx").on(table.voteId),
  groupIdx: index("group_vote_totals_group_idx").on(table.groupId)
}));

export const individualVotes = pgTable("individual_votes", {
  id: text("id").primaryKey(),
  voteId: text("vote_id").notNull().references(() => votes.id),
  memberId: text("member_id").notNull().references(() => members.id),
  groupId: text("group_id").references(() => parliamentaryGroups.id),
  choice: voteChoiceEnum("choice").notNull(),
  voteMethod: text("vote_method")
}, (table) => ({
  voteIdx: index("individual_votes_vote_idx").on(table.voteId),
  memberIdx: index("individual_votes_member_idx").on(table.memberId),
  groupIdx: index("individual_votes_group_idx").on(table.groupId)
}));

export const memberLegislatureActivity = pgTable("member_legislature_activity", {
  id: text("id").primaryKey(),
  memberId: text("member_id").notNull().references(() => members.id),
  personId: text("person_id").references(() => people.id),
  legislatureId: text("legislature_id").notNull().references(() => legislatures.id),
  chamber: chamberEnum("chamber").notNull(),
  votesFor: integer("votes_for").notNull().default(0),
  votesAgainst: integer("votes_against").notNull().default(0),
  abstentions: integer("abstentions").notNull().default(0),
  presentNotVoting: integer("present_not_voting").notNull().default(0),
  absent: integer("absent").notNull().default(0),
  unknown: integer("unknown").notNull().default(0),
  proposals: integer("proposals").notNull().default(0),
  committees: integer("committees").notNull().default(0),
  roles: integer("roles").notNull().default(0),
  firstActivityOn: date("first_activity_on"),
  lastActivityOn: date("last_activity_on"),
  refreshedAt: timestamp("refreshed_at", { withTimezone: true }).notNull()
}, (table) => ({
  memberLegislatureIdx: uniqueIndex("member_legislature_activity_member_leg_idx").on(table.memberId, table.legislatureId, table.chamber),
  personLegislatureIdx: index("member_legislature_activity_person_leg_idx").on(table.personId, table.legislatureId),
  legislatureIdx: index("member_legislature_activity_legislature_idx").on(table.legislatureId, table.chamber)
}));

export const entitySearchIndex = pgTable("entity_search_index", {
  id: text("id").primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  searchText: text("search_text").notNull(),
  chamber: chamberEnum("chamber"),
  legislatureId: text("legislature_id").references(() => legislatures.id),
  sourceDate: date("source_date"),
  refreshedAt: timestamp("refreshed_at", { withTimezone: true }).notNull()
}, (table) => ({
  entityIdx: uniqueIndex("entity_search_index_entity_idx").on(table.entityType, table.entityId),
  textIdx: index("entity_search_index_text_idx").on(table.searchText),
  chamberLegislatureIdx: index("entity_search_index_chamber_leg_idx").on(table.chamber, table.legislatureId),
  sourceDateIdx: index("entity_search_index_source_date_idx").on(table.sourceDate)
}));

export const engagementEvents = pgTable("engagement_events", {
  id: text("id").primaryKey(),
  eventType: text("event_type").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  queryHash: text("query_hash"),
  queryText: text("query_text"),
  locale: varchar("locale", { length: 8 }).notNull().default("ro"),
  visitorHash: text("visitor_hash").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull()
}, (table) => ({
  eventMonthIdx: index("engagement_events_event_month_idx").on(table.eventType, table.entityType, table.occurredAt),
  entityIdx: index("engagement_events_entity_idx").on(table.entityType, table.entityId, table.occurredAt),
  searchIdx: index("engagement_events_search_idx").on(table.queryHash, table.occurredAt)
}));

export const contentReactions = pgTable("content_reactions", {
  id: text("id").primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  reaction: text("reaction").notNull(),
  visitorHash: text("visitor_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull()
}, (table) => ({
  uniqueVisitorReactionIdx: uniqueIndex("content_reactions_unique_visitor_idx").on(
    table.entityType,
    table.entityId,
    table.reaction,
    table.visitorHash
  ),
  aggregateIdx: index("content_reactions_aggregate_idx").on(table.entityType, table.entityId, table.reaction, table.createdAt)
}));
