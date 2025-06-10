import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { z } from "zod";
import { 
  insertItemSchema, 
  insertWarehouseSchema, 
  insertCategorySchema, 
  insertInventorySchema, 
  insertTransactionSchema, 
  insertRequestSchema, 
  insertRequestItemSchema,
  insertDepartmentSchema,
  insertUserSchema,
  insertWarehouseOperatorSchema,
  departments,
  organizationSettings
} from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

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
  // Get all users (admin only)
  app.get("/api/users", checkRole("admin"), async (req, res) => {
    const users = await storage.getAllUsers();
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
    const userId = parseInt(req.params.id, 10);
    const success = await storage.deleteUser(userId);
    if (!success) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(204).send();
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

  // ==== Warehouse Routes ====
  // Get all warehouses
  app.get("/api/warehouses", async (req, res) => {
    const warehouses = await storage.getAllWarehouses();
    res.json(warehouses);
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

  // Delete warehouse (admin only)
  app.delete("/api/warehouses/:id", checkRole("admin"), async (req, res) => {
    const warehouseId = parseInt(req.params.id, 10);
    const success = await storage.deleteWarehouse(warehouseId);
    if (!success) {
      return res.status(404).json({ message: "Warehouse not found" });
    }
    res.status(204).send();
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
      
      // Check stock availability for each item in the requested warehouse
      let needsTransfer = false;
      const transferRequirements = [];
      
      // Add items to request and check stock
      if (req.body.items && Array.isArray(req.body.items)) {
        for (const item of req.body.items) {
          try {
            const requestItemData = insertRequestItemSchema.parse({
              ...item,
              requestId: request.id
            });
            
            await storage.createRequestItem(requestItemData);
            
            // Check if the requested warehouse has sufficient stock
            const inventory = await storage.getAllInventory();
            const stockInWarehouse = inventory.find(inv => 
              inv.itemId === item.itemId && inv.warehouseId === requestData.warehouseId
            );
            
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
            console.error("Error adding item to request:", error);
          }
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
                
                // Update source warehouse inventory
                await storage.updateInventoryQuantity(
                  requestItem.itemId,
                  warehouse.id,
                  otherInventory.quantity - requestItem.quantity
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
            
            // Update inventory
            await storage.updateInventoryQuantity(
              requestItem.itemId,
              request.warehouseId,
              inventory.quantity - requestItem.quantity
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
        pendingRequests: pendingRequests.slice(0, 3)
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
        approvedAt: new Date().toISOString(),
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
      
      // Create a map of item details by ID
      const itemMap = new Map();
      allItems.forEach(item => {
        itemMap.set(item.id, item);
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
        
        return {
          ...warehouse,
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

  // Approval Settings routes
  app.get("/api/approval-settings", async (req, res) => {
    try {
      const settings = await storage.getAllApprovalSettings();
      res.json(settings);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/approval-settings", async (req, res) => {
    try {
      const settings = await storage.createApprovalSettings(req.body);
      res.status(201).json(settings);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/approval-settings/:id", async (req, res) => {
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

  app.delete("/api/approval-settings/:id", async (req, res) => {
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

  // Organization settings routes
  app.get("/api/organization-settings", async (req, res) => {
    try {
      const settings = await db.select().from(organizationSettings).limit(1);
      if (settings.length === 0) {
        // Create default settings if none exist
        const defaultSettings = await db.insert(organizationSettings).values({
          organizationName: "My Organization",
          currency: "USD",
          currencySymbol: "$",
          timezone: "UTC"
        }).returning();
        res.json(defaultSettings[0]);
      } else {
        res.json(settings[0]);
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/organization-settings", async (req, res) => {
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

  const httpServer = createServer(app);
  return httpServer;
}
