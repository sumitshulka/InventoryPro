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
  Notification,
  InsertNotification,
  Issue,
  InsertIssue,
  IssueActivity,
  InsertIssueActivity,
  EmailSettings,
  InsertEmailSettings,
  TransferItem,
  InsertTransferItem,
  RejectedGoods,
  InsertRejectedGoods,
  InsertTransfer,
  TransferUpdate,
  InsertTransferUpdate,
  TransactionType,
  AuditLog,
  InsertAuditLog,
  Client,
  InsertClient,
  SalesOrder,
  InsertSalesOrder,
  SalesOrderItem,
  InsertSalesOrderItem,
  SalesOrderApproval,
  InsertSalesOrderApproval,
  SalesOrderDispatch,
  InsertSalesOrderDispatch,
  SalesOrderDispatchItem,
  InsertSalesOrderDispatchItem,
  AuditManagerWarehouse,
  InsertAuditManagerWarehouse,
  AuditTeamMember,
  InsertAuditTeamMember,
  AuditSession,
  InsertAuditSession,
  AuditVerification,
  InsertAuditVerification,
  AuditReconciliation,
  InsertAuditReconciliation,
  AuditApproval,
  InsertAuditApproval,
  AuditActionLog,
  InsertAuditActionLog,
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
  emailSettings,
  clients,
  salesOrders,
  salesOrderItems,
  salesOrderApprovals,
  salesOrderDispatches,
  salesOrderDispatchItems,
  organizationSettings,
  auditManagerWarehouses,
  auditTeamMembers,
  auditSessions,
  auditVerifications,
  auditReconciliations,
  auditApprovals,
  auditActionLogs
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

  // Notification operations
  getNotificationsByRecipient(recipientId: number): Promise<any[]>;
  getUnreadNotificationCount(userId: number): Promise<number>;
  createNotification(notification: any): Promise<any>;
  markNotificationAsRead(id: number): Promise<any>;
  getNotificationsByCategory(userId: number, category: string): Promise<any[]>;
  getNotificationThread(notificationId: number): Promise<any[]>;
  getNotification(id: number): Promise<any>;
  markNotificationAsReplied(id: number): Promise<any>;
  markNotificationAsClosed(id: number): Promise<any>;
  archiveNotification(id: number): Promise<any>;
  cleanupArchivedNotifications(): Promise<void>;

  // Issue operations
  closeIssue(id: number, userId: number, resolutionNotes: string): Promise<any>;
  reopenIssue(id: number, userId: number): Promise<any>;
  getIssueActivityWithUser(issueId: number): Promise<any[]>;

  // Email settings operations
  getEmailSettings(): Promise<any>;
  createEmailSettings(settings: any): Promise<any>;
  updateEmailSettings(id: number, settings: any): Promise<any>;
  markEmailSettingsAsVerified(id: number): Promise<any>;
  deleteEmailSettings(id: number): Promise<boolean>;

  // Organization settings operations
  getOrganizationSettings(): Promise<any>;

  // User operations extensions
  getUserById(id: number): Promise<any>;
  updateUserStatus(id: number, isActive: boolean): Promise<any>;

  // Transfer operations extensions
  updateTransferItem(id: number, data: any): Promise<any>;
  createRejectedGoods(data: any): Promise<any>;

  // Client operations
  getClient(id: number): Promise<Client | undefined>;
  getClientByCode(code: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  getAllClients(): Promise<Client[]>;
  getActiveClients(): Promise<Client[]>;
  updateClient(id: number, clientData: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(id: number): Promise<boolean>;
  getNextClientCode(): Promise<string>;

  // Sales Order operations
  getSalesOrder(id: number): Promise<SalesOrder | undefined>;
  getSalesOrderByCode(code: string): Promise<SalesOrder | undefined>;
  createSalesOrder(order: InsertSalesOrder): Promise<SalesOrder>;
  getAllSalesOrders(): Promise<SalesOrder[]>;
  getSalesOrdersByWarehouse(warehouseId: number): Promise<SalesOrder[]>;
  getSalesOrdersByUser(userId: number): Promise<SalesOrder[]>;
  getSalesOrdersByStatus(status: string): Promise<SalesOrder[]>;
  updateSalesOrder(id: number, orderData: Partial<InsertSalesOrder>): Promise<SalesOrder | undefined>;
  deleteSalesOrder(id: number): Promise<boolean>;
  getNextSalesOrderCode(): Promise<string>;

  // Sales Order Items operations
  getSalesOrderItem(id: number): Promise<SalesOrderItem | undefined>;
  getSalesOrderItemsByOrder(orderId: number): Promise<SalesOrderItem[]>;
  createSalesOrderItem(item: InsertSalesOrderItem): Promise<SalesOrderItem>;
  updateSalesOrderItem(id: number, itemData: Partial<InsertSalesOrderItem>): Promise<SalesOrderItem | undefined>;
  deleteSalesOrderItem(id: number): Promise<boolean>;
  deleteSalesOrderItemsByOrder(orderId: number): Promise<boolean>;

  // Sales Order Approval operations
  getSalesOrderApproval(id: number): Promise<SalesOrderApproval | undefined>;
  getSalesOrderApprovalsByOrder(orderId: number): Promise<SalesOrderApproval[]>;
  getPendingSalesOrderApprovals(approverId: number): Promise<SalesOrderApproval[]>;
  getAllPendingSalesOrderApprovals(): Promise<SalesOrderApproval[]>;
  createSalesOrderApproval(approval: InsertSalesOrderApproval): Promise<SalesOrderApproval>;
  updateSalesOrderApproval(id: number, approvalData: Partial<InsertSalesOrderApproval>): Promise<SalesOrderApproval | undefined>;

  // Sales Order Dispatch operations
  getSalesOrderDispatch(id: number): Promise<SalesOrderDispatch | undefined>;
  getSalesOrderDispatchesByOrder(orderId: number): Promise<SalesOrderDispatch[]>;
  createSalesOrderDispatch(dispatch: InsertSalesOrderDispatch): Promise<SalesOrderDispatch>;
  updateSalesOrderDispatch(id: number, dispatchData: Partial<InsertSalesOrderDispatch>): Promise<SalesOrderDispatch | undefined>;
  getNextDispatchCode(): Promise<string>;

  // Dispatch Items operations
  getDispatchItemsByDispatch(dispatchId: number): Promise<SalesOrderDispatchItem[]>;
  createDispatchItem(item: InsertSalesOrderDispatchItem): Promise<SalesOrderDispatchItem>;

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
  async approveReturn(transferId: number, returnReason: string, userId: number): Promise<any> {
    const updatedTransfer = await this.updateTransfer(transferId, { 
      status: 'return_approved', 
      returnReason,
      approvedBy: userId,
      updatedAt: new Date()
    });
    return updatedTransfer;
  }

  async approveDisposal(transferId: number, disposalReason: string, userId: number): Promise<any> {
    const updatedTransfer = await this.updateTransfer(transferId, { 
      status: 'disposed', 
      disposalReason,
      disposalDate: new Date(),
      approvedBy: userId,
      updatedAt: new Date()
    });
    return updatedTransfer;
  }

  async recordReturnShipment(transferId: number, courierName: string, trackingNumber: string, userId: number): Promise<any> {
    const updatedTransfer = await this.updateTransfer(transferId, { 
      status: 'return_shipped',
      returnCourierName: courierName,
      returnTrackingNumber: trackingNumber,
      returnShippedDate: new Date(),
      updatedAt: new Date()
    });
    return updatedTransfer;
  }

  async recordReturnDelivery(transferId: number, userId: number): Promise<any> {
    const updatedTransfer = await this.updateTransfer(transferId, { 
      status: 'returned',
      returnDeliveredDate: new Date(),
      receivedBy: userId,
      updatedAt: new Date()
    });
    return updatedTransfer;
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
        .set({ status: 'read', updatedAt: new Date() })
        .where(eq(notifications.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  async getNotificationsByCategory(userId: number, category: string): Promise<any[]> {
    try {
      const result = await db.select()
        .from(notifications)
        .where(and(eq(notifications.recipientId, userId), eq(notifications.category, category)))
        .orderBy(desc(notifications.createdAt));
      return result;
    } catch (error) {
      console.error('Error fetching notifications by category:', error);
      return [];
    }
  }

  async getNotificationThread(notificationId: number): Promise<any[]> {
    try {
      const notification = await db.select()
        .from(notifications)
        .where(eq(notifications.id, notificationId));
      
      if (!notification.length) return [];
      
      const rootId = notification[0].parentId || notificationId;
      
      const result = await db.select()
        .from(notifications)
        .where(or(eq(notifications.id, rootId), eq(notifications.parentId, rootId)))
        .orderBy(notifications.createdAt);
      return result;
    } catch (error) {
      console.error('Error fetching notification thread:', error);
      return [];
    }
  }

  async getNotification(id: number): Promise<any> {
    try {
      const result = await db.select()
        .from(notifications)
        .where(eq(notifications.id, id));
      return result[0];
    } catch (error) {
      console.error('Error fetching notification:', error);
      throw error;
    }
  }

  async markNotificationAsReplied(id: number): Promise<any> {
    try {
      const result = await db.update(notifications)
        .set({ status: 'replied', updatedAt: new Date() })
        .where(eq(notifications.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error marking notification as replied:', error);
      throw error;
    }
  }

  async markNotificationAsClosed(id: number): Promise<any> {
    try {
      const result = await db.update(notifications)
        .set({ status: 'closed', updatedAt: new Date() })
        .where(eq(notifications.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error marking notification as closed:', error);
      throw error;
    }
  }

  async archiveNotification(id: number): Promise<any> {
    try {
      const result = await db.update(notifications)
        .set({ isArchived: true, archivedAt: new Date(), updatedAt: new Date() })
        .where(eq(notifications.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error archiving notification:', error);
      throw error;
    }
  }

  async cleanupArchivedNotifications(): Promise<void> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      await db.delete(notifications)
        .where(and(eq(notifications.isArchived, true), lt(notifications.archivedAt, thirtyDaysAgo)));
    } catch (error) {
      console.error('Error cleaning up archived notifications:', error);
    }
  }

  async closeIssue(id: number, userId: number, resolutionNotes: string): Promise<any> {
    try {
      const result = await db.update(issues)
        .set({ 
          status: 'closed', 
          closedBy: userId, 
          closedAt: new Date(),
          resolutionNotes: resolutionNotes,
          updatedAt: new Date()
        })
        .where(eq(issues.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error closing issue:', error);
      throw error;
    }
  }

  async reopenIssue(id: number, userId: number): Promise<any> {
    try {
      const result = await db.update(issues)
        .set({ 
          status: 'open', 
          reopenedBy: userId, 
          reopenedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(issues.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error reopening issue:', error);
      throw error;
    }
  }

  async getIssueActivityWithUser(issueId: number): Promise<any[]> {
    try {
      const result = await db.select({
        id: issueActivities.id,
        action: issueActivities.action,
        previousValue: issueActivities.previousValue,
        newValue: issueActivities.newValue,
        comment: issueActivities.comment,
        createdAt: issueActivities.createdAt,
        user: {
          id: users.id,
          name: users.name,
          username: users.username
        }
      })
      .from(issueActivities)
      .leftJoin(users, eq(issueActivities.userId, users.id))
      .where(eq(issueActivities.issueId, issueId))
      .orderBy(issueActivities.createdAt);
      return result;
    } catch (error) {
      console.error('Error fetching issue activities:', error);
      return [];
    }
  }

  async getEmailSettings(): Promise<any> {
    try {
      const result = await db.select()
        .from(emailSettings)
        .where(eq(emailSettings.isActive, true))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error('Error fetching email settings:', error);
      return null;
    }
  }

  async createEmailSettings(settings: any): Promise<any> {
    try {
      const result = await db.insert(emailSettings).values(settings).returning();
      return result[0];
    } catch (error) {
      console.error('Error creating email settings:', error);
      throw error;
    }
  }

  async updateEmailSettings(id: number, settings: any): Promise<any> {
    try {
      const result = await db.update(emailSettings)
        .set({ ...settings, updatedAt: new Date() })
        .where(eq(emailSettings.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error updating email settings:', error);
      throw error;
    }
  }

  async markEmailSettingsAsVerified(id: number): Promise<any> {
    try {
      const result = await db.update(emailSettings)
        .set({ isVerified: true, lastTestedAt: new Date(), updatedAt: new Date() })
        .where(eq(emailSettings.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error marking email settings as verified:', error);
      throw error;
    }
  }

  async deleteEmailSettings(id: number): Promise<boolean> {
    try {
      const result = await db.delete(emailSettings).where(eq(emailSettings.id, id));
      return result.rowCount ? result.rowCount > 0 : false;
    } catch (error) {
      console.error('Error deleting email settings:', error);
      return false;
    }
  }

  async getOrganizationSettings(): Promise<any> {
    try {
      const [settings] = await db.select().from(organizationSettings).limit(1);
      return settings;
    } catch (error) {
      console.error('Error fetching organization settings:', error);
      return null;
    }
  }

  async getUserById(id: number): Promise<any> {
    return this.getUser(id);
  }

  async updateUserStatus(id: number, isActive: boolean): Promise<any> {
    try {
      const result = await db.update(users)
        .set({ isActive })
        .where(eq(users.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error updating user status:', error);
      throw error;
    }
  }

  async updateTransferItem(id: number, data: any): Promise<any> {
    try {
      const result = await db.update(transferItems)
        .set(data)
        .where(eq(transferItems.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error updating transfer item:', error);
      throw error;
    }
  }

  async createRejectedGoods(data: any): Promise<any> {
    try {
      const result = await db.insert(rejectedGoods).values(data).returning();
      return result[0];
    } catch (error) {
      console.error('Error creating rejected goods:', error);
      throw error;
    }
  }

  // ==================== CLIENT OPERATIONS ====================

  async getClient(id: number): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client;
  }

  async getClientByCode(code: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.clientCode, code));
    return client;
  }

  async createClient(client: InsertClient): Promise<Client> {
    const [newClient] = await db.insert(clients).values(client).returning();
    return newClient;
  }

  async getAllClients(): Promise<Client[]> {
    return await db.select().from(clients).orderBy(desc(clients.createdAt));
  }

  async getActiveClients(): Promise<Client[]> {
    return await db.select().from(clients).where(eq(clients.isActive, true)).orderBy(clients.companyName);
  }

  async updateClient(id: number, clientData: Partial<InsertClient>): Promise<Client | undefined> {
    const [updatedClient] = await db.update(clients)
      .set({ ...clientData, updatedAt: new Date() })
      .where(eq(clients.id, id))
      .returning();
    return updatedClient;
  }

  async deleteClient(id: number): Promise<boolean> {
    const result = await db.delete(clients).where(eq(clients.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getNextClientCode(): Promise<string> {
    const result = await db.select({ maxId: sql<number>`COALESCE(MAX(id), 0)` }).from(clients);
    const nextNum = (result[0]?.maxId || 0) + 1;
    return `CLI-${nextNum.toString().padStart(4, '0')}`;
  }

  // ==================== SALES ORDER OPERATIONS ====================

  async getSalesOrder(id: number): Promise<SalesOrder | undefined> {
    const [order] = await db.select().from(salesOrders).where(eq(salesOrders.id, id));
    return order;
  }

  async getSalesOrderByCode(code: string): Promise<SalesOrder | undefined> {
    const [order] = await db.select().from(salesOrders).where(eq(salesOrders.orderCode, code));
    return order;
  }

  async createSalesOrder(order: InsertSalesOrder): Promise<SalesOrder> {
    const [newOrder] = await db.insert(salesOrders).values(order).returning();
    return newOrder;
  }

  async getAllSalesOrders(): Promise<SalesOrder[]> {
    return await db.select().from(salesOrders).orderBy(desc(salesOrders.createdAt));
  }

  async getSalesOrdersByWarehouse(warehouseId: number): Promise<SalesOrder[]> {
    return await db.select().from(salesOrders)
      .where(eq(salesOrders.warehouseId, warehouseId))
      .orderBy(desc(salesOrders.createdAt));
  }

  async getSalesOrdersByUser(userId: number): Promise<SalesOrder[]> {
    return await db.select().from(salesOrders)
      .where(eq(salesOrders.createdBy, userId))
      .orderBy(desc(salesOrders.createdAt));
  }

  async getSalesOrdersByStatus(status: string): Promise<SalesOrder[]> {
    return await db.select().from(salesOrders)
      .where(eq(salesOrders.status, status))
      .orderBy(desc(salesOrders.createdAt));
  }

  async updateSalesOrder(id: number, orderData: Partial<InsertSalesOrder>): Promise<SalesOrder | undefined> {
    const [updatedOrder] = await db.update(salesOrders)
      .set({ ...orderData, updatedAt: new Date() })
      .where(eq(salesOrders.id, id))
      .returning();
    return updatedOrder;
  }

  async deleteSalesOrder(id: number): Promise<boolean> {
    // First delete related items, approvals, dispatches
    await db.delete(salesOrderItems).where(eq(salesOrderItems.salesOrderId, id));
    await db.delete(salesOrderApprovals).where(eq(salesOrderApprovals.salesOrderId, id));
    // Get dispatches and delete dispatch items first
    const dispatchesToDelete = await db.select().from(salesOrderDispatches).where(eq(salesOrderDispatches.salesOrderId, id));
    for (const dispatch of dispatchesToDelete) {
      await db.delete(salesOrderDispatchItems).where(eq(salesOrderDispatchItems.dispatchId, dispatch.id));
    }
    await db.delete(salesOrderDispatches).where(eq(salesOrderDispatches.salesOrderId, id));
    // Now delete the order
    const result = await db.delete(salesOrders).where(eq(salesOrders.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getNextSalesOrderCode(): Promise<string> {
    const result = await db.select({ maxId: sql<number>`COALESCE(MAX(id), 0)` }).from(salesOrders);
    const nextNum = (result[0]?.maxId || 0) + 1;
    return `SO-${nextNum.toString().padStart(4, '0')}`;
  }

  // ==================== SALES ORDER ITEMS OPERATIONS ====================

  async getSalesOrderItem(id: number): Promise<SalesOrderItem | undefined> {
    const [item] = await db.select().from(salesOrderItems).where(eq(salesOrderItems.id, id));
    return item;
  }

  async getSalesOrderItemsByOrder(orderId: number): Promise<SalesOrderItem[]> {
    return await db.select().from(salesOrderItems).where(eq(salesOrderItems.salesOrderId, orderId));
  }

  async createSalesOrderItem(item: InsertSalesOrderItem): Promise<SalesOrderItem> {
    const [newItem] = await db.insert(salesOrderItems).values(item).returning();
    return newItem;
  }

  async updateSalesOrderItem(id: number, itemData: Partial<InsertSalesOrderItem>): Promise<SalesOrderItem | undefined> {
    const [updatedItem] = await db.update(salesOrderItems)
      .set(itemData)
      .where(eq(salesOrderItems.id, id))
      .returning();
    return updatedItem;
  }

  async deleteSalesOrderItem(id: number): Promise<boolean> {
    const result = await db.delete(salesOrderItems).where(eq(salesOrderItems.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async deleteSalesOrderItemsByOrder(orderId: number): Promise<boolean> {
    const result = await db.delete(salesOrderItems).where(eq(salesOrderItems.salesOrderId, orderId));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // ==================== SALES ORDER APPROVAL OPERATIONS ====================

  async getSalesOrderApproval(id: number): Promise<SalesOrderApproval | undefined> {
    const [approval] = await db.select().from(salesOrderApprovals).where(eq(salesOrderApprovals.id, id));
    return approval;
  }

  async getSalesOrderApprovalsByOrder(orderId: number): Promise<SalesOrderApproval[]> {
    return await db.select().from(salesOrderApprovals).where(eq(salesOrderApprovals.salesOrderId, orderId));
  }

  async getPendingSalesOrderApprovals(approverId: number): Promise<SalesOrderApproval[]> {
    return await db.select().from(salesOrderApprovals)
      .where(and(
        eq(salesOrderApprovals.approverId, approverId),
        eq(salesOrderApprovals.status, 'pending')
      ));
  }

  async getAllPendingSalesOrderApprovals(): Promise<SalesOrderApproval[]> {
    return await db.select().from(salesOrderApprovals)
      .where(eq(salesOrderApprovals.status, 'pending'));
  }

  async createSalesOrderApproval(approval: InsertSalesOrderApproval): Promise<SalesOrderApproval> {
    const [newApproval] = await db.insert(salesOrderApprovals).values(approval).returning();
    return newApproval;
  }

  async updateSalesOrderApproval(id: number, approvalData: Partial<InsertSalesOrderApproval>): Promise<SalesOrderApproval | undefined> {
    const [updatedApproval] = await db.update(salesOrderApprovals)
      .set(approvalData)
      .where(eq(salesOrderApprovals.id, id))
      .returning();
    return updatedApproval;
  }

  // ==================== SALES ORDER DISPATCH OPERATIONS ====================

  async getSalesOrderDispatch(id: number): Promise<SalesOrderDispatch | undefined> {
    const [dispatch] = await db.select().from(salesOrderDispatches).where(eq(salesOrderDispatches.id, id));
    return dispatch;
  }

  async getSalesOrderDispatchesByOrder(orderId: number): Promise<SalesOrderDispatch[]> {
    return await db.select().from(salesOrderDispatches)
      .where(eq(salesOrderDispatches.salesOrderId, orderId))
      .orderBy(desc(salesOrderDispatches.dispatchDate));
  }

  async createSalesOrderDispatch(dispatch: InsertSalesOrderDispatch): Promise<SalesOrderDispatch> {
    const [newDispatch] = await db.insert(salesOrderDispatches).values(dispatch).returning();
    return newDispatch;
  }

  async updateSalesOrderDispatch(id: number, dispatchData: Partial<InsertSalesOrderDispatch>): Promise<SalesOrderDispatch | undefined> {
    const [updatedDispatch] = await db.update(salesOrderDispatches)
      .set(dispatchData)
      .where(eq(salesOrderDispatches.id, id))
      .returning();
    return updatedDispatch;
  }

  async getNextDispatchCode(): Promise<string> {
    const result = await db.select({ maxId: sql<number>`COALESCE(MAX(id), 0)` }).from(salesOrderDispatches);
    const nextNum = (result[0]?.maxId || 0) + 1;
    return `DIS-${nextNum.toString().padStart(4, '0')}`;
  }

  // ==================== DISPATCH ITEMS OPERATIONS ====================

  async getDispatchItemsByDispatch(dispatchId: number): Promise<SalesOrderDispatchItem[]> {
    return await db.select().from(salesOrderDispatchItems).where(eq(salesOrderDispatchItems.dispatchId, dispatchId));
  }

  async createDispatchItem(item: InsertSalesOrderDispatchItem): Promise<SalesOrderDispatchItem> {
    const [newItem] = await db.insert(salesOrderDispatchItems).values(item).returning();
    return newItem;
  }

  // ==================== AUDIT MANAGER WAREHOUSE OPERATIONS ====================

  async getAuditManagerWarehouses(managerId: number): Promise<AuditManagerWarehouse[]> {
    return await db.select().from(auditManagerWarehouses)
      .where(and(
        eq(auditManagerWarehouses.auditManagerId, managerId),
        eq(auditManagerWarehouses.isActive, true)
      ));
  }

  async getAllAuditManagerWarehouses(): Promise<AuditManagerWarehouse[]> {
    return await db.select().from(auditManagerWarehouses)
      .where(eq(auditManagerWarehouses.isActive, true));
  }

  async assignWarehouseToAuditManager(data: InsertAuditManagerWarehouse): Promise<AuditManagerWarehouse> {
    const [assignment] = await db.insert(auditManagerWarehouses).values(data).returning();
    return assignment;
  }

  async removeWarehouseFromAuditManager(managerId: number, warehouseId: number): Promise<void> {
    await db.update(auditManagerWarehouses)
      .set({ isActive: false })
      .where(and(
        eq(auditManagerWarehouses.auditManagerId, managerId),
        eq(auditManagerWarehouses.warehouseId, warehouseId)
      ));
  }

  async getAuditManagersByWarehouse(warehouseId: number): Promise<AuditManagerWarehouse[]> {
    return await db.select().from(auditManagerWarehouses)
      .where(and(
        eq(auditManagerWarehouses.warehouseId, warehouseId),
        eq(auditManagerWarehouses.isActive, true)
      ));
  }

  // ==================== AUDIT TEAM MEMBER OPERATIONS ====================

  async getAuditTeamMembers(managerId: number, warehouseId?: number): Promise<AuditTeamMember[]> {
    if (warehouseId) {
      return await db.select().from(auditTeamMembers)
        .where(and(
          eq(auditTeamMembers.auditManagerId, managerId),
          eq(auditTeamMembers.warehouseId, warehouseId),
          eq(auditTeamMembers.isActive, true)
        ));
    }
    return await db.select().from(auditTeamMembers)
      .where(and(
        eq(auditTeamMembers.auditManagerId, managerId),
        eq(auditTeamMembers.isActive, true)
      ));
  }

  async addAuditTeamMember(data: InsertAuditTeamMember): Promise<AuditTeamMember> {
    const [member] = await db.insert(auditTeamMembers).values(data).returning();
    return member;
  }

  async removeAuditTeamMember(id: number): Promise<void> {
    await db.update(auditTeamMembers)
      .set({ isActive: false })
      .where(eq(auditTeamMembers.id, id));
  }

  async getAuditTeamMemberById(id: number): Promise<AuditTeamMember | undefined> {
    const [member] = await db.select().from(auditTeamMembers).where(eq(auditTeamMembers.id, id));
    return member;
  }

  async getAuditUserAssignments(userId: number): Promise<AuditTeamMember[]> {
    return await db.select().from(auditTeamMembers)
      .where(and(
        eq(auditTeamMembers.auditUserId, userId),
        eq(auditTeamMembers.isActive, true)
      ));
  }

  // ==================== AUDIT SESSION OPERATIONS ====================

  async getAllAuditSessions(): Promise<AuditSession[]> {
    return await db.select().from(auditSessions)
      .orderBy(desc(auditSessions.createdAt));
  }

  async getAuditSessionById(id: number): Promise<AuditSession | undefined> {
    const [session] = await db.select().from(auditSessions).where(eq(auditSessions.id, id));
    return session;
  }

  async getAuditSessionsByWarehouse(warehouseId: number): Promise<AuditSession[]> {
    return await db.select().from(auditSessions)
      .where(eq(auditSessions.warehouseId, warehouseId))
      .orderBy(desc(auditSessions.createdAt));
  }

  async getAuditSessionsByManager(managerId: number): Promise<AuditSession[]> {
    return await db.select().from(auditSessions)
      .where(eq(auditSessions.auditManagerId, managerId))
      .orderBy(desc(auditSessions.createdAt));
  }

  async createAuditSession(data: InsertAuditSession): Promise<AuditSession> {
    const [session] = await db.insert(auditSessions).values(data).returning();
    return session;
  }

  async updateAuditSession(id: number, data: Partial<InsertAuditSession>): Promise<AuditSession | undefined> {
    const [session] = await db.update(auditSessions)
      .set(data)
      .where(eq(auditSessions.id, id))
      .returning();
    return session;
  }

  async getNextAuditCode(): Promise<string> {
    const year = new Date().getFullYear();
    const result = await db.select({ count: sql<number>`COUNT(*)` }).from(auditSessions);
    const nextNum = (result[0]?.count || 0) + 1;
    return `AUD-${year}-${nextNum.toString().padStart(4, '0')}`;
  }

  // ==================== AUDIT VERIFICATION OPERATIONS ====================

  async getAuditVerificationsBySession(sessionId: number): Promise<AuditVerification[]> {
    return await db.select().from(auditVerifications)
      .where(eq(auditVerifications.auditSessionId, sessionId));
  }

  async getAuditVerificationById(id: number): Promise<AuditVerification | undefined> {
    const [verification] = await db.select().from(auditVerifications).where(eq(auditVerifications.id, id));
    return verification;
  }

  async createAuditVerification(data: InsertAuditVerification): Promise<AuditVerification> {
    const [verification] = await db.insert(auditVerifications).values(data).returning();
    return verification;
  }

  async updateAuditVerification(id: number, data: Partial<InsertAuditVerification>): Promise<AuditVerification | undefined> {
    const [verification] = await db.update(auditVerifications)
      .set(data)
      .where(eq(auditVerifications.id, id))
      .returning();
    return verification;
  }

  // ==================== AUDIT RECONCILIATION OPERATIONS ====================

  async getAuditReconciliationsByVerification(verificationId: number): Promise<AuditReconciliation[]> {
    return await db.select().from(auditReconciliations)
      .where(eq(auditReconciliations.auditVerificationId, verificationId));
  }

  async createAuditReconciliation(data: InsertAuditReconciliation): Promise<AuditReconciliation> {
    const [reconciliation] = await db.insert(auditReconciliations).values(data).returning();
    return reconciliation;
  }

  async updateAuditReconciliation(id: number, data: Partial<InsertAuditReconciliation>): Promise<AuditReconciliation | undefined> {
    const [reconciliation] = await db.update(auditReconciliations)
      .set(data)
      .where(eq(auditReconciliations.id, id))
      .returning();
    return reconciliation;
  }

  // ==================== AUDIT APPROVAL OPERATIONS ====================

  async getAuditApprovalsBySession(sessionId: number): Promise<AuditApproval[]> {
    return await db.select().from(auditApprovals)
      .where(eq(auditApprovals.auditSessionId, sessionId));
  }

  async createAuditApproval(data: InsertAuditApproval): Promise<AuditApproval> {
    const [approval] = await db.insert(auditApprovals).values(data).returning();
    return approval;
  }

  async updateAuditApproval(id: number, data: Partial<InsertAuditApproval>): Promise<AuditApproval | undefined> {
    const [approval] = await db.update(auditApprovals)
      .set(data)
      .where(eq(auditApprovals.id, id))
      .returning();
    return approval;
  }

  async getPendingAuditApprovals(): Promise<AuditApproval[]> {
    return await db.select().from(auditApprovals)
      .where(eq(auditApprovals.status, 'pending'));
  }

  // ==================== AUDIT ACTION LOG OPERATIONS ====================

  async createAuditActionLog(data: InsertAuditActionLog): Promise<AuditActionLog> {
    const [log] = await db.insert(auditActionLogs).values(data).returning();
    return log;
  }

  async getAuditActionLogsBySession(sessionId: number): Promise<AuditActionLog[]> {
    return await db.select().from(auditActionLogs)
      .where(eq(auditActionLogs.auditSessionId, sessionId))
      .orderBy(desc(auditActionLogs.performedAt));
  }

  async getAuditActionLogsByVerification(verificationId: number): Promise<AuditActionLog[]> {
    return await db.select().from(auditActionLogs)
      .where(eq(auditActionLogs.auditVerificationId, verificationId))
      .orderBy(desc(auditActionLogs.performedAt));
  }

  // ==================== ENHANCED AUDIT SESSION OPERATIONS ====================

  async getOpenAuditSessions(): Promise<AuditSession[]> {
    return await db.select().from(auditSessions)
      .where(or(
        eq(auditSessions.status, 'open'),
        eq(auditSessions.status, 'in_progress')
      ))
      .orderBy(desc(auditSessions.createdAt));
  }

  async getOpenAuditSessionsForWarehouse(warehouseId: number): Promise<AuditSession[]> {
    return await db.select().from(auditSessions)
      .where(and(
        eq(auditSessions.warehouseId, warehouseId),
        or(
          eq(auditSessions.status, 'open'),
          eq(auditSessions.status, 'in_progress')
        )
      ))
      .orderBy(desc(auditSessions.createdAt));
  }

  async checkWarehouseFreezeStatus(warehouseId: number, date: Date): Promise<boolean> {
    const sessions = await db.select().from(auditSessions)
      .where(and(
        eq(auditSessions.warehouseId, warehouseId),
        eq(auditSessions.freezeConfirmed, true),
        or(
          eq(auditSessions.status, 'open'),
          eq(auditSessions.status, 'in_progress')
        )
      ));
    
    for (const session of sessions) {
      if (session.startDate && session.endDate) {
        const startDate = new Date(session.startDate);
        const endDate = new Date(session.endDate);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        if (date >= startDate && date <= endDate) {
          return true; // Warehouse is frozen
        }
      }
    }
    return false;
  }

  async getWarehousesUnderAudit(): Promise<number[]> {
    const now = new Date();
    const sessions = await db.select().from(auditSessions)
      .where(
        or(
          eq(auditSessions.status, 'open'),
          eq(auditSessions.status, 'in_progress')
        )
      );
    
    const warehouseIds: Set<number> = new Set();
    for (const session of sessions) {
      if (session.startDate && session.endDate) {
        const startDate = new Date(session.startDate);
        const endDate = new Date(session.endDate);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        if (now >= startDate && now <= endDate) {
          warehouseIds.add(session.warehouseId);
        }
      }
    }
    return Array.from(warehouseIds);
  }

  async getAuditSessionsForAuditManager(managerId: number): Promise<AuditSession[]> {
    // Get warehouses assigned to this audit manager
    const assignments = await this.getAuditManagerWarehouses(managerId);
    const warehouseIds = assignments.map(a => a.warehouseId);
    
    if (warehouseIds.length === 0) return [];
    
    return await db.select().from(auditSessions)
      .where(and(
        sql`${auditSessions.warehouseId} IN (${sql.join(warehouseIds.map(id => sql`${id}`), sql`, `)})`,
        or(
          eq(auditSessions.status, 'open'),
          eq(auditSessions.status, 'in_progress'),
          eq(auditSessions.status, 'reconciliation')
        )
      ))
      .orderBy(desc(auditSessions.createdAt));
  }

  async getAuditSessionsForAuditUser(userId: number): Promise<AuditSession[]> {
    // Get team assignments for this audit user
    const assignments = await this.getAuditUserAssignments(userId);
    const warehouseIds = Array.from(new Set(assignments.map(a => a.warehouseId)));
    
    if (warehouseIds.length === 0) return [];
    
    return await db.select().from(auditSessions)
      .where(and(
        sql`${auditSessions.warehouseId} IN (${sql.join(warehouseIds.map(id => sql`${id}`), sql`, `)})`,
        or(
          eq(auditSessions.status, 'open'),
          eq(auditSessions.status, 'in_progress'),
          eq(auditSessions.status, 'reconciliation')
        )
      ))
      .orderBy(desc(auditSessions.createdAt));
  }

  async getInventoryItemsForWarehouse(warehouseId: number): Promise<any[]> {
    return await db.select({
      inventoryId: inventory.id,
      itemId: items.id,
      itemCode: items.sku,
      itemName: items.name,
      quantity: inventory.quantity,
    })
    .from(inventory)
    .innerJoin(items, eq(inventory.itemId, items.id))
    .where(eq(inventory.warehouseId, warehouseId));
  }

  async getAllAuditSessionsForWarehouses(warehouseIds: number[]): Promise<AuditSession[]> {
    if (warehouseIds.length === 0) return [];
    
    return await db.select().from(auditSessions)
      .where(sql`${auditSessions.warehouseId} IN (${sql.join(warehouseIds.map(id => sql`${id}`), sql`, `)})`)
      .orderBy(desc(auditSessions.createdAt));
  }
}

// Create a global storage instance
export const storage = new DatabaseStorage();