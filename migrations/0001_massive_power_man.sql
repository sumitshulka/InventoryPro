CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" integer,
	"details" text NOT NULL,
	"old_values" text,
	"new_values" text,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "departments_manager_idx" ON "departments" USING btree ("manager_id");--> statement-breakpoint
CREATE INDEX "departments_active_idx" ON "departments" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "inventory_item_idx" ON "inventory" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "inventory_warehouse_idx" ON "inventory" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "inventory_quantity_idx" ON "inventory" USING btree ("quantity");--> statement-breakpoint
CREATE INDEX "inventory_last_updated_idx" ON "inventory" USING btree ("last_updated");--> statement-breakpoint
CREATE INDEX "inventory_item_warehouse_idx" ON "inventory" USING btree ("item_id","warehouse_id");--> statement-breakpoint
CREATE INDEX "items_category_idx" ON "items" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "items_name_idx" ON "items" USING btree ("name");--> statement-breakpoint
CREATE INDEX "items_unit_idx" ON "items" USING btree ("unit");--> statement-breakpoint
CREATE INDEX "items_min_stock_idx" ON "items" USING btree ("min_stock_level");--> statement-breakpoint
CREATE INDEX "locations_city_idx" ON "locations" USING btree ("city");--> statement-breakpoint
CREATE INDEX "locations_state_idx" ON "locations" USING btree ("state");--> statement-breakpoint
CREATE INDEX "locations_country_idx" ON "locations" USING btree ("country");--> statement-breakpoint
CREATE INDEX "locations_active_idx" ON "locations" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "locations_created_at_idx" ON "locations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "request_items_request_idx" ON "request_items" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "request_items_item_idx" ON "request_items" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "request_items_request_item_idx" ON "request_items" USING btree ("request_id","item_id");--> statement-breakpoint
CREATE INDEX "requests_user_idx" ON "requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "requests_warehouse_idx" ON "requests" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "requests_status_idx" ON "requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "requests_priority_idx" ON "requests" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "requests_submitted_at_idx" ON "requests" USING btree ("submitted_at");--> statement-breakpoint
CREATE INDEX "requests_created_at_idx" ON "requests" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "requests_updated_at_idx" ON "requests" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "requests_user_status_idx" ON "requests" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "requests_warehouse_status_idx" ON "requests" USING btree ("warehouse_id","status");--> statement-breakpoint
CREATE INDEX "transactions_item_idx" ON "transactions" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "transactions_type_idx" ON "transactions" USING btree ("transaction_type");--> statement-breakpoint
CREATE INDEX "transactions_user_idx" ON "transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "transactions_requester_idx" ON "transactions" USING btree ("requester_id");--> statement-breakpoint
CREATE INDEX "transactions_source_warehouse_idx" ON "transactions" USING btree ("source_warehouse_id");--> statement-breakpoint
CREATE INDEX "transactions_dest_warehouse_idx" ON "transactions" USING btree ("destination_warehouse_id");--> statement-breakpoint
CREATE INDEX "transactions_request_idx" ON "transactions" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "transactions_status_idx" ON "transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "transactions_created_at_idx" ON "transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "transactions_completed_at_idx" ON "transactions" USING btree ("completed_at");--> statement-breakpoint
CREATE INDEX "transactions_check_in_date_idx" ON "transactions" USING btree ("check_in_date");--> statement-breakpoint
CREATE INDEX "transactions_type_user_idx" ON "transactions" USING btree ("transaction_type","user_id");--> statement-breakpoint
CREATE INDEX "transactions_item_warehouse_idx" ON "transactions" USING btree ("item_id","source_warehouse_id");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "users_manager_idx" ON "users" USING btree ("manager_id");--> statement-breakpoint
CREATE INDEX "users_warehouse_idx" ON "users" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "users_department_idx" ON "users" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "users_warehouse_operator_idx" ON "users" USING btree ("is_warehouse_operator");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "warehouse_operators_user_idx" ON "warehouse_operators" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "warehouse_operators_warehouse_idx" ON "warehouse_operators" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "warehouse_operators_active_idx" ON "warehouse_operators" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "warehouse_operators_created_at_idx" ON "warehouse_operators" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "warehouses_location_idx" ON "warehouses" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "warehouses_manager_idx" ON "warehouses" USING btree ("manager_id");--> statement-breakpoint
CREATE INDEX "warehouses_active_idx" ON "warehouses" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "warehouses_status_idx" ON "warehouses" USING btree ("status");--> statement-breakpoint
CREATE INDEX "warehouses_deleted_at_idx" ON "warehouses" USING btree ("deleted_at");