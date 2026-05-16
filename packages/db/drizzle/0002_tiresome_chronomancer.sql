CREATE TYPE "public"."ingestion_run_status" AS ENUM('running', 'completed', 'partial', 'failed');--> statement-breakpoint
CREATE TYPE "public"."source_discovery_kind" AS ENUM('bill', 'vote');--> statement-breakpoint
CREATE TYPE "public"."source_discovery_status" AS ENUM('pending', 'imported', 'partial', 'failed', 'skipped');--> statement-breakpoint
CREATE TABLE "ingestion_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"status" "ingestion_run_status" NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "source_discoveries" (
	"id" text PRIMARY KEY NOT NULL,
	"chamber" "chamber" NOT NULL,
	"kind" "source_discovery_kind" NOT NULL,
	"source_url" text NOT NULL,
	"official_id" text,
	"title" text,
	"discovered_on" date,
	"first_seen_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"imported_at" timestamp with time zone,
	"status" "source_discovery_status" DEFAULT 'pending' NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"source_snapshot_id" text
);
--> statement-breakpoint
ALTER TABLE "source_discoveries" ADD CONSTRAINT "source_discoveries_source_snapshot_id_source_snapshots_id_fk" FOREIGN KEY ("source_snapshot_id") REFERENCES "public"."source_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "source_discoveries_source_url_idx" ON "source_discoveries" USING btree ("source_url");