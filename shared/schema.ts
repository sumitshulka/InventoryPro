import { pgTable, text, serial, integer, boolean, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull().default("user"),
  warehouseId: integer("warehouse_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  name: true,
  email: true,
  role: true,
  warehouseId: true,
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
  manager: text("manager"),
  capacity: integer("capacity").notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

export const insertWarehouseSchema = createInsertSchema(warehouses).pick({
  name: true,
  location: true,
  manager: true,
  capacity: true,
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
  status: text("status").notNull().default("completed"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  transactionCode: true,
  userId: true,
  createdAt: true,
  completedAt: true,
});

// Inventory requests
export const requests = pgTable("requests", {
  id: serial("id").primaryKey(),
  requestCode: text("request_code").notNull().unique(),
  userId: integer("user_id").notNull(),
  warehouseId: integer("warehouse_id").notNull(),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
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
