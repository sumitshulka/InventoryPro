import { 
  User, 
  InsertUser, 
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
  TransactionType
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;

  // Category operations
  getCategory(id: number): Promise<Category | undefined>;
  getCategoryByName(name: string): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  getAllCategories(): Promise<Category[]>;
  updateCategory(id: number, categoryData: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(id: number): Promise<boolean>;

  // Warehouse operations
  getWarehouse(id: number): Promise<Warehouse | undefined>;
  getWarehouseByName(name: string): Promise<Warehouse | undefined>;
  createWarehouse(warehouse: InsertWarehouse): Promise<Warehouse>;
  getAllWarehouses(): Promise<Warehouse[]>;
  updateWarehouse(id: number, warehouseData: Partial<InsertWarehouse>): Promise<Warehouse | undefined>;
  deleteWarehouse(id: number): Promise<boolean>;

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

  // Transaction operations
  getTransaction(id: number): Promise<Transaction | undefined>;
  getTransactionByCode(code: string): Promise<Transaction | undefined>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  getAllTransactions(): Promise<Transaction[]>;
  getTransactionsByType(type: TransactionType): Promise<Transaction[]>;
  getTransactionsByWarehouse(warehouseId: number): Promise<Transaction[]>;
  updateTransaction(id: number, transactionData: Partial<InsertTransaction>): Promise<Transaction | undefined>;
  deleteTransaction(id: number): Promise<boolean>;

  // Request operations
  getRequest(id: number): Promise<Request | undefined>;
  getRequestByCode(code: string): Promise<Request | undefined>;
  createRequest(request: InsertRequest): Promise<Request>;
  getAllRequests(): Promise<Request[]>;
  getRequestsByStatus(status: string): Promise<Request[]>;
  getRequestsByUser(userId: number): Promise<Request[]>;
  updateRequest(id: number, requestData: Partial<InsertRequest>): Promise<Request | undefined>;
  deleteRequest(id: number): Promise<boolean>;

  // Request Item operations
  getRequestItem(id: number): Promise<RequestItem | undefined>;
  getRequestItemsByRequest(requestId: number): Promise<RequestItem[]>;
  createRequestItem(requestItem: InsertRequestItem): Promise<RequestItem>;
  updateRequestItem(id: number, requestItemData: Partial<InsertRequestItem>): Promise<RequestItem | undefined>;
  deleteRequestItem(id: number): Promise<boolean>;

  // Session store
  sessionStore: session.SessionStore;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private categories: Map<number, Category>;
  private warehouses: Map<number, Warehouse>;
  private items: Map<number, Item>;
  private inventory: Map<number, Inventory>;
  private transactions: Map<number, Transaction>;
  private requests: Map<number, Request>;
  private requestItems: Map<number, RequestItem>;
  
  private userIdCounter: number;
  private categoryIdCounter: number;
  private warehouseIdCounter: number;
  private itemIdCounter: number;
  private inventoryIdCounter: number;
  private transactionIdCounter: number;
  private requestIdCounter: number;
  private requestItemIdCounter: number;
  
  sessionStore: session.SessionStore;

  constructor() {
    this.users = new Map();
    this.categories = new Map();
    this.warehouses = new Map();
    this.items = new Map();
    this.inventory = new Map();
    this.transactions = new Map();
    this.requests = new Map();
    this.requestItems = new Map();
    
    this.userIdCounter = 1;
    this.categoryIdCounter = 1;
    this.warehouseIdCounter = 1;
    this.itemIdCounter = 1;
    this.inventoryIdCounter = 1;
    this.transactionIdCounter = 1;
    this.requestIdCounter = 1;
    this.requestItemIdCounter = 1;
    
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
    
    // Initialize with some sample data
    this.initializeData();
  }

  // Initialize with sample data for development
  private async initializeData() {
    // Create admin user
    await this.createUser({
      username: "admin",
      password: "admin", // Will be hashed in auth.ts
      name: "Admin User",
      email: "admin@example.com",
      role: "admin"
    });
    
    // Create manager user
    await this.createUser({
      username: "manager",
      password: "manager", // Will be hashed in auth.ts
      name: "Manager User",
      email: "manager@example.com",
      role: "manager",
      warehouseId: 1
    });
    
    // Create regular user
    await this.createUser({
      username: "user",
      password: "user", // Will be hashed in auth.ts
      name: "Regular User",
      email: "user@example.com",
      role: "user",
      warehouseId: 2
    });
    
    // Create categories
    const electronicsCategory = await this.createCategory({
      name: "Electronics",
      description: "Electronic devices and accessories"
    });
    
    const officeCategory = await this.createCategory({
      name: "Office Supplies",
      description: "Office stationery and supplies"
    });
    
    // Create warehouses
    const northWarehouse = await this.createWarehouse({
      name: "North Branch",
      location: "123 Main St, New York, NY",
      manager: "Michael Scott",
      capacity: 1000,
      isActive: true
    });
    
    const southWarehouse = await this.createWarehouse({
      name: "South Branch",
      location: "456 Oak Ave, Miami, FL",
      manager: "Jim Halpert",
      capacity: 800,
      isActive: true
    });
    
    const eastWarehouse = await this.createWarehouse({
      name: "East Branch",
      location: "789 Pine St, Boston, MA",
      manager: "Dwight Schrute",
      capacity: 600,
      isActive: true
    });
    
    const westWarehouse = await this.createWarehouse({
      name: "West Branch",
      location: "101 Cedar Blvd, San Francisco, CA",
      manager: "Pam Beesly",
      capacity: 750,
      isActive: true
    });
    
    // Create items
    const laptop = await this.createItem({
      name: "Laptop Dell XPS 15",
      sku: "LAP-DEL-XPS15",
      description: "Dell XPS 15 Laptop with 16GB RAM, 512GB SSD",
      minStockLevel: 10,
      categoryId: electronicsCategory.id,
      unit: "pcs"
    });
    
    const monitor = await this.createItem({
      name: "Monitor 24\" Dell",
      sku: "MON-DEL-24",
      description: "24-inch Dell Monitor",
      minStockLevel: 10,
      categoryId: electronicsCategory.id,
      unit: "pcs"
    });
    
    const keyboard = await this.createItem({
      name: "Keyboard Logitech K380",
      sku: "KEY-LOG-K380",
      description: "Logitech K380 Wireless Keyboard",
      minStockLevel: 15,
      categoryId: electronicsCategory.id,
      unit: "pcs"
    });
    
    const mouse = await this.createItem({
      name: "Mouse Logitech MX Master",
      sku: "MOU-LOG-MXM",
      description: "Logitech MX Master Wireless Mouse",
      minStockLevel: 15,
      categoryId: electronicsCategory.id,
      unit: "pcs"
    });
    
    const headphones = await this.createItem({
      name: "Headphones Bose QC35",
      sku: "HEA-BOS-QC35",
      description: "Bose QuietComfort 35 Wireless Headphones",
      minStockLevel: 5,
      categoryId: electronicsCategory.id,
      unit: "pcs"
    });
    
    const paper = await this.createItem({
      name: "A4 Paper Ream",
      sku: "PAP-A4-500",
      description: "500 sheets of A4 paper",
      minStockLevel: 20,
      categoryId: officeCategory.id,
      unit: "reams"
    });
    
    // Create inventory
    await this.createInventory({
      itemId: laptop.id,
      warehouseId: northWarehouse.id,
      quantity: 15
    });
    
    await this.createInventory({
      itemId: monitor.id,
      warehouseId: northWarehouse.id,
      quantity: 20
    });
    
    await this.createInventory({
      itemId: keyboard.id,
      warehouseId: southWarehouse.id,
      quantity: 12
    });
    
    await this.createInventory({
      itemId: mouse.id,
      warehouseId: eastWarehouse.id,
      quantity: 25
    });
    
    await this.createInventory({
      itemId: headphones.id,
      warehouseId: westWarehouse.id,
      quantity: 2
    });
    
    await this.createInventory({
      itemId: paper.id,
      warehouseId: southWarehouse.id,
      quantity: 30
    });
    
    // Create some transactions
    await this.createTransaction({
      transactionCode: "TRX-872",
      itemId: laptop.id,
      quantity: 15,
      transactionType: "check-in",
      destinationWarehouseId: northWarehouse.id,
      userId: 2,
      status: "completed"
    });
    
    await this.createTransaction({
      transactionCode: "TRX-871",
      itemId: monitor.id,
      quantity: 8,
      transactionType: "transfer",
      sourceWarehouseId: eastWarehouse.id,
      destinationWarehouseId: westWarehouse.id,
      userId: 2,
      status: "in-transit"
    });
    
    await this.createTransaction({
      transactionCode: "TRX-870",
      itemId: keyboard.id,
      quantity: 12,
      transactionType: "issue",
      sourceWarehouseId: southWarehouse.id,
      userId: 3,
      status: "completed"
    });
    
    // Create some requests
    const request1 = await this.createRequest({
      userId: 3,
      warehouseId: southWarehouse.id,
      status: "pending",
      notes: "Office Supplies Request"
    });
    
    await this.createRequestItem({
      requestId: request1.id,
      itemId: paper.id,
      quantity: 5
    });
    
    await this.createRequestItem({
      requestId: request1.id,
      itemId: keyboard.id,
      quantity: 3
    });
    
    await this.createRequestItem({
      requestId: request1.id,
      itemId: mouse.id,
      quantity: 3
    });
    
    const request2 = await this.createRequest({
      userId: 3,
      warehouseId: eastWarehouse.id,
      status: "pending",
      notes: "Tech Equipment"
    });
    
    await this.createRequestItem({
      requestId: request2.id,
      itemId: laptop.id,
      quantity: 5
    });
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }

  async createUser(user: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const createdAt = new Date();
    const newUser: User = { ...user, id, createdAt };
    this.users.set(id, newUser);
    return newUser;
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined> {
    const user = await this.getUser(id);
    if (!user) return undefined;

    const updatedUser = { ...user, ...userData };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async deleteUser(id: number): Promise<boolean> {
    return this.users.delete(id);
  }

  // Category operations
  async getCategory(id: number): Promise<Category | undefined> {
    return this.categories.get(id);
  }

  async getCategoryByName(name: string): Promise<Category | undefined> {
    return Array.from(this.categories.values()).find(
      (category) => category.name === name
    );
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const id = this.categoryIdCounter++;
    const newCategory: Category = { ...category, id };
    this.categories.set(id, newCategory);
    return newCategory;
  }

  async getAllCategories(): Promise<Category[]> {
    return Array.from(this.categories.values());
  }

  async updateCategory(id: number, categoryData: Partial<InsertCategory>): Promise<Category | undefined> {
    const category = await this.getCategory(id);
    if (!category) return undefined;

    const updatedCategory = { ...category, ...categoryData };
    this.categories.set(id, updatedCategory);
    return updatedCategory;
  }

  async deleteCategory(id: number): Promise<boolean> {
    return this.categories.delete(id);
  }

  // Warehouse operations
  async getWarehouse(id: number): Promise<Warehouse | undefined> {
    return this.warehouses.get(id);
  }

  async getWarehouseByName(name: string): Promise<Warehouse | undefined> {
    return Array.from(this.warehouses.values()).find(
      (warehouse) => warehouse.name === name
    );
  }

  async createWarehouse(warehouse: InsertWarehouse): Promise<Warehouse> {
    const id = this.warehouseIdCounter++;
    const newWarehouse: Warehouse = { ...warehouse, id };
    this.warehouses.set(id, newWarehouse);
    return newWarehouse;
  }

  async getAllWarehouses(): Promise<Warehouse[]> {
    return Array.from(this.warehouses.values());
  }

  async updateWarehouse(id: number, warehouseData: Partial<InsertWarehouse>): Promise<Warehouse | undefined> {
    const warehouse = await this.getWarehouse(id);
    if (!warehouse) return undefined;

    const updatedWarehouse = { ...warehouse, ...warehouseData };
    this.warehouses.set(id, updatedWarehouse);
    return updatedWarehouse;
  }

  async deleteWarehouse(id: number): Promise<boolean> {
    return this.warehouses.delete(id);
  }

  // Item operations
  async getItem(id: number): Promise<Item | undefined> {
    return this.items.get(id);
  }

  async getItemBySku(sku: string): Promise<Item | undefined> {
    return Array.from(this.items.values()).find(
      (item) => item.sku === sku
    );
  }

  async createItem(item: InsertItem): Promise<Item> {
    const id = this.itemIdCounter++;
    const newItem: Item = { ...item, id };
    this.items.set(id, newItem);
    return newItem;
  }

  async getAllItems(): Promise<Item[]> {
    return Array.from(this.items.values());
  }

  async updateItem(id: number, itemData: Partial<InsertItem>): Promise<Item | undefined> {
    const item = await this.getItem(id);
    if (!item) return undefined;

    const updatedItem = { ...item, ...itemData };
    this.items.set(id, updatedItem);
    return updatedItem;
  }

  async deleteItem(id: number): Promise<boolean> {
    return this.items.delete(id);
  }

  // Inventory operations
  async getInventory(id: number): Promise<Inventory | undefined> {
    return this.inventory.get(id);
  }

  async getInventoryByItemAndWarehouse(itemId: number, warehouseId: number): Promise<Inventory | undefined> {
    return Array.from(this.inventory.values()).find(
      (inv) => inv.itemId === itemId && inv.warehouseId === warehouseId
    );
  }

  async createInventory(inventory: InsertInventory): Promise<Inventory> {
    const id = this.inventoryIdCounter++;
    const lastUpdated = new Date();
    const newInventory: Inventory = { ...inventory, id, lastUpdated };
    this.inventory.set(id, newInventory);
    return newInventory;
  }

  async getAllInventory(): Promise<Inventory[]> {
    return Array.from(this.inventory.values());
  }

  async getInventoryByWarehouse(warehouseId: number): Promise<Inventory[]> {
    return Array.from(this.inventory.values()).filter(
      (inv) => inv.warehouseId === warehouseId
    );
  }

  async updateInventory(id: number, inventoryData: Partial<InsertInventory>): Promise<Inventory | undefined> {
    const inventory = await this.getInventory(id);
    if (!inventory) return undefined;

    const updatedInventory = { ...inventory, ...inventoryData, lastUpdated: new Date() };
    this.inventory.set(id, updatedInventory);
    return updatedInventory;
  }

  async updateInventoryQuantity(itemId: number, warehouseId: number, quantity: number): Promise<Inventory | undefined> {
    const inventory = await this.getInventoryByItemAndWarehouse(itemId, warehouseId);
    
    if (inventory) {
      // Update existing inventory
      const updatedInventory = { 
        ...inventory, 
        quantity, 
        lastUpdated: new Date() 
      };
      this.inventory.set(inventory.id, updatedInventory);
      return updatedInventory;
    } else {
      // Create new inventory record
      return this.createInventory({
        itemId,
        warehouseId,
        quantity
      });
    }
  }

  async deleteInventory(id: number): Promise<boolean> {
    return this.inventory.delete(id);
  }

  // Transaction operations
  async getTransaction(id: number): Promise<Transaction | undefined> {
    return this.transactions.get(id);
  }

  async getTransactionByCode(code: string): Promise<Transaction | undefined> {
    return Array.from(this.transactions.values()).find(
      (transaction) => transaction.transactionCode === code
    );
  }

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const id = this.transactionIdCounter++;
    const createdAt = new Date();
    const completedAt = transaction.status === "completed" ? new Date() : undefined;
    const newTransaction: Transaction = { ...transaction, id, createdAt, completedAt };
    this.transactions.set(id, newTransaction);
    return newTransaction;
  }

  async getAllTransactions(): Promise<Transaction[]> {
    return Array.from(this.transactions.values());
  }

  async getTransactionsByType(type: TransactionType): Promise<Transaction[]> {
    return Array.from(this.transactions.values()).filter(
      (transaction) => transaction.transactionType === type
    );
  }

  async getTransactionsByWarehouse(warehouseId: number): Promise<Transaction[]> {
    return Array.from(this.transactions.values()).filter(
      (transaction) => 
        transaction.sourceWarehouseId === warehouseId || 
        transaction.destinationWarehouseId === warehouseId
    );
  }

  async updateTransaction(id: number, transactionData: Partial<InsertTransaction>): Promise<Transaction | undefined> {
    const transaction = await this.getTransaction(id);
    if (!transaction) return undefined;

    const updatedTransaction = { ...transaction, ...transactionData };
    if (transactionData.status === "completed" && !transaction.completedAt) {
      updatedTransaction.completedAt = new Date();
    }
    
    this.transactions.set(id, updatedTransaction);
    return updatedTransaction;
  }

  async deleteTransaction(id: number): Promise<boolean> {
    return this.transactions.delete(id);
  }

  // Request operations
  async getRequest(id: number): Promise<Request | undefined> {
    return this.requests.get(id);
  }

  async getRequestByCode(code: string): Promise<Request | undefined> {
    return Array.from(this.requests.values()).find(
      (request) => request.requestCode === code
    );
  }

  async createRequest(request: InsertRequest): Promise<Request> {
    const id = this.requestIdCounter++;
    const requestCode = `REQ-${id + 150}`; // Starting with REQ-151 for better UI display
    const createdAt = new Date();
    const newRequest: Request = { ...request, id, requestCode, createdAt, updatedAt: createdAt };
    this.requests.set(id, newRequest);
    return newRequest;
  }

  async getAllRequests(): Promise<Request[]> {
    return Array.from(this.requests.values());
  }

  async getRequestsByStatus(status: string): Promise<Request[]> {
    return Array.from(this.requests.values()).filter(
      (request) => request.status === status
    );
  }

  async getRequestsByUser(userId: number): Promise<Request[]> {
    return Array.from(this.requests.values()).filter(
      (request) => request.userId === userId
    );
  }

  async updateRequest(id: number, requestData: Partial<InsertRequest>): Promise<Request | undefined> {
    const request = await this.getRequest(id);
    if (!request) return undefined;

    const updatedRequest = { 
      ...request, 
      ...requestData, 
      updatedAt: new Date() 
    };
    
    this.requests.set(id, updatedRequest);
    return updatedRequest;
  }

  async deleteRequest(id: number): Promise<boolean> {
    return this.requests.delete(id);
  }

  // Request Item operations
  async getRequestItem(id: number): Promise<RequestItem | undefined> {
    return this.requestItems.get(id);
  }

  async getRequestItemsByRequest(requestId: number): Promise<RequestItem[]> {
    return Array.from(this.requestItems.values()).filter(
      (requestItem) => requestItem.requestId === requestId
    );
  }

  async createRequestItem(requestItem: InsertRequestItem): Promise<RequestItem> {
    const id = this.requestItemIdCounter++;
    const newRequestItem: RequestItem = { ...requestItem, id };
    this.requestItems.set(id, newRequestItem);
    return newRequestItem;
  }

  async updateRequestItem(id: number, requestItemData: Partial<InsertRequestItem>): Promise<RequestItem | undefined> {
    const requestItem = await this.getRequestItem(id);
    if (!requestItem) return undefined;

    const updatedRequestItem = { ...requestItem, ...requestItemData };
    this.requestItems.set(id, updatedRequestItem);
    return updatedRequestItem;
  }

  async deleteRequestItem(id: number): Promise<boolean> {
    return this.requestItems.delete(id);
  }
}

export const storage = new MemStorage();
