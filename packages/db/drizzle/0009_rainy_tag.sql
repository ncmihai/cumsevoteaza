CREATE TYPE "public"."stored_asset_entity_type" AS ENUM('member', 'person', 'party', 'formation', 'source_snapshot', 'pipeline_report');--> statement-breakpoint
CREATE TYPE "public"."stored_asset_status" AS ENUM('pending', 'stored', 'failed', 'missing', 'official_timeout');--> statement-breakpoint
CREATE TYPE "public"."stored_asset_type" AS ENUM('photo', 'cv', 'party_logo', 'html_snapshot', 'report');--> statement-breakpoint
CREATE TABLE "stored_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_type" "stored_asset_entity_type" NOT NULL,
	"entity_id" text NOT NULL,
	"asset_type" "stored_asset_type" NOT NULL,
	"legislature_id" text,
	"chamber" "chamber",
	"official_url" text,
	"blob_url" text,
	"content_hash" text,
	"mime_type" text,
	"byte_size" integer,
	"fetch_status" "stored_asset_status" DEFAULT 'pending' NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"source_snapshot_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stored_assets" ADD CONSTRAINT "stored_assets_legislature_id_legislatures_id_fk" FOREIGN KEY ("legislature_id") REFERENCES "public"."legislatures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stored_assets" ADD CONSTRAINT "stored_assets_source_snapshot_id_source_snapshots_id_fk" FOREIGN KEY ("source_snapshot_id") REFERENCES "public"."source_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stored_assets_entity_idx" ON "stored_assets" USING btree ("entity_type","entity_id","asset_type");--> statement-breakpoint
CREATE INDEX "stored_assets_official_url_idx" ON "stored_assets" USING btree ("official_url");--> statement-breakpoint
CREATE INDEX "stored_assets_content_hash_idx" ON "stored_assets" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "stored_assets_status_idx" ON "stored_assets" USING btree ("fetch_status","last_attempt_at");