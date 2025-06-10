import { pgTable, text, serial, integer, boolean, timestamp, unique, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Departments table
export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  managerId: integer("manager_id"),
  isActive: boolean("is_active").notNull().default(true),
});

export const insertDepartmentSchema = createInsertSchema(departments).pick({
  name: true,
  description: true,
  managerId: true,
  isActive: true,
});

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
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  name: true,
  email: true,
  role: true,
  managerId: true,
  warehouseId: true,
  departmentId: true,
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
  location: text("location").notNull(),
  managerId: integer("manager_id").references(() => users.id),
  capacity: integer("capacity").notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

export const insertWarehouseSchema = createInsertSchema(warehouses).pick({
  name: true,
  location: true,
  managerId: true,
  capacity: true,
  isActive: true,
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
});

export const insertItemSchema = createInsertSchema(items).pick({
  name: true,
  sku: true,
  description: true,
  minStockLevel: true,
  categoryId: true,
  unit: true,
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
  checkInDate: timestamp("check_in_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const insertTransactionSchema = createInsertSchema(transactions)
  .omit({
    id: true,
    transactionCode: true,
    userId: true,
    createdAt: true,
    completedAt: true,
  })
  .extend({
    cost: z.preprocess((arg) => {
      if (typeof arg === 'number') return arg.toString();
      return arg;
    }, z.string().optional()),
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
});

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
});

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
  currency: text("currency").notNull().default("USD"),
  currencySymbol: text("currency_symbol").notNull().default("$"),
  timezone: text("timezone").notNull().default("UTC"),
  defaultUnits: text("default_units").array().notNull().default(["pcs", "boxes", "reams", "kg", "liters"]),
  allowedCategories: text("allowed_categories").array().notNull().default(["Electronics", "Office Supplies", "Furniture"]),
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
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at"),
});

export const insertTransferSchema = createInsertSchema(transfers).omit({
  id: true,
  transferCode: true,
  createdAt: true,
  updatedAt: true,
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
