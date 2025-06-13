import { 
  User, 
  InsertUser, 
  Department,
  InsertDepartment,
  Location,
  InsertLocation,
  Category, 
  InsertCategory, 
  Warehouse, 
  InsertWarehouse, 
  Item, 
  InsertItem, 
  Inventory, 
  InsertInventory, 
  Transaction, 
  InsertTransaction, 
  Request, 
  InsertRequest, 
  RequestItem, 
  InsertRequestItem,
  ApprovalSettings,
  InsertApprovalSettings,
  RequestApproval,
  InsertRequestApproval,
  WarehouseOperator,
  InsertWarehouseOperator,
  TransferNotification,
  InsertTransferNotification,
  Transfer,
  InsertTransfer,
  TransferItem,
  InsertTransferItem,
  TransferUpdate,
  InsertTransferUpdate,
  TransactionType,
  RejectedGoods,
  InsertRejectedGoods,
  Notification,
  InsertNotification,
  Issue,
  InsertIssue,
  IssueActivity,
  InsertIssueActivity,
  AuditLog,
  InsertAuditLog,
  EmailSettings,
  InsertEmailSettings,
  users,
  departments,
  locations,
  categories,
  warehouses,
  items,
  inventory,
  transactions,
  requests,
  requestItems,
  approvalSettings,
  requestApprovals,
  warehouseOperators,
  transferNotifications,
  transfers,
  transferItems,
  transferUpdates,
  rejectedGoods,
  notifications,
  issues,
  issueActivities,
  auditLogs,
  emailSettings
} from "@shared/schema";
import session from "express-session";
import connectPg from "connect-pg-simple";
import createMemoryStore from "memorystore";
import { db, pool } from "./db";
import { eq, and, desc, or, ne } from "drizzle-orm";

const MemoryStore = createMemoryStore(session);
const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;

  // Department operations
  getDepartment(id: number): Promise<Department | undefined>;
  getDepartmentByName(name: string): Promise<Department | undefined>;
  createDepartment(department: InsertDepartment): Promise<Department>;
  getAllDepartments(): Promise<Department[]>;
  getActiveDepartments(): Promise<Department[]>;
  updateDepartment(id: number, departmentData: Partial<InsertDepartment>): Promise<Department | undefined>;
  deleteDepartment(id: number): Promise<boolean>;

  // Location operations
  getLocation(id: number): Promise<Location | undefined>;
  getLocationByName(name: string): Promise<Location | undefined>;
  createLocation(location: InsertLocation): Promise<Location>;
  getAllLocations(): Promise<Location[]>;
  updateLocation(id: number, locationData: Partial<InsertLocation>): Promise<Location | undefined>;
  deleteLocation(id: number): Promise<boolean>;

  // Warehouse operations
  getWarehouse(id: number): Promise<Warehouse | undefined>;
  getWarehouseByName(name: string): Promise<Warehouse | undefined>;
  createWarehouse(warehouse: InsertWarehouse): Promise<Warehouse>;
  getAllWarehouses(): Promise<Warehouse[]>;
  getActiveWarehouses(): Promise<Warehouse[]>;
  getWarehousesByManager(managerId: number): Promise<Warehouse[]>;
  updateWarehouse(id: number, warehouseData: Partial<InsertWarehouse>): Promise<Warehouse | undefined>;
  deleteWarehouse(id: number): Promise<boolean>;
  archiveWarehouse(id: number): Promise<Warehouse | undefined>;
  restoreWarehouse(id: number): Promise<Warehouse | undefined>;

  // Item operations
  getItem(id: number): Promise<Item | undefined>;
  getItemBySku(sku: string): Promise<Item | undefined>;
  createItem(item: InsertItem): Promise<Item>;
  getAllItems(): Promise<Item[]>;
  updateItem(id: number, itemData: Partial<InsertItem>): Promise<Item | undefined>;
  deleteItem(id: number): Promise<boolean>;

  // Inventory operations
  getInventory(id: number): Promise<Inventory | undefined>;
  getInventoryByItemAndWarehouse(itemId: number, warehouseId: number): Promise<Inventory | undefined>;
  createInventory(inventory: InsertInventory): Promise<Inventory>;
  getAllInventory(): Promise<Inventory[]>;
  getInventoryByWarehouse(warehouseId: number): Promise<Inventory[]>;
  updateInventory(id: number, inventoryData: Partial<InsertInventory>): Promise<Inventory | undefined>;
  updateInventoryQuantity(itemId: number, warehouseId: number, quantity: number): Promise<Inventory | undefined>;
  deleteInventory(id: number): Promise<boolean>;

  // Session store
  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool: pool,
      tableName: 'session'
    });
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined> {
    const [updatedUser] = await db.update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  async deleteUser(id: number): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Department operations
  async getDepartment(id: number): Promise<Department | undefined> {
    const [department] = await db.select().from(departments).where(eq(departments.id, id));
    return department;
  }

  async getDepartmentByName(name: string): Promise<Department | undefined> {
    const [department] = await db.select().from(departments).where(eq(departments.name, name));
    return department;
  }

  async createDepartment(department: InsertDepartment): Promise<Department> {
    const [newDepartment] = await db.insert(departments).values(department).returning();
    return newDepartment;
  }

  async getAllDepartments(): Promise<Department[]> {
    return await db.select().from(departments);
  }

  async getActiveDepartments(): Promise<Department[]> {
    return await db.select().from(departments).where(eq(departments.isActive, true));
  }

  async updateDepartment(id: number, departmentData: Partial<InsertDepartment>): Promise<Department | undefined> {
    const [updatedDepartment] = await db.update(departments)
      .set(departmentData)
      .where(eq(departments.id, id))
      .returning();
    return updatedDepartment;
  }

  async deleteDepartment(id: number): Promise<boolean> {
    const result = await db.delete(departments).where(eq(departments.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Location operations
  async getLocation(id: number): Promise<Location | undefined> {
    const [location] = await db.select().from(locations).where(eq(locations.id, id));
    return location;
  }

  async getLocationByName(name: string): Promise<Location | undefined> {
    const [location] = await db.select().from(locations).where(eq(locations.name, name));
    return location;
  }

  async createLocation(location: InsertLocation): Promise<Location> {
    const [newLocation] = await db.insert(locations).values(location).returning();
    return newLocation;
  }

  async getAllLocations(): Promise<Location[]> {
    return await db.select().from(locations);
  }

  async updateLocation(id: number, locationData: Partial<InsertLocation>): Promise<Location | undefined> {
    const [updatedLocation] = await db.update(locations)
      .set(locationData)
      .where(eq(locations.id, id))
      .returning();
    return updatedLocation;
  }

  async deleteLocation(id: number): Promise<boolean> {
    const result = await db.delete(locations).where(eq(locations.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Warehouse operations
  async getWarehouse(id: number): Promise<Warehouse | undefined> {
    const [warehouse] = await db.select().from(warehouses).where(eq(warehouses.id, id));
    return warehouse;
  }

  async getWarehouseByName(name: string): Promise<Warehouse | undefined> {
    const [warehouse] = await db.select().from(warehouses).where(eq(warehouses.name, name));
    return warehouse;
  }

  async createWarehouse(warehouse: InsertWarehouse): Promise<Warehouse> {
    const [newWarehouse] = await db.insert(warehouses).values(warehouse).returning();
    return newWarehouse;
  }

  async getAllWarehouses(): Promise<Warehouse[]> {
    return await db.select().from(warehouses);
  }

  async getActiveWarehouses(): Promise<Warehouse[]> {
    return await db.select().from(warehouses).where(eq(warehouses.isActive, true));
  }

  async getWarehousesByManager(managerId: number): Promise<Warehouse[]> {
    return await db.select().from(warehouses).where(eq(warehouses.managerId, managerId));
  }

  async updateWarehouse(id: number, warehouseData: Partial<InsertWarehouse>): Promise<Warehouse | undefined> {
    const [updatedWarehouse] = await db.update(warehouses)
      .set(warehouseData)
      .where(eq(warehouses.id, id))
      .returning();
    return updatedWarehouse;
  }

  async deleteWarehouse(id: number): Promise<boolean> {
    const result = await db.delete(warehouses).where(eq(warehouses.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async archiveWarehouse(id: number): Promise<Warehouse | undefined> {
    const [archivedWarehouse] = await db.update(warehouses)
      .set({ status: 'deleted', deletedAt: new Date() })
      .where(eq(warehouses.id, id))
      .returning();
    return archivedWarehouse;
  }

  async restoreWarehouse(id: number): Promise<Warehouse | undefined> {
    const [restoredWarehouse] = await db.update(warehouses)
      .set({ status: 'active', deletedAt: null })
      .where(eq(warehouses.id, id))
      .returning();
    return restoredWarehouse;
  }

  // Item operations
  async getItem(id: number): Promise<Item | undefined> {
    const [item] = await db.select().from(items).where(eq(items.id, id));
    return item;
  }

  async getItemBySku(sku: string): Promise<Item | undefined> {
    const [item] = await db.select().from(items).where(eq(items.sku, sku));
    return item;
  }

  async createItem(item: InsertItem): Promise<Item> {
    const [newItem] = await db.insert(items).values(item).returning();
    return newItem;
  }

  async getAllItems(): Promise<Item[]> {
    return await db.select().from(items);
  }

  async updateItem(id: number, itemData: Partial<InsertItem>): Promise<Item | undefined> {
    const [updatedItem] = await db.update(items)
      .set(itemData)
      .where(eq(items.id, id))
      .returning();
    return updatedItem;
  }

  async deleteItem(id: number): Promise<boolean> {
    const result = await db.delete(items).where(eq(items.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Inventory operations
  async getInventory(id: number): Promise<Inventory | undefined> {
    const [inv] = await db.select().from(inventory).where(eq(inventory.id, id));
    return inv;
  }

  async getInventoryByItemAndWarehouse(itemId: number, warehouseId: number): Promise<Inventory | undefined> {
    const [inv] = await db.select().from(inventory)
      .where(and(eq(inventory.itemId, itemId), eq(inventory.warehouseId, warehouseId)));
    return inv;
  }

  async createInventory(inv: InsertInventory): Promise<Inventory> {
    const [newInventory] = await db.insert(inventory).values(inv).returning();
    return newInventory;
  }

  async getAllInventory(): Promise<Inventory[]> {
    return await db.select().from(inventory);
  }

  async getInventoryByWarehouse(warehouseId: number): Promise<Inventory[]> {
    return await db.select().from(inventory).where(eq(inventory.warehouseId, warehouseId));
  }

  async updateInventory(id: number, inventoryData: Partial<InsertInventory>): Promise<Inventory | undefined> {
    const [updatedInventory] = await db.update(inventory)
      .set(inventoryData)
      .where(eq(inventory.id, id))
      .returning();
    return updatedInventory;
  }

  async updateInventoryQuantity(itemId: number, warehouseId: number, quantity: number): Promise<Inventory | undefined> {
    const [updatedInventory] = await db.update(inventory)
      .set({ quantity, lastUpdated: new Date() })
      .where(and(eq(inventory.itemId, itemId), eq(inventory.warehouseId, warehouseId)))
      .returning();
    return updatedInventory;
  }

  async deleteInventory(id: number): Promise<boolean> {
    const result = await db.delete(inventory).where(eq(inventory.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }
}

// Create a global storage instance
export const storage = new DatabaseStorage();