CREATE INDEX "bill_sponsors_bill_idx" ON "bill_sponsors" USING btree ("bill_id");--> statement-breakpoint
CREATE INDEX "bill_sponsors_member_idx" ON "bill_sponsors" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "group_vote_totals_vote_idx" ON "group_vote_totals" USING btree ("vote_id");--> statement-breakpoint
CREATE INDEX "group_vote_totals_group_idx" ON "group_vote_totals" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "individual_votes_vote_idx" ON "individual_votes" USING btree ("vote_id");--> statement-breakpoint
CREATE INDEX "individual_votes_member_idx" ON "individual_votes" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "individual_votes_group_idx" ON "individual_votes" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "member_group_memberships_member_period_idx" ON "member_group_memberships" USING btree ("member_id","starts_on","ends_on");--> statement-breakpoint
CREATE INDEX "member_group_memberships_group_period_idx" ON "member_group_memberships" USING btree ("group_id","starts_on","ends_on");--> statement-breakpoint
CREATE INDEX "member_mandates_member_legislature_idx" ON "member_mandates" USING btree ("member_id","legislature_id","chamber");--> statement-breakpoint
CREATE INDEX "member_mandates_legislature_chamber_idx" ON "member_mandates" USING btree ("legislature_id","chamber");--> statement-breakpoint
CREATE INDEX "member_party_affiliations_member_period_idx" ON "member_party_affiliations" USING btree ("member_id","starts_on","ends_on");--> statement-breakpoint
CREATE INDEX "member_party_affiliations_party_period_idx" ON "member_party_affiliations" USING btree ("party_id","starts_on","ends_on");