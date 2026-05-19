CREATE TABLE "member_mandate_relations" (
	"id" text PRIMARY KEY NOT NULL,
	"mandate_id" text NOT NULL,
	"relation" text NOT NULL,
	"related_member_id" text,
	"related_name" text NOT NULL,
	"related_official_url" text,
	"source_snapshot_id" text
);
--> statement-breakpoint
ALTER TABLE "member_group_memberships" ADD COLUMN "logo_url" text;--> statement-breakpoint
ALTER TABLE "member_party_affiliations" ADD COLUMN "logo_url" text;--> statement-breakpoint
ALTER TABLE "member_mandate_relations" ADD CONSTRAINT "member_mandate_relations_mandate_id_member_mandates_id_fk" FOREIGN KEY ("mandate_id") REFERENCES "public"."member_mandates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_mandate_relations" ADD CONSTRAINT "member_mandate_relations_related_member_id_members_id_fk" FOREIGN KEY ("related_member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_mandate_relations" ADD CONSTRAINT "member_mandate_relations_source_snapshot_id_source_snapshots_id_fk" FOREIGN KEY ("source_snapshot_id") REFERENCES "public"."source_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "member_mandate_relations_mandate_idx" ON "member_mandate_relations" USING btree ("mandate_id");--> statement-breakpoint
CREATE INDEX "member_mandate_relations_related_member_idx" ON "member_mandate_relations" USING btree ("related_member_id");
