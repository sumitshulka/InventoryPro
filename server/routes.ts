import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { z } from "zod";
import { 
  insertItemSchema, 
  insertWarehouseSchema, 
  insertCategorySchema, 
  insertLocationSchema,
  insertInventorySchema, 
  insertTransactionSchema, 
  insertRequestSchema, 
  insertRequestItemSchema,
  insertDepartmentSchema,
  insertUserSchema,
  insertWarehouseOperatorSchema,
  insertTransferSchema,
  insertTransferItemSchema,
  insertTransferUpdateSchema,
  insertNotificationSchema,
  insertEmailSettingsSchema,
  departments,
  organizationSettings,
  users,
  auditLogs,
  items,
  warehouses,
  categories,
  locations,
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
  notifications
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, lte, exists, isNotNull, or } from "drizzle-orm";

// Utility function to check authentication
const requireAuth = (req: Request, res: Response, next: Function) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
};

// Utility function to check required role
const checkRole = (requiredRole: string) => {
  return (req: Request, res: Response, next: Function) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = req.user;
    if (
      (requiredRole === "admin" && user.role !== "admin") ||
      (requiredRole === "manager" && user.role !== "admin" && user.role !== "manager")
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    next();
  };
};

// Utility function to log audit events
const logAuditEvent = async (
  userId: number,
  action: string,
  entityType: string,
  entityId: number | null,
  details: string,
  oldValues?: any,
  newValues?: any,
  req?: Request
) => {
  try {
    await db.insert(auditLogs).values({
      userId,
      action,
      entityType,
      entityId,
      details,
      oldValues: oldValues ? JSON.stringify(oldValues) : null,
      newValues: newValues ? JSON.stringify(newValues) : null,
      ipAddress: req?.ip || '127.0.0.1',
      userAgent: req?.get('User-Agent') || null,
    });
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  setupAuth(app);

  // Get current user
  app.get("/api/current-user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    res.json(req.user);
  });

  // ==== User Management Routes ====
  // Get users (admin sees all, managers see their subordinates)
  app.get("/api/users", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    let users;
    if (req.user.role === 'admin') {
      // Admins can see all users
      users = await storage.getAllUsers();
    } else if (req.user.role === 'manager') {
      // Managers can see their subordinates
      const allUsers = await storage.getAllUsers();
      users = allUsers.filter(u => u.managerId === req.user!.id);
    } else {
      // Regular users cannot access user management
      return res.status(403).json({ message: "Forbidden" });
    }

    res.json(users);
  });

  // Get active users only (for dropdowns and selections)
  app.get("/api/users/active", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    let users;
    if (req.user.role === 'admin') {
      users = await storage.getActiveUsers();
    } else if (req.user.role === 'manager') {
      const allActiveUsers = await storage.getActiveUsers();
      users = allActiveUsers.filter(u => u.managerId === req.user!.id);
    } else {
      return res.status(403).json({ message: "Forbidden" });
    }

    res.json(users);
  });

  // Create new user (admin only)
  app.post("/api/users", checkRole("admin"), async (req, res) => {
    try {
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const user = await storage.createUser(req.body);
      res.status(201).json(user);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Update user (admin only)
  app.put("/api/users/:id", checkRole("admin"), async (req, res) => {
    const userId = parseInt(req.params.id, 10);
    try {
      console.log("User update request body:", JSON.stringify(req.body, null, 2));
      
      // Validate the user data
      const userData = insertUserSchema.partial().parse(req.body);
      console.log("Parsed user data:", JSON.stringify(userData, null, 2));
      
      // Check if the user exists
      const existingUser = await storage.getUser(userId);
      if (!existingUser) {
        return res.status(404).json({ message: "User not found" });
      }
      console.log("Existing user:", JSON.stringify(existingUser, null, 2));
      
      // Check for unique constraint violations only if username or email is being changed
      if (userData.username && userData.username !== existingUser.username) {
        console.log("Checking username uniqueness:", userData.username);
        const userWithSameUsername = await storage.getUserByUsername(userData.username);
        if (userWithSameUsername) {
          console.log("Username conflict found:", userWithSameUsername.username);
          return res.status(400).json({ message: "Username already exists" });
        }
      }
      
      if (userData.email && userData.email !== existingUser.email) {
        console.log("Checking email uniqueness:", userData.email);
        const allUsers = await storage.getAllUsers();
        const userWithSameEmail = allUsers.find(u => u.email === userData.email && u.id !== userId);
        if (userWithSameEmail) {
          console.log("Email conflict found:", userWithSameEmail.email);
          return res.status(400).json({ message: "Email already exists" });
        }
      }
      
      // Filter out undefined values to prevent constraint issues
      const cleanUserData = Object.entries(userData).reduce((acc, [key, value]) => {
        if (value !== undefined && value !== "") {
          acc[key] = value;
        }
        return acc;
      }, {} as any);
      
      console.log("Clean user data for update:", JSON.stringify(cleanUserData, null, 2));
      
      const updatedUser = await storage.updateUser(userId, cleanUserData);
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(updatedUser);
    } catch (error: any) {
      console.error("User update error:", error);
      res.status(400).json({ message: error.message });
    }
  });

  // Delete user (admin only)
  app.delete("/api/users/:id", checkRole("admin"), async (req, res) => {
    try {
      const userId = parseInt(req.params.id, 10);

      // Prevent deleting your own account
      if (req.user?.id === userId) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const success = await storage.deleteUser(userId);
      if (!success) {
        return res.status(500).json({ message: "Failed to delete user" });
      }

      res.json({ message: "User deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==== Category Routes ====
  // Get all categories
  app.get("/api/categories", async (req, res) => {
    const categories = await storage.getAllCategories();
    res.json(categories);
  });

  // Create category (manager+)
  app.post("/api/categories", checkRole("manager"), async (req, res) => {
    try {
      const categoryData = insertCategorySchema.parse(req.body);
      const existingCategory = await storage.getCategoryByName(categoryData.name);
      if (existingCategory) {
        return res.status(400).json({ message: "Category already exists" });
      }

      const category = await storage.createCategory(categoryData);
      res.status(201).json(category);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Update category (manager+)
  app.put("/api/categories/:id", checkRole("manager"), async (req, res) => {
    const categoryId = parseInt(req.params.id, 10);
    try {
      const categoryData = insertCategorySchema.partial().parse(req.body);
      const updatedCategory = await storage.updateCategory(categoryId, categoryData);
      if (!updatedCategory) {
        return res.status(404).json({ message: "Category not found" });
      }
      res.json(updatedCategory);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Delete category (manager+)
  app.delete("/api/categories/:id", checkRole("manager"), async (req, res) => {
    const categoryId = parseInt(req.params.id, 10);
    const success = await storage.deleteCategory(categoryId);
    if (!success) {
      return res.status(404).json({ message: "Category not found" });
    }
    res.status(204).send();
  });

  // ==== Location Routes ====
  // Get all locations (Admin only)
  app.get("/api/locations", checkRole("admin"), async (req, res) => {
    const locations = await storage.getAllLocations();
    res.json(locations);
  });

  // Create location (admin only)
  app.post("/api/locations", checkRole("admin"), async (req, res) => {
    try {
      const locationData = insertLocationSchema.parse(req.body);
      const existingLocation = await storage.getLocationByName(locationData.name);
      if (existingLocation) {
        return res.status(400).json({ message: "Location already exists" });
      }

      const location = await storage.createLocation(locationData);
      res.status(201).json(location);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Update location (admin only)
  app.put("/api/locations/:id", checkRole("admin"), async (req, res) => {
    const locationId = parseInt(req.params.id, 10);
    try {
      const locationData = insertLocationSchema.partial().parse(req.body);
      const updatedLocation = await storage.updateLocation(locationId, locationData);
      if (!updatedLocation) {
        return res.status(404).json({ message: "Location not found" });
      }
      res.json(updatedLocation);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Delete location (admin only)
  app.delete("/api/locations/:id", checkRole("admin"), async (req, res) => {
    const locationId = parseInt(req.params.id, 10);
    const success = await storage.deleteLocation(locationId);
    if (!success) {
      return res.status(404).json({ message: "Location not found" });
    }
    res.status(204).send();
  });

  // ==== Warehouse Routes ====
  // Get all warehouses with manager information (including archived)
  app.get("/api/warehouses", async (req, res) => {
    try {
      const warehouses = await storage.getAllWarehouses();
      
      // Enrich warehouses with manager information
      const enrichedWarehouses = await Promise.all(warehouses.map(async (warehouse) => {
        let manager = null;
        if (warehouse.managerId) {
          manager = await storage.getUser(warehouse.managerId);
        }
        return {
          ...warehouse,
          manager: manager ? { id: manager.id, name: manager.name, email: manager.email, role: manager.role } : null
        };
      }));
      
      res.json(enrichedWarehouses);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create warehouse (admin only)
  app.post("/api/warehouses", checkRole("admin"), async (req, res) => {
    try {
      const warehouseData = insertWarehouseSchema.parse(req.body);
      const existingWarehouse = await storage.getWarehouseByName(warehouseData.name);
      if (existingWarehouse) {
        return res.status(400).json({ message: "Warehouse already exists" });
      }

      const warehouse = await storage.createWarehouse(warehouseData);
      res.status(201).json(warehouse);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Update warehouse (admin only)
  app.put("/api/warehouses/:id", checkRole("admin"), async (req, res) => {
    const warehouseId = parseInt(req.params.id, 10);
    try {
      const warehouseData = insertWarehouseSchema.partial().parse(req.body);
      const updatedWarehouse = await storage.updateWarehouse(warehouseId, warehouseData);
      if (!updatedWarehouse) {
        return res.status(404).json({ message: "Warehouse not found" });
      }
      res.json(updatedWarehouse);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Update warehouse manager (admin only)
  app.patch("/api/warehouses/:id", checkRole("admin"), async (req, res) => {
    const warehouseId = parseInt(req.params.id, 10);
    try {
      const { managerId } = req.body;
      
      // Validate managerId if provided
      if (managerId !== null && managerId !== undefined) {
        const manager = await storage.getUser(managerId);
        if (!manager) {
          return res.status(400).json({ message: "Manager not found" });
        }
        if (manager.role !== 'admin' && manager.role !== 'manager') {
          return res.status(400).json({ message: "User must be an admin or manager" });
        }
      }

      const updatedWarehouse = await storage.updateWarehouse(warehouseId, { managerId });
      if (!updatedWarehouse) {
        return res.status(404).json({ message: "Warehouse not found" });
      }
      res.json(updatedWarehouse);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Archive warehouse (admin only) - soft delete to preserve transaction history
  app.delete("/api/warehouses/:id", checkRole("admin"), async (req, res) => {
    const warehouseId = parseInt(req.params.id, 10);
    const archivedWarehouse = await storage.archiveWarehouse(warehouseId);
    if (!archivedWarehouse) {
      return res.status(404).json({ message: "Warehouse not found" });
    }
    res.json(archivedWarehouse);
  });

  // Get active warehouses only (excludes archived)
  app.get("/api/warehouses/active", async (req, res) => {
    try {
      const warehouses = await storage.getActiveWarehouses();
      
      // Enrich warehouses with manager information
      const enrichedWarehouses = await Promise.all(warehouses.map(async (warehouse) => {
        let manager = null;
        if (warehouse.managerId) {
          manager = await storage.getUser(warehouse.managerId);
        }

        let location = null;
        if (warehouse.locationId) {
          location = await storage.getLocation(warehouse.locationId);
        }
        
        return {
          ...warehouse,
          manager: manager?.name || null,
          location: location?.name || null
        };
      }));

      res.json(enrichedWarehouses);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==== Item Routes ====
  // Get all items
  app.get("/api/items", async (req, res) => {
    const items = await storage.getAllItems();
    res.json(items);
  });

  // Create item (manager+)
  app.post("/api/items", checkRole("manager"), async (req, res) => {
    try {
      const itemData = insertItemSchema.parse(req.body);
      const existingItem = await storage.getItemBySku(itemData.sku);
      if (existingItem) {
        return res.status(400).json({ message: "Item with this SKU already exists" });
      }

      const item = await storage.createItem(itemData);
      res.status(201).json(item);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Update item (manager+)
  app.put("/api/items/:id", checkRole("manager"), async (req, res) => {
    const itemId = parseInt(req.params.id, 10);
    try {
      const itemData = insertItemSchema.partial().parse(req.body);
      const updatedItem = await storage.updateItem(itemId, itemData);
      if (!updatedItem) {
        return res.status(404).json({ message: "Item not found" });
      }
      res.json(updatedItem);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Delete item (manager+)
  app.delete("/api/items/:id", checkRole("manager"), async (req, res) => {
    const itemId = parseInt(req.params.id, 10);
    const success = await storage.deleteItem(itemId);
    if (!success) {
      return res.status(404).json({ message: "Item not found" });
    }
    res.status(204).send();
  });

  // Update item status (activate/deactivate) - manager+
  app.patch("/api/items/:id/status", checkRole("manager"), async (req, res) => {
    const itemId = parseInt(req.params.id, 10);
    try {
      const { status } = z.object({
        status: z.enum(["active", "inactive"])
      }).parse(req.body);

      // If deactivating, check that item has 0 quantity in all warehouses
      if (status === "inactive") {
        const inventoryItems = await storage.getAllInventory();
        const itemInventory = inventoryItems.filter(inv => inv.itemId === itemId);
        const totalQuantity = itemInventory.reduce((sum, inv) => sum + inv.quantity, 0);
        
        if (totalQuantity > 0) {
          return res.status(400).json({ 
            message: "Cannot deactivate item with available quantity. Current quantity: " + totalQuantity 
          });
        }
      }

      const updatedItem = await storage.updateItem(itemId, { status });
      if (!updatedItem) {
        return res.status(404).json({ message: "Item not found" });
      }
      res.json(updatedItem);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Get check-in history for an item
  app.get("/api/items/:id/checkin-history", async (req, res) => {
    const itemId = parseInt(req.params.id, 10);
    try {
      const transactions = await storage.getAllTransactions();
      const checkInTransactions = transactions.filter(t => 
        t.itemId === itemId && t.transactionType === "check-in"
      ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      res.json(checkInTransactions);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // ==== Inventory Routes ====
  // Get all inventory
  app.get("/api/inventory", async (req, res) => {
    const inventory = await storage.getAllInventory();
    res.json(inventory);
  });

  // Get inventory for specific warehouse
  app.get("/api/inventory/warehouse/:warehouseId", async (req, res) => {
    const warehouseId = parseInt(req.params.warehouseId, 10);
    const inventory = await storage.getInventoryByWarehouse(warehouseId);
    res.json(inventory);
  });

  // Create or update inventory (manager+)
  app.post("/api/inventory", checkRole("manager"), async (req, res) => {
    try {
      const inventoryData = insertInventorySchema.parse(req.body);
      
      // Check if item exists
      const item = await storage.getItem(inventoryData.itemId);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }
      
      // Check if warehouse exists
      const warehouse = await storage.getWarehouse(inventoryData.warehouseId);
      if (!warehouse) {
        return res.status(404).json({ message: "Warehouse not found" });
      }
      
      // Check if inventory already exists for this item in this warehouse
      const existingInventory = await storage.getInventoryByItemAndWarehouse(
        inventoryData.itemId,
        inventoryData.warehouseId
      );
      
      let inventory;
      if (existingInventory) {
        // Update existing inventory
        inventory = await storage.updateInventory(existingInventory.id, {
          quantity: inventoryData.quantity
        });
      } else {
        // Create new inventory
        inventory = await storage.createInventory(inventoryData);
      }
      
      res.status(201).json(inventory);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Update inventory quantity (manager+)
  app.put("/api/inventory/update-quantity", checkRole("manager"), async (req, res) => {
    try {
      const data = z.object({
        itemId: z.number(),
        warehouseId: z.number(),
        quantity: z.number()
      }).parse(req.body);
      
      const inventory = await storage.updateInventoryQuantity(
        data.itemId,
        data.warehouseId,
        data.quantity
      );
      
      res.json(inventory);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // ==== Transaction Routes ====
  // Get all transactions
  app.get("/api/transactions", async (req, res) => {
    const transactions = await storage.getAllTransactions();
    res.json(transactions);
  });

  // Get transactions by type
  app.get("/api/transactions/type/:type", async (req, res) => {
    const { type } = req.params;
    if (!['check-in', 'issue', 'transfer'].includes(type)) {
      return res.status(400).json({ message: "Invalid transaction type" });
    }
    
    const transactions = await storage.getTransactionsByType(type as any);
    res.json(transactions);
  });

  // Get transactions for a warehouse
  app.get("/api/transactions/warehouse/:warehouseId", async (req, res) => {
    const warehouseId = parseInt(req.params.warehouseId, 10);
    const transactions = await storage.getTransactionsByWarehouse(warehouseId);
    res.json(transactions);
  });

  // Create transaction (check-in, issue, transfer) - check-in for all authenticated users, others require manager
  app.post("/api/transactions", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Check if it's a check-in transaction or requires manager role
    const transactionType = req.body.transactionType;
    if (transactionType !== "check-in") {
      const user = req.user;
      if (user.role !== "admin" && user.role !== "manager") {
        return res.status(403).json({ message: "Forbidden" });
      }
    }
    try {
      console.log("Transaction request body:", JSON.stringify(req.body, null, 2));
      
      // Additional validation before schema parsing
      if (req.body.quantity !== undefined && req.body.quantity <= 0) {
        console.log("Rejecting negative/zero quantity:", req.body.quantity);
        return res.status(400).json({ 
          message: "Quantity must be greater than 0",
          issues: [{ path: ["quantity"], message: "Quantity must be greater than 0" }]
        });
      }
      
      // Use safeParse and handle any validation errors manually
      const parseResult = insertTransactionSchema.safeParse(req.body);
      
      if (!parseResult.success) {
        console.log("Validation error:", JSON.stringify(parseResult.error.issues, null, 2));
        return res.status(400).json({ 
          message: parseResult.error.message,
          issues: parseResult.error.issues
        });
      }
      
      const transactionData = parseResult.data;
      
      // Generate transaction code
      const transactionCode = `TRX-${(await storage.getAllTransactions()).length + 873}`; // Start from where sample data left off
      
      // Create transaction with the correct fields
      let transactionPayload: any = {
        ...transactionData,
        transactionCode,
        userId: req.user!.id, // Use the authenticated user's ID
      };
      
      // Create the transaction
      const transaction = await storage.createTransaction(transactionPayload);
      
      // Update inventory based on transaction type
      if (transaction.transactionType === "check-in" && transaction.destinationWarehouseId) {
        // Check if inventory already exists
        const existingInventory = await storage.getInventoryByItemAndWarehouse(
          transaction.itemId,
          transaction.destinationWarehouseId
        );
        
        if (existingInventory) {
          // Update existing inventory
          await storage.updateInventory(existingInventory.id, {
            quantity: existingInventory.quantity + transaction.quantity
          });
        } else {
          // Create new inventory
          await storage.createInventory({
            itemId: transaction.itemId,
            warehouseId: transaction.destinationWarehouseId,
            quantity: transaction.quantity
          });
        }
      } else if (transaction.transactionType === "issue" && transaction.sourceWarehouseId) {
        // Check if inventory exists and has enough quantity
        const existingInventory = await storage.getInventoryByItemAndWarehouse(
          transaction.itemId,
          transaction.sourceWarehouseId
        );
        
        if (!existingInventory) {
          return res.status(400).json({ message: "Item not in inventory" });
        }
        
        if (existingInventory.quantity < transaction.quantity) {
          return res.status(400).json({ message: "Not enough quantity in inventory" });
        }
        
        // Update inventory
        await storage.updateInventory(existingInventory.id, {
          quantity: existingInventory.quantity - transaction.quantity
        });
      } else if (transaction.transactionType === "transfer" && transaction.sourceWarehouseId && transaction.destinationWarehouseId) {
        // Check if source inventory exists and has enough quantity
        const sourceInventory = await storage.getInventoryByItemAndWarehouse(
          transaction.itemId,
          transaction.sourceWarehouseId
        );
        
        if (!sourceInventory) {
          return res.status(400).json({ message: "Item not in source warehouse inventory" });
        }
        
        if (sourceInventory.quantity < transaction.quantity) {
          return res.status(400).json({ message: "Not enough quantity in source warehouse" });
        }
        
        // Update source inventory
        await storage.updateInventory(sourceInventory.id, {
          quantity: sourceInventory.quantity - transaction.quantity
        });
        
        // If transaction is completed, update destination inventory
        if (transaction.status === "completed") {
          const destinationInventory = await storage.getInventoryByItemAndWarehouse(
            transaction.itemId,
            transaction.destinationWarehouseId
          );
          
          if (destinationInventory) {
            // Update existing destination inventory
            await storage.updateInventory(destinationInventory.id, {
              quantity: destinationInventory.quantity + transaction.quantity
            });
          } else {
            // Create new destination inventory
            await storage.createInventory({
              itemId: transaction.itemId,
              warehouseId: transaction.destinationWarehouseId,
              quantity: transaction.quantity
            });
          }
        }
      }
      
      res.status(201).json(transaction);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Update transaction status (manager+)
  app.put("/api/transactions/:id/status", checkRole("manager"), async (req, res) => {
    const transactionId = parseInt(req.params.id, 10);
    
    try {
      const { status } = z.object({
        status: z.string().refine(
          s => ['pending', 'in-transit', 'completed', 'cancelled'].includes(s),
          { message: "Invalid status" }
        )
      }).parse(req.body);
      
      // Get transaction
      const transaction = await storage.getTransaction(transactionId);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      
      // If completing a transfer transaction, update destination inventory
      if (
        status === "completed" && 
        transaction.status !== "completed" &&
        transaction.transactionType === "transfer" &&
        transaction.sourceWarehouseId &&
        transaction.destinationWarehouseId
      ) {
        const destinationInventory = await storage.getInventoryByItemAndWarehouse(
          transaction.itemId,
          transaction.destinationWarehouseId
        );
        
        if (destinationInventory) {
          // Update existing destination inventory
          await storage.updateInventory(destinationInventory.id, {
            quantity: destinationInventory.quantity + transaction.quantity
          });
        } else {
          // Create new destination inventory
          await storage.createInventory({
            itemId: transaction.itemId,
            warehouseId: transaction.destinationWarehouseId,
            quantity: transaction.quantity
          });
        }
      }
      
      // Update transaction status
      const updatedTransaction = await storage.updateTransaction(transactionId, { status });
      
      res.json(updatedTransaction);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // ==== Request Routes ====
  // Get all requests
  app.get("/api/requests", async (req, res) => {
    // Regular users can only see their own requests
    if (req.user!.role === "user") {
      const requests = await storage.getRequestsByUser(req.user!.id);
      return res.json(requests);
    }
    
    // Managers and admins can see all requests
    const requests = await storage.getAllRequests();
    res.json(requests);
  });

  // Get requests by status
  app.get("/api/requests/status/:status", async (req, res) => {
    const { status } = req.params;
    
    // Regular users can only see their own requests
    if (req.user!.role === "user") {
      const allUserRequests = await storage.getRequestsByUser(req.user!.id);
      const filteredRequests = allUserRequests.filter(r => r.status === status);
      return res.json(filteredRequests);
    }
    
    // Managers and admins can see all requests with given status
    const requests = await storage.getRequestsByStatus(status);
    res.json(requests);
  });

  // Get request details including items
  app.get("/api/requests/:id", async (req, res) => {
    const requestId = parseInt(req.params.id, 10);
    
    if (isNaN(requestId)) {
      return res.status(400).json({ message: "Invalid request ID" });
    }
    
    const request = await storage.getRequest(requestId);
    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }
    
    // Regular users can only see their own requests
    if (req.user!.role === "user" && request.userId !== req.user!.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    
    // Get items in request
    const requestItems = await storage.getRequestItemsByRequest(requestId);
    
    res.json({
      ...request,
      items: requestItems
    });
  });

  // Get request items separately
  app.get("/api/requests/:id/items", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const requestId = parseInt(req.params.id, 10);
    
    if (isNaN(requestId)) {
      return res.status(400).json({ message: "Invalid request ID" });
    }
    
    const request = await storage.getRequest(requestId);
    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }
    
    // Regular users can only see their own requests
    if (req.user!.role === "user" && request.userId !== req.user!.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    
    // Get items in request
    const requestItems = await storage.getRequestItemsByRequest(requestId);
    
    res.json(requestItems);
  });

  // Create request (all authenticated users)
  app.post("/api/requests", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const requestData = insertRequestSchema.parse({
        ...req.body,
        userId: req.user!.id
      });
      
      // Create request
      const request = await storage.createRequest(requestData);
      
      // Optimized: Get inventory data once instead of per-item queries
      const allInventory = await storage.getAllInventory();
      const inventoryMap = new Map();
      
      // Create efficient lookup map: "itemId-warehouseId" -> inventory
      for (const inv of allInventory) {
        const key = `${inv.itemId}-${inv.warehouseId}`;
        inventoryMap.set(key, inv);
      }
      
      // Check stock availability for each item in the requested warehouse
      let needsTransfer = false;
      const transferRequirements = [];
      
      // Optimized: Batch create request items and process stock checks
      if (req.body.items && Array.isArray(req.body.items)) {
        // Prepare batch data for request items
        const requestItemsData = [];
        
        for (const item of req.body.items) {
          try {
            const requestItemData = insertRequestItemSchema.parse({
              ...item,
              requestId: request.id
            });
            
            requestItemsData.push(requestItemData);
            
            // Check stock using pre-loaded inventory map
            const stockKey = `${item.itemId}-${requestData.warehouseId}`;
            const stockInWarehouse = inventoryMap.get(stockKey);
            
            if (!stockInWarehouse || stockInWarehouse.quantity < item.quantity) {
              needsTransfer = true;
              const shortfall = item.quantity - (stockInWarehouse?.quantity || 0);
              transferRequirements.push({
                itemId: item.itemId,
                requiredQuantity: shortfall,
                requestedQuantity: item.quantity,
                availableQuantity: stockInWarehouse?.quantity || 0
              });
            }
          } catch (error) {
            console.error("Error preparing request item:", error);
          }
        }
        
        // Create all request items at once
        for (const itemData of requestItemsData) {
          await storage.createRequestItem(itemData);
        }
      }
      
      // If transfer is needed, create transfer notifications and mark request
      if (needsTransfer) {
        await storage.updateRequest(request.id, { 
          status: "pending-transfer",
          notes: `${request.notes || ''}\n\nStock Transfer Required: Some items are not available in sufficient quantities in the requested warehouse.`
        });

        // Get all warehouses for reference
        const allWarehouses = await storage.getAllWarehouses();
        const allInventory = await storage.getAllInventory();

        // Create transfer notifications for each item that needs transfer
        for (const requirement of transferRequirements) {
          // Find warehouses that have the required item
          const availableInventory = allInventory.filter(inv => 
            inv.itemId === requirement.itemId && 
            inv.warehouseId !== requestData.warehouseId && 
            inv.quantity > 0
          );

          // Create notification for each warehouse that has stock
          for (const inv of availableInventory) {
            try {
              const sourceWarehouse = allWarehouses.find(w => w.id === inv.warehouseId);
              const targetWarehouse = allWarehouses.find(w => w.id === requestData.warehouseId);
              
              await storage.createTransferNotification({
                requestId: request.id,
                warehouseId: inv.warehouseId,
                itemId: requirement.itemId,
                requiredQuantity: Math.min(requirement.requiredQuantity, inv.quantity),
                availableQuantity: inv.quantity,
                status: 'pending',
                notifiedUserId: null, // Will be assigned when warehouse manager checks
                transferId: null,
                notes: `Transfer needed for request ${request.requestCode}. Item shortage in ${targetWarehouse?.name || 'requested warehouse'}. Available in ${sourceWarehouse?.name || 'source warehouse'}.`
              });
            } catch (error) {
              console.error("Error creating transfer notification:", error);
            }
          }
        }
      }

      // Create approval records based on user hierarchy and approval settings
      try {
        // For employees, get their manager for approval
        if (req.user!.role === "employee") {
          const manager = await storage.getUserManager(req.user!.id);
          if (manager) {
            await storage.createRequestApproval({
              requestId: request.id,
              approverId: manager.id,
              approvalLevel: "manager",
              status: "pending"
            });
          } else {
            // If no manager, require admin approval
            const admins = await storage.getAllUsers();
            const adminUser = admins.find(u => u.role === "admin");
            if (adminUser) {
              await storage.createRequestApproval({
                requestId: request.id,
                approverId: adminUser.id,
                approvalLevel: "admin",
                status: "pending"
              });
            }
          }
        } else if (req.user!.role === "manager") {
          // Managers need admin approval for high priority requests
          if (request.priority === "high") {
            const admins = await storage.getAllUsers();
            const adminUser = admins.find(u => u.role === "admin");
            if (adminUser) {
              await storage.createRequestApproval({
                requestId: request.id,
                approverId: adminUser.id,
                approvalLevel: "admin",
                status: "pending"
              });
            }
          }
        }
        // Admins can auto-approve their own requests (no approval record needed)
      } catch (error) {
        console.error("Error creating approval records:", error);
      }
      
      res.status(201).json(request);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Update request status (manager+)
  app.put("/api/requests/:id/status", checkRole("manager"), async (req, res) => {
    const requestId = parseInt(req.params.id, 10);
    
    try {
      const { status } = z.object({
        status: z.string().refine(
          s => ['pending', 'approved', 'rejected', 'completed'].includes(s),
          { message: "Invalid status" }
        )
      }).parse(req.body);
      
      // Get request
      const request = await storage.getRequest(requestId);
      if (!request) {
        return res.status(404).json({ message: "Request not found" });
      }
      
      // If approving or completing a request, handle the inventory changes
      if ((status === "approved" || status === "completed") && request.status === "pending") {
        // Get all items in the request
        const requestItems = await storage.getRequestItemsByRequest(requestId);
        
        // Check if items are available in the warehouse
        for (const requestItem of requestItems) {
          const inventory = await storage.getInventoryByItemAndWarehouse(
            requestItem.itemId,
            request.warehouseId
          );
          
          // If item is not in the requested warehouse, check if it's available in other warehouses
          if (!inventory || inventory.quantity < requestItem.quantity) {
            let foundInOtherWarehouse = false;
            
            // Check other warehouses
            const allWarehouses = await storage.getAllWarehouses();
            
            for (const warehouse of allWarehouses) {
              if (warehouse.id === request.warehouseId) continue;
              
              const otherInventory = await storage.getInventoryByItemAndWarehouse(
                requestItem.itemId,
                warehouse.id
              );
              
              if (otherInventory && otherInventory.quantity >= requestItem.quantity) {
                // Create a transfer transaction
                const trxCode = `TRX-${(await storage.getAllTransactions()).length + 873}`;
                await storage.createTransaction({
                  itemId: requestItem.itemId,
                  quantity: requestItem.quantity,
                  transactionType: "transfer",
                  sourceWarehouseId: warehouse.id,
                  destinationWarehouseId: request.warehouseId,
                  requestId: request.id,
                  requesterId: req.user!.id,
                  status: "in-transit"
                });
                
                // Update source warehouse inventory by subtracting the transferred quantity
                await storage.updateInventoryQuantity(
                  requestItem.itemId,
                  warehouse.id,
                  -requestItem.quantity
                );
                
                foundInOtherWarehouse = true;
                break;
              }
            }
            
            if (!foundInOtherWarehouse) {
              return res.status(400).json({ 
                message: `Not enough quantity of item ID ${requestItem.itemId} available in any warehouse` 
              });
            }
          } else {
            // Item is available in the requested warehouse, create an issue transaction
            const issueCode = `TRX-${(await storage.getAllTransactions()).length + 873}`;
            await storage.createTransaction({
              itemId: requestItem.itemId,
              quantity: requestItem.quantity,
              transactionType: "issue",
              sourceWarehouseId: request.warehouseId,
              requestId: request.id,
              requesterId: req.user!.id,
              status: "completed"
            });
            
            // Update inventory by subtracting the issued quantity
            await storage.updateInventoryQuantity(
              requestItem.itemId,
              request.warehouseId,
              -requestItem.quantity
            );
          }
        }
      }
      
      // Update request status
      const updatedRequest = await storage.updateRequest(requestId, { status });
      
      res.json(updatedRequest);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // ==== Report Routes ====
  // Get inventory stock report
  app.get("/api/reports/inventory-stock", async (req, res) => {
    try {
      const allInventory = await storage.getAllInventory();
      const allItems = await storage.getAllItems();
      const allWarehouses = await storage.getAllWarehouses();
      
      // Create a map of item details by ID
      const itemMap = new Map();
      allItems.forEach(item => {
        itemMap.set(item.id, item);
      });
      
      // Create a map of warehouse details by ID
      const warehouseMap = new Map();
      allWarehouses.forEach(warehouse => {
        warehouseMap.set(warehouse.id, warehouse);
      });
      
      // Create inventory report with item and warehouse details
      const inventoryReport = allInventory.map(inv => {
        const item = itemMap.get(inv.itemId);
        const warehouse = warehouseMap.get(inv.warehouseId);
        
        return {
          ...inv,
          item,
          warehouse,
          isLowStock: item && inv.quantity < item.minStockLevel
        };
      });
      
      res.json(inventoryReport);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Get inventory movement report (transactions)
  app.get("/api/reports/inventory-movement", async (req, res) => {
    try {
      const { startDate, endDate, warehouseId, type } = req.query;
      
      // Get all transactions
      let transactions = await storage.getAllTransactions();
      
      // Filter by date range if provided
      if (startDate) {
        const start = new Date(startDate as string);
        transactions = transactions.filter(t => new Date(t.createdAt) >= start);
      }
      
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999); // End of the day
        transactions = transactions.filter(t => new Date(t.createdAt) <= end);
      }
      
      // Filter by warehouse if provided
      if (warehouseId) {
        const warehouseIdNum = parseInt(warehouseId as string, 10);
        transactions = transactions.filter(t => 
          t.sourceWarehouseId === warehouseIdNum || 
          t.destinationWarehouseId === warehouseIdNum
        );
      }
      
      // Filter by transaction type if provided
      if (type && ['check-in', 'issue', 'transfer'].includes(type as string)) {
        transactions = transactions.filter(t => t.transactionType === type);
      }
      
      // Enrich transactions with item and warehouse details
      const allItems = await storage.getAllItems();
      const allWarehouses = await storage.getAllWarehouses();
      const allUsers = await storage.getAllUsers();
      
      // Create maps for lookup
      const itemMap = new Map();
      allItems.forEach(item => {
        itemMap.set(item.id, item);
      });
      
      const warehouseMap = new Map();
      allWarehouses.forEach(warehouse => {
        warehouseMap.set(warehouse.id, warehouse);
      });
      
      const userMap = new Map();
      allUsers.forEach(user => {
        userMap.set(user.id, user);
      });
      
      // Enrich data
      const enrichedTransactions = transactions.map(t => {
        return {
          ...t,
          item: itemMap.get(t.itemId),
          sourceWarehouse: t.sourceWarehouseId ? warehouseMap.get(t.sourceWarehouseId) : null,
          destinationWarehouse: t.destinationWarehouseId ? warehouseMap.get(t.destinationWarehouseId) : null,
          user: userMap.get(t.userId)
        };
      });
      
      res.json(enrichedTransactions);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Get dashboard summary
  app.get("/api/dashboard/summary", async (req, res) => {
    try {
      const totalItems = (await storage.getAllItems()).length;
      
      // Count low stock items
      const allInventory = await storage.getAllInventory();
      const allItems = await storage.getAllItems();
      
      const itemMap = new Map();
      allItems.forEach(item => {
        itemMap.set(item.id, item);
      });
      
      const lowStockItems = allInventory.filter(inv => {
        const item = itemMap.get(inv.itemId);
        return item && inv.quantity < item.minStockLevel;
      });
      
      // Count pending requests
      const pendingRequests = await storage.getRequestsByStatus('pending');
      
      // Get request items for pending requests to display correct item counts
      const pendingRequestsWithItems = await Promise.all(
        pendingRequests.slice(0, 3).map(async (request) => {
          const requestItems = await storage.getRequestItemsByRequest(request.id);
          return {
            ...request,
            items: requestItems
          };
        })
      );
      
      // Count active transfers
      const activeTransfers = (await storage.getAllTransactions())
        .filter(t => t.transactionType === 'transfer' && t.status === 'in-transit');
      
      // Get most recent transactions
      let recentTransactions = await storage.getAllTransactions();
      recentTransactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      recentTransactions = recentTransactions.slice(0, 5);
      
      res.json({
        totalItems,
        lowStockItemsCount: lowStockItems.length,
        pendingRequestsCount: pendingRequests.length,
        activeTransfersCount: activeTransfers.length,
        recentTransactions,
        lowStockItems: lowStockItems.slice(0, 5).map(inv => ({
          ...inv,
          item: itemMap.get(inv.itemId)
        })),
        pendingRequests: pendingRequestsWithItems
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Transfer notification routes
  // Get pending transfer notifications
  app.get("/api/transfer-notifications", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const notifications = await storage.getPendingTransferNotifications();
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching transfer notifications:", error);
      res.status(500).json({ message: "Failed to fetch transfer notifications" });
    }
  });

  // Get transfer notifications by warehouse
  app.get("/api/transfer-notifications/warehouse/:warehouseId", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const warehouseId = parseInt(req.params.warehouseId);
      const notifications = await storage.getTransferNotificationsByWarehouse(warehouseId);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching warehouse transfer notifications:", error);
      res.status(500).json({ message: "Failed to fetch warehouse transfer notifications" });
    }
  });

  // Update transfer notification status
  app.patch("/api/transfer-notifications/:id", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const id = parseInt(req.params.id);
      const updateData = req.body;
      
      const updatedNotification = await storage.updateTransferNotification(id, updateData);
      if (!updatedNotification) {
        return res.status(404).json({ message: "Transfer notification not found" });
      }
      
      res.json(updatedNotification);
    } catch (error) {
      console.error("Error updating transfer notification:", error);
      res.status(500).json({ message: "Failed to update transfer notification" });
    }
  });

  // Approve or reject approval request
  app.patch("/api/approvals/:id/:action", async (req: Request, res: Response) => {
    try {
      const { id, action } = req.params;
      const { notes } = req.body;

      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({ message: "Invalid action. Must be 'approve' or 'reject'" });
      }

      const approvalId = parseInt(id, 10);
      if (isNaN(approvalId)) {
        return res.status(400).json({ message: "Invalid approval ID" });
      }

      // Get the approval record
      const approval = await storage.getRequestApproval(approvalId);
      if (!approval) {
        return res.status(404).json({ message: "Approval not found" });
      }

      // Check if user has permission to approve this request
      if (approval.approverId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to approve this request" });
      }

      // Check if already processed
      if (approval.status !== 'pending') {
        return res.status(400).json({ message: "Approval already processed" });
      }

      // Update approval record
      const updatedApproval = await storage.updateRequestApproval(approvalId, {
        status: action === 'approve' ? 'approved' : 'rejected',
        approvedAt: new Date(),
        notes: notes || null
      });

      // Update request status based on approval
      const request = await storage.getRequest(approval.requestId);
      if (request) {
        let newStatus = action === 'approve' ? 'approved' : 'rejected';
        await storage.updateRequest(approval.requestId, { status: newStatus });
      }

      res.json(updatedApproval);
    } catch (error: any) {
      console.error("Error processing approval:", error);
      res.status(500).json({ message: "Failed to process approval" });
    }
  });

  // Export transactions to CSV
  app.get("/api/export/transactions", async (req, res) => {
    try {
      const transactions = await storage.getAllTransactions();
      const allItems = await storage.getAllItems();
      const allWarehouses = await storage.getAllWarehouses();
      const allUsers = await storage.getAllUsers();
      
      const itemMap = new Map();
      allItems.forEach(item => itemMap.set(item.id, item));
      
      const warehouseMap = new Map();
      allWarehouses.forEach(warehouse => warehouseMap.set(warehouse.id, warehouse));
      
      const userMap = new Map();
      allUsers.forEach(user => userMap.set(user.id, user));
      
      // CSV headers
      let csv = 'Transaction Code,Type,Item Name,SKU,Quantity,Unit,Source Warehouse,Destination Warehouse,Cost,Date,Status,User\n';
      
      // Add transaction data
      transactions.forEach(transaction => {
        const item = itemMap.get(transaction.itemId);
        const sourceWarehouse = transaction.sourceWarehouseId ? warehouseMap.get(transaction.sourceWarehouseId) : null;
        const destinationWarehouse = transaction.destinationWarehouseId ? warehouseMap.get(transaction.destinationWarehouseId) : null;
        const user = userMap.get(transaction.userId);
        
        csv += `"${transaction.transactionCode}",`;
        csv += `"${transaction.transactionType}",`;
        csv += `"${item?.name || `Item #${transaction.itemId}`}",`;
        csv += `"${item?.sku || 'N/A'}",`;
        csv += `${transaction.quantity},`;
        csv += `"${item?.unit || 'units'}",`;
        csv += `"${sourceWarehouse?.name || 'N/A'}",`;
        csv += `"${destinationWarehouse?.name || 'N/A'}",`;
        csv += `"${transaction.cost || 'N/A'}",`;
        csv += `"${transaction.createdAt.toISOString()}",`;
        csv += `"${transaction.status}",`;
        csv += `"${user?.name || 'Unknown'}"`;
        csv += '\n';
      });
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="inventory-movements.csv"');
      res.send(csv);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Get warehouse statistics
  app.get("/api/warehouses/stats", async (req, res) => {
    try {
      const warehouses = await storage.getAllWarehouses();
      const allInventory = await storage.getAllInventory();
      const allItems = await storage.getAllItems();
      const allUsers = await storage.getAllUsers();
      const allLocations = await storage.getAllLocations();
      
      // Create maps for lookups
      const itemMap = new Map();
      allItems.forEach(item => {
        itemMap.set(item.id, item);
      });
      
      const userMap = new Map();
      allUsers.forEach(user => {
        userMap.set(user.id, user);
      });
      
      const locationMap = new Map();
      allLocations.forEach(location => {
        locationMap.set(location.id, location);
      });
      
      // Calculate statistics for each warehouse
      const warehouseStats = await Promise.all(warehouses.map(async warehouse => {
        const warehouseInventory = allInventory.filter(inv => inv.warehouseId === warehouse.id);
        
        // Count total items
        const totalItems = warehouseInventory.reduce((sum, inv) => sum + inv.quantity, 0);
        
        // Count low stock items
        const lowStockItems = warehouseInventory.filter(inv => {
          const item = itemMap.get(inv.itemId);
          return item && inv.quantity < item.minStockLevel;
        });
        
        // Calculate capacity usage (rough estimation)
        const capacityUsed = Math.round((totalItems / warehouse.capacity) * 100);
        
        // Get manager details
        const manager = warehouse.managerId ? userMap.get(warehouse.managerId) : null;
        
        // Get location details
        const location = warehouse.locationId ? locationMap.get(warehouse.locationId) : null;
        
        return {
          ...warehouse,
          manager: manager ? { id: manager.id, name: manager.name, role: manager.role } : null,
          location: location ? location.name : 'Unknown Location',
          totalItems,
          lowStockItems: lowStockItems.length,
          capacityUsed
        };
      }));
      
      res.json(warehouseStats);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // ==== Export Routes ====
  // Export inventory stock as CSV
  app.get("/api/export/inventory-stock", async (req, res) => {
    try {
      const allInventory = await storage.getAllInventory();
      const allItems = await storage.getAllItems();
      const allWarehouses = await storage.getAllWarehouses();
      
      // Create maps for lookup
      const itemMap = new Map();
      allItems.forEach(item => {
        itemMap.set(item.id, item);
      });
      
      const warehouseMap = new Map();
      allWarehouses.forEach(warehouse => {
        warehouseMap.set(warehouse.id, warehouse);
      });
      
      // Create CSV header
      let csv = "Item ID,SKU,Item Name,Warehouse,Quantity,Min Stock Level,Low Stock\n";
      
      // Add inventory data
      allInventory.forEach(inv => {
        const item = itemMap.get(inv.itemId);
        const warehouse = warehouseMap.get(inv.warehouseId);
        
        if (item && warehouse) {
          const isLowStock = inv.quantity < item.minStockLevel;
          
          csv += `${item.id},${item.sku},"${item.name}","${warehouse.name}",${inv.quantity},${item.minStockLevel},${isLowStock}\n`;
        }
      });
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=inventory-stock.csv');
      res.send(csv);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Export transactions as CSV
  app.get("/api/export/transactions", async (req, res) => {
    try {
      const transactions = await storage.getAllTransactions();
      const allItems = await storage.getAllItems();
      const allWarehouses = await storage.getAllWarehouses();
      const allUsers = await storage.getAllUsers();
      
      // Create maps for lookup
      const itemMap = new Map();
      allItems.forEach(item => {
        itemMap.set(item.id, item);
      });
      
      const warehouseMap = new Map();
      allWarehouses.forEach(warehouse => {
        warehouseMap.set(warehouse.id, warehouse);
      });
      
      const userMap = new Map();
      allUsers.forEach(user => {
        userMap.set(user.id, user);
      });
      
      // Create CSV header
      let csv = "Transaction ID,Code,Date,Type,Item SKU,Item Name,Quantity,Source Warehouse,Destination Warehouse,Status,User\n";
      
      // Add transaction data
      transactions.forEach(t => {
        const item = itemMap.get(t.itemId);
        const sourceWarehouse = t.sourceWarehouseId ? warehouseMap.get(t.sourceWarehouseId) : null;
        const destWarehouse = t.destinationWarehouseId ? warehouseMap.get(t.destinationWarehouseId) : null;
        const user = userMap.get(t.userId);
        
        if (item) {
          csv += `${t.id},${t.transactionCode},"${new Date(t.createdAt).toISOString().split('T')[0]}",${t.transactionType},${item.sku},"${item.name}",${t.quantity},"${sourceWarehouse ? sourceWarehouse.name : ''}","${destWarehouse ? destWarehouse.name : ''}",${t.status},"${user ? user.name : ''}"\n`;
        }
      });
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=transactions.csv');
      res.send(csv);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Approval Settings routes (Admin only)
  app.get("/api/approval-settings", checkRole("admin"), async (req, res) => {
    try {
      const settings = await storage.getAllApprovalSettings();
      res.json(settings);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/approval-settings", checkRole("admin"), async (req, res) => {
    try {
      const settings = await storage.createApprovalSettings(req.body);
      res.status(201).json(settings);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/approval-settings/:id", checkRole("admin"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const settings = await storage.updateApprovalSettings(id, req.body);
      if (!settings) {
        return res.status(404).json({ message: "Approval settings not found" });
      }
      res.json(settings);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/approval-settings/:id", checkRole("admin"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteApprovalSettings(id);
      if (!deleted) {
        return res.status(404).json({ message: "Approval settings not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Organization settings routes (Read access for all authenticated users, Write access admin only)
  app.get("/api/organization-settings", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const settings = await db.select().from(organizationSettings).limit(1);
      if (settings.length === 0) {
        // Create default settings if none exist
        const defaultSettings = await db.insert(organizationSettings).values({
          organizationName: "My Organization",
          currency: "USD",
          currencySymbol: "$",
          timezone: "UTC",
          inventoryValuationMethod: "Last Value"
        }).returning();
        res.json(defaultSettings[0]);
      } else {
        res.json(settings[0]);
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/organization-settings", checkRole("admin"), async (req, res) => {
    try {
      const existing = await db.select().from(organizationSettings).limit(1);
      if (existing.length === 0) {
        // Create new settings
        const newSettings = await db.insert(organizationSettings).values({
          ...req.body,
        }).returning();
        res.json(newSettings[0]);
      } else {
        // Update existing settings
        const updated = await db.update(organizationSettings)
          .set({ ...req.body, updatedAt: new Date() })
          .where(eq(organizationSettings.id, existing[0].id))
          .returning();
        res.json(updated[0]);
      }
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // ==== Departments Routes ====
  // Get all departments
  app.get("/api/departments", async (req, res) => {
    try {
      const allDepartments = await db.select().from(departments);
      res.json(allDepartments);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Create department (admin only)
  app.post("/api/departments", checkRole("admin"), async (req, res) => {
    try {
      const departmentData = insertDepartmentSchema.parse(req.body);
      const newDepartment = await db.insert(departments).values(departmentData).returning();
      res.status(201).json(newDepartment[0]);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Update department (admin only)
  app.put("/api/departments/:id", checkRole("admin"), async (req, res) => {
    try {
      const departmentId = parseInt(req.params.id);
      const departmentData = insertDepartmentSchema.partial().parse(req.body);
      const updatedDepartment = await db.update(departments)
        .set(departmentData)
        .where(eq(departments.id, departmentId))
        .returning();
      
      if (updatedDepartment.length === 0) {
        return res.status(404).json({ message: "Department not found" });
      }
      res.json(updatedDepartment[0]);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Delete department (admin only)
  app.delete("/api/departments/:id", checkRole("admin"), async (req, res) => {
    try {
      const departmentId = parseInt(req.params.id);
      const deletedDepartment = await db.delete(departments)
        .where(eq(departments.id, departmentId))
        .returning();
      
      if (deletedDepartment.length === 0) {
        return res.status(404).json({ message: "Department not found" });
      }
      res.status(204).send();
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // User manager assignment routes
  app.put("/api/users/:id/manager", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { managerId } = req.body;
      
      const updatedUser = await storage.updateUser(userId, { managerId });
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(updatedUser);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // User department assignment routes (admin only)
  app.put("/api/users/:id/department", checkRole("admin"), async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { departmentId } = req.body;
      
      const updatedUser = await storage.updateUser(userId, { departmentId });
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(updatedUser);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Warehouse manager assignment routes
  app.put("/api/warehouses/:id/manager", async (req, res) => {
    try {
      const warehouseId = parseInt(req.params.id);
      const { managerId } = req.body;
      
      const updatedWarehouse = await storage.updateWarehouse(warehouseId, { managerId });
      if (!updatedWarehouse) {
        return res.status(404).json({ message: "Warehouse not found" });
      }
      
      res.json(updatedWarehouse);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Categories routes
  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await storage.getAllCategories();
      res.json(categories);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/categories", async (req, res) => {
    try {
      const category = await storage.createCategory(req.body);
      res.status(201).json(category);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/categories/:id", async (req, res) => {
    try {
      const categoryId = parseInt(req.params.id);
      const updatedCategory = await storage.updateCategory(categoryId, req.body);
      if (!updatedCategory) {
        return res.status(404).json({ message: "Category not found" });
      }
      res.json(updatedCategory);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/categories/:id", async (req, res) => {
    try {
      const categoryId = parseInt(req.params.id);
      const deleted = await storage.deleteCategory(categoryId);
      if (!deleted) {
        return res.status(404).json({ message: "Category not found" });
      }
      res.json({ message: "Category deleted successfully" });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Request Approval routes
  app.get("/api/request-approvals/:requestId", async (req, res) => {
    try {
      const requestId = parseInt(req.params.requestId);
      const approvals = await storage.getRequestApprovalsByRequest(requestId);
      res.json(approvals);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/pending-approvals", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const approvals = await storage.getRequestApprovalsByApprover(req.user.id);
      const pendingApprovals = approvals.filter(approval => approval.status === 'pending');
      
      // Get all reference data
      const allItems = await storage.getAllItems();
      const allWarehouses = await storage.getAllWarehouses();
      const allInventory = await storage.getAllInventory();
      // For now, we'll skip departments since they're not implemented yet
      const allDepartments: any[] = [];
      
      // Create maps for lookup
      const itemMap = new Map();
      allItems.forEach(item => itemMap.set(item.id, item));
      
      const warehouseMap = new Map();
      allWarehouses.forEach(warehouse => warehouseMap.set(warehouse.id, warehouse));
      
      const inventoryMap = new Map();
      allInventory.forEach(inv => {
        const key = `${inv.itemId}-${inv.warehouseId}`;
        inventoryMap.set(key, inv);
      });
      
      const departmentMap = new Map();
      allDepartments.forEach((dept: any) => departmentMap.set(dept.id, dept));
      
      // Enrich with complete request data
      const enrichedApprovals = await Promise.all(pendingApprovals.map(async approval => {
        const request = await storage.getRequest(approval.requestId);
        const requestItems = await storage.getRequestItemsByRequest(approval.requestId);
        const requester = request ? await storage.getUser(request.userId) : null;
        
        // Enrich request items with item details and availability
        const enrichedRequestItems = requestItems.map(requestItem => {
          const item = itemMap.get(requestItem.itemId);
          const inventoryKey = `${requestItem.itemId}-${request?.warehouseId}`;
          const inventory = inventoryMap.get(inventoryKey);
          const availableQuantity = inventory ? inventory.quantity : 0;
          
          return {
            ...requestItem,
            item,
            availableQuantity,
            isAvailable: availableQuantity >= requestItem.quantity
          };
        });
        
        // Enrich requester with department info
        const enrichedRequester = requester ? {
          ...requester,
          department: requester.departmentId ? departmentMap.get(requester.departmentId) : null
        } : null;
        
        // Enrich request with complete information
        const enrichedRequest = request ? {
          ...request,
          user: enrichedRequester,
          items: enrichedRequestItems,
          warehouse: warehouseMap.get(request.warehouseId),
          priority: request.priority || 'medium' // Default priority if not set
        } : null;
        
        return {
          ...approval,
          request: enrichedRequest
        };
      }));
      
      res.json(enrichedApprovals);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/request-approvals/:id/approve", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const approvalId = parseInt(req.params.id);
      const { comments } = req.body;
      
      const approval = await storage.getRequestApproval(approvalId);
      if (!approval) {
        return res.status(404).json({ message: "Approval not found" });
      }
      
      // Check if user can approve this request
      const canApprove = await storage.canApproveRequest(req.user.id, approval.requestId);
      if (!canApprove) {
        return res.status(403).json({ message: "You don't have permission to approve this request" });
      }
      
      const updatedApproval = await storage.updateRequestApproval(approvalId, {
        status: 'approved',
        comments,
        approvedAt: new Date()
      });
      
      // Check if all required approvals are complete
      const request = await storage.getRequest(approval.requestId);
      if (request) {
        const allApprovals = await storage.getRequestApprovalsByRequest(approval.requestId);
        const allApproved = allApprovals.every(app => app.status === 'approved');
        
        if (allApproved) {
          await storage.updateRequest(approval.requestId, { status: 'approved' });
        }
      }
      
      res.json(updatedApproval);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/request-approvals/:id/reject", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const approvalId = parseInt(req.params.id);
      const { comments } = req.body;
      
      const approval = await storage.getRequestApproval(approvalId);
      if (!approval) {
        return res.status(404).json({ message: "Approval not found" });
      }
      
      // Check if user can approve this request
      const canApprove = await storage.canApproveRequest(req.user.id, approval.requestId);
      if (!canApprove) {
        return res.status(403).json({ message: "You don't have permission to reject this request" });
      }
      
      const updatedApproval = await storage.updateRequestApproval(approvalId, {
        status: 'rejected',
        comments,
        approvedAt: new Date()
      });
      
      // Reject the entire request
      await storage.updateRequest(approval.requestId, { status: 'rejected' });
      
      res.json(updatedApproval);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // User hierarchy routes
  app.get("/api/users/:id/manager", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const manager = await storage.getUserManager(userId);
      res.json(manager);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/users/:id/hierarchy", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const hierarchy = await storage.getUserHierarchy(userId);
      res.json(hierarchy);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Warehouse Operator routes
  app.get("/api/warehouse-operators", checkRole("manager"), async (req, res) => {
    try {
      const operators = await storage.getAllWarehouseOperators();
      
      // Enrich with user and warehouse data
      const enrichedOperators = await Promise.all(operators.map(async (operator) => {
        const user = await storage.getUser(operator.userId);
        const warehouse = await storage.getWarehouse(operator.warehouseId);
        return {
          ...operator,
          user,
          warehouse
        };
      }));
      
      res.json(enrichedOperators);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/warehouse-operators/user/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const operators = await storage.getWarehouseOperatorsByUser(userId);
      res.json(operators);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/warehouse-operators/warehouse/:warehouseId", async (req, res) => {
    try {
      const warehouseId = parseInt(req.params.warehouseId);
      const operators = await storage.getWarehouseOperatorsByWarehouse(warehouseId);
      
      // Enrich with user data
      const enrichedOperators = await Promise.all(operators.map(async (operator) => {
        const user = await storage.getUser(operator.userId);
        return {
          ...operator,
          user
        };
      }));
      
      res.json(enrichedOperators);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/warehouse-operators", checkRole("manager"), async (req, res) => {
    try {
      const operatorData = insertWarehouseOperatorSchema.parse(req.body);
      const newOperator = await storage.createWarehouseOperator(operatorData);
      res.status(201).json(newOperator);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/warehouse-operators/:id", checkRole("manager"), async (req, res) => {
    try {
      const operatorId = parseInt(req.params.id);
      const operatorData = insertWarehouseOperatorSchema.partial().parse(req.body);
      const updatedOperator = await storage.updateWarehouseOperator(operatorId, operatorData);
      
      if (!updatedOperator) {
        return res.status(404).json({ message: "Warehouse operator not found" });
      }
      res.json(updatedOperator);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/warehouse-operators/:id", checkRole("manager"), async (req, res) => {
    try {
      const operatorId = parseInt(req.params.id);
      const deleted = await storage.deleteWarehouseOperator(operatorId);
      
      if (!deleted) {
        return res.status(404).json({ message: "Warehouse operator not found" });
      }
      res.status(204).send();
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/users/:userId/operated-warehouses", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const warehouseIds = await storage.getUserOperatedWarehouses(userId);
      res.json(warehouseIds);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/users/:userId/is-warehouse-operator/:warehouseId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const warehouseId = parseInt(req.params.warehouseId);
      const isOperator = await storage.isUserWarehouseOperator(userId, warehouseId);
      res.json({ isOperator });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Rejected Goods Management Routes
  app.get("/api/rejected-goods", async (req: Request, res: Response) => {
    try {
      const rejectedGoods = await storage.getAllRejectedGoods();
      
      // Enrich with item and warehouse details
      const enrichedGoods = await Promise.all(rejectedGoods.map(async (goods) => {
        const item = await storage.getItem(goods.itemId);
        const warehouse = await storage.getWarehouse(goods.warehouseId);
        const rejectedByUser = await storage.getUser(goods.rejectedBy);
        return { ...goods, item, warehouse, rejectedByUser };
      }));
      
      res.json(enrichedGoods);
    } catch (error) {
      console.error("Error fetching rejected goods:", error);
      res.status(500).json({ message: "Failed to fetch rejected goods" });
    }
  });

  app.get("/api/rejected-goods/warehouse/:warehouseId", async (req: Request, res: Response) => {
    try {
      const warehouseId = parseInt(req.params.warehouseId);
      const rejectedGoods = await storage.getRejectedGoodsByWarehouse(warehouseId);
      
      // Enrich with item details
      const enrichedGoods = await Promise.all(rejectedGoods.map(async (goods) => {
        const item = await storage.getItem(goods.itemId);
        const rejectedByUser = await storage.getUser(goods.rejectedBy);
        return { ...goods, item, rejectedByUser };
      }));
      
      res.json(enrichedGoods);
    } catch (error) {
      console.error("Error fetching rejected goods by warehouse:", error);
      res.status(500).json({ message: "Failed to fetch rejected goods" });
    }
  });

  app.patch("/api/rejected-goods/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const updatedGoods = await storage.updateRejectedGoods(id, req.body);
      if (!updatedGoods) {
        return res.status(404).json({ message: "Rejected goods not found" });
      }
      res.json(updatedGoods);
    } catch (error) {
      console.error("Error updating rejected goods:", error);
      res.status(500).json({ message: "Failed to update rejected goods" });
    }
  });

  // Enhanced Transfer Management Routes
  
  // Get all transfers with enriched data
  app.get("/api/transfers", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const transfers = await storage.getAllTransfers();
      
      // Enrich transfers with additional data
      const enrichedTransfers = await Promise.all(transfers.map(async (transfer) => {
        const sourceWarehouse = await storage.getWarehouse(transfer.sourceWarehouseId);
        const destinationWarehouse = await storage.getWarehouse(transfer.destinationWarehouseId);
        const initiatedByUser = await storage.getUser(transfer.initiatedBy);
        const approvedByUser = transfer.approvedBy ? await storage.getUser(transfer.approvedBy) : null;
        const transferItems = await storage.getTransferItemsByTransfer(transfer.id);
        
        // Enrich transfer items with item details
        const enrichedItems = await Promise.all(transferItems.map(async (item) => {
          const itemDetails = await storage.getItem(item.itemId);
          return { ...item, item: itemDetails };
        }));

        return {
          ...transfer,
          sourceWarehouse,
          destinationWarehouse,
          initiatedByUser,
          approvedByUser,
          items: enrichedItems
        };
      }));

      res.json(enrichedTransfers);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Get transfers by status
  app.get("/api/transfers/status/:status", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const status = req.params.status;
      const transfers = await storage.getTransfersByStatus(status);
      
      // Enrich with basic data
      const enrichedTransfers = await Promise.all(transfers.map(async (transfer) => {
        const sourceWarehouse = await storage.getWarehouse(transfer.sourceWarehouseId);
        const destinationWarehouse = await storage.getWarehouse(transfer.destinationWarehouseId);
        const initiatedByUser = await storage.getUser(transfer.initiatedBy);
        
        return {
          ...transfer,
          sourceWarehouse,
          destinationWarehouse,
          initiatedByUser
        };
      }));

      res.json(enrichedTransfers);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Create new transfer
  app.post("/api/transfers", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const transferData = insertTransferSchema.parse({
        ...req.body,
        initiatedBy: req.user!.id,
        expectedShipmentDate: req.body.expectedShipmentDate ? new Date(req.body.expectedShipmentDate) : null,
        expectedArrivalDate: req.body.expectedArrivalDate ? new Date(req.body.expectedArrivalDate) : null
      });

      const transfer = await storage.createTransfer(transferData);

      // Create transfer items
      if (req.body.items && Array.isArray(req.body.items)) {
        for (const item of req.body.items) {
          await storage.createTransferItem({
            transferId: transfer.id,
            itemId: item.itemId,
            requestedQuantity: item.requestedQuantity,
            approvedQuantity: item.requestedQuantity // Initially same as requested
          });
        }
      }

      // Create initial transfer update
      await storage.createTransferUpdate({
        transferId: transfer.id,
        updatedBy: req.user!.id,
        status: 'pending',
        updateType: 'status_change',
        description: 'Transfer created'
      });

      res.status(201).json(transfer);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Get specific transfer with full details
  app.get("/api/transfers/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const transferId = parseInt(req.params.id);
      const transfer = await storage.getTransfer(transferId);

      if (!transfer) {
        return res.status(404).json({ message: "Transfer not found" });
      }

      // Get enriched data
      const sourceWarehouse = await storage.getWarehouse(transfer.sourceWarehouseId);
      const destinationWarehouse = await storage.getWarehouse(transfer.destinationWarehouseId);
      const initiatedByUser = await storage.getUser(transfer.initiatedBy);
      const approvedByUser = transfer.approvedBy ? await storage.getUser(transfer.approvedBy) : null;
      const transferItems = await storage.getTransferItemsByTransfer(transfer.id);
      const transferUpdates = await storage.getTransferUpdatesByTransfer(transfer.id);

      // Enrich transfer items with item details
      const enrichedItems = await Promise.all(transferItems.map(async (item) => {
        const itemDetails = await storage.getItem(item.itemId);
        return { ...item, item: itemDetails };
      }));

      // Enrich transfer updates with user details
      const enrichedUpdates = await Promise.all(transferUpdates.map(async (update) => {
        const user = await storage.getUser(update.updatedBy);
        return { ...update, user };
      }));

      res.json({
        ...transfer,
        sourceWarehouse,
        destinationWarehouse,
        initiatedByUser,
        approvedByUser,
        items: enrichedItems,
        updates: enrichedUpdates
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Update transfer (for status changes, shipment details, etc.)
  app.patch("/api/transfers/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const transferId = parseInt(req.params.id);
      const user = req.user!;
      
      // Get the transfer to check permissions
      const transfer = await storage.getTransfer(transferId);
      if (!transfer) {
        return res.status(404).json({ message: "Transfer not found" });
      }

      // Get warehouse information to check management roles
      const sourceWarehouse = await storage.getWarehouse(transfer.sourceWarehouseId);
      const destinationWarehouse = await storage.getWarehouse(transfer.destinationWarehouseId);
      
      // Check if user manages source or destination warehouse
      const managesSourceWarehouse = user.role === 'admin' || sourceWarehouse?.managerId === user.id;
      const managesDestinationWarehouse = user.role === 'admin' || destinationWarehouse?.managerId === user.id;
      
      // Define field permissions based on role and warehouse management
      const sourceWarehouseFields = [
        'receiptNumber', 'handoverPersonName', 'handoverPersonContact', 'handoverDate',
        'courierName', 'trackingNumber', 'transportNotes'
      ];
      
      const destinationWarehouseFields = [
        'receivedBy', 'receivedDate', 'receiverNotes', 'overallCondition'
      ];
      
      // Status change permissions
      const canUpdateStatus = (newStatus: string) => {
        if (newStatus === 'in-transit' && transfer.status === 'approved') {
          return managesSourceWarehouse;
        }
        if ((newStatus === 'completed' || newStatus === 'rejected') && transfer.status === 'in-transit') {
          return managesDestinationWarehouse;
        }
        return false;
      };
      
      const filteredData: any = {};
      
      // Check permissions for each field
      for (const [field, value] of Object.entries(req.body)) {
        if (value === undefined) continue;
        
        if (field === 'status') {
          if (canUpdateStatus(value as string)) {
            filteredData[field] = value;
          } else {
            return res.status(403).json({ 
              message: `You don't have permission to change status to ${value}` 
            });
          }
        } else if (sourceWarehouseFields.includes(field)) {
          if (managesSourceWarehouse) {
            filteredData[field] = value;
          } else {
            return res.status(403).json({ 
              message: `Only source warehouse managers can update ${field}` 
            });
          }
        } else if (destinationWarehouseFields.includes(field)) {
          if (managesDestinationWarehouse) {
            filteredData[field] = value;
          } else {
            return res.status(403).json({ 
              message: `Only destination warehouse managers can update ${field}` 
            });
          }
        } else if (['items', 'rejectionReason'].includes(field)) {
          // Items and rejection reason can be updated by destination warehouse managers
          if (managesDestinationWarehouse) {
            filteredData[field] = value;
          } else {
            return res.status(403).json({ 
              message: `Only destination warehouse managers can update ${field}` 
            });
          }
        }
      }

      // Convert date strings to Date objects
      if (filteredData.expectedShipmentDate) {
        filteredData.expectedShipmentDate = new Date(filteredData.expectedShipmentDate);
      }
      if (filteredData.expectedArrivalDate) {
        filteredData.expectedArrivalDate = new Date(filteredData.expectedArrivalDate);
      }
      if (filteredData.actualShipmentDate) {
        filteredData.actualShipmentDate = new Date(filteredData.actualShipmentDate);
      }
      if (filteredData.actualArrivalDate) {
        filteredData.actualArrivalDate = new Date(filteredData.actualArrivalDate);
      }
      if (filteredData.handoverDate) {
        filteredData.handoverDate = new Date(filteredData.handoverDate);
      }
      if (filteredData.receivedDate) {
        filteredData.receivedDate = new Date(filteredData.receivedDate);
      }

      const updatedTransfer = await storage.updateTransfer(transferId, filteredData);

      // Handle inventory updates when transfer is completed (accepted) or rejected
      if ((filteredData.status === 'completed' || filteredData.status === 'rejected') && updatedTransfer) {
        const transferItems = await storage.getTransferItemsByTransfer(transferId);
        if (transferItems && transferItems.length > 0) {
          
          if (filteredData.status === 'completed') {
            // Handle accepted transfer - normal inventory flow
            for (const item of transferItems) {
              // Remove from source warehouse
              await storage.updateInventoryQuantity(
                item.itemId, 
                updatedTransfer.sourceWarehouseId, 
                -item.requestedQuantity
              );
              
              // Add to destination warehouse
              await storage.updateInventoryQuantity(
                item.itemId, 
                updatedTransfer.destinationWarehouseId, 
                item.actualQuantity || item.requestedQuantity
              );

              // Create transaction records for transfer out
              await storage.createTransaction({
                itemId: item.itemId,
                sourceWarehouseId: updatedTransfer.sourceWarehouseId,
                userId: req.user!.id,
                requesterId: req.user!.id,
                transactionType: 'check-out',
                quantity: item.requestedQuantity,
              });

              // Create transaction records for transfer in
              await storage.createTransaction({
                itemId: item.itemId,
                destinationWarehouseId: updatedTransfer.destinationWarehouseId,
                userId: req.user!.id,
                requesterId: filteredData.receivedBy || req.user!.id,
                transactionType: 'check-in',
                quantity: item.actualQuantity || item.requestedQuantity,
              });
            }
          } else if (filteredData.status === 'rejected') {
            // Handle rejected transfer - move items to rejected goods
            for (const item of transferItems) {
              // Remove from source warehouse (already shipped)
              await storage.updateInventoryQuantity(
                item.itemId, 
                updatedTransfer.sourceWarehouseId, 
                -item.requestedQuantity
              );

              // Create rejected goods record
              await storage.createRejectedGoods({
                transferId: transferId,
                itemId: item.itemId,
                quantity: item.requestedQuantity,
                rejectionReason: filteredData.receiverNotes || 'Transfer rejected by destination warehouse',
                rejectedBy: req.user!.id,
                warehouseId: updatedTransfer.destinationWarehouseId,
                status: 'rejected',
                notes: filteredData.receiverNotes
              });

              // Create transaction record for rejection
              await storage.createTransaction({
                itemId: item.itemId,
                sourceWarehouseId: updatedTransfer.sourceWarehouseId,
                userId: req.user!.id,
                requesterId: req.user!.id,
                transactionType: 'check-out',
                quantity: item.requestedQuantity,
              });
            }
          }
        }
      }

      if (!updatedTransfer) {
        return res.status(404).json({ message: "Transfer not found" });
      }

      // Create transfer update log
      await storage.createTransferUpdate({
        transferId,
        updatedBy: req.user!.id,
        status: updatedTransfer.status,
        updateType: req.body.updateType || 'status_change',
        description: req.body.updateDescription || `Transfer updated`,
        metadata: req.body.metadata ? JSON.stringify(req.body.metadata) : undefined
      });

      res.json(updatedTransfer);
    } catch (error: any) {
      console.error('Transfer update error:', error);
      res.status(400).json({ message: error.message });
    }
  });

  // Update transfer items (for received quantities, condition, etc.)
  app.patch("/api/transfers/:transferId/items/:itemId", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const transferId = parseInt(req.params.transferId);
      const itemId = parseInt(req.params.itemId);
      const updateData = insertTransferItemSchema.partial().parse(req.body);

      const updatedItem = await storage.updateTransferItem(itemId, updateData);

      if (!updatedItem) {
        return res.status(404).json({ message: "Transfer item not found" });
      }

      // Create update log
      await storage.createTransferUpdate({
        transferId,
        updatedBy: req.user!.id,
        status: 'updated',
        updateType: 'receipt_info',
        description: `Item ${itemId} updated`,
        metadata: JSON.stringify(updateData)
      });

      res.json(updatedItem);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // ==== Notification Routes ====
  // Get notifications for the current user
  app.get("/api/notifications", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const { category, status, page = 1, limit = 20 } = req.query;
      let notifications;
      
      if (category) {
        notifications = await storage.getNotificationsByCategory(req.user.id, category as string);
      } else {
        notifications = await storage.getNotificationsByRecipient(req.user.id);
      }
      
      // Filter by status if provided
      if (status) {
        notifications = notifications.filter(n => n.status === status);
      }
      
      // Add sender information
      const enrichedNotifications = await Promise.all(notifications.map(async (notification) => {
        const sender = await storage.getUser(notification.senderId);
        return {
          ...notification,
          sender: sender ? { id: sender.id, name: sender.name, role: sender.role } : null
        };
      }));
      
      res.json(enrichedNotifications);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get unread notification count
  app.get("/api/notifications/unread-count", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const count = await storage.getUnreadNotificationCount(req.user.id);
      res.json({ count });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get notification thread
  app.get("/api/notifications/:id/thread", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const notificationId = parseInt(req.params.id);
      const thread = await storage.getNotificationThread(notificationId);
      
      // Add sender information to each notification
      const enrichedThread = await Promise.all(thread.map(async (notification) => {
        const sender = await storage.getUser(notification.senderId);
        return {
          ...notification,
          sender: sender ? { id: sender.id, name: sender.name, role: sender.role } : null
        };
      }));
      
      res.json(enrichedThread);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create a new notification (supports multiple recipients)
  app.post("/api/notifications", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const { recipientIds, recipientType, ...notificationData } = req.body;
      
      let targetRecipients = [];
      
      if (recipientType === 'specific' && recipientIds) {
        // Send to specific users
        targetRecipients = recipientIds;
      } else if (recipientType === 'admins') {
        // Send to all admins
        const adminUsers = await db.select({ id: users.id })
          .from(users)
          .where(eq(users.role, 'admin'));
        targetRecipients = adminUsers.map(u => u.id);
      } else if (recipientType === 'managers') {
        // Send to all managers
        const managerUsers = await db.select({ id: users.id })
          .from(users)
          .where(eq(users.role, 'manager'));
        targetRecipients = managerUsers.map(u => u.id);
      } else if (recipientType === 'all') {
        // Send to all users (admin only)
        if (req.user.role !== 'admin') {
          return res.status(403).json({ message: "Only admins can send to all users" });
        }
        const allUsers = await db.select({ id: users.id })
          .from(users);
        targetRecipients = allUsers.map(u => u.id).filter(id => id !== req.user!.id);
      } else if (notificationData.recipientId) {
        // Single recipient (backward compatibility)
        targetRecipients = [notificationData.recipientId];
      }
      
      const createdNotifications = [];
      
      for (const recipientId of targetRecipients) {
        const validatedData = insertNotificationSchema.parse({
          ...notificationData,
          senderId: req.user.id,
          recipientId: recipientId
        });
        
        const notification = await storage.createNotification(validatedData);
        createdNotifications.push(notification);
      }
      
      // Log notification creation
      await storage.createAuditLog({
        userId: req.user!.id,
        action: "CREATE",
        entityType: "notification",
        entityId: createdNotifications[0]?.id || 0,
        details: `Created notification to ${targetRecipients.length} recipients: ${notificationData.subject}`
      });
      
      res.status(201).json({ 
        message: `Notification sent to ${targetRecipients.length} recipients`,
        notifications: createdNotifications 
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Reply to a notification
  app.post("/api/notifications/:id/reply", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const parentId = parseInt(req.params.id);
      const parentNotification = await storage.getNotification(parentId);
      
      if (!parentNotification) {
        return res.status(404).json({ message: "Notification not found" });
      }
      
      // Create reply notification
      const replyData = insertNotificationSchema.parse({
        senderId: req.user.id,
        recipientId: parentNotification.senderId,
        subject: `Re: ${parentNotification.subject}`,
        message: req.body.message,
        category: parentNotification.category,
        priority: req.body.priority || 'normal',
        parentId: parentId,
        relatedEntityType: parentNotification.relatedEntityType,
        relatedEntityId: parentNotification.relatedEntityId
      });
      
      const reply = await storage.createNotification(replyData);
      
      // Mark original notification as replied
      await storage.markNotificationAsReplied(parentId);
      
      res.status(201).json(reply);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Mark notification as read
  app.patch("/api/notifications/:id/read", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const notificationId = parseInt(req.params.id);
      const notification = await storage.getNotification(notificationId);
      
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }
      
      // Only the recipient can mark as read
      if (notification.recipientId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const updatedNotification = await storage.markNotificationAsRead(notificationId);
      res.json(updatedNotification);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Close notification (no reply needed)
  app.patch("/api/notifications/:id/close", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const notificationId = parseInt(req.params.id);
      const notification = await storage.getNotification(notificationId);
      
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }
      
      // Only the recipient can close
      if (notification.recipientId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const updatedNotification = await storage.markNotificationAsClosed(notificationId);
      res.json(updatedNotification);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Archive notification
  app.patch("/api/notifications/:id/archive", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const notificationId = parseInt(req.params.id);
      const notification = await storage.getNotification(notificationId);
      
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }
      
      // Only the recipient can archive
      if (notification.recipientId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const updatedNotification = await storage.archiveNotification(notificationId);
      res.json(updatedNotification);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Get users for notification recipients (managers, admins, etc.)
  app.get("/api/notifications/recipients", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const allUsers = await storage.getAllUsers();
      
      // Filter based on user role - users can send to managers and admins
      let availableRecipients = [];
      
      if (req.user!.role === 'admin') {
        // Admins can send to anyone
        availableRecipients = allUsers.filter(u => u.id !== req.user!.id);
      } else if (req.user!.role === 'manager') {
        // Managers can send to other managers, admins, and their subordinates
        availableRecipients = allUsers.filter(u => 
          u.id !== req.user!.id && 
          (u.role === 'admin' || u.role === 'manager' || u.managerId === req.user!.id)
        );
      } else {
        // Regular users can send to managers and admins
        availableRecipients = allUsers.filter(u => 
          u.id !== req.user!.id && 
          (u.role === 'admin' || u.role === 'manager')
        );
      }
      
      const recipients = availableRecipients.map(user => ({
        id: user.id,
        name: user.name,
        role: user.role,
        email: user.email
      }));
      
      res.json(recipients);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Cleanup archived notifications (maintenance endpoint)
  app.post("/api/notifications/cleanup", checkRole("admin"), async (req, res) => {
    try {
      const deletedCount = await storage.cleanupArchivedNotifications();
      res.json({ deletedCount, message: `Cleaned up ${deletedCount} old notifications` });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get audit logs
  app.get("/api/audit-logs", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      let whereConditions;

      if (req.user.role === 'admin') {
        // Admins can view all audit logs
        whereConditions = undefined;
      } else if (req.user.role === 'manager') {
        // Managers can view their own logs and logs of their subordinates
        whereConditions = or(
          eq(auditLogs.userId, req.user.id),
          exists(
            db.select()
              .from(users)
              .where(and(
                eq(users.id, auditLogs.userId),
                eq(users.managerId, req.user.id)
              ))
          )
        );
      } else {
        // Regular users can only view their own audit logs
        whereConditions = eq(auditLogs.userId, req.user.id);
      }

      const query = db.select({
        id: auditLogs.id,
        userId: auditLogs.userId,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        details: auditLogs.details,
        oldValues: auditLogs.oldValues,
        newValues: auditLogs.newValues,
        ipAddress: auditLogs.ipAddress,
        userAgent: auditLogs.userAgent,
        createdAt: auditLogs.createdAt,
        user: {
          id: users.id,
          name: users.name,
          username: users.username,
          email: users.email
        }
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .orderBy(desc(auditLogs.createdAt))
      .limit(100);

      const logs = whereConditions ? await query.where(whereConditions) : await query;

      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get issues (filtered by warehouse access)
  app.get("/api/issues", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const allIssues = await storage.getAllIssues();
      
      // Filter issues based on user's access level
      let filteredIssues = allIssues;
      
      if (req.user.role !== 'admin') {
        filteredIssues = allIssues.filter(issue => {
          // User can see issues they reported, are assigned to, or from their warehouse
          return issue.reportedBy === req.user!.id ||
                 issue.assignedTo === req.user!.id ||
                 (issue.warehouseId && req.user!.warehouseId === issue.warehouseId);
        });
      }

      res.json(filteredIssues);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get inventory valuation report
  app.get("/api/reports/inventory-valuation", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // Get the "as of" date from query parameters, default to current date
      const asOfDateParam = req.query.asOfDate as string;
      const asOfDate = asOfDateParam ? new Date(asOfDateParam) : new Date();
      
      // Set the end of day for the as of date to include all transactions from that day
      asOfDate.setHours(23, 59, 59, 999);

      // Get organization settings to determine valuation method
      const orgSettings = await db.select().from(organizationSettings).limit(1);
      const valuationMethod = orgSettings[0]?.inventoryValuationMethod || 'Last Value';

      // Optimized: Get all inventory with item, warehouse, and category details in one query
      const inventoryData = await db.select({
        inventoryId: inventory.id,
        itemId: inventory.itemId,
        warehouseId: inventory.warehouseId,
        quantity: inventory.quantity,
        itemName: items.name,
        itemSku: items.sku,
        itemCategoryId: items.categoryId,
        itemUnit: items.unit,
        warehouseName: warehouses.name,
        categoryName: categories.name,
      })
      .from(inventory)
      .leftJoin(items, eq(inventory.itemId, items.id))
      .leftJoin(warehouses, eq(inventory.warehouseId, warehouses.id))
      .leftJoin(categories, eq(items.categoryId, categories.id));

      // Optimized: Get ALL relevant transactions in one bulk query instead of per-item queries
      const allTransactions = await db.select({
        id: transactions.id,
        itemId: transactions.itemId,
        quantity: transactions.quantity,
        transactionType: transactions.transactionType,
        sourceWarehouseId: transactions.sourceWarehouseId,
        destinationWarehouseId: transactions.destinationWarehouseId,
        status: transactions.status,
        cost: transactions.cost,
        createdAt: transactions.createdAt,
      })
      .from(transactions)
      .where(lte(transactions.createdAt, asOfDate))
      .orderBy(transactions.itemId, transactions.createdAt);

      // Create efficient lookup maps to avoid repeated queries
      const transactionsByItem = new Map();
      const checkInsByItemWarehouse = new Map();

      // Group transactions by item for efficient processing
      for (const transaction of allTransactions) {
        // Group all transactions by item
        if (!transactionsByItem.has(transaction.itemId)) {
          transactionsByItem.set(transaction.itemId, []);
        }
        transactionsByItem.get(transaction.itemId).push(transaction);

        // Group check-in transactions by item-warehouse combination
        if (transaction.transactionType === 'check-in' && transaction.destinationWarehouseId) {
          const key = `${transaction.itemId}-${transaction.destinationWarehouseId}`;
          if (!checkInsByItemWarehouse.has(key)) {
            checkInsByItemWarehouse.set(key, []);
          }
          checkInsByItemWarehouse.get(key).push(transaction);
        }
      }

      const valuationReport = [];

      for (const invItem of inventoryData) {
        if (!invItem.itemId) continue;

        // Get pre-grouped transactions for this item (no database query needed)
        const itemTransactions = transactionsByItem.get(invItem.itemId) || [];

        // Calculate inventory position as of the date by processing transactions for this warehouse
        let inventoryAsOfDate = 0;
        for (const transaction of itemTransactions) {
          if (transaction.transactionType === 'check-in' && transaction.destinationWarehouseId === invItem.warehouseId) {
            inventoryAsOfDate += transaction.quantity;
          } else if (transaction.transactionType === 'issue' && transaction.sourceWarehouseId === invItem.warehouseId) {
            inventoryAsOfDate -= transaction.quantity;
          } else if (transaction.transactionType === 'transfer') {
            if (transaction.sourceWarehouseId === invItem.warehouseId) {
              inventoryAsOfDate -= transaction.quantity;
            }
            if (transaction.destinationWarehouseId === invItem.warehouseId && transaction.status === 'completed') {
              inventoryAsOfDate += transaction.quantity;
            }
          }
        }

        // Skip if no inventory as of the selected date
        if (inventoryAsOfDate <= 0) {
          continue;
        }

        // Get check-in transactions for this item-warehouse combination (pre-grouped)
        const checkInKey = `${invItem.itemId}-${invItem.warehouseId}`;
        const checkInTransactions = checkInsByItemWarehouse.get(checkInKey) || [];

        if (checkInTransactions.length === 0) {
          // No check-in transactions, skip this item
          continue;
        }

        let unitValue = 0;
        let lastCheckInDate = null;
        let firstCheckInDate = null;

        if (checkInTransactions.length > 0) {
          firstCheckInDate = checkInTransactions[0].createdAt;
          lastCheckInDate = checkInTransactions[checkInTransactions.length - 1].createdAt;
        }

        // Calculate unit value based on valuation method
        switch (valuationMethod) {
          case 'Last Value':
            // Use the cost from the most recent check-in
            const lastTransaction = checkInTransactions[checkInTransactions.length - 1];
            unitValue = parseFloat(lastTransaction.cost || '0');
            break;

          case 'Earliest Value':
            // Use the cost from the first check-in
            const firstTransaction = checkInTransactions[0];
            unitValue = parseFloat(firstTransaction.cost || '0');
            break;

          case 'Average Value':
            // Calculate weighted average: total cost / total quantity
            let totalCost = 0;
            let totalQuantity = 0;
            
            for (const transaction of checkInTransactions) {
              const cost = parseFloat(transaction.cost || '0');
              if (cost && transaction.quantity) {
                totalCost += cost * transaction.quantity;
                totalQuantity += transaction.quantity;
              }
            }
            
            unitValue = totalQuantity > 0 ? totalCost / totalQuantity : 0;
            break;

          default:
            unitValue = 0;
        }

        const totalValue = unitValue * inventoryAsOfDate;

        valuationReport.push({
          id: invItem.inventoryId,
          name: invItem.itemName || 'Unknown Item',
          sku: invItem.itemSku || 'N/A',
          category: invItem.categoryName || 'Uncategorized',
          warehouse: invItem.warehouseName || 'Unknown Warehouse',
          currentStock: inventoryAsOfDate,
          unit: invItem.itemUnit || 'pcs',
          unitValue: unitValue,
          totalValue: totalValue,
          valuationMethod: valuationMethod,
          lastCheckInDate: lastCheckInDate,
          firstCheckInDate: firstCheckInDate,
        });
      }

      // Log audit event
      await logAuditEvent(
        req.user.id,
        'VIEW',
        'report',
        null,
        `Generated inventory valuation report using ${valuationMethod} method`,
        null,
        null,
        req
      );

      res.json(valuationReport);
    } catch (error: any) {
      console.error('Error generating inventory valuation report:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create new issue
  app.post("/api/issues", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const issueData = {
        ...req.body,
        reportedBy: req.user.id,
        status: 'open'
      };

      const newIssue = await storage.createIssue(issueData);
      res.status(201).json(newIssue);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update issue status
  app.patch("/api/issues/:id/status", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { id } = req.params;
      const { status } = req.body;

      const updatedIssue = await storage.updateIssue(parseInt(id), { status }, req.user.id);
      
      if (!updatedIssue) {
        return res.status(404).json({ message: "Issue not found" });
      }

      res.json(updatedIssue);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Close issue with resolution comments
  app.patch("/api/issues/:id/close", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { id } = req.params;
      const { resolutionNotes } = req.body;

      if (!resolutionNotes || resolutionNotes.trim() === '') {
        return res.status(400).json({ message: "Resolution comments are required when closing an issue" });
      }

      const closedIssue = await storage.closeIssue(parseInt(id), req.user.id, resolutionNotes);
      
      if (!closedIssue) {
        return res.status(404).json({ message: "Issue not found" });
      }

      res.json(closedIssue);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Reopen issue (only for original reporter)
  app.patch("/api/issues/:id/reopen", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { id } = req.params;
      const issue = await storage.getIssue(parseInt(id));
      
      if (!issue) {
        return res.status(404).json({ message: "Issue not found" });
      }

      // Only the original reporter can reopen the issue
      if (issue.reportedBy !== req.user.id) {
        return res.status(403).json({ message: "Only the original reporter can reopen this issue" });
      }

      if (issue.status !== 'closed') {
        return res.status(400).json({ message: "Issue is not closed" });
      }

      const reopenedIssue = await storage.reopenIssue(parseInt(id), req.user.id);
      
      if (!reopenedIssue) {
        return res.status(404).json({ message: "Issue not found" });
      }

      res.json(reopenedIssue);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get issue activity log
  app.get("/api/issues/:id/activities", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { id } = req.params;
      const issue = await storage.getIssue(parseInt(id));
      
      if (!issue) {
        return res.status(404).json({ message: "Issue not found" });
      }

      // Allow access to: admin, reporter, assigned user, or warehouse users
      const canAccess = req.user.role === 'admin' || 
                       issue.reportedBy === req.user.id || 
                       issue.assignedTo === req.user.id ||
                       (issue.warehouseId && req.user.warehouseId === issue.warehouseId);

      if (!canAccess) {
        return res.status(403).json({ message: "Not authorized to view issue activities" });
      }

      const activities = await storage.getIssueActivityWithUser(parseInt(id));
      res.json(activities);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete issue (admin only, only closed issues)
  app.delete("/api/issues/:id", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: "Only administrators can delete issues" });
      }

      const { id } = req.params;
      const issue = await storage.getIssue(parseInt(id));
      
      if (!issue) {
        return res.status(404).json({ message: "Issue not found" });
      }

      if (issue.status !== 'closed') {
        return res.status(400).json({ message: "Only closed issues can be deleted" });
      }

      const deleted = await storage.deleteIssue(parseInt(id));
      
      if (!deleted) {
        return res.status(500).json({ message: "Failed to delete issue" });
      }

      res.json({ message: "Issue deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==== Email Configuration Routes ====
  // Get email settings (admin only)
  app.get("/api/email-settings", checkRole("admin"), async (req, res) => {
    try {
      const settings = await storage.getEmailSettings();
      res.json(settings || null);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Create or update email settings (admin only)
  app.post("/api/email-settings", checkRole("admin"), async (req, res) => {
    try {
      const settingsData = insertEmailSettingsSchema.parse(req.body);
      const settings = await storage.createEmailSettings(settingsData);
      res.status(201).json(settings);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Update email settings (admin only)
  app.put("/api/email-settings/:id", checkRole("admin"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const settingsData = insertEmailSettingsSchema.partial().parse(req.body);
      const settings = await storage.updateEmailSettings(id, settingsData);
      if (!settings) {
        return res.status(404).json({ message: "Email settings not found" });
      }
      res.json(settings);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Test email configuration (admin only)
  app.post("/api/email-settings/test", checkRole("admin"), async (req, res) => {
    try {
      const { testEmail, verificationTestEmail, settingsId, ...tempSettings } = req.body;
      
      // Use either testEmail or verificationTestEmail
      const emailToTest = testEmail || verificationTestEmail;
      
      if (!emailToTest) {
        return res.status(400).json({ message: "Test email address is required" });
      }

      let settings;
      let existingSettings = await storage.getEmailSettings();
      
      if (settingsId || existingSettings) {
        // Use existing settings if available
        settings = existingSettings;
      } else {
        // Test with provided settings without saving
        const validatedSettings = insertEmailSettingsSchema.parse(tempSettings);
        settings = { 
          ...validatedSettings, 
          id: 0, 
          isActive: true, 
          isVerified: false, 
          lastTestedAt: null,
          createdAt: new Date(), 
          updatedAt: new Date() 
        };
      }

      if (!settings) {
        return res.status(404).json({ message: "Email settings not found" });
      }

      // Import email service dynamically
      const { EmailService } = await import('./email-service');
      const emailService = new EmailService(settings);
      
      // Test connection first
      const connectionTest = await emailService.testConnection();
      if (!connectionTest) {
        return res.status(400).json({ 
          message: "Failed to connect to email server. Please check your configuration." 
        });
      }

      // Send test email
      const testResult = await emailService.sendTestEmail(emailToTest);
      
      if (testResult) {
        // Mark as verified if this is an existing configuration
        if (existingSettings && existingSettings.id) {
          await storage.markEmailSettingsAsVerified(existingSettings.id);
        }
        res.json({ 
          success: true, 
          message: "Test email sent successfully. Configuration verified!" 
        });
      } else {
        res.status(400).json({ 
          message: "Failed to send test email. Please check your configuration." 
        });
      }
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Delete email settings (admin only)
  app.delete("/api/email-settings", checkRole("admin"), async (req, res) => {
    try {
      const deleted = await storage.deleteEmailSettings();
      if (!deleted) {
        return res.status(404).json({ message: "Email settings not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Toggle user status (admin only)
  app.patch("/api/users/:id/status", checkRole("admin"), async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { isActive } = req.body;

      if (typeof isActive !== 'boolean') {
        return res.status(400).json({ message: "isActive must be a boolean value" });
      }

      // Prevent deactivating admin users
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.role === 'admin' && !isActive) {
        return res.status(400).json({ message: "Cannot deactivate admin users" });
      }

      const updatedUser = await storage.updateUserStatus(userId, isActive);
      res.json(updatedUser);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
