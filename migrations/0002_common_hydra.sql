CREATE TABLE "clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_code" text NOT NULL,
	"company_name" text NOT NULL,
	"contact_person" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"billing_address" text NOT NULL,
	"billing_city" text NOT NULL,
	"billing_state" text NOT NULL,
	"billing_zip_code" text NOT NULL,
	"billing_country" text DEFAULT 'India' NOT NULL,
	"shipping_address" text NOT NULL,
	"shipping_city" text NOT NULL,
	"shipping_state" text NOT NULL,
	"shipping_zip_code" text NOT NULL,
	"shipping_country" text DEFAULT 'India' NOT NULL,
	"tax_id" text,
	"payment_terms" text DEFAULT 'Net 30',
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	CONSTRAINT "clients_client_code_unique" UNIQUE("client_code")
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
CREATE TABLE "sales_order_approvals" (
	"id" serial PRIMARY KEY NOT NULL,
	"sales_order_id" integer NOT NULL,
	"approver_id" integer NOT NULL,
	"approval_level" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"comments" text,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_order_dispatch_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"dispatch_id" integer NOT NULL,
	"sales_order_item_id" integer NOT NULL,
	"item_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"transaction_id" integer,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "sales_order_dispatches" (
	"id" serial PRIMARY KEY NOT NULL,
	"dispatch_code" text NOT NULL,
	"sales_order_id" integer NOT NULL,
	"dispatched_by" integer NOT NULL,
	"dispatch_date" timestamp DEFAULT now() NOT NULL,
	"courier_name" text NOT NULL,
	"tracking_number" text,
	"vehicle_number" text,
	"driver_name" text,
	"driver_contact" text,
	"status" text DEFAULT 'dispatched' NOT NULL,
	"delivered_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sales_order_dispatches_dispatch_code_unique" UNIQUE("dispatch_code")
);
--> statement-breakpoint
CREATE TABLE "sales_order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"sales_order_id" integer NOT NULL,
	"item_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"tax_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"line_total" numeric(12, 2) NOT NULL,
	"dispatched_quantity" integer DEFAULT 0 NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "sales_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_code" text NOT NULL,
	"client_id" integer NOT NULL,
	"warehouse_id" integer NOT NULL,
	"created_by" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"order_date" timestamp DEFAULT now() NOT NULL,
	"expected_delivery_date" timestamp,
	"shipping_address" text NOT NULL,
	"shipping_city" text NOT NULL,
	"shipping_state" text NOT NULL,
	"shipping_zip_code" text NOT NULL,
	"shipping_country" text DEFAULT 'India' NOT NULL,
	"billing_address" text NOT NULL,
	"billing_city" text NOT NULL,
	"billing_state" text NOT NULL,
	"billing_zip_code" text NOT NULL,
	"billing_country" text DEFAULT 'India' NOT NULL,
	"subtotal" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_tax" numeric(12, 2) DEFAULT '0' NOT NULL,
	"grand_total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"internal_notes" text,
	"approved_by" integer,
	"approved_at" timestamp,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	CONSTRAINT "sales_orders_order_code_unique" UNIQUE("order_code")
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
ALTER TABLE "issue_activities" ADD CONSTRAINT "issue_activities_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_activities" ADD CONSTRAINT "issue_activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_reported_by_users_id_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_reopened_by_users_id_fk" FOREIGN KEY ("reopened_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_approvals" ADD CONSTRAINT "sales_order_approvals_sales_order_id_sales_orders_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_approvals" ADD CONSTRAINT "sales_order_approvals_approver_id_users_id_fk" FOREIGN KEY ("approver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_dispatch_items" ADD CONSTRAINT "sales_order_dispatch_items_dispatch_id_sales_order_dispatches_id_fk" FOREIGN KEY ("dispatch_id") REFERENCES "public"."sales_order_dispatches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_dispatch_items" ADD CONSTRAINT "sales_order_dispatch_items_sales_order_item_id_sales_order_items_id_fk" FOREIGN KEY ("sales_order_item_id") REFERENCES "public"."sales_order_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_dispatch_items" ADD CONSTRAINT "sales_order_dispatch_items_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_dispatch_items" ADD CONSTRAINT "sales_order_dispatch_items_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_dispatches" ADD CONSTRAINT "sales_order_dispatches_sales_order_id_sales_orders_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_dispatches" ADD CONSTRAINT "sales_order_dispatches_dispatched_by_users_id_fk" FOREIGN KEY ("dispatched_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_items" ADD CONSTRAINT "sales_order_items_sales_order_id_sales_orders_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_items" ADD CONSTRAINT "sales_order_items_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clients_company_name_idx" ON "clients" USING btree ("company_name");--> statement-breakpoint
CREATE INDEX "clients_email_idx" ON "clients" USING btree ("email");--> statement-breakpoint
CREATE INDEX "clients_active_idx" ON "clients" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "clients_created_at_idx" ON "clients" USING btree ("created_at");--> statement-breakpoint
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
CREATE INDEX "sales_order_approvals_order_idx" ON "sales_order_approvals" USING btree ("sales_order_id");--> statement-breakpoint
CREATE INDEX "sales_order_approvals_approver_idx" ON "sales_order_approvals" USING btree ("approver_id");--> statement-breakpoint
CREATE INDEX "sales_order_approvals_status_idx" ON "sales_order_approvals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "dispatch_items_dispatch_idx" ON "sales_order_dispatch_items" USING btree ("dispatch_id");--> statement-breakpoint
CREATE INDEX "dispatch_items_order_item_idx" ON "sales_order_dispatch_items" USING btree ("sales_order_item_id");--> statement-breakpoint
CREATE INDEX "dispatch_items_item_idx" ON "sales_order_dispatch_items" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "dispatch_items_transaction_idx" ON "sales_order_dispatch_items" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "sales_order_dispatches_order_idx" ON "sales_order_dispatches" USING btree ("sales_order_id");--> statement-breakpoint
CREATE INDEX "sales_order_dispatches_dispatched_by_idx" ON "sales_order_dispatches" USING btree ("dispatched_by");--> statement-breakpoint
CREATE INDEX "sales_order_dispatches_date_idx" ON "sales_order_dispatches" USING btree ("dispatch_date");--> statement-breakpoint
CREATE INDEX "sales_order_dispatches_status_idx" ON "sales_order_dispatches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sales_order_items_order_idx" ON "sales_order_items" USING btree ("sales_order_id");--> statement-breakpoint
CREATE INDEX "sales_order_items_item_idx" ON "sales_order_items" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "sales_orders_client_idx" ON "sales_orders" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "sales_orders_warehouse_idx" ON "sales_orders" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "sales_orders_status_idx" ON "sales_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sales_orders_created_by_idx" ON "sales_orders" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "sales_orders_order_date_idx" ON "sales_orders" USING btree ("order_date");--> statement-breakpoint
CREATE INDEX "sales_orders_created_at_idx" ON "sales_orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "items_status_idx" ON "items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "items_created_at_idx" ON "items" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "users_active_idx" ON "users" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "users_reset_token_idx" ON "users" USING btree ("reset_token");