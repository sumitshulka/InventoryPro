# License Management System Implementation Guide

This document provides complete implementation details for integrating a comprehensive license management system with external license manager validation, user/product limits enforcement, and secure checksum verification.

## Overview

The license management system provides:
- External license acquisition and validation
- HMAC-SHA256 checksum verification with mutual keys
- User and product limit enforcement with real-time UI display
- Request deduplication and caching to prevent server overload
- Role-based access control integration
- Comprehensive error handling and logging

## Architecture Components

### 1. Database Schema (Drizzle ORM)

```typescript
// shared/schema.ts
import { pgTable, text, timestamp, boolean, integer, serial } from 'drizzle-orm/pg-core';

export const licenses = pgTable('licenses', {
  id: serial('id').primaryKey(),
  applicationId: text('application_id').notNull(),
  clientId: text('client_id').notNull(),
  licenseKey: text('license_key').notNull(),
  subscriptionType: text('subscription_type').notNull(),
  validTill: timestamp('valid_till').notNull(),
  mutualKey: text('mutual_key').notNull(), // Encrypted
  checksum: text('checksum').notNull(),
  subscriptionData: text('subscription_data').notNull(), // Encrypted JSON
  baseUrl: text('base_url'),
  isActive: boolean('is_active').default(true),
  lastValidated: timestamp('last_validated'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

export type License = typeof licenses.$inferSelect;
export type InsertLicense = typeof licenses.$inferInsert;
```

### 2. Core License Manager Class

```typescript
// server/license-manager.ts
import crypto from 'crypto';
import { db } from './db.js';
import { licenses, type License, type InsertLicense } from '../shared/schema.js';
import { eq, and, desc } from 'drizzle-orm';

export const APP_ID = 'your-application-id-here'; // Replace with your app ID
const ENCRYPTION_KEY = process.env.LICENSE_ENCRYPTION_KEY || 'your-encryption-key-2024';

// API Interfaces
export interface LicenseAcquisitionRequest {
  client_id: string;
  app_id: string;
  base_url: string;
}

export interface LicenseAcquisitionResponse {
  license_key: string;
  subscription_type: string;
  valid_till: string; // ISO 8601 format
  checksum: string;
  mutual_key?: string; // Required for proper validation
  subscription_data: {
    type: string;
    properties: {
      Users: {
        type: string;
        minimum: number;
        maximum: number;
      };
      Products?: {
        type: string;
        minimum: number;
        maximum: number;
      };
    };
    required: string[];
  };
  message: string;
}

export interface LicenseValidationRequest {
  client_id: string;
  app_id: string;
  license_key: string;
  checksum: string;
  domain: string;
}

export interface LicenseValidationResponse {
  valid?: boolean;
  status?: string; // "Valid" or "Invalid"
  message: string;
  validated_at?: string;
  expires_at?: string;
  subscription_data?: any;
}

// Encryption/Decryption functions
function encrypt(text: string): string {
  const cipher = crypto.createCipher('aes-256-cbc', ENCRYPTION_KEY);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

function decrypt(encryptedText: string): string {
  const decipher = crypto.createDecipher('aes-256-cbc', ENCRYPTION_KEY);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Checksum calculation - CRITICAL: Use exact order
export function generateChecksum(
  mutualKey: string,
  clientId: string,
  appId: string,
  licenseKey: string,
  endDateISOString: string
): string {
  const checksumData = clientId + appId + licenseKey + endDateISOString;
  const checksum = crypto.createHmac('sha256', mutualKey).update(checksumData).digest('hex');
  return checksum;
}

export class LicenseManager {
  private licenseManagerUrl: string | null = null;
  private validationCache: Map<string, { result: any; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 30 * 1000; // 30 seconds cache
  private pendingValidations: Map<string, Promise<any>> = new Map();

  constructor(licenseManagerUrl?: string) {
    this.licenseManagerUrl = licenseManagerUrl || process.env.LICENSE_MANAGER_URL || null;
  }

  setLicenseManagerUrl(url: string) {
    this.licenseManagerUrl = url;
  }

  // License Acquisition
  async acquireLicense(
    clientId: string,
    productId: string,
    baseUrl: string
  ): Promise<{ success: boolean; message: string; license?: License }> {
    if (!this.licenseManagerUrl) {
      throw new Error('License manager URL not configured');
    }

    try {
      const requestPayload: LicenseAcquisitionRequest = {
        client_id: clientId,
        app_id: productId,
        base_url: baseUrl
      };

      const licenseManagerBaseUrl = this.licenseManagerUrl.endsWith('/') ? 
        this.licenseManagerUrl.slice(0, -1) : this.licenseManagerUrl;
      const fullUrl = `${licenseManagerBaseUrl}/api/acquire-license`;
      
      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload)
      });

      if (!response.ok) {
        throw new Error(`License manager responded with status: ${response.status}`);
      }

      const licenseResponse: LicenseAcquisitionResponse = await response.json();

      // Validate required fields
      if (!licenseResponse.license_key || !licenseResponse.subscription_type || 
          !licenseResponse.valid_till || !licenseResponse.checksum || 
          !licenseResponse.subscription_data) {
        throw new Error(`Missing required fields in response: ${JSON.stringify(licenseResponse)}`);
      }

      // CRITICAL: Extract mutual_key from response
      if (!licenseResponse.mutual_key) {
        throw new Error(`Missing mutual_key in response. License manager must provide mutual_key for checksum validation.`);
      }

      // Store license with encryption
      const encryptedMutualKey = encrypt(licenseResponse.mutual_key);
      const encryptedSubscriptionData = encrypt(JSON.stringify(licenseResponse.subscription_data));

      const licenseData: InsertLicense = {
        applicationId: APP_ID,
        clientId: clientId,
        licenseKey: licenseResponse.license_key,
        subscriptionType: licenseResponse.subscription_type,
        validTill: new Date(licenseResponse.valid_till),
        mutualKey: encryptedMutualKey,
        checksum: licenseResponse.checksum,
        subscriptionData: encryptedSubscriptionData,
        baseUrl: baseUrl,
        isActive: true,
        lastValidated: new Date()
      };

      // Remove existing licenses for this app and client
      await db.delete(licenses).where(
        and(
          eq(licenses.applicationId, APP_ID),
          eq(licenses.clientId, clientId)
        )
      );

      // Insert new license
      const [newLicense] = await db.insert(licenses).values(licenseData).returning();

      return {
        success: true,
        message: 'License acquired successfully',
        license: newLicense
      };
    } catch (error: any) {
      console.error('License acquisition error:', error);
      return {
        success: false,
        message: error.message || 'Failed to acquire license'
      };
    }
  }

  // License Validation with Caching and Deduplication
  async validateLicense(
    clientId: string,
    domain: string
  ): Promise<{ valid: boolean; message: string; license?: License }> {
    try {
      const cacheKey = `${clientId}:${domain}`;
      
      // Check cache first
      const cachedResult = this.validationCache.get(cacheKey);
      if (cachedResult && (Date.now() - cachedResult.timestamp) < this.CACHE_DURATION) {
        return cachedResult.result;
      }

      // Check for pending validation
      const pendingValidation = this.pendingValidations.get(cacheKey);
      if (pendingValidation) {
        return await pendingValidation;
      }

      // Start new validation
      const validationPromise = this.performLicenseValidation(clientId, domain, cacheKey);
      this.pendingValidations.set(cacheKey, validationPromise);

      try {
        const result = await validationPromise;
        return result;
      } finally {
        this.pendingValidations.delete(cacheKey);
      }
    } catch (error: any) {
      console.error('License validation error:', error);
      return {
        valid: false,
        message: error.message || 'License validation failed'
      };
    }
  }

  private async performLicenseValidation(
    clientId: string, 
    domain: string, 
    cacheKey: string
  ): Promise<{ valid: boolean; message: string; license?: License }> {
    try {
      // Get license from database
      const [currentLicense] = await db
        .select()
        .from(licenses)
        .where(
          and(
            eq(licenses.applicationId, APP_ID),
            eq(licenses.clientId, clientId),
            eq(licenses.isActive, true)
          )
        )
        .orderBy(desc(licenses.createdAt))
        .limit(1);

      if (!currentLicense) {
        return { valid: false, message: 'No active license found' };
      }

      // Check expiry
      if (new Date() > new Date(currentLicense.validTill)) {
        return { valid: false, message: 'License has expired' };
      }

      // Decrypt mutual key and calculate checksum
      const mutualKey = decrypt(currentLicense.mutualKey);
      const calculatedChecksum = generateChecksum(
        mutualKey,
        clientId,
        APP_ID,
        currentLicense.licenseKey,
        currentLicense.validTill.toISOString()
      );

      // External validation if URL configured
      if (this.licenseManagerUrl) {
        const validationRequest: LicenseValidationRequest = {
          client_id: clientId,
          app_id: APP_ID,
          license_key: currentLicense.licenseKey,
          checksum: calculatedChecksum,
          domain: currentLicense.baseUrl || domain
        };

        const licenseManagerBaseUrl = this.licenseManagerUrl.endsWith('/') ? 
          this.licenseManagerUrl.slice(0, -1) : this.licenseManagerUrl;
        const validationUrl = `${licenseManagerBaseUrl}/api/validate-license`;

        const response = await fetch(validationUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(validationRequest)
        });

        if (!response.ok) {
          throw new Error(`Validation failed with status: ${response.status}`);
        }

        const validationResponse: any = await response.json();
        
        // Handle different response formats
        const isValid = validationResponse.valid === true || 
                        validationResponse.status === 'Valid' ||
                        validationResponse.status === 'valid';

        if (isValid) {
          await db
            .update(licenses)
            .set({ lastValidated: new Date() })
            .where(eq(licenses.id, currentLicense.id));

          const result = {
            valid: true,
            message: validationResponse.message || 'License is valid',
            license: currentLicense
          };

          // Cache successful result
          this.validationCache.set(cacheKey, {
            result,
            timestamp: Date.now()
          });

          return result;
        } else {
          const result = {
            valid: false,
            message: validationResponse.message || 'License validation failed'
          };

          // Cache failed result for shorter time
          this.validationCache.set(cacheKey, {
            result,
            timestamp: Date.now() - (this.CACHE_DURATION - 5000)
          });

          return result;
        }
      } else {
        // Local validation only
        await db
          .update(licenses)
          .set({ lastValidated: new Date() })
          .where(eq(licenses.id, currentLicense.id));

        const result = {
          valid: true,
          message: 'License is valid (local validation)',
          license: currentLicense
        };

        this.validationCache.set(cacheKey, {
          result,
          timestamp: Date.now()
        });

        return result;
      }
    } catch (error: any) {
      console.error('License validation error:', error);
      return {
        valid: false,
        message: error.message || 'License validation failed'
      };
    }
  }

  // Get current license
  async getCurrentLicense(clientId: string): Promise<License | null> {
    try {
      const whereClause = clientId 
        ? and(
            eq(licenses.applicationId, APP_ID),
            eq(licenses.clientId, clientId),
            eq(licenses.isActive, true)
          )
        : and(
            eq(licenses.applicationId, APP_ID),
            eq(licenses.isActive, true)
          );

      const [license] = await db
        .select()
        .from(licenses)
        .where(whereClause)
        .orderBy(desc(licenses.createdAt))
        .limit(1);

      return license || null;
    } catch (error) {
      console.error('Error getting current license:', error);
      return null;
    }
  }

  // Get subscription data with limits
  async getSubscriptionData(clientId: string): Promise<any | null> {
    try {
      const license = await this.getCurrentLicense(clientId);
      if (!license) return null;

      const decryptedData = decrypt(license.subscriptionData);
      return JSON.parse(decryptedData);
    } catch (error) {
      console.error('Error getting subscription data:', error);
      return null;
    }
  }

  // Check limits (Users, Products, etc.)
  async checkLimits(clientId: string, type: string): Promise<{ allowed: boolean; limit: number; current?: number }> {
    try {
      const subscriptionData = await this.getSubscriptionData(clientId);
      if (!subscriptionData || !subscriptionData.properties) {
        return { allowed: false, limit: 0 };
      }

      const limitConfig = subscriptionData.properties[type];
      if (!limitConfig) {
        return { allowed: true, limit: Infinity };
      }

      const limit = limitConfig.maximum || Infinity;
      
      // Get current count based on type
      let current = 0;
      if (type === 'Users') {
        const [result] = await db.execute(sql`SELECT COUNT(*) as count FROM users WHERE is_active = true`);
        current = parseInt(result.count as string);
      } else if (type === 'Products') {
        const [result] = await db.execute(sql`SELECT COUNT(*) as count FROM items`);
        current = parseInt(result.count as string);
      }

      return {
        allowed: current < limit,
        limit,
        current
      };
    } catch (error) {
      console.error('Error checking limits:', error);
      return { allowed: false, limit: 0 };
    }
  }
}

export const licenseManager = new LicenseManager();
```

### 3. License Middleware

```typescript
// server/license-middleware.ts
import { Request, Response, NextFunction } from 'express';
import { licenseManager } from './license-manager.js';

declare global {
  namespace Express {
    interface Request {
      license?: any;
    }
  }
}

export async function requireValidLicense(req: Request, res: Response, next: NextFunction) {
  try {
    // Skip non-API endpoints
    if (!req.path.startsWith('/api/')) {
      return next();
    }

    // Skip license and auth endpoints
    if (req.path.startsWith('/api/license') || 
        req.path.startsWith('/api/login') || 
        req.path.startsWith('/api/logout') ||
        req.path.startsWith('/api/user') ||
        req.path.startsWith('/api/check-admin-exists')) {
      return next();
    }

    // Get client ID
    let clientId = process.env.CLIENT_ID || req.headers['x-client-id'] as string;
    
    if (!clientId) {
      const anyLicense = await licenseManager.getCurrentLicense('');
      if (anyLicense) {
        clientId = anyLicense.clientId;
      }
    }
    
    if (!clientId) {
      return res.status(403).json({ 
        error: 'LICENSE_REQUIRED',
        message: 'No license configured. Please acquire a license to continue.',
        requiresLicense: true
      });
    }

    // Validate license
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const validation = await licenseManager.validateLicense(clientId, baseUrl);
    
    if (!validation.valid) {
      return res.status(403).json({ 
        error: 'INVALID_LICENSE',
        message: validation.message 
      });
    }

    // Check expiry
    const currentLicense = await licenseManager.getCurrentLicense(clientId);
    if (!currentLicense || new Date() > new Date(currentLicense.validTill)) {
      return res.status(403).json({ 
        error: 'LICENSE_EXPIRED',
        message: 'License has expired. Please renew your license.' 
      });
    }

    req.license = currentLicense;
    next();
  } catch (error: any) {
    console.error('License middleware error:', error);
    res.status(500).json({ 
      error: 'LICENSE_ERROR',
      message: 'License validation failed' 
    });
  }
}

// User limit middleware
export async function checkUserLimit(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.method === 'POST' && req.path === '/api/users') {
      const clientId = process.env.CLIENT_ID || '';
      const limits = await licenseManager.checkLimits(clientId, 'Users');
      
      if (!limits.allowed) {
        return res.status(403).json({
          error: 'USER_LIMIT_EXCEEDED',
          message: `Maximum user limit of ${limits.limit} reached. Current: ${limits.current}`,
          limit: limits.limit,
          current: limits.current
        });
      }
    }
    next();
  } catch (error) {
    console.error('User limit check error:', error);
    next();
  }
}

// Product limit middleware
export async function checkProductLimit(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.method === 'POST' && req.path === '/api/items') {
      const clientId = process.env.CLIENT_ID || '';
      const limits = await licenseManager.checkLimits(clientId, 'Products');
      
      if (!limits.allowed) {
        return res.status(403).json({
          error: 'PRODUCT_LIMIT_EXCEEDED',
          message: `Maximum product limit of ${limits.limit} reached. Current: ${limits.current}`,
          limit: limits.limit,
          current: limits.current
        });
      }
    }
    next();
  } catch (error) {
    console.error('Product limit check error:', error);
    next();
  }
}
```

### 4. API Routes

```typescript
// server/routes.ts - Add these routes
import { licenseManager } from './license-manager.js';

// License acquisition
app.post("/api/license/acquire", async (req: Request, res: Response) => {
  try {
    const { clientId, licenseManagerUrl, baseUrl } = req.body;
    
    if (!clientId || !licenseManagerUrl) {
      return res.status(400).json({ 
        error: 'Missing required fields: clientId, licenseManagerUrl' 
      });
    }

    licenseManager.setLicenseManagerUrl(licenseManagerUrl);
    const result = await licenseManager.acquireLicense(clientId, APP_ID, baseUrl);
    
    res.json(result);
  } catch (error: any) {
    console.error('License acquisition error:', error);
    res.status(500).json({ 
      error: 'ACQUISITION_FAILED',
      message: error.message || 'Failed to acquire license' 
    });
  }
});

// License validation test
app.post("/api/license/test-validation", async (req: Request, res: Response) => {
  try {
    const clientId = process.env.CLIENT_ID || '';
    if (!clientId) {
      return res.status(400).json({ error: 'No client ID configured' });
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const result = await licenseManager.validateLicense(clientId, baseUrl);
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ 
      error: 'VALIDATION_FAILED',
      message: error.message 
    });
  }
});

// Get license status
app.get("/api/license/status", async (req: Request, res: Response) => {
  try {
    const clientId = process.env.CLIENT_ID || '';
    const license = await licenseManager.getCurrentLicense(clientId);
    
    if (!license) {
      return res.json({
        hasLicense: false,
        isActive: false,
        isExpired: false
      });
    }

    const isExpired = new Date() > new Date(license.validTill);
    const subscriptionData = await licenseManager.getSubscriptionData(clientId);

    res.json({
      hasLicense: true,
      isActive: license.isActive,
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
      error: 'STATUS_ERROR',
      message: error.message 
    });
  }
});

// Get current limits
app.get("/api/license/limits", async (req: Request, res: Response) => {
  try {
    const clientId = process.env.CLIENT_ID || '';
    const userLimits = await licenseManager.checkLimits(clientId, 'Users');
    const productLimits = await licenseManager.checkLimits(clientId, 'Products');

    res.json({
      Users: userLimits,
      Products: productLimits
    });
  } catch (error: any) {
    console.error('Limits check error:', error);
    res.status(500).json({ 
      error: 'LIMITS_ERROR',
      message: error.message 
    });
  }
});

// Deactivate license
app.post("/api/license/deactivate", async (req: Request, res: Response) => {
  try {
    const clientId = process.env.CLIENT_ID || '';
    const result = await licenseManager.deactivateLicense(clientId);
    
    res.json({ success: result });
  } catch (error: any) {
    res.status(500).json({ 
      error: 'DEACTIVATION_FAILED',
      message: error.message 
    });
  }
});
```

### 5. Frontend License Hook

```typescript
// client/src/hooks/use-license.tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export interface LicenseStatus {
  hasLicense: boolean;
  isActive: boolean;
  isExpired: boolean;
  license?: {
    clientId: string;
    licenseKey: string;
    subscriptionType: string;
    validTill: string;
    lastValidated: string;
    subscriptionData: any;
  };
}

export interface LicenseLimits {
  Users: {
    allowed: boolean;
    limit: number;
    current?: number;
  };
  Products: {
    allowed: boolean;
    limit: number;
    current?: number;
  };
}

export function useLicense() {
  const queryClient = useQueryClient();

  const { data: licenseStatus, isLoading } = useQuery<LicenseStatus>({
    queryKey: ['/api/license/status'],
    refetchInterval: 60000, // Check every minute
  });

  const { data: limits } = useQuery<LicenseLimits>({
    queryKey: ['/api/license/limits'],
    enabled: licenseStatus?.hasLicense === true,
    refetchInterval: 30000, // Check every 30 seconds
  });

  const acquireLicenseMutation = useMutation({
    mutationFn: async (data: { 
      clientId: string; 
      licenseManagerUrl: string; 
      baseUrl: string; 
    }) => {
      return await apiRequest('/api/license/acquire', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/license/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/license/limits'] });
    }
  });

  const testValidationMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/license/test-validation', {
        method: 'POST'
      });
    }
  });

  const deactivateLicenseMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/license/deactivate', {
        method: 'POST'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/license/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/license/limits'] });
    }
  });

  return {
    licenseStatus,
    limits,
    isLoading,
    acquireLicense: acquireLicenseMutation.mutateAsync,
    testValidation: testValidationMutation.mutateAsync,
    deactivateLicense: deactivateLicenseMutation.mutateAsync,
    isAcquiring: acquireLicenseMutation.isPending,
    isTesting: testValidationMutation.isPending,
    isDeactivating: deactivateLicenseMutation.isPending
  };
}
```

### 6. License Guard Component

```typescript
// client/src/components/license-guard.tsx
import { useLicense } from '@/hooks/use-license';
import { ReactNode } from 'react';

interface LicenseGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function LicenseGuard({ children, fallback }: LicenseGuardProps) {
  const { licenseStatus, isLoading } = useLicense();

  if (isLoading) {
    return <div>Loading license information...</div>;
  }

  if (!licenseStatus?.hasLicense || !licenseStatus.isActive || licenseStatus.isExpired) {
    return fallback || <div>Valid license required to access this application.</div>;
  }

  return <>{children}</>;
}
```

### 7. License Settings Page

```typescript
// client/src/pages/license-settings-page.tsx
import { useState } from 'react';
import { useLicense } from '@/hooks/use-license';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export function LicenseSettingsPage() {
  const { toast } = useToast();
  const { 
    licenseStatus, 
    limits, 
    acquireLicense, 
    testValidation, 
    deactivateLicense,
    isAcquiring,
    isTesting,
    isDeactivating
  } = useLicense();

  const [formData, setFormData] = useState({
    clientId: '',
    licenseManagerUrl: '',
    baseUrl: window.location.origin
  });

  const handleAcquireLicense = async () => {
    try {
      const result = await acquireLicense(formData);
      if (result.success) {
        toast({
          title: "License Acquired",
          description: result.message,
        });
      } else {
        toast({
          variant: "destructive",
          title: "License Acquisition Failed",
          description: result.message,
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "License Acquisition Failed",
        description: error.message || "An error occurred",
      });
    }
  };

  const handleTestValidation = async () => {
    try {
      const result = await testValidation();
      toast({
        title: result.valid ? "License Validation Successful" : "License Validation Failed",
        description: result.message,
        variant: result.valid ? "default" : "destructive",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Validation Test Failed",
        description: error.message,
      });
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">License Management</h1>

      {/* Current License Status */}
      <Card>
        <CardHeader>
          <CardTitle>License Status</CardTitle>
        </CardHeader>
        <CardContent>
          {licenseStatus?.hasLicense ? (
            <div className="space-y-2">
              <p><strong>License Key:</strong> {licenseStatus.license?.licenseKey}</p>
              <p><strong>Type:</strong> {licenseStatus.license?.subscriptionType}</p>
              <p><strong>Valid Until:</strong> {new Date(licenseStatus.license?.validTill || '').toLocaleDateString()}</p>
              <p><strong>Status:</strong> 
                <span className={`ml-2 ${licenseStatus.isActive && !licenseStatus.isExpired ? 'text-green-600' : 'text-red-600'}`}>
                  {licenseStatus.isActive && !licenseStatus.isExpired ? 'Active' : 'Inactive/Expired'}
                </span>
              </p>
            </div>
          ) : (
            <p className="text-gray-600">No license configured</p>
          )}
        </CardContent>
      </Card>

      {/* Usage Limits */}
      {limits && (
        <Card>
          <CardHeader>
            <CardTitle>Usage Limits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold">Users</h4>
                <p>{limits.Users.current || 0} / {limits.Users.limit === Infinity ? '∞' : limits.Users.limit}</p>
                <p className={limits.Users.allowed ? 'text-green-600' : 'text-red-600'}>
                  {limits.Users.allowed ? 'Within Limit' : 'Limit Exceeded'}
                </p>
              </div>
              <div>
                <h4 className="font-semibold">Products</h4>
                <p>{limits.Products.current || 0} / {limits.Products.limit === Infinity ? '∞' : limits.Products.limit}</p>
                <p className={limits.Products.allowed ? 'text-green-600' : 'text-red-600'}>
                  {limits.Products.allowed ? 'Within Limit' : 'Limit Exceeded'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* License Acquisition */}
      <Card>
        <CardHeader>
          <CardTitle>Acquire New License</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Client ID"
            value={formData.clientId}
            onChange={(e) => setFormData(prev => ({ ...prev, clientId: e.target.value }))}
          />
          <Input
            placeholder="License Manager URL"
            value={formData.licenseManagerUrl}
            onChange={(e) => setFormData(prev => ({ ...prev, licenseManagerUrl: e.target.value }))}
          />
          <Input
            placeholder="Base URL"
            value={formData.baseUrl}
            onChange={(e) => setFormData(prev => ({ ...prev, baseUrl: e.target.value }))}
          />
          <Button 
            onClick={handleAcquireLicense} 
            disabled={isAcquiring || !formData.clientId || !formData.licenseManagerUrl}
          >
            {isAcquiring ? 'Acquiring...' : 'Acquire License'}
          </Button>
        </CardContent>
      </Card>

      {/* License Actions */}
      <Card>
        <CardHeader>
          <CardTitle>License Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleTestValidation} disabled={isTesting} variant="outline">
            {isTesting ? 'Testing...' : 'Test Validation'}
          </Button>
          <Button 
            onClick={() => deactivateLicense()} 
            disabled={isDeactivating} 
            variant="destructive"
          >
            {isDeactivating ? 'Deactivating...' : 'Deactivate License'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

## Implementation Steps

1. **Database Setup**: Create the licenses table using the provided schema
2. **Environment Variables**: Set up required environment variables
3. **Install License Manager**: Add the LicenseManager class to your backend
4. **Add Middleware**: Implement license validation middleware
5. **API Routes**: Add license management API endpoints
6. **Frontend Integration**: Implement the license hook and components
7. **License Guard**: Wrap your application with license protection
8. **UI Integration**: Add license settings page and limit displays

## Environment Variables

```env
# Required
LICENSE_ENCRYPTION_KEY=your-encryption-key-2024
CLIENT_ID=your-client-id-here
DATABASE_URL=your-database-url

# Optional
LICENSE_MANAGER_URL=https://your-license-manager.com
```

## External License Manager API Requirements

Your external license manager must provide these endpoints:

### POST /api/acquire-license
**Request:**
```json
{
  "client_id": "string",
  "app_id": "string", 
  "base_url": "string"
}
```

**Response:**
```json
{
  "license_key": "string",
  "subscription_type": "string",
  "valid_till": "2028-07-11T15:11:50.707Z",
  "checksum": "string",
  "mutual_key": "string",
  "subscription_data": {
    "type": "object",
    "properties": {
      "Users": {
        "type": "number",
        "minimum": 1,
        "maximum": 50
      }
    },
    "required": ["Users"]
  },
  "message": "string"
}
```

### POST /api/validate-license
**Request:**
```json
{
  "client_id": "string",
  "app_id": "string",
  "license_key": "string", 
  "checksum": "string",
  "domain": "string"
}
```

**Response:**
```json
{
  "status": "Valid",
  "message": "License is valid and verified",
  "validated_at": "2025-07-11T15:35:28.409Z",
  "expires_at": "2028-07-11T15:11:50.707Z"
}
```

## Security Considerations

1. **Mutual Key Protection**: Never expose the mutual key in client-side code
2. **Encryption**: All sensitive data (mutual key, subscription data) is encrypted in database
3. **Checksum Validation**: Use exact order: clientId + appId + licenseKey + endDateISOString
4. **Request Deduplication**: Prevents overwhelming the license server
5. **Domain Validation**: License validation includes domain checking
6. **Session Management**: License validation integrated with authentication

## Error Handling

The system handles various error scenarios:
- Missing license
- Expired license  
- Invalid checksum
- Network failures
- License server unavailable
- Limit exceeded scenarios

All errors include descriptive messages and appropriate HTTP status codes for proper frontend handling.

This comprehensive guide provides everything needed to implement the same license management system in any application.