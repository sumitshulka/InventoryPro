CREATE TABLE "approval_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_type" text DEFAULT 'issue' NOT NULL,
	"min_approval_level" text DEFAULT 'manager' NOT NULL,
	"max_amount" numeric,
	"requires_second_approval" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	CONSTRAINT "categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"manager_id" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "departments_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "inventory" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_id" integer NOT NULL,
	"warehouse_id" integer NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"last_updated" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_item_id_warehouse_id_unique" UNIQUE("item_id","warehouse_id")
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sku" text NOT NULL,
	"description" text,
	"min_stock_level" integer DEFAULT 10 NOT NULL,
	"category_id" integer,
	"unit" text DEFAULT 'pcs' NOT NULL,
	CONSTRAINT "items_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"zip_code" text NOT NULL,
	"country" text DEFAULT 'India' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "locations_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"sender_id" integer NOT NULL,
	"recipient_id" integer NOT NULL,
	"subject" text NOT NULL,
	"message" text NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"status" text DEFAULT 'unread' NOT NULL,
	"parent_id" integer,
	"related_entity_type" text,
	"related_entity_id" integer,
	"is_archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_name" text DEFAULT 'My Organization' NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"currency_symbol" text DEFAULT '$' NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"default_units" text[] DEFAULT '{"pcs","boxes","reams","kg","liters"}' NOT NULL,
	"allowed_categories" text[] DEFAULT '{"Electronics","Office Supplies","Furniture"}' NOT NULL,
	"inventory_valuation_method" text DEFAULT 'Last Value' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "rejected_goods" (
	"id" serial PRIMARY KEY NOT NULL,
	"transfer_id" integer NOT NULL,
	"item_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"rejection_reason" text NOT NULL,
	"rejected_by" integer NOT NULL,
	"rejected_at" timestamp DEFAULT now() NOT NULL,
	"warehouse_id" integer NOT NULL,
	"status" text DEFAULT 'rejected' NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "request_approvals" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"approver_id" integer NOT NULL,
	"approval_level" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"comments" text,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "request_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"item_id" integer NOT NULL,
	"quantity" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_code" text NOT NULL,
	"user_id" integer NOT NULL,
	"warehouse_id" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"justification" text,
	"notes" text,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	CONSTRAINT "requests_request_code_unique" UNIQUE("request_code")
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"transaction_code" text NOT NULL,
	"item_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"transaction_type" text NOT NULL,
	"source_warehouse_id" integer,
	"destination_warehouse_id" integer,
	"request_id" integer,
	"user_id" integer NOT NULL,
	"requester_id" integer,
	"status" text DEFAULT 'completed' NOT NULL,
	"cost" numeric(10, 2),
	"check_in_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	CONSTRAINT "transactions_transaction_code_unique" UNIQUE("transaction_code")
);
--> statement-breakpoint
CREATE TABLE "transfer_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"transfer_id" integer NOT NULL,
	"item_id" integer NOT NULL,
	"requested_quantity" integer NOT NULL,
	"approved_quantity" integer,
	"actual_quantity" integer,
	"condition" text DEFAULT 'good',
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "transfer_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"warehouse_id" integer NOT NULL,
	"item_id" integer NOT NULL,
	"required_quantity" integer NOT NULL,
	"available_quantity" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"notified_user_id" integer,
	"transfer_id" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "transfer_updates" (
	"id" serial PRIMARY KEY NOT NULL,
	"transfer_id" integer NOT NULL,
	"updated_by" integer NOT NULL,
	"status" text NOT NULL,
	"update_type" text NOT NULL,
	"description" text,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transfers" (
	"id" serial PRIMARY KEY NOT NULL,
	"transfer_code" text NOT NULL,
	"source_warehouse_id" integer NOT NULL,
	"destination_warehouse_id" integer NOT NULL,
	"initiated_by" integer NOT NULL,
	"approved_by" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"transfer_mode" text DEFAULT 'courier' NOT NULL,
	"expected_shipment_date" timestamp,
	"expected_arrival_date" timestamp,
	"actual_shipment_date" timestamp,
	"actual_arrival_date" timestamp,
	"courier_name" text,
	"tracking_number" text,
	"receipt_number" text,
	"handover_person_name" text,
	"handover_person_contact" text,
	"handover_date" timestamp,
	"receipt_document" text,
	"received_by" integer,
	"received_date" timestamp,
	"receiver_notes" text,
	"overall_condition" text DEFAULT 'good',
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	CONSTRAINT "transfers_transfer_code_unique" UNIQUE("transfer_code")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"manager_id" integer,
	"warehouse_id" integer,
	"department_id" integer,
	"is_warehouse_operator" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "warehouse_operators" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"warehouse_id" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "warehouse_operators_user_id_warehouse_id_unique" UNIQUE("user_id","warehouse_id")
);
--> statement-breakpoint
CREATE TABLE "warehouses" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"location_id" integer NOT NULL,
	"manager_id" integer,
	"capacity" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "warehouses_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_parent_id_notifications_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."notifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_operators" ADD CONSTRAINT "warehouse_operators_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_operators" ADD CONSTRAINT "warehouse_operators_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_manager_id_users_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifications_sender_idx" ON "notifications" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "notifications_recipient_idx" ON "notifications" USING btree ("recipient_id");--> statement-breakpoint
CREATE INDEX "notifications_status_idx" ON "notifications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "notifications_category_idx" ON "notifications" USING btree ("category");--> statement-breakpoint
CREATE INDEX "notifications_created_at_idx" ON "notifications" USING btree ("created_at");