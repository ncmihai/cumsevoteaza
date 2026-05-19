CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS "pg_trgm";--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS "unaccent";--> statement-breakpoint
CREATE INDEX "individual_votes_member_vote_idx" ON "individual_votes" USING btree ("member_id","vote_id");--> statement-breakpoint
CREATE INDEX "member_group_memberships_group_member_period_idx" ON "member_group_memberships" USING btree ("group_id","member_id","starts_on","ends_on");--> statement-breakpoint
CREATE INDEX "member_mandates_chamber_period_idx" ON "member_mandates" USING btree ("chamber","starts_on","ends_on");--> statement-breakpoint
CREATE INDEX "entity_search_index_search_text_trgm_idx" ON "entity_search_index" USING gin ("search_text" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "bills_identifiers_gin_idx" ON "bills" USING gin ("identifiers");
