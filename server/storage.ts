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
import { eq, and, desc, or, ne, sql } from "drizzle-orm";

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

  // Transaction operations
  async getTransaction(id: number): Promise<Transaction | undefined> {
    const [transaction] = await db.select().from(transactions).where(eq(transactions.id, id));
    return transaction;
  }

  async getTransactionByCode(code: string): Promise<Transaction | undefined> {
    const [transaction] = await db.select().from(transactions).where(eq(transactions.transactionCode, code));
    return transaction;
  }

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const [newTransaction] = await db.insert(transactions).values([transaction]).returning();
    return newTransaction;
  }

  async getAllTransactions(): Promise<Transaction[]> {
    return await db.select().from(transactions);
  }

  async getTransactionsByType(type: TransactionType): Promise<Transaction[]> {
    return await db.select().from(transactions).where(eq(transactions.transactionType, type));
  }

  async getTransactionsByWarehouse(warehouseId: number): Promise<Transaction[]> {
    return await db.select().from(transactions)
      .where(or(eq(transactions.sourceWarehouseId, warehouseId), eq(transactions.destinationWarehouseId, warehouseId)));
  }

  async updateTransaction(id: number, transactionData: Partial<InsertTransaction>): Promise<Transaction | undefined> {
    const [updatedTransaction] = await db.update(transactions)
      .set(transactionData)
      .where(eq(transactions.id, id))
      .returning();
    return updatedTransaction;
  }

  async deleteTransaction(id: number): Promise<boolean> {
    const result = await db.delete(transactions).where(eq(transactions.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Request operations
  async getRequest(id: number): Promise<Request | undefined> {
    const [request] = await db.select().from(requests).where(eq(requests.id, id));
    return request;
  }

  async getRequestByCode(code: string): Promise<Request | undefined> {
    const [request] = await db.select().from(requests).where(eq(requests.requestCode, code));
    return request;
  }

  async createRequest(request: InsertRequest): Promise<Request> {
    const [newRequest] = await db.insert(requests).values([request]).returning();
    return newRequest;
  }

  async getAllRequests(): Promise<Request[]> {
    return await db.select().from(requests);
  }

  async getRequestsByStatus(status: string): Promise<Request[]> {
    return await db.select().from(requests).where(eq(requests.status, status));
  }

  async getRequestsByUser(userId: number): Promise<Request[]> {
    return await db.select().from(requests).where(eq(requests.userId, userId));
  }

  async updateRequest(id: number, requestData: Partial<InsertRequest>): Promise<Request | undefined> {
    const [updatedRequest] = await db.update(requests)
      .set(requestData)
      .where(eq(requests.id, id))
      .returning();
    return updatedRequest;
  }

  async deleteRequest(id: number): Promise<boolean> {
    const result = await db.delete(requests).where(eq(requests.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Request Item operations
  async getRequestItem(id: number): Promise<RequestItem | undefined> {
    const [requestItem] = await db.select().from(requestItems).where(eq(requestItems.id, id));
    return requestItem;
  }

  async getRequestItemsByRequest(requestId: number): Promise<RequestItem[]> {
    return await db.select().from(requestItems).where(eq(requestItems.requestId, requestId));
  }

  async createRequestItem(requestItem: InsertRequestItem): Promise<RequestItem> {
    const [newRequestItem] = await db.insert(requestItems).values(requestItem).returning();
    return newRequestItem;
  }

  async updateRequestItem(id: number, requestItemData: Partial<InsertRequestItem>): Promise<RequestItem | undefined> {
    const [updatedRequestItem] = await db.update(requestItems)
      .set(requestItemData)
      .where(eq(requestItems.id, id))
      .returning();
    return updatedRequestItem;
  }

  async deleteRequestItem(id: number): Promise<boolean> {
    const result = await db.delete(requestItems).where(eq(requestItems.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Request Approval operations
  async getRequestApproval(id: number): Promise<RequestApproval | undefined> {
    const [approval] = await db.select().from(requestApprovals).where(eq(requestApprovals.id, id));
    return approval;
  }

  async getRequestApprovalsByRequest(requestId: number): Promise<RequestApproval[]> {
    return await db.select().from(requestApprovals).where(eq(requestApprovals.requestId, requestId));
  }

  async getRequestApprovalsByApprover(approverId: number): Promise<RequestApproval[]> {
    return await db.select().from(requestApprovals).where(eq(requestApprovals.approverId, approverId));
  }

  async createRequestApproval(approval: InsertRequestApproval): Promise<RequestApproval> {
    const [newApproval] = await db.insert(requestApprovals).values(approval).returning();
    return newApproval;
  }

  async updateRequestApproval(id: number, approvalData: Partial<InsertRequestApproval>): Promise<RequestApproval | undefined> {
    const [updatedApproval] = await db.update(requestApprovals)
      .set(approvalData)
      .where(eq(requestApprovals.id, id))
      .returning();
    return updatedApproval;
  }

  async deleteRequestApproval(id: number): Promise<boolean> {
    const result = await db.delete(requestApprovals).where(eq(requestApprovals.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Category operations
  async getCategory(id: number): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.id, id));
    return category;
  }

  async getCategoryByName(name: string): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.name, name));
    return category;
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [newCategory] = await db.insert(categories).values(category).returning();
    return newCategory;
  }

  async getAllCategories(): Promise<Category[]> {
    return await db.select().from(categories);
  }

  async updateCategory(id: number, categoryData: Partial<InsertCategory>): Promise<Category | undefined> {
    const [updatedCategory] = await db.update(categories)
      .set(categoryData)
      .where(eq(categories.id, id))
      .returning();
    return updatedCategory;
  }

  async deleteCategory(id: number): Promise<boolean> {
    const result = await db.delete(categories).where(eq(categories.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Additional methods needed by routes
  async getActiveUsers(): Promise<User[]> {
    return await db.select().from(users).where(eq(users.isActive, true));
  }

  async createAuditLog(auditLog: InsertAuditLog): Promise<AuditLog> {
    const [newAuditLog] = await db.insert(auditLogs).values(auditLog).returning();
    return newAuditLog;
  }

  async getUserManager(userId: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user?.managerId) return undefined;
    return await this.getUser(user.managerId);
  }

  async canApproveRequest(userId: number, requestId: number): Promise<boolean> {
    // Simple implementation - can be enhanced based on business rules
    const user = await this.getUser(userId);
    return user?.role === 'admin' || user?.role === 'manager';
  }

  async createTransferNotification(notification: InsertTransferNotification): Promise<TransferNotification> {
    const [newNotification] = await db.insert(transferNotifications).values(notification).returning();
    return newNotification;
  }

  async getPendingTransferNotifications(): Promise<TransferNotification[]> {
    return await db.select().from(transferNotifications).where(eq(transferNotifications.status, 'pending'));
  }

  async getTransferNotificationsByWarehouse(warehouseId: number): Promise<TransferNotification[]> {
    return await db.select().from(transferNotifications).where(eq(transferNotifications.warehouseId, warehouseId));
  }

  async updateTransferNotification(id: number, data: Partial<InsertTransferNotification>): Promise<TransferNotification | undefined> {
    const [updated] = await db.update(transferNotifications)
      .set(data)
      .where(eq(transferNotifications.id, id))
      .returning();
    return updated;
  }

  // Approval Settings operations
  async getApprovalSettings(id: number): Promise<ApprovalSettings | undefined> {
    const [settings] = await db.select().from(approvalSettings).where(eq(approvalSettings.id, id));
    return settings;
  }

  async getApprovalSettingsByType(requestType: string): Promise<ApprovalSettings[]> {
    return await db.select().from(approvalSettings).where(eq(approvalSettings.requestType, requestType));
  }

  async createApprovalSettings(settings: InsertApprovalSettings): Promise<ApprovalSettings> {
    const [newSettings] = await db.insert(approvalSettings).values(settings).returning();
    return newSettings;
  }

  async getAllApprovalSettings(): Promise<ApprovalSettings[]> {
    return await db.select().from(approvalSettings);
  }

  async updateApprovalSettings(id: number, settingsData: Partial<InsertApprovalSettings>): Promise<ApprovalSettings | undefined> {
    const [updatedSettings] = await db.update(approvalSettings)
      .set(settingsData)
      .where(eq(approvalSettings.id, id))
      .returning();
    return updatedSettings;
  }

  async deleteApprovalSettings(id: number): Promise<boolean> {
    const result = await db.delete(approvalSettings).where(eq(approvalSettings.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Warehouse Operator operations
  async getWarehouseOperator(id: number): Promise<WarehouseOperator | undefined> {
    const [operator] = await db.select().from(warehouseOperators).where(eq(warehouseOperators.id, id));
    return operator;
  }

  async getWarehouseOperatorsByUser(userId: number): Promise<WarehouseOperator[]> {
    return await db.select().from(warehouseOperators).where(eq(warehouseOperators.userId, userId));
  }

  async getWarehouseOperatorsByWarehouse(warehouseId: number): Promise<WarehouseOperator[]> {
    return await db.select().from(warehouseOperators).where(eq(warehouseOperators.warehouseId, warehouseId));
  }

  async getAllWarehouseOperators(): Promise<WarehouseOperator[]> {
    return await db.select().from(warehouseOperators);
  }

  async createWarehouseOperator(operator: InsertWarehouseOperator): Promise<WarehouseOperator> {
    const [newOperator] = await db.insert(warehouseOperators).values(operator).returning();
    return newOperator;
  }

  async updateWarehouseOperator(id: number, operatorData: Partial<InsertWarehouseOperator>): Promise<WarehouseOperator | undefined> {
    const [updatedOperator] = await db.update(warehouseOperators)
      .set(operatorData)
      .where(eq(warehouseOperators.id, id))
      .returning();
    return updatedOperator;
  }

  async deleteWarehouseOperator(id: number): Promise<boolean> {
    const result = await db.delete(warehouseOperators).where(eq(warehouseOperators.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Helper method for user hierarchy
  async getUserHierarchy(userId: number): Promise<User[]> {
    const hierarchy: User[] = [];
    let currentUser = await this.getUser(userId);
    
    while (currentUser) {
      hierarchy.push(currentUser);
      if (currentUser.managerId) {
        currentUser = await this.getUser(currentUser.managerId);
      } else {
        break;
      }
    }
    
    return hierarchy;
  }

  // Additional missing methods for complete functionality
  async getUserOperatedWarehouses(userId: number): Promise<Warehouse[]> {
    const operators = await this.getWarehouseOperatorsByUser(userId);
    const warehouses: Warehouse[] = [];
    for (const operator of operators) {
      const warehouse = await this.getWarehouse(operator.warehouseId);
      if (warehouse) warehouses.push(warehouse);
    }
    return warehouses;
  }

  async isUserWarehouseOperator(userId: number, warehouseId: number): Promise<boolean> {
    const operators = await this.getWarehouseOperatorsByUser(userId);
    return operators.some(op => op.warehouseId === warehouseId && op.isActive);
  }

  // Stub implementations for complex methods that need full implementation
  async getAllRejectedGoods(): Promise<RejectedGoods[]> {
    return await db.select().from(rejectedGoods);
  }

  async getRejectedGoodsByWarehouse(warehouseId: number): Promise<RejectedGoods[]> {
    return await db.select().from(rejectedGoods).where(eq(rejectedGoods.warehouseId, warehouseId));
  }

  async updateRejectedGoods(id: number, data: Partial<InsertRejectedGoods>): Promise<RejectedGoods | undefined> {
    const [updated] = await db.update(rejectedGoods)
      .set(data)
      .where(eq(rejectedGoods.id, id))
      .returning();
    return updated;
  }

  // Transfer-related methods
  async getTransfer(id: number): Promise<Transfer | undefined> {
    const [transfer] = await db.select().from(transfers).where(eq(transfers.id, id));
    return transfer;
  }

  async getAllTransfers(): Promise<Transfer[]> {
    return await db.select().from(transfers);
  }

  async getTransfersByStatus(status: string): Promise<Transfer[]> {
    return await db.select().from(transfers).where(eq(transfers.status, status));
  }

  async createTransfer(transfer: InsertTransfer): Promise<Transfer> {
    const [newTransfer] = await db.insert(transfers).values([transfer]).returning();
    return newTransfer;
  }

  async updateTransfer(id: number, data: Partial<InsertTransfer>): Promise<Transfer | undefined> {
    const [updated] = await db.update(transfers)
      .set(data)
      .where(eq(transfers.id, id))
      .returning();
    return updated;
  }

  async getTransferItemsByTransfer(transferId: number): Promise<TransferItem[]> {
    return await db.select().from(transferItems).where(eq(transferItems.transferId, transferId));
  }

  async createTransferItem(item: InsertTransferItem): Promise<TransferItem> {
    const [newItem] = await db.insert(transferItems).values([item]).returning();
    return newItem;
  }

  async getTransferUpdatesByTransfer(transferId: number): Promise<TransferUpdate[]> {
    return await db.select().from(transferUpdates).where(eq(transferUpdates.transferId, transferId));
  }

  async createTransferUpdate(update: InsertTransferUpdate): Promise<TransferUpdate> {
    const [newUpdate] = await db.insert(transferUpdates).values([update]).returning();
    return newUpdate;
  }

  // Simplified implementations for complex business logic methods
  async approveReturn(transferId: number, userId: number): Promise<boolean> {
    await this.updateTransfer(transferId, { status: 'return_approved', approvedBy: userId });
    return true;
  }

  async approveDisposal(transferId: number, userId: number): Promise<boolean> {
    await this.updateTransfer(transferId, { status: 'disposal_approved', approvedBy: userId });
    return true;
  }

  async recordReturnShipment(transferId: number, data: any): Promise<boolean> {
    await this.updateTransfer(transferId, { status: 'return_shipped', ...data });
    return true;
  }

  async recordReturnDelivery(transferId: number, data: any): Promise<boolean> {
    await this.updateTransfer(transferId, { status: 'return_delivered', ...data });
    return true;
  }

  // Issues operations
  async getAllIssues(): Promise<any[]> {
    try {
      const result = await db.select().from(issues).orderBy(desc(issues.createdAt));
      return result;
    } catch (error) {
      console.error('Error fetching issues:', error);
      return [];
    }
  }

  async createIssue(issue: any): Promise<any> {
    try {
      const result = await db.insert(issues).values({
        title: issue.title,
        description: issue.description,
        category: issue.category,
        priority: issue.priority,
        reporterId: issue.reporterId,
        warehouseId: issue.warehouseId || null,
        itemId: issue.itemId || null,
        status: 'open'
      }).returning();
      return result[0];
    } catch (error) {
      console.error('Error creating issue:', error);
      throw error;
    }
  }

  async updateIssue(id: number, data: any): Promise<any> {
    try {
      const result = await db.update(issues)
        .set({ status: data.status, updatedAt: new Date() })
        .where(eq(issues.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error updating issue:', error);
      throw error;
    }
  }

  async getIssue(id: number): Promise<any> {
    try {
      const result = await db.select().from(issues).where(eq(issues.id, id));
      return result[0];
    } catch (error) {
      console.error('Error fetching issue:', error);
      return null;
    }
  }

  async deleteIssue(id: number): Promise<boolean> {
    try {
      await db.delete(issues).where(eq(issues.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting issue:', error);
      return false;
    }
  }

  // Notifications operations
  async getNotificationsByRecipient(recipientId: number): Promise<any[]> {
    try {
      const result = await db.select().from(notifications)
        .where(eq(notifications.recipientId, recipientId))
        .orderBy(desc(notifications.createdAt));
      return result;
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }
  }

  async getUnreadNotificationCount(userId: number): Promise<number> {
    try {
      const result = await db.select({ count: sql<number>`count(*)` })
        .from(notifications)
        .where(and(eq(notifications.recipientId, userId), eq(notifications.status, 'unread')));
      return result[0]?.count || 0;
    } catch (error) {
      console.error('Error fetching unread count:', error);
      return 0;
    }
  }

  async createNotification(notification: any): Promise<any> {
    try {
      const result = await db.insert(notifications).values({
        senderId: notification.senderId,
        recipientId: notification.recipientId,
        subject: notification.subject,
        message: notification.message,
        category: notification.category,
        priority: notification.priority,
        status: 'unread'
      }).returning();
      return result[0];
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  async markNotificationAsRead(id: number): Promise<any> {
    try {
      const result = await db.update(notifications)
        .set({ status: 'read', readAt: new Date() })
        .where(eq(notifications.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }
}

// Create a global storage instance
export const storage = new DatabaseStorage();