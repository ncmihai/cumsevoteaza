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

export const members = pgTable("members", {
  id: text("id").primaryKey(),
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
});

export const memberGroupMemberships = pgTable("member_group_memberships", {
  id: text("id").primaryKey(),
  memberId: text("member_id").notNull().references(() => members.id),
  groupId: text("group_id").notNull().references(() => parliamentaryGroups.id),
  startsOn: date("starts_on").notNull(),
  endsOn: date("ends_on"),
  sourceSnapshotId: text("source_snapshot_id").references(() => sourceSnapshots.id)
});

export const memberPartyAffiliations = pgTable("member_party_affiliations", {
  id: text("id").primaryKey(),
  memberId: text("member_id").notNull().references(() => members.id),
  partyId: text("party_id").notNull().references(() => parties.id),
  startsOn: date("starts_on").notNull(),
  endsOn: date("ends_on"),
  sourceSnapshotId: text("source_snapshot_id").references(() => sourceSnapshots.id)
});

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
});

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

export const groupVoteTotals = pgTable("group_vote_totals", {
  id: text("id").primaryKey(),
  voteId: text("vote_id").notNull().references(() => votes.id),
  groupId: text("group_id").notNull().references(() => parliamentaryGroups.id),
  forCount: integer("for_count").notNull().default(0),
  against: integer("against").notNull().default(0),
  abstention: integer("abstention").notNull().default(0),
  presentNotVoting: integer("present_not_voting").notNull().default(0)
});

export const individualVotes = pgTable("individual_votes", {
  id: text("id").primaryKey(),
  voteId: text("vote_id").notNull().references(() => votes.id),
  memberId: text("member_id").notNull().references(() => members.id),
  groupId: text("group_id").references(() => parliamentaryGroups.id),
  choice: voteChoiceEnum("choice").notNull(),
  voteMethod: text("vote_method")
});

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
