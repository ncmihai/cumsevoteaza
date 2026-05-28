ALTER TABLE "bills" ADD COLUMN "decision_chamber" "chamber";--> statement-breakpoint
CREATE INDEX "bills_decision_chamber_idx" ON "bills" USING btree ("decision_chamber");