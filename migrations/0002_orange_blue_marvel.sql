CREATE TABLE "disposed_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_id" integer NOT NULL,
	"warehouse_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"unit_value" numeric(10, 2) NOT NULL,
	"total_value" numeric(10, 2) NOT NULL,
	"disposal_date" timestamp DEFAULT now() NOT NULL,
	"disposal_reason" text,
	"approved_by" integer NOT NULL,
	"source_type" varchar(50),
	"source_id" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "email_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"display_name" text NOT NULL,
	"host" text,
	"port" integer,
	"secure" boolean DEFAULT false,
	"username" text,
	"password" text,
	"from_email" text NOT NULL,
	"from_name" text NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"verification_test_email" text,
	"last_tested_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issue_activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"issue_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"action" text NOT NULL,
	"previous_value" text,
	"new_value" text,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issues" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"reported_by" integer NOT NULL,
	"assigned_to" integer,
	"warehouse_id" integer,
	"item_id" integer,
	"attachments" text[],
	"estimated_resolution_date" timestamp,
	"actual_resolution_date" timestamp,
	"resolution_notes" text,
	"closed_by" integer,
	"closed_at" timestamp,
	"reopened_by" integer,
	"reopened_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "licenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"application_id" text NOT NULL,
	"client_id" text NOT NULL,
	"license_key" text NOT NULL,
	"subscription_type" text NOT NULL,
	"valid_till" timestamp NOT NULL,
	"mutual_key" text NOT NULL,
	"checksum" text NOT NULL,
	"subscription_data" text NOT NULL,
	"base_url" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_validated" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	CONSTRAINT "licenses_license_key_unique" UNIQUE("license_key")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" json NOT NULL,
	"expire" timestamp (6) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_parent_id_notifications_id_fk";
--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD COLUMN "logo" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "rate" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "supplier_name" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "po_number" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "delivery_challan_number" text;--> statement-breakpoint
ALTER TABLE "transfers" ADD COLUMN "return_reason" text;--> statement-breakpoint
ALTER TABLE "transfers" ADD COLUMN "return_courier_name" text;--> statement-breakpoint
ALTER TABLE "transfers" ADD COLUMN "return_tracking_number" text;--> statement-breakpoint
ALTER TABLE "transfers" ADD COLUMN "return_shipped_date" timestamp;--> statement-breakpoint
ALTER TABLE "transfers" ADD COLUMN "return_delivered_date" timestamp;--> statement-breakpoint
ALTER TABLE "transfers" ADD COLUMN "disposal_reason" text;--> statement-breakpoint
ALTER TABLE "transfers" ADD COLUMN "disposal_date" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "reset_token" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "reset_token_expiry" text;--> statement-breakpoint
ALTER TABLE "disposed_items" ADD CONSTRAINT "disposed_items_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disposed_items" ADD CONSTRAINT "disposed_items_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disposed_items" ADD CONSTRAINT "disposed_items_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_activities" ADD CONSTRAINT "issue_activities_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_activities" ADD CONSTRAINT "issue_activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_reported_by_users_id_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_reopened_by_users_id_fk" FOREIGN KEY ("reopened_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_settings_provider_idx" ON "email_settings" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "email_settings_active_idx" ON "email_settings" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "email_settings_verified_idx" ON "email_settings" USING btree ("is_verified");--> statement-breakpoint
CREATE INDEX "issue_activities_issue_idx" ON "issue_activities" USING btree ("issue_id");--> statement-breakpoint
CREATE INDEX "issue_activities_user_idx" ON "issue_activities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "issue_activities_action_idx" ON "issue_activities" USING btree ("action");--> statement-breakpoint
CREATE INDEX "issue_activities_created_at_idx" ON "issue_activities" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "issues_reported_by_idx" ON "issues" USING btree ("reported_by");--> statement-breakpoint
CREATE INDEX "issues_assigned_to_idx" ON "issues" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "issues_status_idx" ON "issues" USING btree ("status");--> statement-breakpoint
CREATE INDEX "issues_priority_idx" ON "issues" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "issues_category_idx" ON "issues" USING btree ("category");--> statement-breakpoint
CREATE INDEX "issues_warehouse_idx" ON "issues" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "issues_created_at_idx" ON "issues" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "issues_closed_by_idx" ON "issues" USING btree ("closed_by");--> statement-breakpoint
CREATE INDEX "issues_reopened_by_idx" ON "issues" USING btree ("reopened_by");--> statement-breakpoint
CREATE INDEX "licenses_application_idx" ON "licenses" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "licenses_client_idx" ON "licenses" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "licenses_active_idx" ON "licenses" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "licenses_valid_till_idx" ON "licenses" USING btree ("valid_till");--> statement-breakpoint
CREATE INDEX "licenses_last_validated_idx" ON "licenses" USING btree ("last_validated");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "session" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "items_status_idx" ON "items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "items_created_at_idx" ON "items" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "users_active_idx" ON "users" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "users_reset_token_idx" ON "users" USING btree ("reset_token");