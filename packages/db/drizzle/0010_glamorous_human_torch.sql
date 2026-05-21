CREATE TYPE "public"."political_formation_event_entity_role" AS ENUM('absorbed', 'absorber', 'alliance_member', 'renamed_from', 'renamed_to', 'split_from', 'split_to', 'subject');--> statement-breakpoint
CREATE TYPE "public"."political_formation_event_entity_type" AS ENUM('party', 'formation');--> statement-breakpoint
CREATE TYPE "public"."political_formation_event_source_kind" AS ENUM('official', 'wikipedia', 'curated');--> statement-breakpoint
CREATE TYPE "public"."political_formation_event_type" AS ENUM('alliance_formed', 'alliance_dissolved', 'party_merged', 'party_split', 'party_renamed', 'party_absorbed', 'other');--> statement-breakpoint
CREATE TABLE "political_formation_event_entities" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"entity_type" "political_formation_event_entity_type" NOT NULL,
	"entity_id" text NOT NULL,
	"role" "political_formation_event_entity_role" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "political_formation_events" (
	"id" text PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"event_type" "political_formation_event_type" NOT NULL,
	"title_ro" text NOT NULL,
	"title_en" text NOT NULL,
	"description_ro" text NOT NULL,
	"description_en" text NOT NULL,
	"source_url" text,
	"source_kind" "political_formation_event_source_kind" DEFAULT 'curated' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "political_formation_event_entities" ADD CONSTRAINT "political_formation_event_entities_event_id_political_formation_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."political_formation_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "political_formation_event_entities_event_idx" ON "political_formation_event_entities" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "political_formation_event_entities_entity_idx" ON "political_formation_event_entities" USING btree ("entity_type","entity_id","role");--> statement-breakpoint
CREATE UNIQUE INDEX "political_formation_event_entities_unique_idx" ON "political_formation_event_entities" USING btree ("event_id","entity_type","entity_id","role");--> statement-breakpoint
CREATE INDEX "political_formation_events_date_idx" ON "political_formation_events" USING btree ("date","event_type");--> statement-breakpoint
CREATE INDEX "political_formation_events_source_kind_idx" ON "political_formation_events" USING btree ("source_kind");