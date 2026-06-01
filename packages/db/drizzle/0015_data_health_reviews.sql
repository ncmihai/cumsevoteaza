CREATE TYPE "public"."data_health_review_status" AS ENUM('open', 'reviewed', 'ignored', 'accepted', 'fixed');--> statement-breakpoint
CREATE TABLE "data_health_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"issue_key" text NOT NULL,
	"issue_type" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"status" "data_health_review_status" DEFAULT 'open' NOT NULL,
	"note" text,
	"reviewer" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "data_health_reviews_issue_key_idx" ON "data_health_reviews" USING btree ("issue_key");--> statement-breakpoint
CREATE INDEX "data_health_reviews_status_idx" ON "data_health_reviews" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "data_health_reviews_entity_idx" ON "data_health_reviews" USING btree ("entity_type","entity_id");
