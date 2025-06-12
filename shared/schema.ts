import { pgTable, text, serial, integer, boolean, timestamp, unique, numeric, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Departments table
export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  managerId: integer("manager_id"),
  isActive: boolean("is_active").notNull().default(true),
}, (table) => ({
  departmentsManagerIdx: index("departments_manager_idx").on(table.managerId),
  departmentsActiveIdx: index("departments_active_idx").on(table.isActive),
}));

export const insertDepartmentSchema = createInsertSchema(departments).pick({
  name: true,
  description: true,
  managerId: true,
  isActive: true,
});

export type Department = typeof departments.$inferSelect;
export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull().default("user"),
  managerId: integer("manager_id"),
  warehouseId: integer("warehouse_id"),
  departmentId: integer("department_id"),
  isWarehouseOperator: boolean("is_warehouse_operator").notNull().default(false),
  resetToken: text("reset_token"),
  resetTokenExpiry: text("reset_token_expiry"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  usersRoleIdx: index("users_role_idx").on(table.role),
  usersManagerIdx: index("users_manager_idx").on(table.managerId),
  usersWarehouseIdx: index("users_warehouse_idx").on(table.warehouseId),
  usersDepartmentIdx: index("users_department_idx").on(table.departmentId),
  usersWarehouseOperatorIdx: index("users_warehouse_operator_idx").on(table.isWarehouseOperator),
  usersEmailIdx: index("users_email_idx").on(table.email),
  usersCreatedAtIdx: index("users_created_at_idx").on(table.createdAt),
  usersResetTokenIdx: index("users_reset_token_idx").on(table.resetToken),
}));

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  name: true,
  email: true,
  role: true,
  managerId: true,
  warehouseId: true,
  departmentId: true,
  isWarehouseOperator: true,
  resetToken: true,
  resetTokenExpiry: true,
});

// Office Locations
export const locations = pgTable("locations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  zipCode: text("zip_code").notNull(),
  country: text("country").notNull().default("India"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  locationsCityIdx: index("locations_city_idx").on(table.city),
  locationsStateIdx: index("locations_state_idx").on(table.state),
  locationsCountryIdx: index("locations_country_idx").on(table.country),
  locationsActiveIdx: index("locations_active_idx").on(table.isActive),
  locationsCreatedAtIdx: index("locations_created_at_idx").on(table.createdAt),
}));

export const insertLocationSchema = createInsertSchema(locations).pick({
  name: true,
  address: true,
  city: true,
  state: true,
  zipCode: true,
  country: true,
  isActive: true,
});

// Categories for items
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
});

export const insertCategorySchema = createInsertSchema(categories).pick({
  name: true,
  description: true,
});

// Warehouses
export const warehouses = pgTable("warehouses", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  locationId: integer("location_id").notNull().references(() => locations.id),
  managerId: integer("manager_id").references(() => users.id),
  capacity: integer("capacity").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  status: text("status").notNull().default("active"), // active, suspended, deleted
  deletedAt: timestamp("deleted_at"),
}, (table) => ({
  warehousesLocationIdx: index("warehouses_location_idx").on(table.locationId),
  warehousesManagerIdx: index("warehouses_manager_idx").on(table.managerId),
  warehousesActiveIdx: index("warehouses_active_idx").on(table.isActive),
  warehousesStatusIdx: index("warehouses_status_idx").on(table.status),
  warehousesDeletedAtIdx: index("warehouses_deleted_at_idx").on(table.deletedAt),
}));

export const insertWarehouseSchema = createInsertSchema(warehouses).pick({
  name: true,
  locationId: true,
  managerId: true,
  capacity: true,
  isActive: true,
  status: true,
});

// Warehouse Operators - maps users to warehouses as operators
export const warehouseOperators = pgTable("warehouse_operators", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  warehouseId: integer("warehouse_id").notNull().references(() => warehouses.id),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  // Ensure a user can't be added as operator to same warehouse multiple times
  uniqueUserWarehouse: unique().on(table.userId, table.warehouseId),
  warehouseOperatorsUserIdx: index("warehouse_operators_user_idx").on(table.userId),
  warehouseOperatorsWarehouseIdx: index("warehouse_operators_warehouse_idx").on(table.warehouseId),
  warehouseOperatorsActiveIdx: index("warehouse_operators_active_idx").on(table.isActive),
  warehouseOperatorsCreatedAtIdx: index("warehouse_operators_created_at_idx").on(table.createdAt),
}));

export const insertWarehouseOperatorSchema = createInsertSchema(warehouseOperators).pick({
  userId: true,
  warehouseId: true,
  isActive: true,
});

// Items master
export const items = pgTable("items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sku: text("sku").notNull().unique(),
  description: text("description"),
  minStockLevel: integer("min_stock_level").notNull().default(10),
  categoryId: integer("category_id"),
  unit: text("unit").notNull().default("pcs"),
  status: text("status").notNull().default("active"), // 'active' or 'inactive'
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  itemsCategoryIdx: index("items_category_idx").on(table.categoryId),
  itemsNameIdx: index("items_name_idx").on(table.name),
  itemsUnitIdx: index("items_unit_idx").on(table.unit),
  itemsMinStockIdx: index("items_min_stock_idx").on(table.minStockLevel),
  itemsStatusIdx: index("items_status_idx").on(table.status),
  itemsCreatedAtIdx: index("items_created_at_idx").on(table.createdAt),
}));

export const insertItemSchema = createInsertSchema(items).pick({
  name: true,
  sku: true,
  description: true,
  minStockLevel: true,
  categoryId: true,
  unit: true,
  status: true,
});

// Inventory (tracks quantity of items in warehouses)
export const inventory = pgTable("inventory", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id").notNull(),
  warehouseId: integer("warehouse_id").notNull(),
  quantity: integer("quantity").notNull().default(0),
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
}, (table) => {
  return {
    itemWarehouseUnique: unique().on(table.itemId, table.warehouseId),
    inventoryItemIdx: index("inventory_item_idx").on(table.itemId),
    inventoryWarehouseIdx: index("inventory_warehouse_idx").on(table.warehouseId),
    inventoryQuantityIdx: index("inventory_quantity_idx").on(table.quantity),
    inventoryLastUpdatedIdx: index("inventory_last_updated_idx").on(table.lastUpdated),
    inventoryItemWarehouseIdx: index("inventory_item_warehouse_idx").on(table.itemId, table.warehouseId),
  };
});

export const insertInventorySchema = createInsertSchema(inventory).pick({
  itemId: true,
  warehouseId: true,
  quantity: true,
});

// Transaction types (check-in, issue, transfer)
export type TransactionType = "check-in" | "issue" | "transfer";

// Inventory transactions
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  transactionCode: text("transaction_code").notNull().unique(),
  itemId: integer("item_id").notNull(),
  quantity: integer("quantity").notNull(),
  transactionType: text("transaction_type").notNull(),
  sourceWarehouseId: integer("source_warehouse_id"),
  destinationWarehouseId: integer("destination_warehouse_id"),
  requestId: integer("request_id"),
  userId: integer("user_id").notNull(),
  requesterId: integer("requester_id"),
  status: text("status").notNull().default("completed"),
  cost: numeric("cost", { precision: 10, scale: 2 }),
  rate: numeric("rate", { precision: 10, scale: 2 }),
  supplierName: text("supplier_name"),
  poNumber: text("po_number"),
  deliveryChallanNumber: text("delivery_challan_number"),
  checkInDate: timestamp("check_in_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, (table) => ({
  transactionsItemIdx: index("transactions_item_idx").on(table.itemId),
  transactionsTypeIdx: index("transactions_type_idx").on(table.transactionType),
  transactionsUserIdx: index("transactions_user_idx").on(table.userId),
  transactionsRequesterIdx: index("transactions_requester_idx").on(table.requesterId),
  transactionsSourceWarehouseIdx: index("transactions_source_warehouse_idx").on(table.sourceWarehouseId),
  transactionsDestWarehouseIdx: index("transactions_dest_warehouse_idx").on(table.destinationWarehouseId),
  transactionsRequestIdx: index("transactions_request_idx").on(table.requestId),
  transactionsStatusIdx: index("transactions_status_idx").on(table.status),
  transactionsCreatedAtIdx: index("transactions_created_at_idx").on(table.createdAt),
  transactionsCompletedAtIdx: index("transactions_completed_at_idx").on(table.completedAt),
  transactionsCheckInDateIdx: index("transactions_check_in_date_idx").on(table.checkInDate),
  transactionsTypeUserIdx: index("transactions_type_user_idx").on(table.transactionType, table.userId),
  transactionsItemWarehouseIdx: index("transactions_item_warehouse_idx").on(table.itemId, table.sourceWarehouseId),
}));

export const insertTransactionSchema = createInsertSchema(transactions)
  .omit({
    id: true,
    transactionCode: true,
    createdAt: true,
    completedAt: true,
  })
  .extend({
    userId: z.number().optional(),
    cost: z.preprocess((arg) => {
      if (typeof arg === 'number') return arg.toString();
      return arg;
    }, z.string().optional()),
    rate: z.preprocess((arg) => {
      if (typeof arg === 'number') return arg.toString();
      return arg;
    }, z.string().optional()),
    supplierName: z.string().optional(),
    poNumber: z.string().optional(),
    checkInDate: z.preprocess((arg) => {
      if (typeof arg === 'string' || arg instanceof Date) return new Date(arg);
      return arg;
    }, z.date().optional())
  })
  .refine((data) => data.quantity > 0, {
    message: "Quantity must be greater than 0",
    path: ["quantity"]
  });

// Inventory requests
export const requests = pgTable("requests", {
  id: serial("id").primaryKey(),
  requestCode: text("request_code").notNull().unique(),
  userId: integer("user_id").notNull(),
  warehouseId: integer("warehouse_id").notNull(),
  status: text("status").notNull().default("pending"),
  priority: text("priority").notNull().default("normal"),
  justification: text("justification"),
  notes: text("notes"),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at"),
}, (table) => ({
  requestsUserIdx: index("requests_user_idx").on(table.userId),
  requestsWarehouseIdx: index("requests_warehouse_idx").on(table.warehouseId),
  requestsStatusIdx: index("requests_status_idx").on(table.status),
  requestsPriorityIdx: index("requests_priority_idx").on(table.priority),
  requestsSubmittedAtIdx: index("requests_submitted_at_idx").on(table.submittedAt),
  requestsCreatedAtIdx: index("requests_created_at_idx").on(table.createdAt),
  requestsUpdatedAtIdx: index("requests_updated_at_idx").on(table.updatedAt),
  requestsUserStatusIdx: index("requests_user_status_idx").on(table.userId, table.status),
  requestsWarehouseStatusIdx: index("requests_warehouse_status_idx").on(table.warehouseId, table.status),
}));

export const insertRequestSchema = createInsertSchema(requests).omit({
  id: true,
  requestCode: true,
  createdAt: true,
  updatedAt: true,
});

// Request items (items requested in a request)
export const requestItems = pgTable("request_items", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull(),
  itemId: integer("item_id").notNull(),
  quantity: integer("quantity").notNull(),
}, (table) => ({
  requestItemsRequestIdx: index("request_items_request_idx").on(table.requestId),
  requestItemsItemIdx: index("request_items_item_idx").on(table.itemId),
  requestItemsRequestItemIdx: index("request_items_request_item_idx").on(table.requestId, table.itemId),
}));

export const insertRequestItemSchema = createInsertSchema(requestItems).omit({
  id: true,
});

// Approval workflow settings
export const approvalSettings = pgTable("approval_settings", {
  id: serial("id").primaryKey(),
  requestType: text("request_type").notNull().default("issue"),
  minApprovalLevel: text("min_approval_level").notNull().default("manager"),
  maxAmount: numeric("max_amount"),
  requiresSecondApproval: boolean("requires_second_approval").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertApprovalSettingsSchema = createInsertSchema(approvalSettings).omit({
  id: true,
  createdAt: true,
});

// Organization settings with enhanced configuration
export const organizationSettings = pgTable("organization_settings", {
  id: serial("id").primaryKey(),
  organizationName: text("organization_name").notNull().default("My Organization"),
  logo: text("logo"), // Base64 encoded image data
  currency: text("currency").notNull().default("USD"),
  currencySymbol: text("currency_symbol").notNull().default("$"),
  timezone: text("timezone").notNull().default("UTC"),
  defaultUnits: text("default_units").array().notNull().default(["pcs", "boxes", "reams", "kg", "liters"]),
  allowedCategories: text("allowed_categories").array().notNull().default(["Electronics", "Office Supplies", "Furniture"]),
  inventoryValuationMethod: text("inventory_valuation_method").notNull().default("Last Value"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at"),
});

export const insertOrganizationSettingsSchema = createInsertSchema(organizationSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Request approvals
export const requestApprovals = pgTable("request_approvals", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull(),
  approverId: integer("approver_id").notNull(),
  approvalLevel: text("approval_level").notNull(),
  status: text("status").notNull().default("pending"),
  comments: text("comments"),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertRequestApprovalSchema = createInsertSchema(requestApprovals).omit({
  id: true,
  createdAt: true,
});

// Transfer notifications for warehouse managers
export const transferNotifications = pgTable("transfer_notifications", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull(),
  warehouseId: integer("warehouse_id").notNull(),
  itemId: integer("item_id").notNull(),
  requiredQuantity: integer("required_quantity").notNull(),
  availableQuantity: integer("available_quantity").notNull().default(0),
  status: text("status").notNull().default("pending"), // pending, approved, rejected, transferred
  notifiedUserId: integer("notified_user_id"), // warehouse manager notified
  transferId: integer("transfer_id"), // reference to actual transfer if created
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
});

export const insertTransferNotificationSchema = createInsertSchema(transferNotifications).omit({
  id: true,
  createdAt: true,
  resolvedAt: true,
});

// Enhanced transfer management system
export const transfers = pgTable("transfers", {
  id: serial("id").primaryKey(),
  transferCode: text("transfer_code").notNull().unique(),
  sourceWarehouseId: integer("source_warehouse_id").notNull(),
  destinationWarehouseId: integer("destination_warehouse_id").notNull(),
  initiatedBy: integer("initiated_by").notNull(), // user who created the transfer
  approvedBy: integer("approved_by"), // user who approved the transfer
  status: text("status").notNull().default("pending"), // pending, approved, in-transit, completed, cancelled
  transferMode: text("transfer_mode").notNull().default("courier"), // courier, handover, pickup
  expectedShipmentDate: timestamp("expected_shipment_date"),
  expectedArrivalDate: timestamp("expected_arrival_date"),
  actualShipmentDate: timestamp("actual_shipment_date"),
  actualArrivalDate: timestamp("actual_arrival_date"),
  courierName: text("courier_name"),
  trackingNumber: text("tracking_number"),
  receiptNumber: text("receipt_number"),
  handoverPersonName: text("handover_person_name"),
  handoverPersonContact: text("handover_person_contact"),
  handoverDate: timestamp("handover_date"),
  receiptDocument: text("receipt_document"), // file path or URL to uploaded receipt
  receivedBy: integer("received_by"), // destination warehouse manager who received
  receivedDate: timestamp("received_date"),
  receiverNotes: text("receiver_notes"),
  overallCondition: text("overall_condition").default("good"), // good, damaged, mixed
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at"),
});

export const insertTransferSchema = createInsertSchema(transfers).omit({
  id: true,
  transferCode: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  expectedShipmentDate: z.union([z.string(), z.date()]).optional().nullable(),
  expectedArrivalDate: z.union([z.string(), z.date()]).optional().nullable(),
});

// Transfer items (individual items in a transfer)
export const transferItems = pgTable("transfer_items", {
  id: serial("id").primaryKey(),
  transferId: integer("transfer_id").notNull(),
  itemId: integer("item_id").notNull(),
  requestedQuantity: integer("requested_quantity").notNull(),
  approvedQuantity: integer("approved_quantity"),
  actualQuantity: integer("actual_quantity"), // quantity actually received
  condition: text("condition").default("good"), // good, damaged, missing
  notes: text("notes"),
});

export const insertTransferItemSchema = createInsertSchema(transferItems).omit({
  id: true,
});

// Transfer updates/logs for tracking status changes
export const transferUpdates = pgTable("transfer_updates", {
  id: serial("id").primaryKey(),
  transferId: integer("transfer_id").notNull(),
  updatedBy: integer("updated_by").notNull(),
  status: text("status").notNull(),
  updateType: text("update_type").notNull(), // status_change, shipment_info, receipt_info, note
  description: text("description"),
  metadata: text("metadata"), // JSON string for additional data
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTransferUpdateSchema = createInsertSchema(transferUpdates).omit({
  id: true,
  createdAt: true,
});

// Export types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;

export type Warehouse = typeof warehouses.$inferSelect;
export type InsertWarehouse = z.infer<typeof insertWarehouseSchema>;

export type Item = typeof items.$inferSelect;
export type InsertItem = z.infer<typeof insertItemSchema>;

export type Inventory = typeof inventory.$inferSelect;
export type InsertInventory = z.infer<typeof insertInventorySchema>;

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;

export type Request = typeof requests.$inferSelect;
export type InsertRequest = z.infer<typeof insertRequestSchema>;

export type RequestItem = typeof requestItems.$inferSelect;
export type InsertRequestItem = z.infer<typeof insertRequestItemSchema>;

export type ApprovalSettings = typeof approvalSettings.$inferSelect;
export type InsertApprovalSettings = z.infer<typeof insertApprovalSettingsSchema>;

export type RequestApproval = typeof requestApprovals.$inferSelect;
export type InsertRequestApproval = z.infer<typeof insertRequestApprovalSchema>;

export type WarehouseOperator = typeof warehouseOperators.$inferSelect;
export type InsertWarehouseOperator = z.infer<typeof insertWarehouseOperatorSchema>;

export type TransferNotification = typeof transferNotifications.$inferSelect;
export type InsertTransferNotification = z.infer<typeof insertTransferNotificationSchema>;

export type Transfer = typeof transfers.$inferSelect;
export type InsertTransfer = z.infer<typeof insertTransferSchema>;

export type TransferItem = typeof transferItems.$inferSelect;
export type InsertTransferItem = z.infer<typeof insertTransferItemSchema>;

export type TransferUpdate = typeof transferUpdates.$inferSelect;
export type InsertTransferUpdate = z.infer<typeof insertTransferUpdateSchema>;

// Rejected Goods table for tracking rejected transfer items
export const rejectedGoods = pgTable("rejected_goods", {
  id: serial("id").primaryKey(),
  transferId: integer("transfer_id").notNull(),
  itemId: integer("item_id").notNull(),
  quantity: integer("quantity").notNull(),
  rejectionReason: text("rejection_reason").notNull(),
  rejectedBy: integer("rejected_by").notNull(),
  rejectedAt: timestamp("rejected_at").defaultNow().notNull(),
  warehouseId: integer("warehouse_id").notNull(), // Where the rejected goods are stored
  status: text("status").notNull().default("rejected"), // rejected, disposed, returned
  notes: text("notes"),
});

export const insertRejectedGoodsSchema = createInsertSchema(rejectedGoods).pick({
  transferId: true,
  itemId: true,
  quantity: true,
  rejectionReason: true,
  rejectedBy: true,
  warehouseId: true,
  status: true,
  notes: true,
});

export type RejectedGoods = typeof rejectedGoods.$inferSelect;
export type InsertRejectedGoods = z.infer<typeof insertRejectedGoodsSchema>;

// Notifications table
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").notNull().references(() => users.id),
  recipientId: integer("recipient_id").notNull().references(() => users.id),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  category: text("category").notNull().default("general"), // general, inventory, request, transfer, approval
  priority: text("priority").notNull().default("normal"), // low, normal, high, urgent
  status: text("status").notNull().default("unread"), // unread, read, replied, closed
  parentId: integer("parent_id").references(() => notifications.id), // for replies
  relatedEntityType: text("related_entity_type"), // item, warehouse, request, transfer
  relatedEntityId: integer("related_entity_id"),
  isArchived: boolean("is_archived").notNull().default(false),
  archivedAt: timestamp("archived_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  senderIdx: index("notifications_sender_idx").on(table.senderId),
  recipientIdx: index("notifications_recipient_idx").on(table.recipientId),
  statusIdx: index("notifications_status_idx").on(table.status),
  categoryIdx: index("notifications_category_idx").on(table.category),
  createdAtIdx: index("notifications_created_at_idx").on(table.createdAt),
}));

export const insertNotificationSchema = createInsertSchema(notifications).pick({
  senderId: true,
  recipientId: true,
  subject: true,
  message: true,
  category: true,
  priority: true,
  status: true,
  parentId: true,
  relatedEntityType: true,
  relatedEntityId: true,
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export type Location = typeof locations.$inferSelect;
export type InsertLocation = z.infer<typeof insertLocationSchema>;

// Audit logs table
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  action: text("action").notNull(), // CREATE, UPDATE, DELETE, LOGIN, LOGOUT, APPROVE, REJECT, TRANSFER, etc.
  entityType: text("entity_type").notNull(), // item, warehouse, request, transfer, user, etc.
  entityId: integer("entity_id"), // ID of the affected entity
  details: text("details").notNull(), // Human-readable description of the action
  oldValues: text("old_values"), // JSON string of previous values (for updates)
  newValues: text("new_values"), // JSON string of new values (for creates/updates)
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).pick({
  userId: true,
  action: true,
  entityType: true,
  entityId: true,
  details: true,
  oldValues: true,
  newValues: true,
  ipAddress: true,
  userAgent: true,
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

// Email Configuration table
export const emailSettings = pgTable("email_settings", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull(), // smtp, sendgrid, gmail, outlook, ses
  displayName: text("display_name").notNull(),
  host: text("host"), // SMTP host
  port: integer("port"), // SMTP port
  secure: boolean("secure").default(false), // Use TLS
  username: text("username"), // SMTP username or API key
  password: text("password"), // SMTP password or API secret
  fromEmail: text("from_email").notNull(),
  fromName: text("from_name").notNull(),
  isActive: boolean("is_active").notNull().default(false),
  isVerified: boolean("is_verified").notNull().default(false),
  verificationTestEmail: text("verification_test_email"),
  lastTestedAt: timestamp("last_tested_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  providerIdx: index("email_settings_provider_idx").on(table.provider),
  activeIdx: index("email_settings_active_idx").on(table.isActive),
  verifiedIdx: index("email_settings_verified_idx").on(table.isVerified),
}));

export const insertEmailSettingsSchema = createInsertSchema(emailSettings).pick({
  provider: true,
  displayName: true,
  host: true,
  port: true,
  secure: true,
  username: true,
  password: true,
  fromEmail: true,
  fromName: true,
  isActive: true,
  verificationTestEmail: true,
});

export type EmailSettings = typeof emailSettings.$inferSelect;
export type InsertEmailSettings = z.infer<typeof insertEmailSettingsSchema>;
