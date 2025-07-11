import { Request, Response, NextFunction } from 'express';
import { licenseManager } from './license-manager.js';

// License validation middleware
export async function requireValidLicense(req: Request, res: Response, next: NextFunction) {
  try {
    // Only apply license check to API endpoints
    if (!req.path.startsWith('/api/')) {
      return next();
    }

    // Skip license check for license-related endpoints
    if (req.path.startsWith('/api/license')) {
      return next();
    }

    // Skip license check for auth endpoints - these must work for login flow
    if (req.path.startsWith('/api/login') || 
        req.path.startsWith('/api/logout') || 
        req.path.startsWith('/api/user') ||
        req.path.startsWith('/api/check-admin-exists') ||
        req.path.startsWith('/api/create-superadmin') ||
        req.path.startsWith('/api/forgot-password') ||
        req.path.startsWith('/api/reset-password')) {
      return next();
    }

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
      // If no client ID is configured, let the frontend handle license acquisition
      return res.status(403).json({ 
        error: 'LICENSE_REQUIRED',
        message: 'No license configured. Please acquire a license to continue.',
        requiresLicense: true
      });
    }

    // Get base URL from request
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    // Validate license
    const validation = await licenseManager.validateLicense(clientId, baseUrl);
    
    if (!validation.valid) {
      return res.status(403).json({ 
        error: 'INVALID_LICENSE',
        message: validation.message 
      });
    }

    // Check if license has expired
    const currentLicense = await licenseManager.getCurrentLicense(clientId);
    if (!currentLicense || new Date() > new Date(currentLicense.validTill)) {
      return res.status(403).json({ 
        error: 'LICENSE_EXPIRED',
        message: 'License has expired. Please renew your license.' 
      });
    }

    // Add license info to request for use in routes
    req.license = currentLicense;
    
    next();
  } catch (error: any) {
    console.error('License middleware error:', error);
    res.status(500).json({ 
      error: 'LICENSE_CHECK_FAILED',
      message: 'Failed to validate license' 
    });
  }
}

// Middleware to check user limits
export async function checkUserLimit(req: Request, res: Response, next: NextFunction) {
  try {
    const clientId = process.env.CLIENT_ID || req.headers['x-client-id'] as string;
    if (!clientId) {
      return next(); // Skip if no client ID
    }

    // Only check on user creation/update endpoints
    if (req.method === 'POST' && req.path === '/api/users') {
      const limits = await licenseManager.checkLimits(clientId, 'Users');
      
      if (!limits.allowed) {
        return res.status(403).json({
          error: 'FEATURE_NOT_LICENSED',
          message: 'User management not included in your license'
        });
      }

      // Get current user count
      const { storage } = await import('./storage.js');
      const users = await storage.getAllUsers();
      const activeUsers = users.filter(u => u.isActive).length;

      if (activeUsers >= limits.limit) {
        return res.status(403).json({
          error: 'USER_LIMIT_EXCEEDED',
          message: `License allows maximum ${limits.limit} users. Currently have ${activeUsers} active users.`
        });
      }
    }

    next();
  } catch (error: any) {
    console.error('User limit check error:', error);
    next(); // Continue on error to avoid blocking
  }
}

// Middleware to check product limits
export async function checkProductLimit(req: Request, res: Response, next: NextFunction) {
  try {
    const clientId = process.env.CLIENT_ID || req.headers['x-client-id'] as string;
    if (!clientId) {
      return next(); // Skip if no client ID
    }

    // Only check on item creation endpoints
    if (req.method === 'POST' && req.path === '/api/items') {
      const limits = await licenseManager.checkLimits(clientId, 'Products');
      
      // If Products limit is not specified in license, allow unlimited
      if (!limits.allowed) {
        return next(); // Allow unlimited products if not specified
      }

      // Get current item count
      const { storage } = await import('./storage.js');
      const items = await storage.getAllItems();
      const activeItems = items.filter(item => item.status === 'active').length;

      if (activeItems >= limits.limit) {
        return res.status(403).json({
          error: 'PRODUCT_LIMIT_EXCEEDED',
          message: `License allows maximum ${limits.limit} products. Currently have ${activeItems} active products.`
        });
      }
    }

    next();
  } catch (error: any) {
    console.error('Product limit check error:', error);
    next(); // Continue on error to avoid blocking
  }
}

// Declare license property on Express Request type
declare global {
  namespace Express {
    interface Request {
      license?: any;
    }
  }
}