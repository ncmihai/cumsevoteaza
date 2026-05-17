CREATE TABLE "bill_vote_summaries" (
	"bill_id" text PRIMARY KEY NOT NULL,
	"submitted_on" date,
	"latest_event_on" date,
	"vote_count" integer DEFAULT 0 NOT NULL,
	"source_status" "source_status" DEFAULT 'partial' NOT NULL,
	"refreshed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_search_index" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"title" text NOT NULL,
	"subtitle" text,
	"search_text" text NOT NULL,
	"chamber" "chamber",
	"legislature_id" text,
	"source_date" date,
	"refreshed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_legislature_activity" (
	"id" text PRIMARY KEY NOT NULL,
	"member_id" text NOT NULL,
	"person_id" text,
	"legislature_id" text NOT NULL,
	"chamber" "chamber" NOT NULL,
	"votes_for" integer DEFAULT 0 NOT NULL,
	"votes_against" integer DEFAULT 0 NOT NULL,
	"abstentions" integer DEFAULT 0 NOT NULL,
	"present_not_voting" integer DEFAULT 0 NOT NULL,
	"absent" integer DEFAULT 0 NOT NULL,
	"unknown" integer DEFAULT 0 NOT NULL,
	"proposals" integer DEFAULT 0 NOT NULL,
	"committees" integer DEFAULT 0 NOT NULL,
	"roles" integer DEFAULT 0 NOT NULL,
	"first_activity_on" date,
	"last_activity_on" date,
	"refreshed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vote_coverage_summaries" (
	"vote_id" text PRIMARY KEY NOT NULL,
	"coverage_level" text DEFAULT 'source_only' NOT NULL,
	"nominal_votes" integer DEFAULT 0 NOT NULL,
	"group_totals" integer DEFAULT 0 NOT NULL,
	"source_status" "source_status" DEFAULT 'partial' NOT NULL,
	"refreshed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bill_vote_summaries" ADD CONSTRAINT "bill_vote_summaries_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_search_index" ADD CONSTRAINT "entity_search_index_legislature_id_legislatures_id_fk" FOREIGN KEY ("legislature_id") REFERENCES "public"."legislatures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_legislature_activity" ADD CONSTRAINT "member_legislature_activity_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_legislature_activity" ADD CONSTRAINT "member_legislature_activity_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_legislature_activity" ADD CONSTRAINT "member_legislature_activity_legislature_id_legislatures_id_fk" FOREIGN KEY ("legislature_id") REFERENCES "public"."legislatures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_coverage_summaries" ADD CONSTRAINT "vote_coverage_summaries_vote_id_votes_id_fk" FOREIGN KEY ("vote_id") REFERENCES "public"."votes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bill_vote_summaries_submitted_idx" ON "bill_vote_summaries" USING btree ("submitted_on","bill_id");--> statement-breakpoint
CREATE INDEX "bill_vote_summaries_latest_event_idx" ON "bill_vote_summaries" USING btree ("latest_event_on","bill_id");--> statement-breakpoint
CREATE INDEX "bill_vote_summaries_source_status_idx" ON "bill_vote_summaries" USING btree ("source_status");--> statement-breakpoint
CREATE UNIQUE INDEX "entity_search_index_entity_idx" ON "entity_search_index" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "entity_search_index_text_idx" ON "entity_search_index" USING btree ("search_text");--> statement-breakpoint
CREATE INDEX "entity_search_index_chamber_leg_idx" ON "entity_search_index" USING btree ("chamber","legislature_id");--> statement-breakpoint
CREATE INDEX "entity_search_index_source_date_idx" ON "entity_search_index" USING btree ("source_date");--> statement-breakpoint
CREATE UNIQUE INDEX "member_legislature_activity_member_leg_idx" ON "member_legislature_activity" USING btree ("member_id","legislature_id","chamber");--> statement-breakpoint
CREATE INDEX "member_legislature_activity_person_leg_idx" ON "member_legislature_activity" USING btree ("person_id","legislature_id");--> statement-breakpoint
CREATE INDEX "member_legislature_activity_legislature_idx" ON "member_legislature_activity" USING btree ("legislature_id","chamber");--> statement-breakpoint
CREATE INDEX "vote_coverage_summaries_coverage_idx" ON "vote_coverage_summaries" USING btree ("coverage_level","source_status");--> statement-breakpoint
CREATE INDEX "vote_coverage_summaries_source_status_idx" ON "vote_coverage_summaries" USING btree ("source_status");