CREATE TYPE "public"."alignment_basis" AS ENUM('official_investiture', 'official_coalition', 'parliamentary_group_declaration', 'computed_vote_support', 'manual_curation', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."composition_event_type" AS ENUM('legislature_start', 'legislature_end', 'government_designated', 'government_invested', 'government_ended', 'minister_appointed', 'minister_ended', 'reshuffle', 'no_confidence_motion', 'confidence_vote', 'coalition_change', 'group_change', 'member_mandate_start', 'member_mandate_end', 'committee_change', 'role_change', 'other');--> statement-breakpoint
CREATE TYPE "public"."governance_alignment" AS ENUM('government', 'governing_support', 'opposition', 'mixed', 'unaffiliated', 'unknown');--> statement-breakpoint
CREATE TABLE "composition_events" (
	"id" text PRIMARY KEY NOT NULL,
	"event_type" "composition_event_type" NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"occurred_on" date NOT NULL,
	"ends_on" date,
	"legislature_id" text,
	"government_id" text,
	"chamber" "chamber",
	"member_id" text,
	"person_id" text,
	"party_id" text,
	"group_id" text,
	"source_snapshot_id" text
);
--> statement-breakpoint
CREATE TABLE "government_group_alignments" (
	"id" text PRIMARY KEY NOT NULL,
	"government_id" text NOT NULL,
	"group_id" text NOT NULL,
	"alignment" "governance_alignment" DEFAULT 'unknown' NOT NULL,
	"basis" "alignment_basis" DEFAULT 'unknown' NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"source_snapshot_id" text
);
--> statement-breakpoint
CREATE TABLE "government_party_alignments" (
	"id" text PRIMARY KEY NOT NULL,
	"government_id" text NOT NULL,
	"party_id" text NOT NULL,
	"alignment" "governance_alignment" DEFAULT 'unknown' NOT NULL,
	"basis" "alignment_basis" DEFAULT 'unknown' NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"source_snapshot_id" text
);
--> statement-breakpoint
CREATE TABLE "government_roles" (
	"id" text PRIMARY KEY NOT NULL,
	"government_id" text NOT NULL,
	"person_id" text NOT NULL,
	"title" text NOT NULL,
	"ministry" text,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"source_snapshot_id" text
);
--> statement-breakpoint
CREATE TABLE "governments" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"legislature_id" text,
	"prime_minister_person_id" text,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"basis" "alignment_basis" DEFAULT 'official_investiture' NOT NULL,
	"investiture_vote_id" text,
	"source_snapshot_id" text
);
--> statement-breakpoint
CREATE TABLE "member_governance_alignments" (
	"id" text PRIMARY KEY NOT NULL,
	"member_id" text NOT NULL,
	"government_id" text,
	"alignment" "governance_alignment" DEFAULT 'unknown' NOT NULL,
	"basis" "alignment_basis" DEFAULT 'unknown' NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"source_snapshot_id" text
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"display_name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"birth_date" date,
	"source_ids" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "person_id" text;--> statement-breakpoint
ALTER TABLE "composition_events" ADD CONSTRAINT "composition_events_legislature_id_legislatures_id_fk" FOREIGN KEY ("legislature_id") REFERENCES "public"."legislatures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "composition_events" ADD CONSTRAINT "composition_events_government_id_governments_id_fk" FOREIGN KEY ("government_id") REFERENCES "public"."governments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "composition_events" ADD CONSTRAINT "composition_events_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "composition_events" ADD CONSTRAINT "composition_events_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "composition_events" ADD CONSTRAINT "composition_events_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "composition_events" ADD CONSTRAINT "composition_events_group_id_parliamentary_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."parliamentary_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "composition_events" ADD CONSTRAINT "composition_events_source_snapshot_id_source_snapshots_id_fk" FOREIGN KEY ("source_snapshot_id") REFERENCES "public"."source_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "government_group_alignments" ADD CONSTRAINT "government_group_alignments_government_id_governments_id_fk" FOREIGN KEY ("government_id") REFERENCES "public"."governments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "government_group_alignments" ADD CONSTRAINT "government_group_alignments_group_id_parliamentary_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."parliamentary_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "government_group_alignments" ADD CONSTRAINT "government_group_alignments_source_snapshot_id_source_snapshots_id_fk" FOREIGN KEY ("source_snapshot_id") REFERENCES "public"."source_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "government_party_alignments" ADD CONSTRAINT "government_party_alignments_government_id_governments_id_fk" FOREIGN KEY ("government_id") REFERENCES "public"."governments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "government_party_alignments" ADD CONSTRAINT "government_party_alignments_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "government_party_alignments" ADD CONSTRAINT "government_party_alignments_source_snapshot_id_source_snapshots_id_fk" FOREIGN KEY ("source_snapshot_id") REFERENCES "public"."source_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "government_roles" ADD CONSTRAINT "government_roles_government_id_governments_id_fk" FOREIGN KEY ("government_id") REFERENCES "public"."governments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "government_roles" ADD CONSTRAINT "government_roles_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "government_roles" ADD CONSTRAINT "government_roles_source_snapshot_id_source_snapshots_id_fk" FOREIGN KEY ("source_snapshot_id") REFERENCES "public"."source_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "governments" ADD CONSTRAINT "governments_legislature_id_legislatures_id_fk" FOREIGN KEY ("legislature_id") REFERENCES "public"."legislatures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "governments" ADD CONSTRAINT "governments_prime_minister_person_id_people_id_fk" FOREIGN KEY ("prime_minister_person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "governments" ADD CONSTRAINT "governments_source_snapshot_id_source_snapshots_id_fk" FOREIGN KEY ("source_snapshot_id") REFERENCES "public"."source_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_governance_alignments" ADD CONSTRAINT "member_governance_alignments_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_governance_alignments" ADD CONSTRAINT "member_governance_alignments_government_id_governments_id_fk" FOREIGN KEY ("government_id") REFERENCES "public"."governments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_governance_alignments" ADD CONSTRAINT "member_governance_alignments_source_snapshot_id_source_snapshots_id_fk" FOREIGN KEY ("source_snapshot_id") REFERENCES "public"."source_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "composition_events_date_idx" ON "composition_events" USING btree ("occurred_on","event_type");--> statement-breakpoint
CREATE INDEX "composition_events_government_idx" ON "composition_events" USING btree ("government_id");--> statement-breakpoint
CREATE INDEX "composition_events_legislature_idx" ON "composition_events" USING btree ("legislature_id");--> statement-breakpoint
CREATE INDEX "government_group_alignments_group_period_idx" ON "government_group_alignments" USING btree ("group_id","starts_on","ends_on");--> statement-breakpoint
CREATE INDEX "government_group_alignments_government_idx" ON "government_group_alignments" USING btree ("government_id");--> statement-breakpoint
CREATE INDEX "government_party_alignments_party_period_idx" ON "government_party_alignments" USING btree ("party_id","starts_on","ends_on");--> statement-breakpoint
CREATE INDEX "government_party_alignments_government_idx" ON "government_party_alignments" USING btree ("government_id");--> statement-breakpoint
CREATE INDEX "government_roles_government_idx" ON "government_roles" USING btree ("government_id");--> statement-breakpoint
CREATE INDEX "government_roles_person_period_idx" ON "government_roles" USING btree ("person_id","starts_on","ends_on");--> statement-breakpoint
CREATE UNIQUE INDEX "governments_slug_idx" ON "governments" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "governments_period_idx" ON "governments" USING btree ("starts_on","ends_on");--> statement-breakpoint
CREATE INDEX "governments_legislature_idx" ON "governments" USING btree ("legislature_id");--> statement-breakpoint
CREATE INDEX "member_governance_alignments_member_period_idx" ON "member_governance_alignments" USING btree ("member_id","starts_on","ends_on");--> statement-breakpoint
CREATE INDEX "member_governance_alignments_government_idx" ON "member_governance_alignments" USING btree ("government_id");--> statement-breakpoint
CREATE UNIQUE INDEX "people_slug_idx" ON "people" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "people_normalized_name_idx" ON "people" USING btree ("normalized_name");--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;