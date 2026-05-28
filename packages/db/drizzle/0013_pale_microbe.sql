CREATE TYPE "public"."bill_procedure_step_type" AS ENUM('registered', 'sent_to_senate', 'adopted_by_senate', 'sent_to_deputies', 'sent_to_committee', 'committee_opinion_requested', 'committee_opinion_received', 'committee_report_received', 'plenary_debate', 'final_vote', 'promulgation', 'constitutional_review', 'other');--> statement-breakpoint
CREATE TYPE "public"."document_kind" AS ENUM('proposal', 'senate_adopted_form', 'committee_report', 'committee_opinion', 'adopted_form', 'promulgation_form', 'other');--> statement-breakpoint
CREATE TYPE "public"."document_text_status" AS ENUM('pending', 'stored', 'missing', 'failed', 'unsupported');--> statement-breakpoint
ALTER TYPE "public"."stored_asset_entity_type" ADD VALUE 'bill_document' BEFORE 'source_snapshot';--> statement-breakpoint
ALTER TYPE "public"."stored_asset_type" ADD VALUE 'bill_text' BEFORE 'html_snapshot';--> statement-breakpoint
CREATE TABLE "bill_document_text_chunks" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"bill_id" text NOT NULL,
	"chunk_index" integer NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bill_procedure_steps" (
	"id" text PRIMARY KEY NOT NULL,
	"bill_id" text NOT NULL,
	"occurred_on" date NOT NULL,
	"chamber" text DEFAULT 'unknown' NOT NULL,
	"step_type" "bill_procedure_step_type" DEFAULT 'other' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"committee_name" text,
	"document_id" text,
	"source_url" text,
	"display_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "document_kind" "document_kind" DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "source_chamber" "chamber";--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "official_url_hash" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "text_asset_id" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "text_status" "document_text_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "text_preview" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "last_text_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bill_document_text_chunks" ADD CONSTRAINT "bill_document_text_chunks_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_document_text_chunks" ADD CONSTRAINT "bill_document_text_chunks_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_procedure_steps" ADD CONSTRAINT "bill_procedure_steps_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_procedure_steps" ADD CONSTRAINT "bill_procedure_steps_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bill_document_text_chunks_document_chunk_idx" ON "bill_document_text_chunks" USING btree ("document_id","chunk_index");--> statement-breakpoint
CREATE INDEX "bill_document_text_chunks_bill_idx" ON "bill_document_text_chunks" USING btree ("bill_id");--> statement-breakpoint
CREATE INDEX "bill_procedure_steps_bill_date_idx" ON "bill_procedure_steps" USING btree ("bill_id","occurred_on","display_order");--> statement-breakpoint
CREATE INDEX "bill_procedure_steps_document_idx" ON "bill_procedure_steps" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "bill_procedure_steps_type_idx" ON "bill_procedure_steps" USING btree ("step_type");--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_text_asset_id_stored_assets_id_fk" FOREIGN KEY ("text_asset_id") REFERENCES "public"."stored_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "documents_bill_kind_idx" ON "documents" USING btree ("bill_id","document_kind");--> statement-breakpoint
CREATE INDEX "documents_official_url_hash_idx" ON "documents" USING btree ("official_url_hash");--> statement-breakpoint
CREATE INDEX "documents_text_status_idx" ON "documents" USING btree ("text_status");