CREATE TABLE "content_reactions" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"reaction" text NOT NULL,
	"visitor_hash" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engagement_events" (
	"id" text PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"query_hash" text,
	"query_text" text,
	"locale" varchar(8) DEFAULT 'ro' NOT NULL,
	"visitor_hash" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "content_reactions_unique_visitor_idx" ON "content_reactions" USING btree ("entity_type","entity_id","reaction","visitor_hash");--> statement-breakpoint
CREATE INDEX "content_reactions_aggregate_idx" ON "content_reactions" USING btree ("entity_type","entity_id","reaction","created_at");--> statement-breakpoint
CREATE INDEX "engagement_events_event_month_idx" ON "engagement_events" USING btree ("event_type","entity_type","occurred_at");--> statement-breakpoint
CREATE INDEX "engagement_events_entity_idx" ON "engagement_events" USING btree ("entity_type","entity_id","occurred_at");--> statement-breakpoint
CREATE INDEX "engagement_events_search_idx" ON "engagement_events" USING btree ("query_hash","occurred_at");--> statement-breakpoint
CREATE INDEX "bill_events_bill_date_idx" ON "bill_events" USING btree ("bill_id","occurred_on");--> statement-breakpoint
CREATE INDEX "bill_events_occurred_on_idx" ON "bill_events" USING btree ("occurred_on");--> statement-breakpoint
CREATE INDEX "bills_chamber_origin_idx" ON "bills" USING btree ("chamber_of_origin");--> statement-breakpoint
CREATE INDEX "bills_status_idx" ON "bills" USING btree ("status");--> statement-breakpoint
CREATE INDEX "votes_held_on_id_idx" ON "votes" USING btree ("held_on","id");--> statement-breakpoint
CREATE INDEX "votes_chamber_held_on_idx" ON "votes" USING btree ("chamber","held_on");--> statement-breakpoint
CREATE INDEX "votes_bill_id_idx" ON "votes" USING btree ("bill_id");--> statement-breakpoint
CREATE INDEX "votes_source_snapshot_idx" ON "votes" USING btree ("source_snapshot_id");