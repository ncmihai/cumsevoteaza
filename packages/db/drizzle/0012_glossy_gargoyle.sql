CREATE TYPE "public"."stored_asset_storage_provider" AS ENUM('digi_storage', 'vercel_blob', 'external');--> statement-breakpoint
ALTER TABLE "stored_assets" ADD COLUMN "storage_provider" "stored_asset_storage_provider";--> statement-breakpoint
ALTER TABLE "stored_assets" ADD COLUMN "storage_path" text;--> statement-breakpoint
ALTER TABLE "stored_assets" ADD COLUMN "public_url" text;--> statement-breakpoint
ALTER TABLE "stored_assets" ADD COLUMN "width" integer;--> statement-breakpoint
ALTER TABLE "stored_assets" ADD COLUMN "height" integer;--> statement-breakpoint
ALTER TABLE "stored_assets" ADD COLUMN "variant" text;--> statement-breakpoint
UPDATE "stored_assets"
SET
  "storage_provider" = CASE
    WHEN "blob_url" IS NOT NULL THEN 'vercel_blob'::"stored_asset_storage_provider"
    ELSE 'external'::"stored_asset_storage_provider"
  END,
  "public_url" = COALESCE("public_url", "blob_url")
WHERE "storage_provider" IS NULL;--> statement-breakpoint
CREATE INDEX "stored_assets_storage_idx" ON "stored_assets" USING btree ("storage_provider","storage_path");
