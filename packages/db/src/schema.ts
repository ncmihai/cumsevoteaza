import {
  date,
  integer,
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
  slugIdx: uniqueIndex("bills_slug_idx").on(table.slug)
}));

export const billEvents = pgTable("bill_events", {
  id: text("id").primaryKey(),
  billId: text("bill_id").notNull().references(() => bills.id),
  occurredOn: date("occurred_on").notNull(),
  chamber: text("chamber").notNull().default("unknown"),
  label: text("label").notNull(),
  sourceUrl: text("source_url")
});

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
});

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
