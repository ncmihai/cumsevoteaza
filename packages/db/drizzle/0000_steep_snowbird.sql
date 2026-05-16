CREATE TYPE "public"."chamber" AS ENUM('senate', 'deputies');--> statement-breakpoint
CREATE TYPE "public"."source_status" AS ENUM('parsed', 'partial', 'failed');--> statement-breakpoint
CREATE TYPE "public"."vote_choice" AS ENUM('for', 'against', 'abstention', 'present_not_voting', 'absent', 'unknown');--> statement-breakpoint
CREATE TABLE "bill_events" (
	"id" text PRIMARY KEY NOT NULL,
	"bill_id" text NOT NULL,
	"occurred_on" date NOT NULL,
	"chamber" text DEFAULT 'unknown' NOT NULL,
	"label" text NOT NULL,
	"source_url" text
);
--> statement-breakpoint
CREATE TABLE "bill_sponsors" (
	"id" text PRIMARY KEY NOT NULL,
	"bill_id" text NOT NULL,
	"sponsor_type" text DEFAULT 'unknown' NOT NULL,
	"member_id" text,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bills" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"identifiers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"chamber_of_origin" text DEFAULT 'unknown' NOT NULL,
	"status" text DEFAULT 'unknown' NOT NULL,
	"source_snapshot_ids" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"bill_id" text NOT NULL,
	"label" text NOT NULL,
	"url" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_vote_totals" (
	"id" text PRIMARY KEY NOT NULL,
	"vote_id" text NOT NULL,
	"group_id" text NOT NULL,
	"for_count" integer DEFAULT 0 NOT NULL,
	"against" integer DEFAULT 0 NOT NULL,
	"abstention" integer DEFAULT 0 NOT NULL,
	"present_not_voting" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "individual_votes" (
	"id" text PRIMARY KEY NOT NULL,
	"vote_id" text NOT NULL,
	"member_id" text NOT NULL,
	"group_id" text,
	"choice" "vote_choice" NOT NULL,
	"vote_method" text
);
--> statement-breakpoint
CREATE TABLE "legislatures" (
	"id" text PRIMARY KEY NOT NULL,
	"label" varchar(32) NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_committee_memberships" (
	"id" text PRIMARY KEY NOT NULL,
	"member_id" text NOT NULL,
	"committee_name" text NOT NULL,
	"chamber" "chamber" NOT NULL,
	"role" text,
	"starts_on" date NOT NULL,
	"ends_on" date
);
--> statement-breakpoint
CREATE TABLE "member_group_memberships" (
	"id" text PRIMARY KEY NOT NULL,
	"member_id" text NOT NULL,
	"group_id" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"source_snapshot_id" text
);
--> statement-breakpoint
CREATE TABLE "member_mandates" (
	"id" text PRIMARY KEY NOT NULL,
	"member_id" text NOT NULL,
	"legislature_id" text NOT NULL,
	"chamber" "chamber" NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"constituency" text,
	"status" text DEFAULT 'unknown' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_party_affiliations" (
	"id" text PRIMARY KEY NOT NULL,
	"member_id" text NOT NULL,
	"party_id" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"source_snapshot_id" text
);
--> statement-breakpoint
CREATE TABLE "member_roles" (
	"id" text PRIMARY KEY NOT NULL,
	"member_id" text NOT NULL,
	"title" text NOT NULL,
	"chamber" "chamber" NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"display_name" text NOT NULL,
	"source_ids" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parliamentary_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"party_id" text,
	"chamber" "chamber" NOT NULL,
	"short_name" text NOT NULL,
	"name" text NOT NULL,
	"color" varchar(16) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parties" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"short_name" text NOT NULL,
	"name" text NOT NULL,
	"color" varchar(16) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"source_url" text NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"content_hash" text NOT NULL,
	"parser" text NOT NULL,
	"parser_version" text NOT NULL,
	"status" "source_status" NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"id" text PRIMARY KEY NOT NULL,
	"bill_id" text,
	"chamber" "chamber" NOT NULL,
	"title" text NOT NULL,
	"held_on" date NOT NULL,
	"vote_type" text NOT NULL,
	"present" integer DEFAULT 0 NOT NULL,
	"for_count" integer DEFAULT 0 NOT NULL,
	"against" integer DEFAULT 0 NOT NULL,
	"abstention" integer DEFAULT 0 NOT NULL,
	"present_not_voting" integer DEFAULT 0 NOT NULL,
	"absent" integer,
	"source_snapshot_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bill_events" ADD CONSTRAINT "bill_events_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_sponsors" ADD CONSTRAINT "bill_sponsors_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_sponsors" ADD CONSTRAINT "bill_sponsors_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_vote_totals" ADD CONSTRAINT "group_vote_totals_vote_id_votes_id_fk" FOREIGN KEY ("vote_id") REFERENCES "public"."votes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_vote_totals" ADD CONSTRAINT "group_vote_totals_group_id_parliamentary_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."parliamentary_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "individual_votes" ADD CONSTRAINT "individual_votes_vote_id_votes_id_fk" FOREIGN KEY ("vote_id") REFERENCES "public"."votes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "individual_votes" ADD CONSTRAINT "individual_votes_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "individual_votes" ADD CONSTRAINT "individual_votes_group_id_parliamentary_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."parliamentary_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_committee_memberships" ADD CONSTRAINT "member_committee_memberships_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_group_memberships" ADD CONSTRAINT "member_group_memberships_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_group_memberships" ADD CONSTRAINT "member_group_memberships_group_id_parliamentary_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."parliamentary_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_group_memberships" ADD CONSTRAINT "member_group_memberships_source_snapshot_id_source_snapshots_id_fk" FOREIGN KEY ("source_snapshot_id") REFERENCES "public"."source_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_mandates" ADD CONSTRAINT "member_mandates_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_mandates" ADD CONSTRAINT "member_mandates_legislature_id_legislatures_id_fk" FOREIGN KEY ("legislature_id") REFERENCES "public"."legislatures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_party_affiliations" ADD CONSTRAINT "member_party_affiliations_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_party_affiliations" ADD CONSTRAINT "member_party_affiliations_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_party_affiliations" ADD CONSTRAINT "member_party_affiliations_source_snapshot_id_source_snapshots_id_fk" FOREIGN KEY ("source_snapshot_id") REFERENCES "public"."source_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_roles" ADD CONSTRAINT "member_roles_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parliamentary_groups" ADD CONSTRAINT "parliamentary_groups_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_source_snapshot_id_source_snapshots_id_fk" FOREIGN KEY ("source_snapshot_id") REFERENCES "public"."source_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bills_slug_idx" ON "bills" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "members_slug_idx" ON "members" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "parties_slug_idx" ON "parties" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "source_snapshots_content_hash_idx" ON "source_snapshots" USING btree ("content_hash");