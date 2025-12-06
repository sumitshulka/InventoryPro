ALTER TABLE "issue_activities" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "transfer_items" ADD COLUMN "is_disposed" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "transfer_items" ADD COLUMN "disposal_date" timestamp;--> statement-breakpoint
ALTER TABLE "transfer_items" ADD COLUMN "disposal_reason" text;--> statement-breakpoint
CREATE INDEX "locations_updated_at_idx" ON "locations" USING btree ("updated_at");