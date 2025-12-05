import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, hashPassword } from "./auth";
import { licenseManager } from "./license-manager.js";
import { requireValidLicense, checkUserLimit, checkProductLimit } from "./license-middleware.js";
import { any, z } from "zod";
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
import { totalmem } from "os";

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
const FIELD_RESOLVERS: Record<
  string,
  (id: number) => Promise<string | number | null>
> = {
  managerId: async (id) => (await storage.getUser(id))?.name || null,

  warehouseId: async (id) => (await storage.getWarehouse(id))?.name || null,
  sourceWarehouseId: async (id) => (await storage.getWarehouse(id))?.name || null,
  destinationWarehouseId: async (id) =>
    (await storage.getWarehouse(id))?.name || null,

  departmentId: async (id) => (await storage.getDepartment(id))?.name || null,

  itemId: async (id) => (await storage.getItem(id))?.name || null,
};
async function resolveFieldValues(values: any) {
  const resolved: any = {};

  for (const key of Object.keys(values)) {
    const val = values[key];

    if (val === null || val === undefined) continue;

    if (FIELD_RESOLVERS[key]) {
      resolved[key] = await FIELD_RESOLVERS[key](val);
    } else {
      resolved[key] = val;
    }
  }

  return resolved;
}


async function computeDiff(oldObj: any, newObj: any) {
  const rawOld: any = {};
  const rawNew: any = {};

  for (const key of Object.keys(newObj)) {
    if (key.toLowerCase().endsWith("by")) continue;

    const oldVal = oldObj[key];
    const newVal = newObj[key];

    if (JSON.stringify(oldVal) === JSON.stringify(newVal)) continue;

    if (oldVal === null || oldVal === undefined) {
      rawNew[key] = newVal;
      continue;
    }

    rawOld[key] = oldVal;
    rawNew[key] = newVal;
  }

  const oldValues = await resolveFieldValues(rawOld || {});
  const newValues = await resolveFieldValues(rawNew || {});

  return { oldValues, newValues };
}


const USER_AUDIT_FIELDS = [
  "username",
  "name",
  "email",
  "role",
  "isWarehouseOperator",
  "isActive"
];
async function computeUserDiff(oldObj: any, newObj: any) {
  const rawOld: any = {};
  const rawNew: any = {};

  for (const key of USER_AUDIT_FIELDS) {
    const oldVal = oldObj[key];
    const newVal = newObj[key];

    if (JSON.stringify(oldVal) === JSON.stringify(newVal)) continue;

    if (oldVal === null || oldVal === undefined) {
      rawNew[key] = newVal;
      continue;
    }

    rawOld[key] = oldVal;
    rawNew[key] = newVal;
  }

  const oldValues = await resolveFieldValues(rawOld || {});
  const newValues = await resolveFieldValues(rawNew || {});

  return { oldValues, newValues };
}


const TRANSFER_REJECT_FIELDS = [
  "status",
  "rejectionReason",
  "rejectedBy",
  "rejectedDate"
];

async function computeTransferRejectDiff(oldObj: any, newObj: any) {
  const rawOld: any = {};
  const rawNew: any = {};

  for (const key of TRANSFER_REJECT_FIELDS) {
    if (key.toLowerCase().endsWith("by")) continue;

    const oldVal = oldObj[key];
    const newVal = newObj[key];

    if (JSON.stringify(oldVal) === JSON.stringify(newVal)) continue;

    if (oldVal === null || oldVal === undefined) {
      rawNew[key] = newVal;
      continue;
    }

    rawOld[key] = oldVal;
    rawNew[key] = newVal;
  }

  const oldValues = await resolveFieldValues(rawOld || {});
  const newValues = await resolveFieldValues(rawNew || {});

  return { oldValues, newValues };
}






export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  setupAuth(app);

  // License acquisition endpoint (no middleware required)
  app.post("/api/license/acquire", async (req, res) => {
    try {
      const { client_id, product_id, base_url, license_manager_url } = req.body;
      
      if (!client_id || !product_id || !base_url) {
        return res.status(400).json({ 
          error: 'MISSING_PARAMETERS',
          message: 'client_id, product_id and base_url are required' 
        });
      }

      // Set license manager URL if provided
      if (license_manager_url) {
        licenseManager.setLicenseManagerUrl(license_manager_url);
        console.log('License manager URL set to:', license_manager_url);
      }

      const result = await licenseManager.acquireLicense(client_id, product_id, base_url);
      
      if (result.success) {
        res.json({ 
          success: true, 
          message: result.message,
          license: {
            clientId: result.license?.clientId,
            licenseKey: result.license?.licenseKey,
            subscriptionType: result.license?.subscriptionType,
            validTill: result.license?.validTill,
            isActive: result.license?.isActive
          }
        });
      } else {
        res.status(400).json({ 
          error: 'LICENSE_ACQUISITION_FAILED',
          message: result.message 
        });
      }
    } catch (error: any) {
      console.error('License acquisition error:', error);
      res.status(500).json({ 
        error: 'INTERNAL_ERROR',
        message: 'Failed to acquire license' 
      });
    }
  });

  // Get current license status
  app.get("/api/license/status", async (req, res) => {
    try {
      // Try to get client ID from various sources
      let clientId = process.env.CLIENT_ID || req.headers['x-client-id'] as string;
      
      // If no client ID, check if there's any license in the database
      if (!clientId) {
        const anyLicense = await licenseManager.getCurrentLicense('');
        if (anyLicense) {
          clientId = anyLicense.clientId;
        }
      }
      
      if (!clientId) {
        return res.json({ 
          hasLicense: false, 
          message: 'Client ID not configured' 
        });
      }

      const license = await licenseManager.getCurrentLicense(clientId);
      
      if (!license) {
        return res.json({ 
          hasLicense: false, 
          message: 'No license found' 
        });
      }

      const isExpired = new Date() > new Date(license.validTill);
      const subscriptionData = await licenseManager.getSubscriptionData(clientId);

      res.json({
        hasLicense: true,
        isActive: license.isActive && !isExpired,
        isExpired,
        license: {
          clientId: license.clientId,
          licenseKey: license.licenseKey,
          subscriptionType: license.subscriptionType,
          validTill: license.validTill,
          lastValidated: license.lastValidated,
          subscriptionData
        }
      });
    } catch (error: any) {
      console.error('License status error:', error);
      res.status(500).json({ 
        error: 'INTERNAL_ERROR',
        message: 'Failed to get license status' 
      });
    }
  });

  // Validate license manually
  app.post("/api/license/validate", async (req, res) => {
    try {
      const { license_manager_url } = req.body;
      
      // Try to get client ID from various sources
      let clientId = process.env.CLIENT_ID || req.headers['x-client-id'] as string;
      
      // If no client ID, check if there's any license in the database
      if (!clientId) {
        const anyLicense = await licenseManager.getCurrentLicense('');
        if (anyLicense) {
          clientId = anyLicense.clientId;
          console.log('Using client ID from existing license:', clientId);
        }
      }
      
      if (!clientId) {
        return res.status(400).json({ 
          error: 'MISSING_CLIENT_ID',
          message: 'Client ID not configured' 
        });
      }

      // Set license manager URL if provided for external validation
      if (license_manager_url) {
        licenseManager.setLicenseManagerUrl(license_manager_url);
        console.log('License manager URL set for validation:', license_manager_url);
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const validation = await licenseManager.validateLicense(clientId, baseUrl);
      
      res.json({
        valid: validation.valid,
        message: validation.message,
        license: validation.license ? {
          clientId: validation.license.clientId,
          licenseKey: validation.license.licenseKey,
          subscriptionType: validation.license.subscriptionType,
          validTill: validation.license.validTill,
          lastValidated: validation.license.lastValidated
        } : null
      });
    } catch (error: any) {
      console.error('License validation error:', error);
      res.status(500).json({ 
        error: 'INTERNAL_ERROR',
        message: 'Failed to validate license' 
      });
    }
  });

  // Apply license middleware to all protected routes
  app.use(requireValidLicense);

  // Get current user
  app.get("/api/current-user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    res.json(req.user);
  });

  // Check if any admin users exist (for superadmin creation)
  app.get("/api/check-admin-exists", async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const adminExists = users.some(user => user.role === 'admin');
      res.json({ adminExists });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create superadmin user (only if no admin exists)
  app.post("/api/create-superadmin", async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const adminExists = users.some(user => user.role === 'admin');
      
      if (adminExists) {
        return res.status(400).json({ message: "Admin user already exists" });
      }

      const hashedPassword = await hashPassword("superadmin123!");
      
      const superadminUser = {
        username: "superadmin",
        password: hashedPassword,
        name: "Super Administrator",
        email: "superadmin@system.local",
        role: "admin" as const,
        managerId: null,
        warehouseId: null,
        departmentId: null,
        isWarehouseOperator: false,
        isActive: true,
        resetToken: null,
        resetTokenExpiry: null
      };

      const createdUser = await storage.createUser(superadminUser);
      
      // Remove password from response
      const { password, ...userResponse } = createdUser;
      res.json({ message: "Superadmin created successfully", user: userResponse });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
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
  app.get("/api/usersName", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
      }

    const user = req.user;

    if (user.role === "employee" && !user.isWarehouseOperator) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const users = await storage.getAllUsers();

    // ✅ Return only id and name
    const simplifiedUsers = users.map((u: any) => ({
      id: u.id,
      name: u.name,
    }));

    res.json(simplifiedUsers);
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
  app.post("/api/users", checkRole("admin"), checkUserLimit, async (req, res) => {
    try {
      const existingUser = await storage.getUserByUsername(req.body.username);
      const existingUserEmail = await storage.getUserByEmail(req.body?.email)
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      if(existingUserEmail){
        return res.status(400).json({message:'User with this email already exists'})
      }

      const user = await storage.createUser(req.body);

      // 🔥 Filter only fields allowed in audit log
      const filteredAuditValues: any = {};
      for (const key of USER_AUDIT_FIELDS) {
        filteredAuditValues[key] = user[key] ?? null;
      }

      // 🔥 Convert IDs → names (if any exist on creation)
      const newValuesResolved = await resolveFieldValues(filteredAuditValues);

      // Save audit log
      await storage.createAuditLog({
        userId: req.user!.id,
        action: "CREATED",
        entityType: "user",
        entityId: user.id,
        details: `User ${user.name} was created`,
        oldValues: null,
        newValues: JSON.stringify(newValuesResolved),
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get("User-Agent"),
      });

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

      // 1️⃣ Validate incoming data
      const userData = insertUserSchema.partial().parse(req.body);

      // 2️⃣ Fetch existing
      const existingUser = await storage.getUser(userId);
      if (!existingUser) return res.status(404).json({ message: "User not found" });

      // 3️⃣ Remove empty fields
      const cleanUserData = Object.entries(userData).reduce((acc, [key, val]) => {
        if (val !== undefined && val !== "") acc[key] = val;
        return acc;
      }, {} as any);

      // 4️⃣ Username uniqueness check
      if (cleanUserData.username && cleanUserData.username !== existingUser.username) {
        const existingByUsername = await storage.getUserByUsername(cleanUserData.username);
        if (existingByUsername)
          return res.status(400).json({ message: "Username already exists" });
      }

      // 5️⃣ Email uniqueness check
      if (cleanUserData.email && cleanUserData.email !== existingUser.email) {
        const allUsers = await storage.getAllUsers();
        const exists = allUsers.find(u => u.email === cleanUserData.email && u.id !== userId);
        if (exists) return res.status(400).json({ message: "Email already exists" });
      }

      // 6️⃣ Handle warehouse logic
      if (
        cleanUserData.warehouseId !== undefined &&
        cleanUserData.warehouseId !== existingUser.warehouseId
      ) {
        const allWarehouses = await storage.getAllWarehouses();
        const managed = allWarehouses.filter(w => w.managerId === userId);

        for (const w of managed) {
          if (w.id !== cleanUserData.warehouseId) {
            console.log(`Auto-unassigning ${w.name} from user ${userId}`);
            await storage.updateWarehouse(w.id, { managerId: null });
          }
        }
      }

      // 7️⃣ Update the user
      const updatedUser = await storage.updateUser(userId, cleanUserData);
      if (!updatedUser) return res.status(404).json({ message: "User not found" });

      // 8️⃣ Compute basic diff
      const { oldValues, newValues } = await computeUserDiff(existingUser, updatedUser);

      // 9️⃣ If nothing meaningful changed → skip audit log
      if (Object.keys(newValues).length === 0) {
        return res.json(updatedUser);
      }

      // 🔥 10️⃣ Convert IDs → names BEFORE saving audit log
      const resolvedOld = await resolveFieldValues(oldValues);
      const resolvedNew = await resolveFieldValues(newValues);

      // 11️⃣ Save audit log
      await storage.createAuditLog({
        userId: req.user!.id,
        action: "UPDATED",
        entityType: "user",
        entityId: userId,
        details: `User ${existingUser.username} updated`,
        oldValues: JSON.stringify(resolvedOld),
        newValues: JSON.stringify(resolvedNew),
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get("User-Agent"),
      });

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
        return res
          .status(400)
          .json({ message: "Cannot delete your own account" });
      }

      // Fetch the user before deletion (for audit log)
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const success = await storage.deleteUser(userId);
      if (!success) {
        return res.status(500).json({ message: "Failed to delete user" });
      }

      // ----------------------------------------------------
      // 🔥 AUDIT LOG (ONLY ONCE)
      // ----------------------------------------------------
      await storage.createAuditLog({
        userId: req.user!.id,
        action: "UPDATED", // because audit supports CREATED + UPDATED only
        entityType: "user",
        entityId: userId,
        details: `User ${user.username} was deleted`,
        oldValues: JSON.stringify({
          username: user.username,
          email: user.email,
          role: user.role,
          isActive: user.isActive
        }),
        newValues: null, // since user is removed
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"]
      });

      return res.json({ message: "User deleted successfully" });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
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
  app.get("/api/locations",checkRole("manager"),  async (req, res) => {
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
    const allInventoryByWarehouse=await storage.getInventoryByWarehouse(warehouseId)
    const TotalAmount=allInventoryByWarehouse.reduce((sum,item)=>sum+item.quantity,0);
    if (TotalAmount > 0) {
      // ✅ FIX: Changed status code from 404 to 400 (Bad Request)
      return res.status(400).json({ 
        message: 'Cannot archive warehouse with existing inventory',
        details: `Warehouse contains ${TotalAmount} units of inventory`
      });
    }
    const archivedWarehouse = await storage.archiveWarehouse(warehouseId);
    if (!archivedWarehouse) {
      return res.status(404).json({ message: "Warehouse not found" });
    }
    res.json(archivedWarehouse);
  });

  // Restore archived warehouse (admin only)
  app.patch("/api/warehouses/:id/restore", checkRole("admin"), async (req, res) => {
    try {
      const warehouseId = parseInt(req.params.id, 10);
      const restoredWarehouse = await storage.restoreWarehouse(warehouseId);
      if (!restoredWarehouse) {
        return res.status(404).json({ message: "Warehouse not found" });
      }
      res.json(restoredWarehouse);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to restore warehouse" });
    }
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
  app.post("/api/items", checkRole("manager"), checkProductLimit, async (req, res) => {
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

      // Validate quantity
      const incomingQuantity = inventoryData.quantity || 0;
      if (incomingQuantity <= 0) {
        return res.status(400).json({ message: 'Invalid quantity' });
      }

      // Get current inventory for the warehouse
      const InventoryByWarehouse = await storage.getInventoryByWarehouse(inventoryData.warehouseId);
      const FilledAmount = InventoryByWarehouse.reduce((total, inv) => total + (inv.quantity || 0), 0);
      const leftAmount = warehouse.capacity - FilledAmount;

      // Check if inventory already exists for this item in this warehouse
      const existingInventory = await storage.getInventoryByItemAndWarehouse(
        inventoryData.itemId,
        inventoryData.warehouseId
      );
      
      let inventory;
      if (existingInventory) {
        // For UPDATE: Calculate net change in quantity
        const quantityChange = incomingQuantity - existingInventory.quantity;
        
        // Only check capacity if we're increasing quantity
        if (quantityChange > 0 && quantityChange > leftAmount) {
          return res.status(400).json({ 
            message: `Not enough space in warehouse. Available: ${leftAmount}, Additional space needed: ${quantityChange}` 
          });
        }
        
        // Update existing inventory
        inventory = await storage.updateInventory(existingInventory.id, {
          quantity: incomingQuantity
        });
      } else {
        // For CREATE: Check if there's enough space for new inventory
        if (incomingQuantity > leftAmount) {
          return res.status(400).json({ 
            message: `Not enough space in warehouse. Available: ${leftAmount}, Requested: ${incomingQuantity}` 
          });
        }
        
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

      // ✅ FIX 1: Better transaction code generation
      const timestamp = Date.now();
      const randomSuffix = Math.floor(Math.random() * 1000);
      const transactionCode = `TRX-${timestamp}-${randomSuffix}`;
      
      const userId = req.user!.id;
      const dataToValidate = {
        ...req.body,
        transactionCode,
        userId,
      };

      // Use safeParse and handle any validation errors manually
      const parseResult = insertTransactionSchema.safeParse(dataToValidate);
      
      if (!parseResult.success) {
        console.log("Validation error:", JSON.stringify(parseResult.error.issues, null, 2));
        return res.status(400).json({ 
          message: parseResult.error.message,
          issues: parseResult.error.issues
        });
      }
      
      const transactionPayload = parseResult.data;

      // ✅ FIX 2: Validate item exists
      const item = await storage.getItem(transactionPayload.itemId);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }

      // ✅ FIX 3: Add warehouse capacity checks
      if ((transactionPayload.transactionType === "check-in" || 
          transactionPayload.transactionType === "transfer") && 
          transactionPayload.destinationWarehouseId) {
        
        const destinationWarehouse = await storage.getWarehouse(transactionPayload.destinationWarehouseId);
        if (!destinationWarehouse) {
          return res.status(404).json({ message: "Destination warehouse not found" });
        }

        // Check warehouse capacity
        const inventoryInWarehouse = await storage.getInventoryByWarehouse(transactionPayload.destinationWarehouseId);
        const currentCapacity = inventoryInWarehouse.reduce((total, inv) => total + (inv.quantity || 0), 0);
        const availableSpace = destinationWarehouse.capacity - currentCapacity;
        
        // For transfer, only check capacity if status is completed
        const needsCapacityCheck = transactionPayload.transactionType === "check-in" || 
                                (transactionPayload.transactionType === "transfer" && transactionPayload.status === "completed");
        
        if (needsCapacityCheck && transactionPayload.quantity > availableSpace) {
          return res.status(400).json({ 
            message: `Not enough space in destination warehouse. Available: ${availableSpace}, Requested: ${transactionPayload.quantity}` 
          });
        }
      }

      // ✅ FIX 4: Validate source warehouse exists for issue/transfer
      if ((transactionPayload.transactionType === "issue" || transactionPayload.transactionType === "transfer") && 
          transactionPayload.sourceWarehouseId) {
        const sourceWarehouse = await storage.getWarehouse(transactionPayload.sourceWarehouseId);
        if (!sourceWarehouse) {
          return res.status(404).json({ message: "Source warehouse not found" });
        }
      }

      // Create the transaction
      const transaction = await storage.createTransaction(transactionPayload);
      
      try {
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
            // ✅ FIX 5: Rollback transaction
            await storage.deleteTransaction(transaction.id);
            return res.status(400).json({ message: "Item not in inventory" });
          }
          
          if (existingInventory.quantity < transaction.quantity) {
            await storage.deleteTransaction(transaction.id);
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
            await storage.deleteTransaction(transaction.id);
            return res.status(400).json({ message: "Item not in source warehouse inventory" });
          }
          
          if (sourceInventory.quantity < transaction.quantity) {
            await storage.deleteTransaction(transaction.id);
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
        // 🔥 Prepare fields for audit logging (same style as user creation)
        const auditData: any = {
          transactionCode: transaction.transactionCode,
          itemId: transaction.itemId,
          warehouseId: transaction.destinationWarehouseId,
          quantity: transaction.quantity,
          transactionType: transaction.transactionType,
        };

        // 🔥 Resolve IDs → names using your FIELD_RESOLVERS logic
        const resolvedValues = await resolveFieldValues(auditData);

        // 🔥 Save audit log
        await storage.createAuditLog({
          userId: req.user!.id,
          action: "CREATED",
          entityType: "Check-in",
          entityId: transaction.id,
          details: `Checked in ${transaction.quantity} units of ${resolvedValues.itemId} into ${resolvedValues.warehouseId}`,
          oldValues: null,
          newValues: JSON.stringify(resolvedValues),
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.get("User-Agent"),
        });
                
        res.status(201).json(transaction);
      } catch (inventoryError) {
        // ✅ FIX 6: Rollback transaction if inventory update fails
        await storage.deleteTransaction(transaction.id);
        throw inventoryError;
      }
    } catch (error: any) {
      console.error("Transaction creation error:", error);
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
  // Get all requests with user names included
  app.get("/api/requests", async (req, res) => {
    let requests;
    console.log('new Date ribhu',new Date());
    
    // Regular users can only see their own requests
    if (req?.user?.role === "user") {
      requests = await storage.getRequestsByUser(req.user!.id);
    } else {
      // Managers and admins can see all requests
      requests = await storage.getAllRequests();
    }
    
    // Get all users to include user names in response
    const allUsers = await storage.getAllUsers();
    const userMap = new Map();
    allUsers.forEach(user => userMap.set(user.id, user));
    
    // Enrich requests with user names
    const enrichedRequests = requests.map(request => ({
      ...request,
      userName: userMap.get(request.userId)?.name || 'Unknown User',
      userRole: userMap.get(request.userId)?.role || 'unknown'
    }));
    
    res.json(enrichedRequests);
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
    
    // Get user name for the request
    const user = await storage.getUser(request.userId);
    
    // Get items in request
    const requestItems = await storage.getRequestItemsByRequest(requestId);
    const allItems= await storage.getAllItems();
    const itemMap = new Map<number, any>(allItems.map(i => [i.id, i]));

    const requestItemsWithSku = requestItems.map((ri: any) => {
        const item = itemMap.get(ri.itemId);
        return {
          ...ri,
          sku: item?.sku || null,
          itemName: item?.name || null
        };
      });    
    res.json({
      ...request,
      userName: user?.name || 'Unknown User',
      userRole: user?.role || 'unknown',
      items: requestItemsWithSku,

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
  // app.post("/api/requests", async (req, res) => {
  //   if (!req.isAuthenticated()) {
  //     return res.status(401).json({ message: "Unauthorized" });
  //   }
    
  //   try {
  //     const requestCode = `RQX-${(await storage.getAllRequests() ).length + 873}`;
  //     const requestData = insertRequestSchema.parse({
  //       ...req.body,
  //       userId: req.user!.id,
  //       requestCode
  //     });
      
  //     // Create request
  //     const request = await storage.createRequest(requestData);
      
  //     // Optimized: Get inventory data once instead of per-item queries
  //     const allInventory = await storage.getAllInventory();
  //     const inventoryMap = new Map();
      
  //     // Create efficient lookup map: "itemId-warehouseId" -> inventory
  //     for (const inv of allInventory) {
  //       const key = `${inv.itemId}-${inv.warehouseId}`;
  //       inventoryMap.set(key, inv);
  //     }
      
  //     // Check stock availability for each item in the requested warehouse
  //     let needsTransfer = false;
  //     const transferRequirements = [];
      
  //     // Optimized: Batch create request items and process stock checks
  //     if (req.body.items && Array.isArray(req.body.items)) {
  //       // Prepare batch data for request items
  //       const requestItemsData = [];
        
  //       for (const item of req.body.items) {
  //         try {
  //           const requestItemData = insertRequestItemSchema.parse({
  //             ...item,
  //             requestId: request.id
  //           });
            
  //           requestItemsData.push(requestItemData);
            
  //           // Check stock using pre-loaded inventory map
  //           const stockKey = `${item.itemId}-${requestData.warehouseId}`;
  //           const stockInWarehouse = inventoryMap.get(stockKey);
            
  //           if (!stockInWarehouse || stockInWarehouse.quantity < item.quantity) {
  //             needsTransfer = true;
  //             const shortfall = item.quantity - (stockInWarehouse?.quantity || 0);
  //             transferRequirements.push({
  //               itemId: item.itemId,
  //               requiredQuantity: shortfall,
  //               requestedQuantity: item.quantity,
  //               availableQuantity: stockInWarehouse?.quantity || 0
  //             });
  //           }
  //         } catch (error) {
  //           console.error("Error preparing request item:", error);
  //         }
  //       }
        
  //       // Create all request items at once
  //       for (const itemData of requestItemsData) {
  //         await storage.createRequestItem(itemData);
  //       }
  //     }
      
  //     // If transfer is needed, create transfer notifications and mark request
  //     if (needsTransfer) {
  //       await storage.updateRequest(request.id, { 
  //         status: "pending-transfer",
  //         notes: `${request.notes || ''}\n\nStock Transfer Required: Some items are not available in sufficient quantities in the requested warehouse.`
  //       });

  //       // Get all warehouses for reference
  //       const allWarehouses = await storage.getAllWarehouses();
  //       const allInventory = await storage.getAllInventory();

  //       // Create transfer notifications for each item that needs transfer
  //       for (const requirement of transferRequirements) {
  //         // Find warehouses that have the required item
  //         const availableInventory = allInventory.filter(inv => 
  //           inv.itemId === requirement.itemId && 
  //           inv.warehouseId !== requestData.warehouseId && 
  //           inv.quantity > 0
  //         );

  //         // Create notification for each warehouse that has stock
  //         for (const inv of availableInventory) {
  //           try {
  //             const sourceWarehouse = allWarehouses.find(w => w.id === inv.warehouseId);
  //             const targetWarehouse = allWarehouses.find(w => w.id === requestData.warehouseId);
              
  //             await storage.createTransferNotification({
  //               requestId: request.id,
  //               warehouseId: inv.warehouseId,
  //               itemId: requirement.itemId,
  //               requiredQuantity: Math.min(requirement.requiredQuantity, inv.quantity),
  //               availableQuantity: inv.quantity,
  //               status: 'pending',
  //               notifiedUserId: null, // Will be assigned when warehouse manager checks
  //               transferId: null,
  //               notes: `Transfer needed for request ${request.requestCode}. Item shortage in ${targetWarehouse?.name || 'requested warehouse'}. Available in ${sourceWarehouse?.name || 'source warehouse'}.`
  //             });
  //           } catch (error) {
  //             console.error("Error creating transfer notification:", error);
  //           }
  //         }
  //       }
  //     }

  //     // Create approval records based on user hierarchy and approval settings
  //     try {
  //       // For employees, get their manager for approval
  //       if (req.user!.role === "employee") {
  //         const manager = await storage.getUserManager(req.user!.id);
  //         if (manager) {
  //           await storage.createRequestApproval({
  //             requestId: request.id,
  //             approverId: manager.id,
  //             approvalLevel: "manager",
  //             status: "pending"
  //           });
  //         } else {
  //           // If no manager, require admin approval
  //           const admins = await storage.getAllUsers();
  //           const adminUser = admins.find(u => u.role === "admin");
  //           if (adminUser) {
  //             await storage.createRequestApproval({
  //               requestId: request.id,
  //               approverId: adminUser.id,
  //               approvalLevel: "admin",
  //               status: "pending"
  //             });
  //           }
  //         }
  //       } else if (req.user!.role === "manager") {
  //         // Managers need approval from their own manager
  //         const manager = await storage.getUserManager(req.user!.id);
  //         if (manager) {
  //           await storage.createRequestApproval({
  //             requestId: request.id,
  //             approverId: manager.id,
  //             approvalLevel: manager.role === "admin" ? "admin" : "manager",
  //             status: "pending"
  //           });
  //         } else {
  //           // If no manager assigned, require admin approval
  //           const admins = await storage.getAllUsers();
  //           const adminUser = admins.find(u => u.role === "admin");
  //           if (adminUser) {
  //             await storage.createRequestApproval({
  //               requestId: request.id,
  //               approverId: adminUser.id,
  //               approvalLevel: "admin",
  //               status: "pending"
  //             });
  //           }
  //         }
  //       }
  //       // Admins can auto-approve their own requests (no approval record needed)
  //     } catch (error) {
  //       console.error("Error creating approval records:", error);
  //     }
      
  //     res.status(201).json(request);
  //   } catch (error: any) {
  //     res.status(400).json({ message: error.message });
  //   }
  // });
app.post("/api/requests", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const user = req.user!;
    const items = req.body.items || [];

    // -----------------------------------------------------
    // 1️⃣ Generate request code FIRST
    // -----------------------------------------------------
    const requestCode = `RQX-${(await storage.getAllRequests()).length + 873}`;

    // -----------------------------------------------------
    // 2️⃣ Validate request input
    // -----------------------------------------------------
    const baseRequestData = insertRequestSchema.parse({
      ...req.body,
      userId: user.id,
      requestCode,
    });

    const warehouseId = baseRequestData.warehouseId;

    // -----------------------------------------------------
    // 3️⃣ Load inventory + validate stock
    // -----------------------------------------------------
    const allInventory = await storage.getAllInventory();
    const inventoryMap = new Map();

    for (const inv of allInventory) {
      inventoryMap.set(`${inv.itemId}-${inv.warehouseId}`, inv);
    }

    for (const item of items) {
      const inv = inventoryMap.get(`${item.itemId}-${warehouseId}`);
      const available = inv?.quantity || 0;

      if (available < item.quantity) {
        return res.status(400).json({
          message: `Not enough stock for item ${item.itemId}. Requested ${item.quantity}, Available ${available}.`,
        });
      }
    }

    // -----------------------------------------------------
    // 4️⃣ Get warehouse manager → fallback to admin
    // -----------------------------------------------------
    let approvers: Array<{ id: number; level: "manager" | "admin" }> = [];

    const warehouse = await storage.getWarehouse(warehouseId);

    if (warehouse?.managerId) {
      // Single warehouse manager
      approvers.push({
        id: warehouse.managerId,
        level: "manager",
      });
    } else {
      // Fallback → multiple admins
      const users = await storage.getAllUsers();
      const admins = users.filter((u) => u.role === "admin");

      if (admins.length === 0) {
        return res.status(400).json({
          message: "No warehouse manager or admins found to approve the request.",
        });
      }

      approvers = admins.map((a) => ({
        id: a.id,
        level: "admin"
      }));
    }

    // -----------------------------------------------------
    // 5️⃣ TRANSACTION BLOCK
    // -----------------------------------------------------
    const result = await db.transaction(async (tx) => {

      // 5.1 Create request
      const createdRequest = await storage.createRequestTx(tx, {
        ...baseRequestData,
        requestCode,
      });

      // 5.2 Create request items
      for (const item of items) {
        await storage.createRequestItemTx(tx, {
          requestId: createdRequest.id,
          itemId: item.itemId,
          quantity: item.quantity,
        });
      }

      // 5.3 Create approvals (MULTIPLE)
      for (const approver of approvers) {
        await storage.createRequestApprovalTx(tx, {
          requestId: createdRequest.id,
          approverId: approver.id,
          approvalLevel: approver.level,
          status: "pending",
        });
      }

      return createdRequest;
    });
    // -----------------------------------------------------
    // 7️⃣ Audit Log for Check-Out Request (No Item Details)
    // -----------------------------------------------------

    const auditData: any = {
      requestCode: result.requestCode,
      warehouseId: result.warehouseId,
    };

    // Resolve warehouseId → warehouse name, userId → user name
    const resolvedValues = await resolveFieldValues(auditData);

    // Create audit log entry
    await storage.createAuditLog({
      userId: req.user!.id,
      action: "CREATED",
      entityType: "Check-out",
      entityId: result.id,
      details: `Created a check-out request (${resolvedValues.requestCode})`,
      oldValues: null,
      newValues: JSON.stringify(resolvedValues),
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get("User-Agent"),
    });

    // -----------------------------------------------------
    // 6️⃣ Respond
    // -----------------------------------------------------
    res.status(201).json(result);

  } catch (error: any) {
    console.error("💥 Request creation error:", error);
    return res.status(400).json({ message: error.message });
  }
});





  // Update request status (manager+)
  // app.put("/api/requests/:id/status", checkRole("manager"), async (req, res) => {
  //   const requestId = parseInt(req.params.id, 10);
    
  //   try {
  //     const { status } = z.object({
  //       status: z.string().refine(
  //         s => ['pending', 'approved', 'rejected', 'completed'].includes(s),
  //         { message: "Invalid status" }
  //       )
  //     }).parse(req.body);
      
  //     // Get request
  //     const request = await storage.getRequest(requestId);
  //     if (!request) {
  //       return res.status(404).json({ message: "Request not found" });
  //     }
      
  //     // If approving or completing a request, handle the inventory changes
  //     if ((status === "approved" || status === "completed") && request.status === "pending") {
  //       // Get all items in the request
  //       const requestItems = await storage.getRequestItemsByRequest(requestId);
        
  //       // Check if items are available in the warehouse
  //       for (const requestItem of requestItems) {
  //         const inventory = await storage.getInventoryByItemAndWarehouse(
  //           requestItem.itemId,
  //           request.warehouseId
  //         );
          
  //         // If item is not in the requested warehouse, check if it's available in other warehouses
  //         if (!inventory || inventory.quantity < requestItem.quantity) {
  //           let foundInOtherWarehouse = false;
            
  //           // Check other warehouses
  //           const allWarehouses = await storage.getAllWarehouses();
            
  //           for (const warehouse of allWarehouses) {
  //             if (warehouse.id === request.warehouseId) continue;
              
  //             const otherInventory = await storage.getInventoryByItemAndWarehouse(
  //               requestItem.itemId,
  //               warehouse.id
  //             );
              
  //             if (otherInventory && otherInventory.quantity >= requestItem.quantity) {
  //               // Create a transfer transaction
  //               const trxCode = `TRX-${(await storage.getAllTransactions()).length + 873}`;
  //               await storage.createTransaction({
  //                 itemId: requestItem.itemId,
  //                 quantity: requestItem.quantity,
  //                 transactionCode: trxCode,
  //                 transactionType: "transfer",
  //                 userId: req.user!.id,
  //                 sourceWarehouseId: warehouse.id,
  //                 destinationWarehouseId: request.warehouseId,
  //                 requestId: request.id,
  //                 requesterId: req.user!.id,
  //                 status: "in-transit"
  //               });
                
  //               // Update source warehouse inventory by subtracting the transferred quantity
  //               await storage.safeSubtractInventory(
  //                 requestItem.itemId,
  //                 warehouse.id,
  //                 requestItem.quantity
  //               );
                
  //               foundInOtherWarehouse = true;
  //               break;
  //             }
  //           }
            
  //           if (!foundInOtherWarehouse) {
  //             return res.status(400).json({ 
  //               message: `Not enough quantity of item ID ${requestItem.itemId} available in any warehouse` 
  //             });
  //           }
  //         } else {
  //           // Item is available in the requested warehouse, create an issue transaction
  //           const issueCode = `TRX-${(await storage.getAllTransactions()).length + 873}`;
  //           await storage.createTransaction({
  //             itemId: requestItem.itemId,
  //             quantity: requestItem.quantity,
  //             transactionCode: issueCode,
  //             transactionType: "issue",
  //             userId: req.user!.id,
  //             sourceWarehouseId: request.warehouseId,
  //             requestId: request.id,
  //             requesterId: req.user!.id,
  //             status: "completed"
  //           });
            
  //           // Update inventory by subtracting the issued quantity
  //           await storage.safeSubtractInventory(
  //             requestItem.itemId,
  //             request.warehouseId,
  //             requestItem.quantity
  //           );
  //         }
  //       }
  //     }
      
  //     // Update request status
  //     const updatedRequest = await storage.updateRequest(requestId, { status });
      
  //     res.json(updatedRequest);
  //   } catch (error: any) {
  //     res.status(400).json({ message: error.message });
  //   }
  // });
  app.put("/api/requests/:id/status", checkRole("manager"), async (req, res) => {
    const requestId = parseInt(req.params.id, 10);

    try {
      const { status } = z.object({
        status: z.enum(["approved", "rejected", "completed"])
      }).parse(req.body);

      const request = await storage.getRequest(requestId);
      if (!request) {
        return res.status(404).json({ message: "Request not found" });
      }

      // -----------------------------------------------------
      // APPROVE
      // -----------------------------------------------------
      if (status === "approved") {
        if (request.status !== "pending") {
          return res.status(400).json({
            message: "Only pending requests can be approved"
          });
        }

        const result = await db.transaction(async (tx) => {
          const approvals = await storage.getRequestApprovalsByRequestTx(tx, requestId);

          for (const ap of approvals) {
            await storage.updateRequestApprovalTx(tx, ap.id, {
              status: "approved",
              approvedAt: new Date(),
            });
          }

          return await storage.updateRequestTx(tx, requestId, { status: "approved" });
        });

        // ---------------- AUDIT LOG ----------------
        const auditData = {
          requestCode: request.requestCode,
          warehouseId: request.warehouseId,
          requestedBy: request.userId,
          status: "approved"
        };

        const resolved = await resolveFieldValues(auditData);

        await storage.createAuditLog({
          userId: req.user!.id,
          action: "UPDATED",
          entityType: "check-out",
          entityId: requestId,
          details: `Request ${resolved.requestCode} approved`,
          oldValues: null,
          newValues: JSON.stringify(resolved),
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.get("User-Agent")
        });
        // ------------------------------------------

        return res.json(result);
      }

      // -----------------------------------------------------
      // REJECT
      // -----------------------------------------------------
      if (status === "rejected") {
        if (request.status !== "pending") {
          return res.status(400).json({
            message: "Only pending requests can be rejected"
          });
        }

        const result = await db.transaction(async (tx) => {
          const approvals = await storage.getRequestApprovalsByRequestTx(tx, requestId);

          for (const ap of approvals) {
            await storage.updateRequestApprovalTx(tx, ap.id, {
              status: "rejected",
              approvedAt: new Date(),
            });
          }

          return await storage.updateRequestTx(tx, requestId, { status: "rejected" });
        });

        // ---------------- AUDIT LOG ----------------
        const auditData = {
          requestCode: request.requestCode,
          warehouseId: request.warehouseId,
          requestedBy: request.userId,
          status: "rejected"
        };

        const resolved = await resolveFieldValues(auditData);

        await storage.createAuditLog({
          userId: req.user!.id,
          action: "UPDATED",
          entityType: "check-out",
          entityId: requestId,
          details: `Request ${resolved.requestCode} rejected`,
          oldValues: null,
          newValues: JSON.stringify(resolved),
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.get("User-Agent")
        });
        // ------------------------------------------

        return res.json(result);
      }

      // -----------------------------------------------------
      // COMPLETED (checkout execution)
      // -----------------------------------------------------
      if (status === "completed") {
        if (request.status !== "approved") {
          return res.status(400).json({
            message: "Only approved requests can be completed"
          });
        }

        let createdTransactionCode: string | null = null;

        const result = await db.transaction(async (tx) => {
          const requestItems = await storage.getRequestItemsByRequestTx(tx, requestId);
          const warehouseId = request.warehouseId;

          for (const item of requestItems) {
            const inv = await storage.getInventoryByItemAndWarehouseTx(
              tx,
              item.itemId,
              warehouseId
            );

            if (!inv || inv.quantity < item.quantity) {
              throw new Error(
                `Not enough stock for item ${item.itemId} to complete the request`
              );
            }

            const sub = await storage.safeSubtractInventoryTx(
              tx,
              item.itemId,
              warehouseId,
              item.quantity
            );

            if (!sub.success) {
              if (sub.reason === "insufficient_stock") {
                throw new Error(`Not enough stock for item ${item.itemId}`);
              }
              if (sub.reason === "inventory_missing") {
                throw new Error(`Inventory record missing for item ${item.itemId}`);
              }
            }

            const trx = await storage.createTransactionTx(tx, {
              transactionCode: `ISS-${Date.now()}`,
              transactionType: "issue",
              itemId: item.itemId,
              quantity: item.quantity,
              sourceWarehouseId: warehouseId,
              userId: req.user!.id,
              requestId: request.id,
              requesterId: request.userId,
              status: "completed",
            });

            if (!createdTransactionCode) {
              createdTransactionCode = trx.transactionCode;
            }
          }

          return await storage.updateRequestTx(tx, requestId, { status: "completed" });
        });

        // ---------------- AUDIT LOG ----------------
        const auditData = {
          requestCode: request.requestCode,
          warehouseId: request.warehouseId,
          requestedBy: request.userId,
          status: "completed",
          transactionCode: createdTransactionCode
        };

        const resolved = await resolveFieldValues(auditData);

        await storage.createAuditLog({
          userId: req.user!.id,
          action: "UPDATED",
          entityType: "check-out",
          entityId: requestId,
          details: `Request ${resolved.requestCode} completed (Transaction: ${createdTransactionCode})`,
          oldValues: null,
          newValues: JSON.stringify(resolved),
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.get("User-Agent")
        });
        // ------------------------------------------

        return res.json(result);
      }

    } catch (error: any) {
      return res.status(400).json({ message: error.message });
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
      if (type && ['check-in', 'issue','transfer' ].includes(type as string)) {
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
      // Get current date and last month date for comparisons
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      // Get all data needed for calculations
      const allItems = await storage.getAllItems();
      const allInventory = await storage.getAllInventory();
      const allTransactions = await storage.getAllTransactions();
      const allTransfers = await storage.getAllTransfers();
      const allRequests = await storage.getAllRequests();
      
      // Current metrics
      const totalItems = allItems.length;
      
      const itemMap = new Map();
      allItems.forEach(item => {
        itemMap.set(item.id, item);
      });
      
      const lowStockItems = allInventory.filter(inv => {
        const item = itemMap.get(inv.itemId);
        return item && inv.quantity < item.minStockLevel;
      });
      
      const pendingRequests = allRequests.filter(req => req.status === 'pending');
      // const activeTransfers = allTransactions.filter(t => 
      //   t.transactionType === 'transfer' && t.status === 'in-transit'
      // );

      const activeTransfers = allTransfers.filter(t =>
        t.status === 'pending' || t.status==='in-transit' || t.status=== 'return-requested' || t.status === 'return-approved' || t.status === 'return_shipped' || t.status==='partial-return-requested' || t.status==='approved'
      )
      
      // Calculate historical data for comparisons
      const lastMonthItems = allItems.filter(item => 
        new Date(item.createdAt) < currentMonth
      ).length;
      
      const lastMonthRequests = allRequests.filter(req => 
        new Date(req.createdAt) >= lastMonth && 
        new Date(req.createdAt) < currentMonth && 
        req.status === 'pending'
      ).length;
      
      const currentMonthRequests = allRequests.filter(req => 
        new Date(req.createdAt) >= currentMonth && 
        req.status === 'pending'
      ).length;
      
      const lastMonthTransfers = allTransactions.filter(t => 
        t.transactionType === 'transfer' && 
        new Date(t.createdAt) >= lastMonth && 
        new Date(t.createdAt) < currentMonth &&
        t.status === 'in-transit'
      ).length;
      
      // Calculate percentage changes
      const calculateChange = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return Number(((current - previous) / previous * 100).toFixed(1));
      };
      
      const totalItemsChange = calculateChange(totalItems, lastMonthItems);
      const pendingRequestsChange = calculateChange(pendingRequests.length, lastMonthRequests);
      const activeTransfersChange = calculateChange(activeTransfers.length, lastMonthTransfers);
      
      // Low stock items change (comparing current low stock vs last month's transactions indicating stock issues)
      const lastMonthLowStockIndicator = allTransactions.filter(t => 
        new Date(t.createdAt) >= lastMonth && 
        new Date(t.createdAt) < currentMonth &&
        t.transactionType === 'transfer' // Transfers often indicate stock shortages
      ).length;
      const lowStockChange = calculateChange(lowStockItems.length, lastMonthLowStockIndicator);
      
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
      
      // Get most recent transactions
      let recentTransactions = [...allTransactions];
      recentTransactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      recentTransactions = recentTransactions.slice(0, 5);
      
      res.json({
        totalItems,
        lowStockItemsCount: lowStockItems.length,
        pendingRequestsCount: pendingRequests.length,
        activeTransfersCount: activeTransfers.length,
        
        // Add comparative statistics
        statistics: {
          totalItemsChange,
          lowStockChange,
          pendingRequestsChange,
          activeTransfersChange
        },
        
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
      if (updateData.resolvedAt && typeof updateData.resolvedAt === "string") {
        updateData.resolvedAt = new Date(updateData.resolvedAt);
      }
      console.log('updateData',updateData)
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
  // app.patch("/api/approvals/:id/:action", async (req: Request, res: Response) => {
  //   try {
  //     const { id, action } = req.params;
  //     const { notes } = req.body;

  //     if (!req.user) {
  //       return res.status(401).json({ message: "Not authenticated" });
  //     }

  //     if (!['approve', 'reject'].includes(action)) {
  //       return res.status(400).json({ message: "Invalid action. Must be 'approve' or 'reject'" });
  //     }

  //     const approvalId = parseInt(id, 10);
  //     if (isNaN(approvalId)) {
  //       return res.status(400).json({ message: "Invalid approval ID" });
  //     }

  //     // Get the approval record
  //     const approval = await storage.getRequestApproval(approvalId);
  //     if (!approval) {
  //       return res.status(404).json({ message: "Approval not found" });
  //     }

  //     // Check if user has permission to approve this request
  //     if (approval.approverId !== req.user.id) {
  //       return res.status(403).json({ message: "Not authorized to approve this request" });
  //     }

  //     // Check if already processed
  //     if (approval.status !== 'pending') {
  //       return res.status(400).json({ message: "Approval already processed" });
  //     }

  //     // Update approval record
  //     const updatedApproval = await storage.updateRequestApproval(approvalId, {
  //       status: action === 'approve' ? 'approved' : 'rejected',
  //       approvedAt: new Date(),
  //       comments: notes || null
  //     });

  //     // Update request status based on approval
  //     const request = await storage.getRequest(approval.requestId);
  //     if (request && action === 'approve') {
  //       // Update request to approved status
  //       await storage.updateRequest(approval.requestId, { status: 'approved' });
        
  //       // Process inventory deduction for approved checkout request
  //       if (request.status !== 'completed') {
  //         const requestItems = await storage.getRequestItemsByRequest(approval.requestId);
          
  //         // Create issue transactions and update inventory for each item
  //         for (const requestItem of requestItems) {
  //           // Create issue transaction record
  //           const transactionCode = `ISS-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  //           await storage.createTransaction({
  //             transactionCode,
  //             transactionType: 'issue',
  //             itemId: requestItem.itemId,
  //             quantity: requestItem.quantity,
  //             sourceWarehouseId: request.warehouseId,
  //             destinationWarehouseId: null,
  //             userId: req.user.id,
  //             status: 'completed',
  //             completedAt: new Date(),
  //             rate: null,
  //             totalValue: null,
  //             supplierName: null,
  //             supplierContact: null,
  //             purchaseOrderNumber: null,
  //             deliveryChallanNumber: null
  //           });
            
  //           // Update inventory - reduce quantity
  //           const currentInventory = await storage.getInventoryByItemAndWarehouse(
  //             requestItem.itemId, 
  //             request.warehouseId
  //           );
            
  //           if (currentInventory) {
  //             const newQuantity = Math.max(0, currentInventory.quantity - requestItem.quantity);
  //             await storage.updateInventory(currentInventory.id, { quantity: newQuantity });
  //           }
  //         }
          
  //         // Mark request as completed after inventory updates
  //         await storage.updateRequest(approval.requestId, { status: 'completed' });
  //       }
  //     } else if (request && action === 'reject') {
  //       await storage.updateRequest(approval.requestId, { status: 'rejected' });
  //     }

  //     res.json(updatedApproval);
  //   } catch (error: any) {
  //     console.error("Error processing approval:", error);
  //     res.status(500).json({ message: "Failed to process approval" });
  //   }
  // });
  // Approve or reject approval request
  app.patch("/api/approvals/:id/:action", async (req: Request, res: Response) => {
    try {
      const { id, action } = req.params;
      const { notes } = req.body;

      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      if (!["approve", "reject"].includes(action)) {
        return res.status(400).json({ message: "Invalid action. Must be 'approve' or 'reject'" });
      }

      const approvalId = parseInt(id, 10);
      if (isNaN(approvalId)) {
        return res.status(400).json({ message: "Invalid approval ID" });
      }

      const approval = await storage.getRequestApproval(approvalId);
      if (!approval) {
        return res.status(404).json({ message: "Approval not found" });
      }

      if (approval.approverId !== req.user.id) {
        return res.status(403).json({
          message: "You are not authorized to approve or reject this request"
        });
      }

      if (approval.status !== "pending") {
        return res.status(400).json({
          message: "This approval request is already processed"
        });
      }

      const result = await db.transaction(async (tx) => {
        const request = await storage.getRequestTx(tx, approval.requestId);
        if (!request) throw new Error("Request not found");

        const allApprovals = await storage.getRequestApprovalsByRequestTx(tx, request.id);

        const newStatus = action === "approve" ? "approved" : "rejected";

        const updatedApproval = await storage.updateRequestApprovalTx(tx, approvalId, {
          status: newStatus,
          comments: notes || null,
          approvedAt: new Date(),
        });

        for (const ap of allApprovals) {
          if (ap.id !== approvalId) {
            await storage.updateRequestApprovalTx(tx, ap.id, {
              status: newStatus,
              approvedAt: new Date(),
            });
          }
        }

        await storage.updateRequestTx(tx, request.id, {
          status: newStatus,
        });

        return updatedApproval;
      });
      const request= await storage.getRequest(approval.requestId);

      // ------------------- AUDIT LOG (SAFE INSERT) -------------------
      const auditData = {
        requestCode: request?.requestCode,   // will be resolved properly
        status: action === "approve" ? "approved" : "rejected"
      };

      const resolved = await resolveFieldValues(auditData);

      await storage.createAuditLog({
        userId: req.user!.id,
        action: "UPDATED",
        entityType: "check-out",
        entityId: approval.requestId,
        details: `Approval ${resolved.status} for request ${resolved.requestCode}`,
        oldValues: null,
        newValues: JSON.stringify(resolved),
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get("User-Agent"),
      });
      // ---------------------------------------------------------------

      return res.json(result);

    } catch (error: any) {
      console.error("Approval error:", error);
      return res.status(500).json({ message: error.message || "Failed to process approval" });
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
      // Only get active warehouses by default
      const includeArchived = req.query.includeArchived === 'true';
      const allWarehouses = await storage.getAllWarehouses();
      const warehouses = includeArchived ? allWarehouses : allWarehouses.filter(w => w.isActive && w.status === 'active');
      
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
      res.json([...allDepartments].reverse());
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
      
      // Validate that the manager is assigned to this warehouse
      if (managerId) {
        const manager = await storage.getUser(managerId);
        if (!manager) {
          return res.status(400).json({ message: "Manager user not found" });
        }
        
        if (manager.warehouseId !== warehouseId) {
          return res.status(400).json({ 
            message: "Cannot assign user as warehouse manager. User must be assigned to this warehouse as their default warehouse." 
          });
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

  // app.get("/api/pending-approvals", async (req, res) => {
  //   try {
  //     if (!req.user) {
  //       return res.status(401).json({ message: "Not authenticated" });
  //     }
      
  //     const approvals = await storage.getRequestApprovalsByApprover(req.user.id);
  //     const pendingApprovals = approvals.filter(approval => approval.status === 'pending');
  //     console.log('pendingApprovals',pendingApprovals)
      
  //     // Get all reference data
  //     const allItems = await storage.getAllItems();
  //     const allWarehouses = await storage.getAllWarehouses();
  //     const allInventory = await storage.getAllInventory();
  //     // For now, we'll skip departments since they're not implemented yet
  //     const allDepartments: any[] = [];
      
  //     // Create maps for lookup
  //     const itemMap = new Map();
  //     allItems.forEach(item => itemMap.set(item.id, item));
      
  //     const warehouseMap = new Map();
  //     allWarehouses.forEach(warehouse => warehouseMap.set(warehouse.id, warehouse));
      
  //     const inventoryMap = new Map();
  //     allInventory.forEach(inv => {
  //       const key = `${inv.itemId}-${inv.warehouseId}`;
  //       inventoryMap.set(key, inv);
  //     });
      
  //     const departmentMap = new Map();
  //     allDepartments.forEach((dept: any) => departmentMap.set(dept.id, dept));
      
  //     // Enrich with complete request data
  //     const enrichedApprovals = await Promise.all(pendingApprovals.map(async approval => {
  //       const request = await storage.getRequest(approval.requestId);
  //       const requestItems = await storage.getRequestItemsByRequest(approval.requestId);
  //       const requester = request ? await storage.getUser(request.userId) : null;
        
  //       // Enrich request items with item details and availability
  //       const enrichedRequestItems = requestItems.map(requestItem => {
  //         const item = itemMap.get(requestItem.itemId);
  //         const inventoryKey = `${requestItem.itemId}-${request?.warehouseId}`;
  //         const inventory = inventoryMap.get(inventoryKey);
  //         const availableQuantity = inventory ? inventory.quantity : 0;
          
  //         return {
  //           ...requestItem,
  //           item,
  //           availableQuantity,
  //           isAvailable: availableQuantity >= requestItem.quantity
  //         };
  //       });
        
  //       // Enrich requester with department info
  //       const enrichedRequester = requester ? {
  //         ...requester,
  //         department: requester.departmentId ? departmentMap.get(requester.departmentId) : null
  //       } : null;
        
  //       // Enrich request with complete information
  //       const enrichedRequest = request ? {
  //         ...request,
  //         user: enrichedRequester,
  //         items: enrichedRequestItems,
  //         warehouse: warehouseMap.get(request.warehouseId),
  //         priority: request.priority || 'medium' // Default priority if not set
  //       } : null;
        
  //       return {
  //         ...approval,
  //         request: enrichedRequest
  //       };
  //     }));
      
  //     res.json(enrichedApprovals);
  //   } catch (error: any) {
  //     res.status(400).json({ message: error.message });
  //   }
  // });
  app.get("/api/pending-approvals", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const approverId = req.user.id;

      // ----------------------------------------------------
      // 1️⃣ REQUEST APPROVALS (your existing system)
      // ----------------------------------------------------
      const approvals = await storage.getRequestApprovalsByApprover(approverId);
      const pendingApprovals = approvals.filter(a => a.status === "pending");

      // ----------------------------------------------------
      // 2️⃣ REJECTED GOODS APPROVALS
      // ----------------------------------------------------
      const rejectedGoods = await storage.getRejectedGoodsForApprover(approverId);

      // Requested states only
      const pendingRejectedGoods = rejectedGoods.filter(rg =>
        rg.status === "restock_requested" ||
        rg.status === "dispose_requested"
      );

      // ----------------------------------------------------
      // 3️⃣ LOAD REFERENCE DATA
      // ----------------------------------------------------
      const allItems = await storage.getAllItems();
      const allWarehouses = await storage.getAllWarehouses();
      const allInventory = await storage.getAllInventory();

      const itemMap = new Map(allItems.map(i => [i.id, i]));
      const warehouseMap = new Map(allWarehouses.map(w => [w.id, w]));

      const inventoryMap = new Map();
      allInventory.forEach(inv => {
        inventoryMap.set(`${inv.itemId}-${inv.warehouseId}`, inv);
      });

      // ----------------------------------------------------
      // 4️⃣ ENRICH REQUEST APPROVALS
      // ----------------------------------------------------
      const enrichedRequestApprovals = await Promise.all(
        pendingApprovals.map(async approval => {
          const request = await storage.getRequest(approval.requestId);
          if (!request) return null;

          const requester = await storage.getUser(request.userId);
          const items = await storage.getRequestItemsByRequest(request.id);

          const enrichedItems = items.map(ri => {
            const item = itemMap.get(ri.itemId);
            const inv = inventoryMap.get(`${ri.itemId}-${request.warehouseId}`);
            const availableQuantity = inv ? inv.quantity : 0;

            return {
              ...ri,
              item,
              availableQuantity,
              isAvailable: availableQuantity >= ri.quantity
            };
          });

          return {
            type: "request_approval",  // ⭐ IMPORTANT
            id: approval.id,
            approverId: approval.approverId,
            approvalLevel: approval.approvalLevel,
            status: approval.status,
            notes: approval.comments,
            approvedAt: approval.approvedAt,

            request: {
              ...request,
              user: requester,
              items: enrichedItems,
              warehouse: warehouseMap.get(request.warehouseId),
            }
          };
        })
      );

      // Filter nulls
      const filteredRequestApprovals = enrichedRequestApprovals.filter(Boolean);

      // ----------------------------------------------------
      // 5️⃣ ENRICH REJECTED GOODS
      // ----------------------------------------------------
      const enrichedRejectedGoods = await Promise.all(
        pendingRejectedGoods.map(async rg => {
          const item = itemMap.get(rg.itemId);
          const warehouse = warehouseMap.get(rg.warehouseId);
          const rejectedBy = await storage.getUser(rg.rejectedBy);
          const transfer = await storage.getTransfer( rg.transferId);

          const inv = inventoryMap.get(`${rg.itemId}-${rg.warehouseId}`);

          return {
            type: "rejected_goods",  // ⭐ IMPORTANT
            id: rg.id,
            transferId: rg.transferId,
            itemId: rg.itemId,
            quantity: rg.quantity,
            notes: rg.notes,
            status: rg.status,  // restock_requested / dispose_requested
            approver: rg.approver,
            isApproved: rg.isApproved,

            // Enriched
            item,
            warehouse,
            rejectedBy,
            transfer,
            availableQuantity: inv ? inv.quantity : 0,
          };
        })
      );

      // ----------------------------------------------------
      // 6️⃣ MERGE BOTH TYPES
      // ----------------------------------------------------
      const result = [
        ...filteredRequestApprovals,
        ...enrichedRejectedGoods
      ];

      res.json(result);

    } catch (error:any) {
      console.error("Error fetching pending approvals:", error);
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

// app.patch("/api/rejected-goods/:id", async (req: Request, res: Response) => {
//   try {
//     if (!req.isAuthenticated()) {
//         return res.status(401).json({ message: "Unauthorized" });
//       }
//     const id = parseInt(req.params.id);
//     const user = req.user;
//     const { notes, status } = req.body;
//     const rejectedGood = await storage.getRejectedGood(id);

//     if (!rejectedGood || rejectedGood.length === 0) {
//       return res.status(404).json({ message: "Rejected goods not found" });
//     }

//     const transferId = rejectedGood[0].transferId;
//     const itemId = rejectedGood[0].itemId;
//     const transfer = await storage.getTransfer(transferId);
//     if (!transfer) {
//       return res.status(404).json({ message: "Transfer not found" });
//     }

//     const sourceWarehouse = await storage.getWarehouse(transfer.sourceWarehouseId);
//     const [transferItem] = await storage.getTransferItemsByTransferAndItem(transfer.id, itemId);

//     if (user.role !== "admin" && sourceWarehouse?.managerId !== user.id) {
//       return res
//         .status(400)
//         .json({ message: "You don't have permission to change rejected goods status" });
//     }

//     // 5️⃣ Handle restock logic
//     if (status === "restocked") {
//       const result = await storage.safeAddInventory(
//         itemId,
//         sourceWarehouse.id,
//         rejectedGood[0]?.quantity
//       );

//       if (!result.success) {
//         return res.status(400).json({
//           message: "Insufficient stock for this warehouse"
//         });
//       }

//       await storage.createTransaction({
//         transactionCode: `TXN-${transfer}`,
//           transactionType: "check-in",
//           itemId,
//           quantity: rejectedGood[0]?.quantity,
//           sourceWarehouseId: transfer.sourceWarehouseId,
//           destinationWarehouseId: transfer.destinationWarehouseId, // Use same warehouse for disposal
//           userId: user.id,
//           status: "completed",
//           checkInDate: new Date()
//       })
//       const updatedItem = await storage.updateTransferItem(transferItem?.id, { itemStatus:status });
//       if (!updatedItem) {
//       return res.status(404).json({ message: "Transfer Item not found" });
//     }

//     }
//     if(status==='dispose'){
//     await storage.createTransaction({
//       transactionCode: `TXN-${transfer}`,
//         transactionType: "disposal",
//         itemId,
//         quantity: rejectedGood[0]?.quantity,
//         sourceWarehouseId: transfer.sourceWarehouseId,
//         destinationWarehouseId: transfer.destinationWarehouseId, // Use same warehouse for disposal
//         userId: user.id,
//         status: "completed",
//         checkInDate: new Date()
//     })
//     const date=new Date()
//     const updatedItem = await storage.updateTransferItem(transferItem?.id, { itemStatus:status,isDisposed:true,disposalReason:notes,disposalDate:date });
//     if (!updatedItem) {
//       return res.status(404).json({ message: "Transfer Item not found" });
//     }
//   }

//     const updatedGoods = await storage.updateRejectedGoods(id, { status, notes });
//     // await storage.updateTransfer(transferId,{status:'disposed'})

    

//     res.json({
//       message: "Rejected goods and transfer item updated successfully",
//       updatedGoods,
//     });
//   } catch (error) {
//     console.error("💥 Error updating rejected goods:", error);
//     res.status(500).json({ message: "Failed to update rejected goods" });
//   }
// });
  // app.patch("/api/rejected-goods/:id", async (req: Request, res: Response) => {
  //   try {
  //     if (!req.isAuthenticated()) {
  //       return res.status(401).json({ message: "Unauthorized" });
  //     }

  //     const id = parseInt(req.params.id);
  //     const user = req.user!;
  //     const { notes, status } = req.body;

  //     const result = await db.transaction(async (tx) => {

  //       // 1️⃣ Fetch rejected goods inside tx
  //       const rejected = await storage.getRejectedGoodTx(tx, id);
  //       if (!rejected || rejected.length === 0)
  //         throw new Error("Rejected goods not found");

  //       const rg = rejected[0];

  //       // 2️⃣ Fetch transfer info inside tx
  //       const transfer = await storage.getTransferTx(tx, rg.transferId);
  //       console.log('transfer',transfer)
  //       if (!transfer) throw new Error("Transfer not found");

  //       const rows = await storage.getWarehouseTx(tx, transfer.sourceWarehouseId);
  //       const sourceWarehouse = rows[0];
  //       console.log('sourceWarehouse',sourceWarehouse);

  //       // 3️⃣ Permission check
  //       if (user.role !== "admin" && sourceWarehouse?.managerId !== user.id) {
  //         console.log('managerId',sourceWarehouse?.managerId)
  //         console.log('userId',user.id);
  //         throw new Error("You don't have permission to change rejected goods status");
  //       }

  //       const [transferItem] = await storage.getTransferItemsByTransferAndItemTx(
  //         tx,
  //         transfer.id,
  //         rg.itemId
  //       );

  //       if (!transferItem) throw new Error("Transfer item not found");

  //       // ------------------------------------------
  //       // 4️⃣ RESTOCK LOGIC
  //       // ------------------------------------------
  //       if (status === "restocked") {
          
  //         // 4.1 — Safe add inventory WITH LOCK
  //         const inv = await storage.safeAddInventoryTx(
  //           tx,
  //           rg.itemId,
  //           rg.warehouseId,
  //           rg.quantity
  //         );

  //         if (!inv.success) {
  //           if (inv.reason === "exceeds_capacity")
  //             throw new Error("Warehouse capacity exceeded");
  //           throw new Error("Failed to add inventory");
  //         }

  //         // 4.2 — Create transaction
  //         // await storage.createTransactionTx(tx, {
  //         //   itemId: rg.itemId,
  //         //   quantity: rg.quantity,
  //         //   transactionType: "check-in",
  //         //   sourceWarehouseId: transfer.sourceWarehouseId,
  //         //   destinationWarehouseId: transfer.destinationWarehouseId,
  //         //   userId: user.id,
  //         //   status: "completed",
  //         //   checkInDate: new Date(),
  //         // });
          

  //         // 4.3 — Update transfer item
  //         await storage.updateTransferItemTx(tx, transferItem.id, {
  //           itemStatus: "restocked"
  //         });
      

  //         console.table([
  //           {
  //             transferId: rg.transferId,
  //             itemId: transferItem.id,
  //             newStatus: 'restocked'
  //           }
  //         ]);
  //         const updatedTransaction = await storage.updateTransactionByTransferAndItemIdTx(tx,rg.transferId,transferItem.itemId,{status:'restocked',completedAt: new Date(),checkInDate: new Date()});
  //             console.log('updateTransactionByTransferAndItemIdTx', updatedTransaction);
  //       }

  //       // ------------------------------------------
  //       // 5️⃣ DISPOSAL LOGIC
  //       // ------------------------------------------
  //       if (status === "dispose") {

  //         // await storage.createTransactionTx(tx, {
  //         //   itemId: rg.itemId,
  //         //   quantity: rg.quantity,
  //         //   transactionType: "disposal",
  //         //   sourceWarehouseId: transfer.sourceWarehouseId,
  //         //   destinationWarehouseId: transfer.destinationWarehouseId,
  //         //   userId: user.id,
  //         //   status: "completed",
  //         //   checkInDate: new Date(),
  //         // });
  //         const updatedTransaction = await storage.updateTransactionByTransferAndItemIdTx(tx,rg.transferId,transferItem.itemId,{status:'disposed',completedAt : new Date(), checkInDate: new Date()});
  //         console.log('updateTransactionByTransferAndItemIdTx',updatedTransaction);

  //         console.table([
  //           {
  //             transferId: rg.transferId,
  //             itemId: transferItem.id,
  //             newStatus: 'restocked'
  //           }
  //         ]);

  //         await storage.updateTransferItemTx(tx, transferItem.id, {
  //           itemStatus: "dispose",
  //           isDisposed: true,
  //           disposalReason: notes,
  //           disposalDate: new Date()
  //         });
  //       }

  //       // ------------------------------------------
  //       // 6️⃣ Update rejected_goods entry
  //       // ------------------------------------------
  //       const updatedGoods = await storage.updateRejectedGoodsTx(tx, id, {
  //         status,
  //         notes
  //       });

  //       return updatedGoods;
  //     });

  //     res.json({
  //       message: "Rejected goods updated successfully",
  //       updatedGoods: result
  //     });

  //   } catch (error) {
  //     console.error("💥 Error updating rejected goods:", error);
  //     res.status(400).json({ message: error.message });
  //   }
  // });
  app.patch("/api/rejected-goods/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const id = parseInt(req.params.id);
      const user = req.user!;
      const { status, notes, isApproved } = req.body;
      const users = await storage.getAllUsers();
      const admin = users.find(u => u.role === "admin");
      const adminId = admin?.id;

      const result = await db.transaction(async (tx) => {
        const rejected = await storage.getRejectedGoodTx(tx, id);
        if (!rejected || rejected.length === 0)
          throw new Error("Rejected goods not found");

        const rg = rejected[0];
        const oldRg = { ...rg };

        const transfer = await storage.getTransferTx(tx, rg.transferId);
        const transaction = await storage.getTransactionByByTransferAndItemIdTx(tx,transfer.id,rg.itemId)
        const item = await storage.getItem(rg.itemId);

        const sourceWarehouseArray:any = await storage.getWarehouseTx(
          tx,
          transfer.sourceWarehouseId
        );
        const sourceWarehouse = sourceWarehouseArray[0];
        const managerId = sourceWarehouse.managerId || adminId;

        // Permission logic as before...
        const isManager =
          user.role === "admin" || sourceWarehouse?.managerId === user.id;

        const isOperator =
          (user.role === "employee" && user.isWarehouseOperator) ||
          (user.role === "manager" &&
            user.warehouseId === sourceWarehouse?.id &&
            !isManager);

        const [transferItem] =
          await storage.getTransferItemsByTransferAndItemTx(
            tx,
            transfer.id,
            rg.itemId
          );
        if (!transferItem) throw new Error("Transfer item not found");

        let updated;

        // ====================================================
        // 1️⃣ OPERATOR → creates request
        // ====================================================
        if (isOperator) {
          if (rg.status !== "rejected")
            throw new Error("you cannot perform this action");

          let newStatus = rg.status;

          if (status === "restocked") newStatus = "restock_requested";
          if (status === "dispose") newStatus = "dispose_requested";

          updated = await storage.updateRejectedGoodsTx(tx, id, {
            status: newStatus,
            notes,
            isApproved: null,
            approver: sourceWarehouse?.managerId || adminId,
          });

          const diff = await computeTransferRejectDiff(oldRg, updated);

          await storage.createAuditLogTx(tx, {
            userId: user.id,
            action: "UPDATED",
            entityType: "rejected_goods",
            entityId: id,
            details: `Rejected goods #${id} (${item.name}) updated (${newStatus}) of transfer (${transfer?.transferCode})`,
            oldValues: JSON.stringify(diff.oldValues),
            newValues: JSON.stringify(diff.newValues),
            ipAddress: req.ip,
            userAgent: req.get("User-Agent"),
          });

          return updated;
        }

        // ====================================================
        // 2️⃣ MANAGER DIRECT ACTION (rejected → restock/dispose)
        // ====================================================
        if (isManager && rg.status === "rejected") {
          if (status === "restocked") {
            await storage.safeAddInventoryTx(tx, rg.itemId, rg.warehouseId, rg.quantity);

            await storage.updateTransferItemTx(tx, transferItem.id, {
              itemStatus: "restocked",
            });

            await storage.updateTransactionByTransferAndItemIdTx(
              tx,
              rg.transferId,
              transferItem.itemId,
              {
                status: "restocked",
                completedAt: new Date(),
                checkInDate: new Date(),
              }
            );

            updated = await storage.updateRejectedGoodsTx(tx, id, {
              status: "restocked",
              isApproved: true,
              approver: user.id,
              notes,
            });
          }

          if (status === "dispose") {
            await storage.updateTransferItemTx(tx, transferItem.id, {
              itemStatus: "dispose",
              isDisposed: true,
              disposalReason: notes,
              disposalDate: new Date(),
            });

            await storage.updateTransactionByTransferAndItemIdTx(
              tx,
              rg.transferId,
              transferItem.itemId,
              {
                status: "disposed",
                completedAt: new Date(),
                checkInDate: new Date(),
              }
            );

            updated = await storage.updateRejectedGoodsTx(tx, id, {
              status: "disposed",
              isApproved: true,
              approver: user.id,
              notes,
            });
          }

          const diff = await computeTransferRejectDiff(oldRg, updated);

          await storage.createAuditLogTx(tx, {
            userId: user.id,
            action: "UPDATED",
            entityType: "rejected_goods",
            entityId: id,
            details: `Rejected goods #${id} (${item?.name}) updated (${updated.status}) of Transfer (${transfer.transferCode}) and Transaction (${transaction?.transactionCode})`,
            oldValues: JSON.stringify(diff.oldValues),
            newValues: JSON.stringify(diff.newValues),
            ipAddress: req.ip,
            userAgent: req.get("User-Agent"),
          });

          return updated;
        }

        // ====================================================
        // 3️⃣ MANAGER APPROVAL FLOW
        // ====================================================
        if (
          isManager &&
          (rg.status === "dispose_requested" ||
            rg.status === "restock_requested")
        ) {
          if (isApproved === false) {
            updated = await storage.updateRejectedGoodsTx(tx, id, {
              status: "rejected",
              isApproved: false,
              approver: null,
              notes,
            });

            const diff = await computeTransferRejectDiff(oldRg, updated);

            await storage.createAuditLogTx(tx, {
              userId: user.id,
              action: "UPDATED",
              entityType: "rejected_goods",
              entityId: id,
              details: `Rejected goods #${id} (${item?.name}) request rejected`,
              oldValues: JSON.stringify(diff.oldValues),
              newValues: JSON.stringify(diff.newValues),
              ipAddress: req.ip,
              userAgent: req.get("User-Agent"),
            });

            return updated;
          }

          if (isApproved === true) {
            if (rg.status === "restock_requested") {
              await storage.safeAddInventoryTx(
                tx,
                rg.itemId,
                rg.warehouseId,
                rg.quantity
              );

              await storage.updateTransferItemTx(tx, transferItem.id, {
                itemStatus: "restocked",
              });

              await storage.updateTransactionByTransferAndItemIdTx(
                tx,
                rg.transferId,
                transferItem.itemId,
                {
                  status: "restocked",
                  completedAt: new Date(),
                  checkInDate: new Date(),
                }
              );

              updated = await storage.updateRejectedGoodsTx(tx, id, {
                status: "restocked",
                isApproved: true,
                approver: user.id,
                notes,
              });
            }

            if (rg.status === "dispose_requested") {
              await storage.updateTransferItemTx(tx, transferItem.id, {
                itemStatus: "dispose",
                isDisposed: true,
                disposalReason: notes,
                disposalDate: new Date(),
              });

              await storage.updateTransactionByTransferAndItemIdTx(
                tx,
                rg.transferId,
                transferItem.itemId,
                {
                  status: "disposed",
                  completedAt: new Date(),
                  checkInDate: new Date(),
                }
              );

              updated = await storage.updateRejectedGoodsTx(tx, id, {
                status: "disposed",
                isApproved: true,
                approver: user.id,
                notes,
              });
            }

            const diff = await computeTransferRejectDiff(oldRg, updated);

            await storage.createAuditLogTx(tx, {
              userId: user.id,
              action: "UPDATED",
              entityType: "rejected_goods",
              entityId: id,
              details: `Rejected goods #${id} (${item?.name}) updated (${updated?.status}) of Transfer (${transfer?.transferCode}) and Transaction (${transaction?.transactionCode})`,
              oldValues: JSON.stringify(diff.oldValues),
              newValues: JSON.stringify(diff.newValues),
              ipAddress: req.ip,
              userAgent: req.get("User-Agent"),
            });

            return updated;
          }
        }

        throw new Error("Invalid operation");
      });

      res.json({
        message: "Rejected goods updated successfully",
        updatedGoods: result,
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });








  // NEW TRANSFER RETURN/DISPOSAL WORKFLOW ENDPOINTS

  // Approve return for rejected goods (Admin only)
  app.post("/api/transfers/:transferId/approve-return", checkRole("admin"), async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const transferId = parseInt(req.params.transferId);
      const { returnReason } = req.body;
      
      if (!returnReason || returnReason.trim() === '') {
        return res.status(400).json({ message: "Return reason is required" });
      }

      const user = req.user;
      const updatedTransfer = await storage.approveReturn(transferId, returnReason, user.id);
      
      if (!updatedTransfer) {
        return res.status(404).json({ message: "Transfer not found" });
      }

      res.json(updatedTransfer);
    } catch (error) {
      console.error("Error approving return:", error);
      res.status(500).json({ message: "Failed to approve return" });
    }
  });

  // Approve disposal for rejected goods (Admin only)
  app.post("/api/transfers/:transferId/approve-disposal", checkRole("admin"), async (req: Request, res: Response) => {
    try {
      const transferId = parseInt(req.params.transferId);
      const { disposalReason } = req.body;
      
      if (!disposalReason || disposalReason.trim() === '') {
        return res.status(400).json({ message: "Disposal reason is required" });
      }

      const user:any = req.user;
      const updatedTransfer = await storage.approveDisposal(transferId, disposalReason, user.id);
      
      if (!updatedTransfer) {
        return res.status(404).json({ message: "Transfer not found" });
      }

      res.json(updatedTransfer);
    } catch (error) {
      console.error("Error approving disposal:", error);
      res.status(500).json({ message: "Failed to approve disposal" });
    }
  });

// Record return shipment details (Destination warehouse manager)
  app.post("/api/transfers/:transferId/return-shipment", async (req: Request, res: Response) => {
    console.log(`🚚 POST /api/transfers/${req.params.transferId}/return-shipment hit`);
    console.log("Request body:", req.body);

    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const transferId = parseInt(req.params.transferId);
      const { returnCourierName, returnTrackingNumber, returnShippedDate } = req.body;

      // Validation
      if (!returnCourierName?.trim()) {
        return res.status(400).json({ message: "Courier name is required" });
      }
      if (!returnTrackingNumber?.trim()) {
        return res.status(400).json({ message: "Tracking number is required" });
      }
      if (!returnShippedDate) {
        return res.status(400).json({ message: "Return Shipped Date is required" });
      }

      const ReturnShippedDate = new Date(returnShippedDate);

      const user = req.user;
      const transfer:any = await storage.getTransfer(transferId);
      if (!transfer) return res.status(404).json({ message: "Transfer not found" });

      // Permission check
      if (
        user.role !== "admin" &&
        (user.role !== "manager" || user.warehouseId !== transfer.destinationWarehouseId)
      ) {
        return res.status(403).json({
          message: "Only destination warehouse manager can record return shipment",
        });
      }

      // Update transfer
      const updatedTransfer:any = await storage.updateTransfer(transferId, {
        returnCourierName,
        returnTrackingNumber,
        returnShippedDate: ReturnShippedDate,
        status: "return_shipped",
      });

      if (!updatedTransfer) {
        return res.status(404).json({ message: "Transfer not found" });
      }

      // Transfer update log
      await storage.createTransferUpdate({
        transferId,
        updatedBy: req.user!.id,
        status: updatedTransfer.status,
        updateType: req.body.updateType || "return_shipment_recorded",
        description:
          req.body.updateDescription ||
          `Return shipment recorded: ${returnCourierName} (${returnTrackingNumber})`,
        metadata: req.body.metadata ? JSON.stringify(req.body.metadata) : undefined,
      });

      // 🔥 Compute diff (only selected fields)
      const oldValues: any = {};
      const newValues: any = {};

      const fields = [
        "status",
        "returnCourierName",
        "returnTrackingNumber",
        "returnShippedDate",
      ];

      for (const field of fields) {
        const oldVal = transfer[field];
        const newVal = updatedTransfer[field];

        const formattedOld =
          field === "returnShippedDate" && oldVal ? new Date(oldVal).toISOString() : oldVal;
        const formattedNew =
          field === "returnShippedDate" && newVal ? new Date(newVal).toISOString() : newVal;

        if (formattedOld !== formattedNew) {
          oldValues[field] = formattedOld ?? undefined;
          newValues[field] = formattedNew ?? undefined;
        }
      }

      // 🔥 Convert any IDs → names (if diff contains them)
      const resolvedOld = await resolveFieldValues(oldValues);
      const resolvedNew = await resolveFieldValues(newValues);

      // Audit Log
      await storage.createAuditLog({
        userId: req.user!.id,
        action: "UPDATED",
        entityType: "transfer",
        entityId: transferId,
        details: `Transfer ${transfer.transferCode} return shipment recorded`,
        oldValues: Object.keys(resolvedOld).length ? JSON.stringify(resolvedOld) : null,
        newValues: Object.keys(resolvedNew).length ? JSON.stringify(resolvedNew) : null,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get("User-Agent"),
      });

      res.json(updatedTransfer);
    } catch (error) {
      console.error(`💥 Error in return shipment:`, error);
      res.status(500).json({ message: "Failed to record return shipment" });
    }
  });


  // Record return delivery (Source warehouse manager or admin)
  app.post("/api/transfers/:transferId/return-delivery", async (req: Request, res: Response) => {
    try {
      const transferId = parseInt(req.params.transferId);
      const user = req.user;
      
      // Verify user has permission to update this transfer
      const transfer = await storage.getTransfer(transferId);
      if (!transfer) {
        return res.status(404).json({ message: "Transfer not found" });
      }

      // Check if user is source warehouse manager or admin
      if (user.role !== "admin" && 
          (user.role !== "manager" || user.warehouseId !== transfer.sourceWarehouseId)) {
        return res.status(403).json({ message: "Only source warehouse manager can confirm return delivery" });
      }
      const date=new Date();

      const updatedTransfer = await storage.recordReturnDelivery(transferId, {date});
      
      if (!updatedTransfer) {
        return res.status(404).json({ message: "Transfer not found" });
      }

      res.json(updatedTransfer);
    } catch (error) {
      console.error("Error recording return delivery:", error);
      res.status(500).json({ message: "Failed to record return delivery" });
    }
  });

  // Reject transfer (Admin or transfer creator)
  app.post("/api/transfers/:transferId/reject", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const transferId = parseInt(req.params.transferId);
      const { rejectionReason } = req.body;
      const user = req.user!;

      // Get transfer details
      const transfer = await storage.getTransfer(transferId);
      if (!transfer) {
        return res.status(404).json({ message: "Transfer not found" });
      }

      // Must be pending
      if (transfer.status !== "pending") {
        return res.status(400).json({ message: "Only pending transfers can be rejected" });
      }

      // Permission check
      if (user.role !== "admin" && transfer.initiatedBy !== user.id) {
        return res.status(403).json({
          message: "Only admins or transfer creators can reject transfers",
        });
      }

      // Update transfer
      const updatedTransfer = await storage.updateTransfer(transferId, {
        status: "rejected",
        returnReason:rejectionReason,
        rejectedDate: new Date(),
        updatedAt: new Date(),
        // ❗ We DO NOT save rejectedBy in audit diff (frontend already identifies updater)
        // rejectedBy: user.id,
      });

      // Compute diff (only meaningful fields)
      const { oldValues, newValues } = computeTransferRejectDiff(transfer, updatedTransfer);

      // ❗ Remove rejectedBy from diff entirely
      delete oldValues["rejectedBy"];
      delete newValues["rejectedBy"];

      // Convert any ID fields → names
      const resolvedOld = await resolveFieldValues(oldValues);
      const resolvedNew = await resolveFieldValues(newValues);

      // Audit log
      await storage.createAuditLog({
        userId: user.id,
        action: "UPDATED",
        entityType: "transfer",
        entityId: transferId,
        details: `Transfer ${transfer.transferCode} was rejected`,
        oldValues: Object.keys(resolvedOld).length ? JSON.stringify(resolvedOld) : null,
        newValues: Object.keys(resolvedNew).length ? JSON.stringify(resolvedNew) : null,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get("User-Agent"),
      });

      res.json(updatedTransfer);

    } catch (error) {
      console.error("Error rejecting transfer:", error);
      res.status(500).json({ message: "Failed to reject transfer" });
    }
  });


  // Get disposed inventory with filtering
  // Dispose inventory endpoint
  app.post("/api/inventory/dispose", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;

      // Only admins can dispose inventory
      if (user.role !== "admin") {
        return res.status(403).json({ message: "Only administrators can dispose inventory" });
      }

      const { inventoryId, quantity, disposalReason } = req.body;

      if (!inventoryId || !quantity || !disposalReason) {
        return res.status(400).json({ message: "Inventory ID, quantity, and disposal reason are required" });
      }

      // Get inventory from any warehouse
      const allInventory = await storage.getAllInventory();
      const inventory = allInventory.find((inv: any) => inv.id === parseInt(inventoryId));
      if (!inventory) {
        return res.status(404).json({ message: "Inventory not found" });
      }

      // Validate quantity
      if (quantity > inventory.quantity) {
        return res.status(400).json({ message: "Cannot dispose more than available quantity" });
      }

      // Create disposal transfer
      const transferCode = `DISP-${Date.now()}`;

      const disposalTransfer = await storage.createTransfer({
        transferCode,
        sourceWarehouseId: inventory.warehouseId,
        destinationWarehouseId: inventory.warehouseId,
        initiatedBy: user.id,      // Will NOT appear in audit log because we skip "*By"
        status: "disposed",
        disposalReason,
        disposalDate: new Date(),
        approvedBy: user.id,       // skipped in audit
        transferMode: "disposal",
        notes: `Direct disposal from inventory by admin: ${user.name}`
      });

      await storage.updateTransfer(disposalTransfer.id, {
        notes: `${transferCode} - Direct disposal from inventory by admin: ${user.name}`
      });

      // Create disposal transfer item
      await storage.createTransferItem({
        transferId: disposalTransfer.id,
        itemId: inventory.itemId,
        requestedQuantity: quantity,
        approvedQuantity: quantity,
        actualQuantity: quantity,
        itemStatus: "dispose",
        isDisposed: true
      });

      // History transaction
      await storage.createTransaction({
        transactionCode: `TXN-${transferCode}`,
        transactionType: "disposal",
        itemId: inventory.itemId,
        quantity,
        sourceWarehouseId: inventory.warehouseId,
        destinationWarehouseId: inventory.warehouseId,
        userId: user.id,
        status: "completed",
        completedAt: new Date()
      });

      // Update inventory quantity
      const newQuantity = inventory.quantity - quantity;
      await storage.updateInventory(inventoryId, { quantity: newQuantity });

      // -------------------------
      // 🔥 AUDIT LOG (with diff)
      // -------------------------

      const oldValues = { quantity: inventory.quantity };
      const newValues = { quantity: newQuantity };

      // Convert IDs → names
      const resolvedOld = await resolveFieldValues(oldValues);
      const resolvedNew = await resolveFieldValues(newValues);

      await storage.createAuditLog({
        userId: user.id,
        action: "UPDATED",                        // Standardized
        entityType: "inventory",
        entityId: inventoryId,
        details: `Disposed ${quantity} units. Reason: ${disposalReason}`,
        oldValues: JSON.stringify(resolvedOld),
        newValues: JSON.stringify(resolvedNew),
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get("User-Agent"),
      });

      // -------------------------
      // Response
      // -------------------------
      res.json({
        message: "Inventory disposed successfully",
        disposalTransfer,
        remainingQuantity: newQuantity
      });

    } catch (error) {
      console.error("Error disposing inventory:", error);
      res.status(500).json({ message: "Failed to dispose inventory" });
    }
  });


app.get("/api/disposed-inventory", async (req: Request, res: Response) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { warehouseId, itemId, dateFrom, dateTo, approvedBy } = req.query;
    console.log("📥 Query Params:", { warehouseId, itemId, dateFrom, dateTo, approvedBy });

    // Get all disposed transfers
    const disposedTransfers = await storage.getTransfersByStatus("disposed");
    const disposedTransfers1 = await storage.getTransfersByStatus("return-rejected");
    const disposedTransfers2 = await storage.getTransfersByStatus("returned");
    const disposedTransfers3 = [...disposedTransfers, ...disposedTransfers1, ...disposedTransfers2];

    console.log(`📦 Found Transfers:`, {
      disposed: disposedTransfers.length,
      returnRejected: disposedTransfers1.length,
      returned: disposedTransfers2.length,
      total: disposedTransfers3.length,
    });

    // Global unit value map
    const { itemUnitValues } = await calculateItemUnitValues(new Date());
    console.log("💰 Item Unit Values Map Size:", itemUnitValues.size);

    let disposedItems: any[] = [];

    // -------------------------------------------
    // LOOP TRANSFERS
    // -------------------------------------------
    for (const transfer of disposedTransfers3) {
      console.log("\n===============================");
      console.log("🔁 PROCESSING TRANSFER:");
      console.log({
        transferId: transfer.id,
        transferCode: transfer.transferCode,
        sourceWarehouseId: transfer.sourceWarehouseId,
        destinationWarehouseId: transfer.destinationWarehouseId,
        transferStatus: transfer.status,
        disposalDate: transfer.disposalDate,
        disposalReason: transfer.disposalReason,
        approvedBy: transfer.approvedBy,
      });

      const transferItems = await storage.getTransferItemsByTransfer(transfer.id);

      console.log(`🔍 Transfer ${transfer.id} — Items Found: ${transferItems.length}`);

      const disposedTransferItems = transferItems.filter(
        (item) => item.isDisposed === true
      );

      console.log(`♻️ Transfer ${transfer.id} — Disposed Items Count: ${disposedTransferItems.length}`);

      // -------------------------------------------
      // LOOP DISPOSED ITEMS
      // -------------------------------------------
      for (const transferItem of disposedTransferItems) {
        console.log("\n🔹 PROCESSING TRANSFER ITEM:", {
          transferItemId: transferItem.id,
          itemId: transferItem.itemId,
          requestedQuantity: transferItem.requestedQuantity,
          actualQuantity: transferItem.actualQuantity,
          itemStatus: transferItem.itemStatus,
          disposalDate: transferItem.disposalDate,
          disposalReason: transferItem.disposalReason,
        });

        const item = await storage.getItem(transferItem.itemId);
        const warehouse = await storage.getWarehouse(transfer.sourceWarehouseId); // <-- CHECK HERE
        const approvedByUser = transfer.approvedBy
          ? await storage.getUser(transfer.approvedBy)
          : null;

        console.log("🏭 Warehouse Returned:", warehouse);

        // Compare mismatch
        if (warehouse && warehouse.id !== transfer.sourceWarehouseId) {
          console.log("❗❗ WAREHOUSE MISMATCH DETECTED ❗❗", {
            warehouseReturnedId: warehouse?.id,
            expectedSourceWarehouseId: transfer.sourceWarehouseId,
          });
        }

        const unitValue = itemUnitValues.get(transferItem.itemId) || 0;
        const quantity = transferItem.actualQuantity || transferItem.requestedQuantity;
        const totalValue = unitValue * quantity;

        const record = {
          transferId: transfer.id,
          transferCode: transfer.transferCode || `DISP-${transfer.id}`,
          itemId: transferItem.itemId,
          item,
          warehouse,
          warehouseId: transfer.sourceWarehouseId, // <-- CHECK HERE
          quantity,
          unitValue,
          totalValue,
          disposalDate: transfer.disposalDate || transferItem.disposalDate,
          disposalReason: transfer.disposalReason || transferItem.disposalReason,
          approvedBy: approvedByUser?.name || "System",
          approvedById: transfer.approvedBy,
        };

        console.log("📦 FINAL RECORD ADDED:", record);

        disposedItems.push(record);
      }
    }

    console.log(`\n🧾 Total Disposed Items before filters: ${disposedItems.length}`);

    // -------------------------------------------
    // FILTERS WITH DEBUG
    // -------------------------------------------

    if (warehouseId) {
      disposedItems = disposedItems.filter(
        (item) => item.warehouseId === parseInt(warehouseId as string)
      );
      console.log(`🏭 Filtered by warehouseId=${warehouseId} → ${disposedItems.length} items`);
    }

    if (itemId) {
      disposedItems = disposedItems.filter(
        (item) => item.itemId === parseInt(itemId as string)
      );
      console.log(`📦 Filtered by itemId=${itemId} → ${disposedItems.length} items`);
    }

    if (dateFrom) {
      const fromDate = new Date(dateFrom as string);
      disposedItems = disposedItems.filter(
        (item) => item.disposalDate && new Date(item.disposalDate) >= fromDate
      );
      console.log(`📅 Filtered from date=${dateFrom} → ${disposedItems.length} items`);
    }

    if (dateTo) {
      const toDate = new Date(dateTo as string);
      toDate.setHours(23, 59, 59, 999);
      disposedItems = disposedItems.filter(
        (item) => item.disposalDate && new Date(item.disposalDate) <= toDate
      );
      console.log(`📅 Filtered to date=${dateTo} → ${disposedItems.length} items`);
    }

    if (approvedBy && approvedBy !== "all") {
      const approverIdFilter = parseInt(approvedBy as string);
      disposedItems = disposedItems.filter((item) => {
        const transfer = disposedTransfers3.find((t) => t.id === item.transferId);
        return transfer && transfer.approvedBy === approverIdFilter;
      });
      console.log(`👤 Filtered by approvedBy=${approvedBy} → ${disposedItems.length} items`);
    }

    console.log(`\n✅ FINAL Returned Disposed Items: ${disposedItems.length}`);
    res.json(disposedItems);

  } catch (error) {
    console.error("❌ Error fetching disposed inventory:", error);
    res.status(500).json({ message: "Failed to fetch disposed inventory" });
  }
});




  // GET /api/disposed-inventory
// app.get("/api/disposed-inventory", async (req: Request, res: Response) => {
//   try {
//     if (!req.isAuthenticated()) {
//       return res.status(401).json({ message: "Unauthorized" });
//     }

//     const { warehouseId, itemId, dateFrom, dateTo, approvedBy } = req.query;

//     // 1. Get all disposed items WITH the joined data
//     let disposedItems = await storage.getAllDisposedItemsReport();
    
//     // Note: We don't need to calculate value, it's already in the table.
//     // We also don't need N+1 loops. This is much faster.

//     // 2. Apply filters (This logic is now identical to your original)
//     if (warehouseId) {
//       disposedItems = disposedItems.filter(item => 
//         item.warehouse.id === parseInt(warehouseId as string)
//       );
//     }

//     if (itemId) {
//       disposedItems = disposedItems.filter(item => 
//         item.item.id === parseInt(itemId as string)
//       );
//     }

//     if (dateFrom) {
//       const fromDate = new Date(dateFrom as string);
//       disposedItems = disposedItems.filter(item => 
//         item.disposalDate && new Date(item.disposalDate) >= fromDate
//       );
//     }

//     if (dateTo) {
//       const toDate = new Date(dateTo as string);
//       toDate.setHours(23, 59, 59, 999); // End of day
//       disposedItems = disposedItems.filter(item => 
//         item.disposalDate && new Date(item.disposalDate) <= toDate
//       );
//     }

//     if (approvedBy && approvedBy !== "all") {
//       disposedItems = disposedItems.filter(item => 
//         item.approvedByUser.id === parseInt(approvedBy as string)
//       );
//     }

//     // 3. We rename the 'approvedByUser' field to match your original 'approvedBy' name
//     const finalResults = disposedItems.map(item => ({
//       id: item.id,
//       itemId: item.item.id,
//       item: item.item,
//       warehouseId: item.warehouse.id,
//       warehouse: item.warehouse,
//       quantity: item.quantity,
//       unitValue: item.unitValue,
//       totalValue: item.totalValue,
//       disposalDate: item.disposalDate,
//       disposalReason: item.disposalReason,
//       approvedBy: item.approvedByUser?.name || 'System', // Get the name
//       approvedById: item.approvedByUser?.id, // Get the ID
//       // Add any other fields you need
//     }));

//     res.json(finalResults);

//   } catch (error) {
//     console.error("Error fetching disposed inventory:", error);
//     res.status(500).json({ message: "Failed to fetch disposed inventory" });
//   }
// });

  // Enhanced Transfer Management Routes
  
  // Get all transfers with enriched data
  app.get("/api/transfers", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const alltransfers = await storage.getAllTransfers();
      const transfers = alltransfers.filter(t=> t.status!=='disposed');

      
      // Enrich transfers with additional data
      const enrichedTransfers = await Promise.all(transfers.map(async (transfer) => {
        const sourceWarehouse = await storage.getWarehouse(transfer.sourceWarehouseId);
        const destinationWarehouse = await storage.getWarehouse(transfer.destinationWarehouseId);
        const initiatedByUser = await storage.getUser(transfer.initiatedBy);
        const approvedByUser = transfer.approvedBy ? await storage.getUser(transfer.approvedBy) : null;
        const transferItems = await storage.getTransferItemsByTransfer(transfer.id);
        const transferUpdates = await storage.getTransferUpdatesByTransfer(transfer.id);
        const approvedUpdate = transferUpdates.find((item) => item.status === "approved");
        const returnRequested = transferUpdates.find((item)=>item.status==='return-requested'|| item.status==='partial-return-requested');
        const returnApproved = transferUpdates.find((item)=>item.status === "return-approved");
        const returnRejected= transferUpdates.find((item)=>item.status === 'return-rejected')
        const returnShipped = transferUpdates.find((item)=>item.status==='return_shipped');
        const returned = transferUpdates.find((item)=>item.status === 'returned');
        const rejected = transferUpdates.find((item)=>item.status==='rejected');
        const inTransit= transferUpdates.find((item)=>item.status==='in-transit');
        const approvedAt = approvedUpdate ? new Date(approvedUpdate.createdAt) : null;
        const returnApprovedAt = returnApproved ? new Date(returnApproved?.createdAt):null;
        const returnShippedAt = returnShipped ? new Date(returnShipped?.createdAt):null;
        const returnedAt = returned ? new Date(returned?.createdAt):null;
        const rejectedAt = rejected ? new Date(rejected.createdAt):null;
        
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
          items: enrichedItems,
          approvedAt,
          inTransit,
          returnRejected,
          returnApproved,
          returnShipped,
          returned,
          rejected,
          returnRequested
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

      // Check warehouse permissions
      const user = req.user!;
      const sourceWarehouseId = parseInt(req.body.sourceWarehouseId);
      
      // Only admin can create transfers from any warehouse
      // Managers and operators can only create transfers from warehouses they manage or are assigned to
      if (user.role !== 'admin') {
        // Get warehouses the user can transfer from
        const managedWarehouses = await storage.getWarehousesByManager(user.id);
        const assignedWarehouse = user.warehouseId ? await storage.getWarehouse(user.warehouseId) : null;
        
        const allowedWarehouses = [...managedWarehouses];
        if (assignedWarehouse) {
          allowedWarehouses.push(assignedWarehouse);
        }
        
        // Remove duplicates
        const uniqueAllowedWarehouses = allowedWarehouses.filter((warehouse, index, self) => 
          index === self.findIndex(w => w.id === warehouse.id)
        );
        
        if (uniqueAllowedWarehouses.length === 0) {
          return res.status(403).json({ message: "You are not assigned to manage any warehouse" });
        }
        
        const canTransferFromSource = uniqueAllowedWarehouses.some(w => w.id === sourceWarehouseId);
        if (!canTransferFromSource) {
          return res.status(403).json({ 
            message: "You can only create transfers from warehouses you manage or are assigned to" 
          });
        }
      }
      const timestamp = Date.now();
      const randomSuffix = Math.floor(Math.random() * 1000);
      const transferCode = `TRF-${timestamp}-${randomSuffix}`;

      const transferData = insertTransferSchema.parse({
        ...req.body,
        transferCode,
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
      // await storage.createTransferUpdate({
      //   transferId: transfer.id,
      //   updatedBy: req.user!.id,
      //   status: 'pending',
      //   updateType: 'status_change',
      //   description: 'Transfer created'
      // });

      await storage.createAuditLog({
        userId: req.user!.id,
        action: "CREATED",
        entityType: "Transfer",
        details: `Transfer  ${transfer.transferCode} created by ${ req?.user?.name}`,
        ipAddress: req.ip || req.connection.remoteAddress,
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
  // app.patch("/api/transfers/:id", async (req, res) => {
  //   try {
  //     if (!req.isAuthenticated()) {
  //       return res.status(401).json({ message: "Unauthorized" });
  //     }

  //     const transferId = parseInt(req.params.id);
  //     const user = req.user!;
      
  //     // Get the transfer to check permissions
  //     const transfer = await storage.getTransfer(transferId);
  //     if (!transfer) {
  //       return res.status(404).json({ message: "Transfer not found" });
  //     }

  //     // Get warehouse information to check management roles
  //     const sourceWarehouse = await storage.getWarehouse(transfer.sourceWarehouseId);
  //     const destinationWarehouse = await storage.getWarehouse(transfer.destinationWarehouseId);
      
  //     // Check if user manages or is assigned to source or destination warehouse
  //     const managesSourceWarehouse = user.role === 'admin' || 
  //       sourceWarehouse?.managerId === user.id || 
  //       user.warehouseId === transfer.sourceWarehouseId;
  //     const managesDestinationWarehouse = user.role === 'admin' || 
  //       destinationWarehouse?.managerId === user.id || 
  //       user.warehouseId === transfer.destinationWarehouseId;
      
  //     // Define field permissions based on role and warehouse management
  //     const sourceWarehouseFields = [
  //       'receiptNumber', 'handoverPersonName', 'handoverPersonContact', 'handoverDate',
  //       'courierName', 'trackingNumber', 'transportNotes'
  //     ];
      
  //     const destinationWarehouseFields = [
  //       'receivedBy', 'receivedDate', 'receiverNotes', 'overallCondition'
  //     ];
      
  //     // Status change permissions
  //     const canUpdateStatus = (newStatus: string) => {
  //       console.log(`🔄 Status change check: ${transfer.status} -> ${newStatus}`);
        
        
  //       // Allow admins or warehouse managers to approve pending transfers
  //       if (newStatus === 'approved' && transfer.status === 'pending') {
  //         return user.role === 'admin' || managesSourceWarehouse || managesDestinationWarehouse;
  //       }
  //       if (newStatus === 'in-transit' && transfer.status === 'approved') {
  //         return managesSourceWarehouse || user.role === 'admin';
  //       }
  //       if ((newStatus === 'completed' || newStatus === 'rejected') && transfer.status === 'in-transit') {
  //         console.log('managesDestination warehouse ',managesDestinationWarehouse)
  //         return managesDestinationWarehouse;
  //       }
  //       // Allow admins or relevant warehouse managers to reject pending transfers
  //       if (newStatus === 'rejected' && transfer.status === 'pending') {
  //         return user.role === 'admin' || managesSourceWarehouse || managesDestinationWarehouse;
  //       }
  //       if ((newStatus === 'return-requested' || newStatus ==='partial-return-requested') && transfer.status==='in-transit'){
  //         return user.role==='admin' || managesDestinationWarehouse;
  //       }
  //       if(newStatus==='returned' && transfer.status === 'return_shipped'){
  //         return managesDestinationWarehouse || user?.role==='admin'
  //       }
  //       if(newStatus==='return-approved'){
  //         return managesSourceWarehouse || user.role==='admin'
  //       }
  //       if(newStatus==='return-rejected'){
  //         return managesSourceWarehouse || user.role==='admin'
  //       }

  //       return false;
  //     };
      
  //     const filteredData: any = {};
  //     console.table({'managesSourceWarehouse':managesSourceWarehouse,'managesDestinationWarehouse':managesDestinationWarehouse,'isAdmin':user.role==='admin','canUpdateStatus':canUpdateStatus})
      
  //     // Check permissions for each field
  //     for (const [field, value] of Object.entries(req.body)) {
  //       if (value === undefined) continue;
        
  //       if (field === 'status') {
  //         if (canUpdateStatus(value as string)) {
  //           if(value==='approved'){
  //             filteredData["approvedBy"]=req.user.id;
  //           }
  //           filteredData[field] = value;
  //         } else {
  //           return res.status(403).json({ 
  //             message: `You don't have permission to change status to ${value}` 
  //           });
  //         }
  //       } else if (sourceWarehouseFields.includes(field)) {
  //         if (managesSourceWarehouse) {
  //           filteredData[field] = value;
  //         } else {
  //           return res.status(403).json({ 
  //             message: `Only source warehouse managers can update ${field}` 
  //           });
  //         }
  //       } else if (destinationWarehouseFields.includes(field)) {
  //         if (managesDestinationWarehouse) {
  //           filteredData[field] = value;
  //         } else {
  //           return res.status(403).json({ 
  //             message: `Only destination warehouse managers can update ${field}` 
  //           });
  //         }
  //       } else if (['items', 'rejectionReason'].includes(field)) {
  //         // Items and rejection reason can be updated by destination warehouse managers
  //         if (managesDestinationWarehouse) {
  //           filteredData[field] = value;
  //         } else {
  //           return res.status(403).json({ 
  //             message: `Only destination warehouse managers can update ${field}` 
  //           });
  //         }
  //       }
  //     }

  //     console.log('✅ Final filtered data to update:', filteredData);

  //     // Rest of your existing code for date conversions and updates...
  //     // Convert date strings to Date objects
  //     if (filteredData.expectedShipmentDate) {
  //       filteredData.expectedShipmentDate = new Date(filteredData.expectedShipmentDate);
  //     }
  //     if (filteredData.expectedArrivalDate) {
  //       filteredData.expectedArrivalDate = new Date(filteredData.expectedArrivalDate);
  //     }
  //     if (filteredData.actualShipmentDate) {
  //       filteredData.actualShipmentDate = new Date(filteredData.actualShipmentDate);
  //     }
  //     if (filteredData.actualArrivalDate) {
  //       filteredData.actualArrivalDate = new Date(filteredData.actualArrivalDate);
  //     }
  //     if (filteredData.handoverDate) {
  //       filteredData.handoverDate = new Date(filteredData.handoverDate);
  //     }
  //     if (filteredData.receivedDate) {
  //       filteredData.receivedDate = new Date(filteredData.receivedDate);
  //     }



  //     // Handle inventory updates when transfer is in-transit
  //     const updatedTransfer = await storage.updateTransfer(transferId, filteredData);
  //     if((filteredData.status === 'in-transit') && updatedTransfer){
  //       const transferItems = await storage.getTransferItemsByTransfer(transferId);
  //       for (const item of transferItems) {
  //         console.log('ribhuitem',item);
  //         // Remove from source warehouse
  //         const result = await storage.safeSubtractInventory(
  //           item.itemId,
  //           updatedTransfer.sourceWarehouseId,
  //           item.requestedQuantity
  //         );

  //         if (!result.success) {
  //           return res.status(400).json({
  //             message: "Insufficient stock for this warehouse"
  //           });
  //         }

  //         await storage.createTransaction({
  //           itemId: item.itemId,
  //           sourceWarehouseId: updatedTransfer.sourceWarehouseId,
  //           userId: req.user!.id,
  //           requesterId: req.user!.id,
  //           transactionType: 'transfer',
  //           quantity: item.requestedQuantity,
  //           status:'in-transit'
  //         });
  //       }
  //     }
      

  //     // Handle inventory updates when transfer is completed (accepted) or rejected
  //     if ((filteredData.status === 'completed' || filteredData.status === 'returned') && updatedTransfer) {
  //       const transferItems = await storage.getTransferItemsByTransfer(transferId);
  //       if (transferItems && transferItems.length > 0) {
          
  //         if (filteredData.status === 'completed') {
  //           // Handle accepted transfer - normal inventory flow
  //           for (const item of transferItems) {
  //             console.log(' Add to destination warehouse');
  //             const result = await storage.safeAddInventory(
  //               item.itemId,
  //               updatedTransfer.destinationWarehouseId,
  //               item.actualQuantity || item.requestedQuantity
  //             );

  //             if (!result.success) {
  //               return res.status(400).json({
  //                 message: "Warehouse has insufficient capacity"
  //               });
  //             }

  //             console.log('updatedInventory',result.inventory)
  //             // Create transaction records for transfer in
  //             await storage.createTransaction({
  //               itemId: item.itemId,
  //               destinationWarehouseId: updatedTransfer.destinationWarehouseId,
  //               userId: req.user!.id,
  //               requesterId: filteredData.receivedBy || req.user!.id,
  //               transactionType: 'check-in',
  //               quantity: item.actualQuantity || item.requestedQuantity,
  //             });
  //           }
  //           const items=req.body.items;
  //           if (Array.isArray(items) && items.length > 0) {
  //               // run updates in parallel
  //               await Promise.all(items.map(async (item: any) => {
  //                 const id = item.transferItemId ;
  //                 const updatePayload = {
  //                   actualQuantity: item.actualQuantity,
  //                   condition: item.condition,
  //                   notes: item.notes,
  //                   itemStatus:item.itemStatus
  //                 };
  //                 await storage.updateTransferItem(id, updatePayload);
  //               }));
  //             }
  //         }
  //         else if (filteredData.status === 'returned') {
  //           // Handle rejected transfer - move items to rejected goods
            
  //           const filteredTransferItems=transferItems.filter((item)=>item.itemStatus==='Returned')
  //           for (const item of filteredTransferItems) {
             

  //             // Create rejected goods record
  //             await storage.createRejectedGoods({
  //               transferId: transferId,
  //               itemId: item.itemId,
  //               quantity: item.requestedQuantity,
  //               rejectionReason: filteredData.receiverNotes || 'Transfer rejected by destination warehouse',
  //               rejectedBy: req.user!.id,
  //               warehouseId: updatedTransfer.sourceWarehouseId,
  //               status: 'rejected',
  //               notes: filteredData.receiverNotes
  //             });

  //             // // Create transaction record for rejection
  //             // await storage.createTransaction({
  //             //   itemId: item.itemId,
  //             //   sourceWarehouseId: updatedTransfer.sourceWarehouseId,
  //             //   userId: req.user!.id,
  //             //   requesterId: req.user!.id,
  //             //   transactionType: 'check-out',
  //             //   quantity: item.requestedQuantity,
  //             // });
  //           }
  //         }
        
  //     }
  //     }
  //     if (
  //       (filteredData.status === 'partial-return-requested' ||
  //         filteredData.status === 'return-requested') &&
  //       updatedTransfer
  //     ) {
  //       console.log('🔄 Entered partial/return request block');
  //       console.log('➡️ Updated Transfer ID:', updatedTransfer.id);
  //       console.log('📦 Incoming request items:', req.body?.items);

  //       const transferItems = await storage.getTransferItemsByTransfer(updatedTransfer.id);
  //       console.log('🧾 All transfer items from DB:', transferItems);

  //       const items = req.body?.items;

  //       if (Array.isArray(items) && items.length > 0) {
  //         console.log('✏️ Updating transfer items...');
  //         await Promise.all(
  //           items.map(async (item: any) => {
  //             const updatePayload = {
  //               actualQuantity: item.actualQuantity,
  //               condition: item.condition,
  //               notes: item.notes,
  //               itemStatus: item.itemStatus,
  //             };
  //             console.log(`➡️ Updating item ID ${item.transferItemId} with:`, updatePayload);
  //             await storage.updateTransferItem(item.transferItemId, updatePayload);
  //           })
  //         );
  //       } else {
  //         console.log('⚠️ No items provided in request body.');
  //       }

  //       // Refetch updated items to ensure status reflects DB
  //       const updatedTransferItems = await storage.getTransferItemsByTransfer(updatedTransfer.id);
  //       console.log('✅ Refetched updated transfer items:', updatedTransferItems);

  //       const filteredTransferAcceptItems = updatedTransferItems.filter(
  //         (item) => item.itemStatus === 'Accepted'
  //       );
  //       console.log('🟢 Accepted items:', filteredTransferAcceptItems);

  //       for (const item of filteredTransferAcceptItems) {
  //         console.log(`📦 Processing accepted itemId=${item.itemId}`);

  //         const quantityToAdd = item.actualQuantity || item.requestedQuantity;
  //         console.log(
  //           `➕ Adding to destination warehouse=${updatedTransfer.destinationWarehouseId}, quantity=${quantityToAdd}`
  //         );

  //         const result = await storage.safeAddInventory(
  //           item.itemId,
  //           updatedTransfer.sourceWarehouseId,
  //           item.requestedQuantity
  //         );

  //         if (!result.success) {
  //           return res.status(400).json({
  //             message: "Insufficient stock for this warehouse"
  //           });
  //         }

  //         console.log('✅ Updated Inventory:', result.inventory);

  //         await storage.createTransaction({
  //           itemId: item.itemId,
  //           destinationWarehouseId: updatedTransfer.destinationWarehouseId,
  //           userId: req.user!.id,
  //           requesterId: filteredData.receivedBy || req.user!.id,
  //           transactionType: 'check-in',
  //           quantity: quantityToAdd,
  //         });
  //         console.log('🧾 Transaction created for itemId:', item.itemId);
  //       }

  //       console.log('🎯 Partial/Return flow complete for transfer ID:', updatedTransfer.id);
  //     }
  //     if(filteredData.status === 'return-rejected' && updatedTransfer){
  //       const transferItems = await storage.getTransferItemsByTransfer(transferId);

  //       const filteredTransferItems=transferItems.filter((item)=>item.itemStatus==='Returned')
  //       for(const item of filteredTransferItems){
  //         await storage.createRejectedGoods({
  //               transferId: transferId,
  //               itemId: item.itemId,
  //               quantity: item.requestedQuantity,
  //               rejectionReason: filteredData.receiverNotes || 'Transfer rejected by destination warehouse',
  //               rejectedBy: req.user!.id,
  //               warehouseId: updatedTransfer.sourceWarehouseId,
  //               status: 'dispose',
  //               notes: filteredData.receiverNotes
  //             });
  //         await storage.createTransaction({
  //           transactionCode: `TXN-${transfer}`,
  //             transactionType: "disposal",
  //             itemId:item.itemId,
  //             quantity: item.actualQuantity,
  //             sourceWarehouseId: transfer.sourceWarehouseId,
  //             userId: user.id,
  //             status: "completed",
  //             checkInDate: new Date()
  //         })
  //         const date=new Date();
  //         await storage.updateTransferItem(item.id,{itemStatus:'dispose',isDisposed:true,disposalReason:req.body?.disposalReason,disposalDate:date})
  //       }

  //     }

  //     if (!updatedTransfer) {
  //       return res.status(404).json({ message: "Transfer not found" });
  //     }

  //     // Create transfer update log
  //     await storage.createTransferUpdate({
  //       transferId,
  //       updatedBy: req.user!.id,
  //       status: updatedTransfer.status,
  //       updateType: req.body.updateType || 'status_change',
  //       description: req.body.updateDescription || `Transfer updated`,
  //       metadata: req.body.metadata ? JSON.stringify(req.body.metadata) : undefined
  //     });

  //     // Create audit log for transfer update
  //     await storage.createAuditLog({
  //       userId: req.user!.id,
  //       action: 'UPDATE',
  //       entityType: 'transfer',
  //       entityId: transferId,
  //       details: `Transfer ${transfer.transferCode} updated`,
  //       oldValues: JSON.stringify({
  //         status: transfer.status,
  //         notes: transfer.notes,
  //         courierName: transfer.courierName,
  //         handoverPersonName: transfer.handoverPersonName,
  //         trackingNumber: transfer.trackingNumber
  //       }),
  //       newValues: JSON.stringify(filteredData),
  //       ipAddress: req.ip || req.connection.remoteAddress,
  //       userAgent: req.get('User-Agent')
  //     });
  //     // if(filteredData.status=='return-rejected'){
  //     //   console.log('ribhu',filteredData.status)
  //     //   const updatedTransfer=await storage.updateTransfer(transferId,{status:'disposed'})
  //     //   // Create transfer update log
  //     // await storage.createTransferUpdate({
  //     //   transferId,
  //     //   updatedBy: req.user!.id,
  //     //   status: updatedTransfer?.status,
  //     //   updateType: req.body.updateType || 'status_change',
  //     //   description: req.body.updateDescription || `Transfer updated`,
  //     //   metadata: req.body.metadata ? JSON.stringify(req.body.metadata) : undefined
  //     // });

  //     // // // Create audit log for transfer update
  //     // // await storage.createAuditLog({
  //     // //   userId: req.user!.id,
  //     // //   action: 'UPDATE',
  //     // //   entityType: 'transfer',
  //     // //   entityId: transferId,
  //     // //   details: `Transfer ${transfer.transferCode} updated`,
  //     // //   oldValues: JSON.stringify({
  //     // //     status: transfer.status,
  //     // //     notes: transfer.notes,
  //     // //     courierName: transfer.courierName,
  //     // //     handoverPersonName: transfer.handoverPersonName,
  //     // //     trackingNumber: transfer.trackingNumber
  //     // //   }),
  //     // //   newValues: JSON.stringify(filteredData),
  //     // //   ipAddress: req.ip || req.connection.remoteAddress,
  //     // //   userAgent: req.get('User-Agent')
  //     // // });
  //     // }

  //     console.log('🎉 Transfer update process completed successfully');
  //     res.json(updatedTransfer);
  //   }
  //   catch (error: any) {
  //     console.error('💥 Transfer update error:', error);
  //     console.error('Error stack:', error.stack);
  //     res.status(400).json({ message: error.message });
  //   }
  // });

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
      
      // Check if user manages or is assigned to source or destination warehouse
      const managesSourceWarehouse = user.role === 'admin' || 
        sourceWarehouse?.managerId === user.id || 
        user.warehouseId === transfer.sourceWarehouseId;
      const managesDestinationWarehouse = user.role === 'admin' || 
        destinationWarehouse?.managerId === user.id || 
        user.warehouseId === transfer.destinationWarehouseId;
      
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
        console.log(`🔄 Status change check: ${transfer.status} -> ${newStatus}`);
        
        
        // Allow admins or warehouse managers to approve pending transfers
        if (newStatus === 'approved' && transfer.status === 'pending') {
          return user.role === 'admin' || managesSourceWarehouse ;
        }
        if (newStatus === 'rejected' && transfer.status === 'pending') {
          return user.role === 'admin' || managesSourceWarehouse ;
        }
        if (newStatus === 'in-transit' && transfer.status === 'approved') {
          return managesSourceWarehouse || user.role === 'admin';
        }
        if (newStatus === 'completed'  && transfer.status === 'in-transit') {
          console.log('managesDestination warehouse ',managesDestinationWarehouse)
          return managesDestinationWarehouse || user.role==='admin';
        }
        // Allow admins or relevant warehouse managers to reject pending transfers
        
        if ((newStatus === 'return-requested' || newStatus ==='partial-return-requested') && transfer.status==='in-transit'){
          return user.role==='admin' || managesDestinationWarehouse;
        }
         if(newStatus==='return-approved'){
          return managesSourceWarehouse || user.role==='admin'
        }
        if(newStatus==='return-rejected'){
          return managesSourceWarehouse || user.role==='admin'
        }
        if(newStatus==='return_shipped'){
          return managesDestinationWarehouse || user.role==='admin'
        }
        if(newStatus==='returned' && transfer.status === 'return_shipped'){
          return managesSourceWarehouse || user?.role==='admin'
        }
       

        return false;
      };
      
      const filteredData: any = {};
      console.table({'managesSourceWarehouse':managesSourceWarehouse,'managesDestinationWarehouse':managesDestinationWarehouse,'isAdmin':user.role==='admin','canUpdateStatus':canUpdateStatus})
      
      // Check permissions for each field
      for (const [field, value] of Object.entries(req.body)) {
        if (value === undefined) continue;
        
        if (field === 'status') {
          if (canUpdateStatus(value as string)) {
            if(value==='approved'){
              filteredData["approvedBy"]=req.user.id;
            }
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

      console.log('✅ Final filtered data to update:', filteredData);

      // Rest of your existing code for date conversions and updates...
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



      const result = await db.transaction(async (tx) => {
            // Re-fetch transfer inside tx for consistency & use its source/destination ids
            const currentTransfer = await storage.getTransferTx(tx, transferId);
            if (!currentTransfer) throw new Error("Transfer not found");

            // Helper: get transfer items inside tx
            const transferItems = await storage.getTransferItemsByTransferTx(tx, transferId);

            // ---------- Approve flow: subtract from source ----------
            if (filteredData.status === 'approved') {
              // subtract each item using safeSubtractInventoryTx (locks row)
              for (const item of transferItems) {
                const subRes = await storage.safeSubtractInventoryTx(tx, item.itemId, currentTransfer.sourceWarehouseId, item.requestedQuantity);
                if (!subRes.success) {
                  if (subRes.reason === 'insufficient_stock') throw new Error(`Insufficient stock for item ${item.itemId}`);
                  throw new Error('Inventory missing for item ' + item.itemId);
                }

                // create transaction record for this subtract
                await storage.createTransactionTx(tx, {
                  itemId: item.itemId,
                  sourceWarehouseId: currentTransfer.sourceWarehouseId,
                  destinationWarehouseId:currentTransfer.destinationWarehouseId,
                  transferId,
                  userId: req.user!.id,
                  requesterId: req.user!.id,
                  transactionType: 'transfer',
                  quantity: item.requestedQuantity,
                  status: 'approved',
                  createdAt: new Date()
                } as any);
              }
            }

            // ---------- COMPLETED or RETURNED flow: add to destination ----------
            if (filteredData.status === 'completed' ) {
              // Note: if returned, you have separate handling — this is the basic add flow
              for (const item of transferItems) {
                const qtyToAdd = item.actualQuantity || item.requestedQuantity;

                const addRes = await storage.safeAddInventoryTx(tx, item.itemId, currentTransfer.destinationWarehouseId, qtyToAdd);
                if (!addRes.success) {
                  if (addRes.reason === 'exceeds_capacity') throw new Error(`Destination capacity exceeded for item ${item.itemId}`);
                  if (addRes.reason === 'inventory_missing'){
                    await storage.createInventoryTx(tx,{
                      itemId: item.itemId,
                      warehouseId: currentTransfer.destinationWarehouseId,
                      quantity: qtyToAdd
                    });
                  }
                }

                // create transaction record for this addition
                await storage.updateTransactionByTransferAndItemIdTx(tx, transferId,item.itemId, {
                  destinationWarehouseId: currentTransfer.destinationWarehouseId,
                  checkInDate: new Date(),
                  completedAt: new Date(),
                  status:'completed'
                } as any);
              }

              // optionally update transfer items (item-level actual quantities) if provided in request body
              const incomingItems = req.body.items;
              if (Array.isArray(incomingItems) && incomingItems.length > 0) {
                for (const it of incomingItems) {
                  await storage.updateTransferItemTx(tx, it.transferItemId, {
                    actualQuantity: it.actualQuantity,
                    condition: it.condition,
                    notes: it.notes,
                    itemStatus: it.itemStatus
                  });
                }
              }
            }

            // ---------- PARTIAL / RETURN REQUESTS / RETURNS special handling ----------
            if (filteredData.status === 'partial-return-requested' || filteredData.status === 'return-requested') {
              // update transfer items per incoming payload (should be provided)
              const incomingItems = req.body.items;
              if (Array.isArray(incomingItems) && incomingItems.length > 0) {
                for (const it of incomingItems) {
                  await storage.updateTransferItemTx(tx, it.transferItemId, {
                    actualQuantity: it.actualQuantity,
                    condition: it.condition,
                    notes: it.notes,
                    itemStatus: it.itemStatus
                  });
                }
              }

              // After updating the items, process accepted items (example: adding accepted quantity back)
              const updatedItems = await storage.getTransferItemsByTransferTx(tx, transferId);
              const accepted = updatedItems.filter((i: any) => i.itemStatus === 'Accepted');
              const rejected = updatedItems.filter ((i:any)=> i.itemStatus === 'Returned');
              for (const item of accepted) {
                const qtyToAdd = item.actualQuantity || item.requestedQuantity;
                const addRes = await storage.safeAddInventoryTx(tx, item.itemId, currentTransfer.destinationWarehouseId, qtyToAdd);
                if (!addRes.success) {
                  if (addRes.reason === 'exceeds_capacity') throw new Error(`Destination capacity exceeded for item ${item.itemId}`);
                  if (addRes.reason === 'inventory_missing'){
                    await storage.createInventoryTx(tx,{
                      itemId: item.itemId,
                      warehouseId: currentTransfer.destinationWarehouseId,
                      quantity: qtyToAdd
                    });
                  }
                }

                await storage.updateTransactionByTransferAndItemIdTx(tx,transferId,item.itemId, {
                  destinationWarehouseId: currentTransfer.destinationWarehouseId,
                  status:'completed',
                  checkInDate: new Date(),
                  completedAt: new Date()
                  } as any
                );

              }
              for ( const item of rejected){
                await storage.updateTransactionByTransferAndItemIdTx(tx,transferId,item.itemId,{
                  status:'rejected'
                })
              }
            }

            // ---------- RETURN-REJECTED special handling: create rejected goods and disposal ----------
            if (filteredData.status === 'return-rejected') {
              const items = await storage.getTransferItemsByTransferTx(tx, transferId);
              const returnedItems = items.filter((i: any) => i.itemStatus === 'Returned');
              for (const item of returnedItems) {
                await storage.createRejectedGoodsTx(tx, {
                  transferId,
                  itemId: item.itemId,
                  quantity: item.requestedQuantity,
                  rejectionReason: filteredData.receiverNotes || 'Transfer rejected by destination warehouse',
                  rejectedBy: req.user!.id,
                  warehouseId: currentTransfer.sourceWarehouseId,
                  status: 'dispose',
                  notes: filteredData.receiverNotes,
                  createdAt: new Date()
                } as any);

                // create a disposal transaction (example)
                const updatedTransaction = await storage.updateTransactionByTransferAndItemIdTx(tx,transferId,item.itemId, {
                  status:'disposed',
                  completedAt: new Date()
                } as any);
                console.log('updatedTransaction',updatedTransaction)

                // mark transfer item as disposed
                await storage.updateTransferItemTx(tx, item.id, {
                  itemStatus: 'dispose',
                  isDisposed: true,
                  disposalReason: req.body?.disposalReason,
                  disposalDate: new Date()
                });
              }
            }
            if (filteredData.status === 'returned') {
              // Handle rejected transfer - move items to rejected goods
              
              const filteredTransferItems=transferItems.filter((item:any)=>item.itemStatus==='Returned')
              for (const item of filteredTransferItems) {
              

                // Create rejected goods record
                await storage.createRejectedGoodsTx(tx,{
                  transferId: transferId,
                  itemId: item.itemId,
                  quantity: item.requestedQuantity,
                  rejectionReason: filteredData.receiverNotes || 'Transfer rejected by destination warehouse',
                  rejectedBy: req.user!.id,
                  warehouseId: transfer.sourceWarehouseId,
                  status: 'rejected',
                  notes: filteredData.receiverNotes
                });

                await storage.updateTransactionByTransferAndItemIdTx(tx,transferId,item.itemId,{
                  status:'rejected'
                })

                // // Create transaction record for rejection
                // await storage.createTransaction({
                //   itemId: item.itemId,
                //   sourceWarehouseId: updatedTransfer.sourceWarehouseId,
                //   userId: req.user!.id,
                //   requesterId: req.user!.id,
                //   transactionType: 'check-out',
                //   quantity: item.requestedQuantity,
                // });
              }
            }

            // ---------- All inventory ops done & OK -> update transfer record ----------
            const updatedTransfer = await storage.updateTransferTx(tx, transferId, filteredData);
            if (!updatedTransfer) throw new Error("Failed to update transfer");

            // Create transfer update log & audit log inside tx
            await storage.createTransferUpdateTx(tx, {
              transferId,
              updatedBy: req.user!.id,
              status: updatedTransfer.status,
              updateType: req.body.updateType || 'status_change',
              description: req.body.updateDescription || `Transfer updated`,
              metadata: req.body.metadata ? JSON.stringify(req.body.metadata) : undefined,
              createdAt: new Date()
            } as any);
            const { oldValues, newValues } = await computeDiff(currentTransfer, updatedTransfer);

            await storage.createAuditLogTx(tx, {
              userId: req.user!.id,
              action: "UPDATED",
              entityType: "transfer",
              entityId: transferId,
              details: `Transfer ${currentTransfer.transferCode} updated`,
              oldValues: JSON.stringify(oldValues),
              newValues: JSON.stringify(newValues),
              ipAddress: req.ip || req.connection.remoteAddress,
              userAgent: req.get("User-Agent"),
            });


            // return the updated transfer to be sent in response
            return updatedTransfer;
          });
      console.log('🎉 Transfer update process completed successfully');
      res.json(result);
    }
    catch (error: any) {
      console.error('💥 Transfer update error:', error);
      console.error('Error stack:', error.stack);
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
        action: "CREATED",
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
      const warehouses= await storage.getAllWarehouses();
      const items= await storage.getAllItems();
      const enrichedIssues=filteredIssues.map(issue=>{
        const warehouse= warehouses.find(w=>w.id===issue.warehouseId);
        const item = items.find(i=>i.id===issue.itemId)
        return{
          ...issue,
          warehouse,
          item
        }
      })

      res.json(enrichedIssues);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Helper function to calculate item unit values globally
  async function calculateItemUnitValues(asOfDate: Date) {
    // Get organization settings to determine valuation method
    const orgSettings = await db.select().from(organizationSettings).limit(1);
    const valuationMethod = orgSettings[0]?.inventoryValuationMethod || 'Last Value';

    // Get all check-in transactions up to the as-of date
    const allCheckInTransactions = await db.select({
      id: transactions.id,
      itemId: transactions.itemId,
      quantity: transactions.quantity,
      cost: transactions.cost,
      createdAt: transactions.createdAt,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.transactionType, 'check-in'),
        lte(transactions.createdAt, asOfDate)
      )
    )
    .orderBy(transactions.itemId, transactions.createdAt);

    // Group check-ins by item
    const checkInsByItem = new Map();
    for (const transaction of allCheckInTransactions) {
      if (!checkInsByItem.has(transaction.itemId)) {
        checkInsByItem.set(transaction.itemId, []);
      }
      checkInsByItem.get(transaction.itemId).push(transaction);
    }

    // Calculate unit values for each item
    const itemUnitValues = new Map();
    for (const [itemId, checkInTransactions] of checkInsByItem.entries()) {
      if (checkInTransactions.length === 0) continue;

      let unitValue = 0;
      switch (valuationMethod) {
        case 'Last Value':
          const lastTransaction = checkInTransactions[checkInTransactions.length - 1];
          unitValue = parseFloat(lastTransaction.cost || '0');
          break;

        case 'Earliest Value':
          const firstTransaction = checkInTransactions[0];
          unitValue = parseFloat(firstTransaction.cost || '0');
          break;

        case 'Average Value':
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

      itemUnitValues.set(itemId, unitValue);
    }

    return { itemUnitValues, valuationMethod };
  }

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

      // Calculate global item unit values using the shared helper
      const { itemUnitValues, valuationMethod } = await calculateItemUnitValues(asOfDate);

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
      const checkInsByItem = new Map(); // Global check-ins per item (not warehouse-specific)

      // Group transactions by item for efficient processing
      for (const transaction of allTransactions) {
        // Group all transactions by item
        if (!transactionsByItem.has(transaction.itemId)) {
          transactionsByItem.set(transaction.itemId, []);
        }
        transactionsByItem.get(transaction.itemId).push(transaction);

        // Group check-in transactions by item globally (regardless of warehouse)
        if (transaction.transactionType === 'check-in' && transaction.destinationWarehouseId) {
          if (!checkInsByItem.has(transaction.itemId)) {
            checkInsByItem.set(transaction.itemId, []);
          }
          checkInsByItem.get(transaction.itemId).push(transaction);
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

              const src = transaction.sourceWarehouseId;
              const dest = transaction.destinationWarehouseId;
              const qty = transaction.quantity;
              const status = transaction.status;
              let effectiveDate = null;

              if (status === "approved" || status === "in-transit") {
                effectiveDate = transaction.createdAt;
              } else if (status === "completed") {
                effectiveDate = transaction.completedAt;
              } else if (status === "restocked") {
                effectiveDate = transaction.completedAt;
              } else if (status === "disposed") {
                effectiveDate = transaction.completedAt;
              } else if (status === "rejected") {
                effectiveDate = transaction.createdAt;
              }

              if(effectiveDate && effectiveDate > asOfDate){
                continue;
              }

              if(status ==='approved' || status === 'in-transit'){
                if(src=== invItem.warehouseId) inventoryAsOfDate -= qty;
              }
              if (status === 'completed'){
                if(src=== invItem.warehouseId) inventoryAsOfDate -=qty;
                if(dest === invItem.warehouseId) inventoryAsOfDate +=qty
              }
              if (status === 'rejected'){
                if(src=== invItem.warehouseId) inventoryAsOfDate -=qty;
              }
              if (status === 'restocked'){
                //do nothing
              }
              if (status === 'disposed'){
                if(src===invItem.warehouseId) inventoryAsOfDate -=qty;
              }

            }

        }

        // Skip if no inventory as of the selected date
        if (inventoryAsOfDate <= 0) {
          continue;
        }

        // Get the globally calculated unit value for this item
        const unitValue = itemUnitValues.get(invItem.itemId) || 0;

        if (unitValue === 0) {
          // No valuation available for this item, skip
          continue;
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
        reporterId: req.user.id,
        status: 'open'
      };

      const newIssue = await storage.createIssue(issueData);
      try {
        await storage.createIssueActivity({
          issueId: newIssue.id,
          userId: req.user.id,
          action: "create",
          description: req.body?.title || "Issue created",
          metadata: req.body ? JSON.stringify(req.body) : undefined
        } as any);
      } catch (e) {
        console.error("Failed to create issue activity (create):", e);
      }

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
      const previousIssue = await storage.getIssue(parseInt(id));
      const previousStatus = previousIssue?.status;

      const updatedIssue = await storage.updateIssue(parseInt(id), { status });
      
      if (!updatedIssue) {
        return res.status(404).json({ message: "Issue not found" });
      }
      try {
        await storage.createIssueActivity({
          issueId: parseInt(id),
          userId: req.user.id,
          action: status,
          previousValue:previousStatus,
          newValue:status,
          description: `Status changed from ${previousStatus} to ${status}`,
          metadata: JSON.stringify({ status })
        } as any);
      } catch (e) {
        console.error("Failed to create issue activity (status_change):", e);
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
      const issue = await storage.getIssue(parseInt(id));
      const previousStatus=issue.status;
      console.log('previousStatusRIbhu',previousStatus)

      const closedIssue = await storage.closeIssue(parseInt(id), req.user.id, resolutionNotes);
      
      if (!closedIssue) {
        return res.status(404).json({ message: "Issue not found" });
      }
      try {
        await storage.createIssueActivity({
          issueId: parseInt(id),
          userId: req.user.id,
          action: "close",
          previousValue:previousStatus,
          newValue:"close",
          description: resolutionNotes
        } as any);
      } catch (e) {
        console.error("Failed to create issue activity (close):", e);
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
      try {
        await storage.createIssueActivity({
          issueId: parseInt(id),
          userId: req.user.id,
          action: "reopen",
          previousValue:issue.status,
          newValue:"reopen",
          description: "Issue reopened"
        } as any);
      } catch (e) {
        console.error("Failed to create issue activity (reopen):", e);
      }
      
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
      try {
        await storage.deleteIssueActivities(parseInt(id));
      } catch (e) {
        console.error("Failed to delete issue activities:", e);
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
      const settingsWithDefaults = {
        isActive: true, // ✅ Default to active
        ...req.body
      };
      const settingsData = insertEmailSettingsSchema.parse(settingsWithDefaults);
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
      console.log("=== EMAIL SETTINGS TEST REQUEST ===");
      console.log("📨 Request body:", JSON.stringify(req.body, null, 2));
      
      const { testEmail, verificationTestEmail, settingsId, ...tempSettings } = req.body;
      
      // Use either testEmail or verificationTestEmail
      const emailToTest = testEmail || verificationTestEmail;
      console.log("🎯 Test email address:", emailToTest);
      
      if (!emailToTest) {
        console.log("❌ No test email address provided");
        return res.status(400).json({ message: "Test email address is required" });
      }

      let settings;
      console.log("🔍 Looking for existing email settings...");
      let existingSettings = await storage.getEmailSettings();
      console.log("📋 Existing settings found:", existingSettings ? "Yes" : "No");
      
      if (settingsId || existingSettings) {
        // Use existing settings if available
        settings = existingSettings;
        console.log("✅ Using existing email settings");
        if (settings) {
          console.log("   - ID:", settings.id);
          console.log("   - Host:", settings.host);
          console.log("   - Username:", settings.username);
          console.log("   - Is Active:", settings.isActive);
          console.log("   - Is Verified:", settings.isVerified);
        }
      } else {
        // Test with provided settings without saving
        console.log("🔄 Testing with temporary settings from request");
        console.log("📝 Temporary settings:", tempSettings);
        
        try {
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
          console.log("✅ Temporary settings validated successfully");
        } catch (validationError) {
          console.error("❌ Settings validation failed:", validationError);
          throw validationError;
        }
      }

      if (!settings) {
        console.log("❌ No email settings available for testing");
        return res.status(404).json({ message: "Email settings not found" });
      }

      console.log("🚀 Initializing email service...");
      // Import email service dynamically
      const { EmailService } = await import('./email-service');
      const emailService = new EmailService(settings);
      console.log("✅ Email service initialized");

      // Test connection first
      console.log("🔌 Testing email server connection...");
      const connectionTest = await emailService.testConnection();
      console.log("📡 Connection test result:", connectionTest ? "SUCCESS" : "FAILED");
      
      if (!connectionTest) {
        console.log("❌ Failed to connect to email server");
        return res.status(400).json({ 
          message: "Failed to connect to email server. Please check your configuration." 
        });
      }

      console.log("✅ Connection successful, sending test email...");
      // Send test email
      const testResult = await emailService.sendTestEmail(emailToTest);
      console.log("📨 Test email send result:", testResult ? "SUCCESS" : "FAILED");
      
      if (testResult) {
        // Mark as verified if this is an existing configuration
        if (existingSettings && existingSettings.id) {
          console.log("🏷️ Marking email settings as verified...");
          await storage.markEmailSettingsAsVerified(existingSettings.id);
          console.log("✅ Email settings verified status updated");
        }
        
        console.log("🎉 Email configuration test completed successfully!");
        res.json({ 
          success: true, 
          message: "Test email sent successfully. Configuration verified!" 
        });
      } else {
        console.log("❌ Failed to send test email");
        res.status(400).json({ 
          message: "Failed to send test email. Please check your configuration." 
        });
      }
      
    } catch (error: any) {
      console.error("💥 EMAIL SETTINGS TEST ERROR:", error);
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      res.status(400).json({ message: error.message });
    } finally {
      console.log("=== EMAIL SETTINGS TEST COMPLETED ===");
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

      if (typeof isActive !== "boolean") {
        return res
          .status(400)
          .json({ message: "isActive must be a boolean value" });
      }

      // Fetch user
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Prevent deactivating admin users
      if (user.role === "admin" && !isActive) {
        return res
          .status(400)
          .json({ message: "Cannot deactivate admin users" });
      }

      // Enforce active user limit
      if (isActive) {
        const activeUsers = await storage.getActiveUsers();
        if (activeUsers.length >= 50) {
          return res.status(400).json({
            message: `Cannot activate user. Active user count is already ${activeUsers.length}`,
          });
        }
      }

      // Update user status
      const updatedUser = await storage.updateUserStatus(userId, isActive);

      // ----------------------------------------------------
      // 🔥 CREATE AUDIT LOG (ONLY ONCE, CLEAN)
      // ----------------------------------------------------
      await storage.createAuditLog({
        userId: req.user!.id,
        action: "UPDATED",
        entityType: "user",
        entityId: userId,
        details: `User status changed for ${user.username}`,
        oldValues: JSON.stringify({ isActive: user.isActive }),
        newValues: JSON.stringify({ isActive }),
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      return res.json(updatedUser);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });


  // Low Stock Report API
  // app.get("/api/reports/low-stock", async (req, res) => {
  //   try {
  //     if (!req.user) {
  //       return res.status(401).json({ message: "Not authenticated" });
  //     }

  //     const { 
  //       asOfDate = new Date().toISOString().split('T')[0],
  //       warehouseId,
  //       itemId, 
  //       status,
  //       categoryId
  //     } = req.query;

  //     // Get all necessary data
  //     const allItems = await storage.getAllItems();
  //     const allInventory = await storage.getAllInventory();
  //     const allWarehouses = await storage.getAllWarehouses();
  //     const allCategories = await storage.getAllCategories();
  //     const allTransactions = await storage.getAllTransactions();

  //     // Create maps for quick lookups
  //     const itemMap = new Map();
  //     allItems.forEach(item => itemMap.set(item.id, item));

  //     const warehouseMap = new Map();
  //     allWarehouses.forEach(warehouse => warehouseMap.set(warehouse.id, warehouse));

  //     const categoryMap = new Map();
  //     allCategories.forEach(category => categoryMap.set(category.id, category));

  //     // Filter inventory based on criteria
  //     let filteredInventory = allInventory.filter(inv => {
  //       const item = itemMap.get(inv.itemId);
  //       if (!item) return false;

  //       // Check if stock is below minimum level
  //       const isLowStock = inv.quantity < item.minStockLevel;
  //       if (!isLowStock) return false;

  //       // Apply filters
  //       if (warehouseId && inv.warehouseId !== parseInt(warehouseId as string)) return false;
  //       if (itemId && inv.itemId !== parseInt(itemId as string)) return false;
  //       if (categoryId && item.categoryId !== parseInt(categoryId as string)) return false;

  //       return true;
  //     });

  //     // Build low stock report data
  //     const lowStockData = filteredInventory.map(inv => {
  //       const item = itemMap.get(inv.itemId);
  //       const warehouse = warehouseMap.get(inv.warehouseId);
  //       const category = item.categoryId ? categoryMap.get(item.categoryId) : null;

  //       const stockDifference = inv.quantity - item.minStockLevel;
  //       const stockPercentage = Math.round((inv.quantity / item.minStockLevel) * 100);

  //       // Determine status based on stock level
  //       let itemStatus: 'critical' | 'low' | 'warning';
  //       if (inv.quantity <= 0) {
  //         itemStatus = 'critical';
  //       } else if (stockPercentage <= 25) {
  //         itemStatus = 'critical';
  //       } else if (stockPercentage <= 50) {
  //         itemStatus = 'low';
  //       } else {
  //         itemStatus = 'warning';
  //       }

  //       // Find last restock date from transactions
  //       const itemTransactions = allTransactions
  //         .filter(t => 
  //           t.itemId === inv.itemId && 
  //           t.destinationWarehouseId === inv.warehouseId &&
  //           (t.transactionType === 'check-in' || t.transactionType === 'adjustment' )
  //         )
  //         .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  //       const lastRestockDate = itemTransactions.length > 0 ? itemTransactions[0].createdAt : null;

  //       return {
  //         id: inv.id,
  //         itemId: inv.itemId,
  //         itemName: item.name,
  //         itemSku: item.sku,
  //         warehouseId: inv.warehouseId,
  //         warehouseName: warehouse?.name || 'Unknown',
  //         currentQuantity: inv.quantity,
  //         minStockLevel: item.minStockLevel,
  //         unit: item.unit,
  //         categoryName: category?.name,
  //         stockDifference,
  //         stockPercentage,
  //         lastRestockDate,
  //         status: itemStatus
  //       };
  //     });

  //     // Apply status filter if specified
  //     const finalData = status 
  //       ? lowStockData.filter(item => item.status === status)
  //       : lowStockData;

  //     // Sort by most critical first (lowest stock percentage)
  //     finalData.sort((a, b) => a.stockPercentage - b.stockPercentage);

  //     res.json(finalData);
  //   } catch (error: any) {
  //     console.error('Low stock report error:', error);
  //     res.status(500).json({ message: error.message });
  //   }
  // });
  app.get("/api/reports/low-stock", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { 
        asOfDate = new Date().toISOString().split("T")[0],
        warehouseId,
        itemId,
        status,
        categoryId
      } = req.query;
      
      const targetDate = new Date(asOfDate + "T23:59:59");

      // Get required data
      const allItems = await storage.getAllItems();
      const allWarehouses = await storage.getAllWarehouses();
      const allCategories = await storage.getAllCategories();
      const allTransactions = await storage.getAllTransactions();

      const itemMap = new Map(allItems.map(i => [i.id, i]));
      const warehouseMap = new Map(allWarehouses.map(w => [w.id, w]));
      const categoryMap = new Map(allCategories.map(c => [c.id, c]));

      // -----------------------------
      // 1️⃣ BUILD INVENTORY AS OF DATE
      // -----------------------------

      const inventorySnapshot = new Map();

      // Helper function
      function addQty(itemId, warehouseId, delta) {
        const key = `${itemId}-${warehouseId}`;
        const current = inventorySnapshot.get(key) || 0;
        inventorySnapshot.set(key, current + delta);
      }

      const relevantTx = allTransactions.filter(
        tx => new Date(tx.createdAt) <= targetDate
      );

      for (const tx of relevantTx) {
        const src = tx.sourceWarehouseId;
        const dest = tx.destinationWarehouseId;
        const qty = tx.quantity;

        // ------------------------
        // CHECK-IN
        // ------------------------
        if (tx.transactionType === "check-in") {
          addQty(tx.itemId, dest, qty);
        }

        // ------------------------
        // CHECK-OUT
        // ------------------------
        else if (tx.transactionType === "check-out") {
          addQty(tx.itemId, src, -qty);
        }

        // ------------------------
        // ADJUSTMENT
        // ------------------------
        else if (tx.transactionType === "adjustment") {
          addQty(tx.itemId, tx.warehouseId, tx.adjustmentValue);
        }

        // ------------------------
        // TRANSFER — FULL STATUS LOGIC
        // ------------------------
        else if (tx.transactionType === "transfer") {

          let effectiveDate = null;

          if (tx.status === "approved" || tx.status === "in-transit") {
            effectiveDate = tx.createdAt;
          } 
          else if (
            tx.status === "completed" ||
            tx.status === "restocked" ||
            tx.status === "disposed"
          ) {
            effectiveDate = tx.completedAt;
          } 
          else if (tx.status === "rejected") {
            effectiveDate = tx.createdAt;
          }

          if (!effectiveDate) continue;
          if (new Date(effectiveDate) > targetDate) continue;

          // ------------ STATUS LOGIC ------------
          if (tx.status === "approved" || tx.status === "in-transit") {
            // Items left source but not received yet
            addQty(tx.itemId, src, -qty);
          }

          else if (tx.status === "completed") {
            // Both warehouses affected
            addQty(tx.itemId, src, -qty);
            addQty(tx.itemId, dest, qty);
          }

          else if (tx.status === "rejected") {
            // Items left source when approved
            // Destination rejects — stock still out
            addQty(tx.itemId, src, -qty);
          }

          else if (tx.status === "restocked") {
            // Items returned to source warehouse
            addQty(tx.itemId, src, qty);
          }

          else if (tx.status === "disposed") {
            // Items destroyed after rejection
            addQty(tx.itemId, src, -qty);
          }
        }
      }

      // Convert snapshot map → list
      const inventoryList = [...inventorySnapshot.entries()].map(([key, qty]) => {
        const [itemIdStr, warehouseIdStr] = key.split("-");
        return {
          itemId: parseInt(itemIdStr),
          warehouseId: parseInt(warehouseIdStr),
          quantity: qty
        };
      });

      // -----------------------------------
      // 2️⃣ FILTER INVENTORY FOR LOW-STOCK
      // -----------------------------------
      let filteredInventory = inventoryList.filter(inv => {
        const item = itemMap.get(inv.itemId);
        if (!item) return false;

        const isLowStock = inv.quantity < item.minStockLevel;
        if (!isLowStock) return false;

        if (warehouseId && inv.warehouseId !== parseInt(warehouseId)) return false;
        if (itemId && inv.itemId !== parseInt(itemId)) return false;
        if (categoryId && item.categoryId !== parseInt(categoryId)) return false;

        return true;
      });

      // -----------------------------------
      // 3️⃣ BUILD RESPONSE OBJECT
      // -----------------------------------
      const lowStockData = filteredInventory.map(inv => {
        const item = itemMap.get(inv.itemId);
        const warehouse = warehouseMap.get(inv.warehouseId);
        const category = categoryMap.get(item.categoryId);

        const stockPercentage = Math.round((inv.quantity / item.minStockLevel) * 100);

        let itemStatus = "warning";
        if (inv.quantity <= 0 || stockPercentage <= 25) itemStatus = "critical";
        else if (stockPercentage <= 50) itemStatus = "low";

        const lastRestock = allTransactions
          .filter(t => 
            t.itemId === inv.itemId &&
            t.destinationWarehouseId === inv.warehouseId &&
            (t.transactionType === "check-in" || t.transactionType === "adjustment") &&
            new Date(t.createdAt) <= targetDate
          )
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        return {
          itemId: inv.itemId,
          itemName: item.name,
          warehouseId: inv.warehouseId,
          warehouseName: warehouse?.name,
          currentQuantity: inv.quantity,
          minStockLevel: item.minStockLevel,
          categoryName: category?.name,
          stockPercentage,
          lastRestockDate: lastRestock[0]?.createdAt || null,
          status: itemStatus
        };
      });

      const finalData = status 
        ? lowStockData.filter(i => i.status === status)
        : lowStockData;

      finalData.sort((a, b) => a.stockPercentage - b.stockPercentage);

      res.json(finalData);

    } catch (error) {
      console.error("Low stock report error:", error);
      res.status(500).json({ message: error.message });
    }
  });



  // Analytics API endpoints
  
  // Fastest Moving Items Analytics
  app.get("/api/analytics/fastest-moving", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { startDate, endDate, departmentId, warehouseId } = req.query;
      
      // Get transactions within date range
      const allTransactions = await storage.getAllTransactions();
      const filteredTransactions = allTransactions.filter(txn => {
        const txnDate = new Date(txn.createdAt || '');
        const start = new Date(startDate as string);
        const end = new Date(endDate as string);
        
        let matchesDate = txnDate >= start && txnDate <= end;
        let matchesDept = !departmentId || departmentId === 'all';
        let matchesWarehouse = !warehouseId || warehouseId === 'all' || 
          txn.sourceWarehouseId === parseInt(warehouseId as string) || 
          txn.destinationWarehouseId === parseInt(warehouseId as string);
        
        return matchesDate && matchesDept && matchesWarehouse;
      });

      // Group by item and calculate movement frequency
      const itemMovements = new Map();
      const allItems = await storage.getAllItems();
      
      filteredTransactions.forEach(txn => {
        const item = allItems.find(i => i.id === txn.itemId);
        if (!item) return;
        
        if (!itemMovements.has(txn.itemId)) {
          itemMovements.set(txn.itemId, {
            itemId: txn.itemId,
            name: item.name,
            sku: item.sku,
            movementCount: 0,
            totalQuantity: 0
          });
        }
        
        const movement = itemMovements.get(txn.itemId);
        movement.movementCount++;
        movement.totalQuantity += txn.quantity;
      });

      // Calculate turnover rates and sort
      const fastestMoving = Array.from(itemMovements.values()).map(item => ({
        ...item,
        turnoverRate: Math.round((item.movementCount / (filteredTransactions.length || 1)) * 100)
      })).sort((a, b) => b.movementCount - a.movementCount);

      res.json(fastestMoving);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Most Ordered Items Analytics
  // app.get("/api/analytics/most-ordered", async (req, res) => {
  //   try {
  //     if (!req.user) {
  //       return res.status(401).json({ message: "Not authenticated" });
  //     }

  //     const { startDate, endDate, departmentId, warehouseId } = req.query;
      
  //     const allRequests = await storage.getAllRequests();
  //     const allRequestItems = [];
      
  //     for (const request of allRequests) {
  //       const items = await storage.getRequestItemsByRequest(request.id);
  //       items.forEach(item => allRequestItems.push({ ...item, request }));
  //     }

  //     // Filter by date range and other criteria
  //     const filteredItems = allRequestItems.filter(item => {
  //       const reqDate = new Date(item.request.createdAt || '');
  //       const start = new Date(startDate as string);
  //       const end = new Date(endDate as string);
        
  //       let matchesDate = reqDate >= start && reqDate <= end;
  //       let matchesDept = !departmentId || departmentId === 'all' || item.request.userId;
  //       let matchesWarehouse = !warehouseId || warehouseId === 'all';
  //       // Only include completed/approved requests for accurate analytics
  //       let isApproved = item.request.status === 'completed' ;
        
  //       return matchesDate && matchesDept && matchesWarehouse && isApproved;
  //     });

  //     // Group by item
  //     const itemOrders = new Map();
  //     const allItems = await storage.getAllItems();
      
  //     filteredItems.forEach(reqItem => {
  //       const item = allItems.find(i => i.id === reqItem.itemId);
  //       if (!item) return;
        
  //       if (!itemOrders.has(reqItem.itemId)) {
  //         itemOrders.set(reqItem.itemId, {
  //           itemId: reqItem.itemId,
  //           name: item.name,
  //           sku: item.sku,
  //           orderCount: 0,
  //           totalQuantity: 0
  //         });
  //       }
        
  //       const order = itemOrders.get(reqItem.itemId);
  //       order.orderCount++;
  //       order.totalQuantity += reqItem.quantity;
  //     });

  //     const mostOrdered = Array.from(itemOrders.values())
  //       .sort((a, b) => b.orderCount - a.orderCount);

  //     res.json(mostOrdered);
  //   } catch (error: any) {
  //     res.status(500).json({ message: error.message });
  //   }
  // });
  // Most Ordered Items Analytics (CORRECT VERSION)
  app.get("/api/analytics/most-ordered", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { startDate, endDate } = req.query;

      const allTransactions = await storage.getAllTransactions();

      const filtered = allTransactions.filter(t => {
        if (t.transactionType !== "issue") return false;
        const date = new Date(t.createdAt);
        return date >= new Date(startDate) && date <= new Date(endDate);
      });

      const itemMap = new Map();

      const allItems = await storage.getAllItems();
      const itemsById = new Map(allItems.map(i => [i.id, i]));

      for (const trx of filtered) {
        if (!itemMap.has(trx.itemId)) {
          const item = itemsById.get(trx.itemId);
          itemMap.set(trx.itemId, {
            itemId: trx.itemId,
            name: item.name,
            sku: item.sku,
            totalQuantity: 0,
            orderCount: 0,
          });
        }

        const entry = itemMap.get(trx.itemId);
        entry.totalQuantity += trx.quantity;
        entry.orderCount += 1; // or unique request ID
      }

      const result = Array.from(itemMap.values()).sort(
        (a, b) => b.totalQuantity - a.totalQuantity
      );

      res.json(result);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });



  // Department Consumption Analytics
  app.get("/api/analytics/department-consumption", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { startDate, endDate, warehouseId } = req.query;
      
      const allRequests = await storage.getAllRequests();
      const allUsers = await storage.getAllUsers();
      const allDepartments = await storage.getAllDepartments();
      
      // Filter requests by date and status
      const filteredRequests = allRequests.filter(req => {
        const reqDate = new Date(req.createdAt || '');
        const start = new Date(startDate as string);
        const end = new Date(endDate as string);
        const isApproved = req.status === 'completed' || req.status === 'approved';
        return reqDate >= start && reqDate <= end && isApproved;
      });

      // Group by department
      const deptConsumption = new Map();
      
      for (const request of filteredRequests) {
        const user = allUsers.find(u => u.id === request.userId);
        const dept = user ? allDepartments.find(d => d.id === user.departmentId) : null;
        
        if (!dept) continue;
        
        if (!deptConsumption.has(dept.id)) {
          deptConsumption.set(dept.id, {
            id: dept.id,
            name: dept.name,
            requestCount: 0,
            totalValue: 0,
            avgValue: 0
          });
        }
        
        const consumption = deptConsumption.get(dept.id);
        consumption.requestCount++;
        
        // Calculate request value (simplified)
        const requestItems = await storage.getRequestItemsByRequest(request.id);
        const requestValue = requestItems.reduce((sum, item) => sum + (item.quantity * 10), 0); // Using estimated value
        consumption.totalValue += requestValue;
      }

      // Calculate averages
      const departmentData = Array.from(deptConsumption.values()).map(dept => ({
        ...dept,
        avgValue: dept.requestCount > 0 ? dept.totalValue / dept.requestCount : 0
      })).sort((a, b) => b.totalValue - a.totalValue);

      res.json(departmentData);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // User Request Analysis
  app.get("/api/analytics/user-requests", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { startDate, endDate, departmentId, warehouseId } = req.query;
      
      const allRequests = await storage.getAllRequests();
      const allUsers = await storage.getAllUsers();
      const allDepartments = await storage.getAllDepartments();
      
      // Filter by date range
      const filteredRequests = allRequests.filter(req => {
        const reqDate = new Date(req.createdAt || '');
        const start = new Date(startDate as string);
        const end = new Date(endDate as string);
        return reqDate >= start && reqDate <= end;
      });

      // Group by user
      const userAnalysis = new Map();
      
      filteredRequests.forEach(request => {
        const user = allUsers.find(u => u.id === request.userId);
        if (!user) return;
        
        const dept = allDepartments.find(d => d.id === user.departmentId);
        
        if (!userAnalysis.has(user.id)) {
          userAnalysis.set(user.id, {
            userId: user.id,
            userName: user.name,
            departmentName: dept?.name || 'Unknown',
            requestCount: 0,
            approvedCount: 0,
            rejectedCount: 0,
            pendingCount: 0,
            approvalRate: 0
          });
        }
        
        const analysis = userAnalysis.get(user.id);
        analysis.requestCount++;
        
        switch (request.status) {
          case 'approved':
          case 'completed':
            analysis.approvedCount++;
            break;
          case 'rejected':
            analysis.rejectedCount++;
            break;
          default:
            analysis.pendingCount++;
        }
      });

      // Calculate approval rates
      const userRequestData = Array.from(userAnalysis.values()).map(user => ({
        ...user,
        approvalRate: user.requestCount > 0 ? Math.round((user.approvedCount / user.requestCount) * 100) : 0
      })).sort((a, b) => b.requestCount - a.requestCount);

      res.json(userRequestData);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Price Variation Analysis
  app.get("/api/analytics/price-variation", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { startDate, endDate, warehouseId } = req.query;
      
      // Validate required parameters
      if (!startDate || !endDate) {
        return res.status(400).json({ message: "startDate and endDate are required" });
      }
      
      // Validate date format
      const startDateObj = new Date(startDate as string);
      const endDateObj = new Date(endDate as string);
      
      if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
        return res.status(400).json({ message: "Invalid date format" });
      }
      
      const allTransactions = await storage.getAllTransactions();
      const allItems = await storage.getAllItems();
      
      console.log(`Price variation analysis: ${allItems.length} items, ${allTransactions.length} transactions`);
      
      // Calculate item unit values using the same logic as inventory valuation
      const startValuationResult = await calculateItemUnitValues(startDateObj);
      const endValuationResult = await calculateItemUnitValues(endDateObj);
      
      console.log(`Start valuation items: ${startValuationResult.itemUnitValues.size}, End valuation items: ${endValuationResult.itemUnitValues.size}`);
      
      // Extract the itemUnitValues Map from the results
      const startValues = Array.from(startValuationResult.itemUnitValues.entries()).map(([itemId, data]) => ({
        itemId,
        unitValue: data.unitValue,
        name: data.name,
        sku: data.sku
      }));
      
      const endValues = Array.from(endValuationResult.itemUnitValues.entries()).map(([itemId, data]) => ({
        itemId,
        unitValue: data.unitValue,
        name: data.name,
        sku: data.sku
      }));
      
      // Build price variation analysis
      const priceAnalysis = new Map();
      
      // Use transaction rate data for authentic price analysis
      const itemsWithTransactions = new Set(allTransactions.map(t => t.itemId));
      const relevantItems = allItems.filter(item => itemsWithTransactions.has(item.id));
      
      relevantItems.forEach(item => {
        const itemTransactions = allTransactions
          .filter(t => t.itemId === item.id && t.rate && Number(t.rate) > 0)
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        
        if (itemTransactions.length >= 2) {
          // Calculate price trend from earliest to latest transactions
          const startPeriodTransactions = itemTransactions.filter(t => 
            new Date(t.createdAt) <= startDateObj
          );
          const endPeriodTransactions = itemTransactions.filter(t => 
            new Date(t.createdAt) <= endDateObj && new Date(t.createdAt) > startDateObj
          );
          
          let startPrice = 0;
          let endPrice = 0;
          
          if (startPeriodTransactions.length > 0) {
            startPrice = Number(startPeriodTransactions[startPeriodTransactions.length - 1].rate);
          } else {
            startPrice = Number(itemTransactions[0].rate);
          }
          
          if (endPeriodTransactions.length > 0) {
            endPrice = Number(endPeriodTransactions[endPeriodTransactions.length - 1].rate);
          } else {
            endPrice = Number(itemTransactions[itemTransactions.length - 1].rate);
          }
          
          const rates = itemTransactions.map(t => Number(t.rate)).filter(rate => !isNaN(rate));
          const minPrice = Math.min(...rates);
          const maxPrice = Math.max(...rates);
          const avgPrice = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
          const priceChange = endPrice - startPrice;
          const variationPercent = startPrice > 0 ? 
            Math.round(((maxPrice - minPrice) / minPrice) * 100) : 0;
          
          priceAnalysis.set(item.id, {
            itemId: item.id,
            itemName: item.name,
            sku: item.sku,
            startPrice: Math.round(startPrice * 100) / 100,
            endPrice: Math.round(endPrice * 100) / 100,
            avgPrice: Math.round(avgPrice * 100) / 100,
            minPrice: Math.round(minPrice * 100) / 100,
            maxPrice: Math.round(maxPrice * 100) / 100,
            variationPercent: variationPercent,
            priceChange: Math.round(priceChange * 100) / 100
          });
        }
      });
      
      // If still no data from transactions, try valuation method
      if (priceAnalysis.size === 0) {
        // Process start values
        startValues.forEach(item => {
          priceAnalysis.set(item.itemId, {
            itemId: item.itemId,
            itemName: item.name,
            sku: item.sku,
            startPrice: item.unitValue,
            endPrice: item.unitValue, // Default to same price
            avgPrice: item.unitValue,
            minPrice: item.unitValue,
            maxPrice: item.unitValue,
            variationPercent: 0,
            priceChange: 0
          });
        });
        
        // Process end values
        endValues.forEach(item => {
          if (priceAnalysis.has(item.itemId)) {
            const analysis = priceAnalysis.get(item.itemId);
            analysis.endPrice = item.unitValue;
            analysis.maxPrice = Math.max(analysis.startPrice, item.unitValue);
            analysis.minPrice = Math.min(analysis.startPrice, item.unitValue);
            analysis.avgPrice = (analysis.startPrice + item.unitValue) / 2;
            analysis.priceChange = item.unitValue - analysis.startPrice;
            analysis.variationPercent = analysis.startPrice > 0 ? 
              Math.round(((analysis.maxPrice - analysis.minPrice) / analysis.minPrice) * 100) : 0;
          } else {
            // Item only exists in end period
            priceAnalysis.set(item.itemId, {
              itemId: item.itemId,
              itemName: item.name,
              sku: item.sku,
              startPrice: 0,
              endPrice: item.unitValue,
              avgPrice: item.unitValue,
              minPrice: 0,
              maxPrice: item.unitValue,
              variationPercent: 100,
              priceChange: item.unitValue
            });
          }
        });
      }

      // Return all price analysis data (remove restrictive filtering)
      const priceVariationData = Array.from(priceAnalysis.values())
        .sort((a, b) => Math.abs(b.priceChange) - Math.abs(a.priceChange));

      console.log(`Returning ${priceVariationData.length} price variation records`);
      res.json(priceVariationData);
    } catch (error: any) {
      console.error("Price variation analysis error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
