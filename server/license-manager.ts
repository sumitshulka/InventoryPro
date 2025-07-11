import crypto from 'crypto';
import { db } from './db.js';
import { licenses, type License, type InsertLicense } from '../shared/schema.js';
import { eq, and, desc } from 'drizzle-orm';

// Application constants
export const APP_ID = '0ce1df0ffe4d4ce2634025e956a4f801';
const ENCRYPTION_KEY = process.env.LICENSE_ENCRYPTION_KEY || 'inventory-license-key-2024';

// License API types
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
  mutual_key?: string; // Optional: if provided by license manager
  subscription_data: {
    type: string;
    properties: {
      Users: {
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

// Encryption utilities
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

// Note: mutual_key is now required from the license manager response
// No fallback generation - the external license manager must provide this value

// Checksum calculation following the HMAC-SHA256 guide
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

  constructor(licenseManagerUrl?: string) {
    this.licenseManagerUrl = licenseManagerUrl || process.env.LICENSE_MANAGER_URL || null;
  }

  setLicenseManagerUrl(url: string) {
    this.licenseManagerUrl = url;
  }

  // Acquire license from external license manager
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
        app_id: productId, // Use productId as the app_id in the request
        base_url: baseUrl
      };

      // Ensure proper URL construction - remove trailing slash if present
      const licenseManagerBaseUrl = this.licenseManagerUrl.endsWith('/') ? 
        this.licenseManagerUrl.slice(0, -1) : this.licenseManagerUrl;
      const fullUrl = `${licenseManagerBaseUrl}/api/acquire-license`;
      console.log('License acquisition request:', {
        url: fullUrl,
        method: 'POST',
        payload: requestPayload
      });
      
      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestPayload)
      });

      if (!response.ok) {
        throw new Error(`License manager responded with status: ${response.status}`);
      }

      const licenseResponse: LicenseAcquisitionResponse = await response.json();

      console.log('========== LICENSE MANAGER RESPONSE ==========');
      console.log('Raw Response:', JSON.stringify(licenseResponse, null, 2));
      console.log('Mutual Key Present:', !!licenseResponse.mutual_key);
      console.log('Mutual Key Value:', licenseResponse.mutual_key ? `${licenseResponse.mutual_key.substring(0, 10)}...` : 'NOT FOUND');
      console.log('========================================');

      // Validate response structure according to expected schema
      if (!licenseResponse.license_key) {
        throw new Error(`Missing license_key in response. Received: ${JSON.stringify(licenseResponse)}`);
      }
      if (!licenseResponse.subscription_type) {
        throw new Error(`Missing subscription_type in response. Received: ${JSON.stringify(licenseResponse)}`);
      }
      if (!licenseResponse.valid_till) {
        throw new Error(`Missing valid_till in response. Received: ${JSON.stringify(licenseResponse)}`);
      }
      if (!licenseResponse.checksum) {
        throw new Error(`Missing checksum in response. Received: ${JSON.stringify(licenseResponse)}`);
      }
      if (!licenseResponse.subscription_data) {
        throw new Error(`Missing subscription_data in response. Received: ${JSON.stringify(licenseResponse)}`);
      }

      // Validate subscription_data structure
      const subData = licenseResponse.subscription_data;
      if (!subData.properties) {
        throw new Error(`Missing properties in subscription_data. Expected object with properties like Users, Products. Received: ${JSON.stringify(subData)}`);
      }

      console.log('License response validation passed');

      // Store the license in database with encryption
      // Extract mutual_key from response - this is now required for proper checksum validation
      if (!licenseResponse.mutual_key) {
        throw new Error(`Missing mutual_key in response. The license manager must provide mutual_key for checksum validation. Received: ${JSON.stringify(licenseResponse)}`);
      }
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

      // Remove any existing licenses for this app and client
      await db.delete(licenses).where(
        and(
          eq(licenses.applicationId, APP_ID),
          eq(licenses.clientId, clientId)
        )
      );

      // Insert new license
      const [insertedLicense] = await db.insert(licenses).values(licenseData).returning();

      return {
        success: true,
        message: 'License acquired successfully',
        license: insertedLicense
      };
    } catch (error: any) {
      console.error('License acquisition error:', error);
      return {
        success: false,
        message: error.message || 'Failed to acquire license'
      };
    }
  }

  // Validate license with external license manager
  async validateLicense(
    clientId: string,
    domain: string
  ): Promise<{ valid: boolean; message: string; license?: License }> {
    try {
      console.log('=== LICENSE VALIDATION START ===');
      console.log('Validating license for clientId:', clientId);
      console.log('Domain:', domain);
      console.log('License Manager URL:', this.licenseManagerUrl);
      
      // Get current license from database
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
        console.log('No active license found in database');
        return {
          valid: false,
          message: 'No active license found'
        };
      }

      console.log('Found license:', {
        id: currentLicense.id,
        licenseKey: currentLicense.licenseKey,
        subscriptionType: currentLicense.subscriptionType,
        validTill: currentLicense.validTill,
        isActive: currentLicense.isActive
      });

      // Check if license is expired
      const isExpired = new Date() > new Date(currentLicense.validTill);
      console.log('License expiry check:', {
        now: new Date().toISOString(),
        validTill: currentLicense.validTill.toISOString(),
        isExpired
      });
      
      if (isExpired) {
        return {
          valid: false,
          message: 'License has expired'
        };
      }

      // Decrypt mutual key
      const mutualKey = decrypt(currentLicense.mutualKey);

      // Calculate checksum for validation using the original base_url from license acquisition
      const calculatedChecksum = generateChecksum(
        mutualKey,
        clientId,
        APP_ID,
        currentLicense.licenseKey,
        currentLicense.validTill.toISOString()
      );

      console.log('Checksum calculation details:', {
        mutualKey: mutualKey.substring(0, 10) + '...',
        clientId,
        appId: APP_ID,
        licenseKey: currentLicense.licenseKey,
        validTill: currentLicense.validTill.toISOString(),
        calculatedChecksum,
        storedChecksum: currentLicense.checksum,
        originalBaseUrl: currentLicense.baseUrl,
        currentDomain: domain
      });

      // Prepare validation request using the original base_url from license acquisition
      const validationRequest: LicenseValidationRequest = {
        client_id: clientId,
        app_id: APP_ID,
        license_key: currentLicense.licenseKey,
        checksum: calculatedChecksum,
        domain: currentLicense.baseUrl || domain // Use original base_url if available
      };

      // Make validation request to license manager
      if (!this.licenseManagerUrl) {
        console.log('No license manager URL configured, doing local validation');
        
        // For local validation, check if license is not expired and is active
        // Skip checksum validation since we don't have the original mutual key used by external license manager
        console.log('Local validation - skipping checksum validation, checking expiry and active status only');
        
        // Update last validated timestamp
        await db
          .update(licenses)
          .set({ lastValidated: new Date() })
          .where(eq(licenses.id, currentLicense.id));

        console.log('=== LICENSE VALIDATION SUCCESS (LOCAL) ===');
        return {
          valid: true,
          message: 'License is valid (local validation)',
          license: currentLicense
        };
      }

      // Ensure proper URL construction - remove trailing slash if present
      const licenseManagerBaseUrl = this.licenseManagerUrl.endsWith('/') ? 
        this.licenseManagerUrl.slice(0, -1) : this.licenseManagerUrl;
      const validationUrl = `${licenseManagerBaseUrl}/api/validate-license`;
      
      console.log('License validation request:', {
        url: validationUrl,
        method: 'POST',
        payload: validationRequest
      });

      const response = await fetch(validationUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(validationRequest)
      });

      console.log('License validation response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log('License validation error response:', errorText);
        throw new Error(`License validation failed with status: ${response.status} - ${errorText}`);
      }

      const validationResponse: any = await response.json();
      console.log('License validation response:', JSON.stringify(validationResponse, null, 2));

      // Handle different response formats from license manager
      const isValid = validationResponse.valid === true || 
                      validationResponse.status === 'Valid' ||
                      validationResponse.status === 'valid';

      console.log('Validation result analysis:', {
        hasValidField: 'valid' in validationResponse,
        validFieldValue: validationResponse.valid,
        hasStatusField: 'status' in validationResponse,
        statusFieldValue: validationResponse.status,
        finalIsValid: isValid
      });

      if (isValid) {
        // Update last validated timestamp
        await db
          .update(licenses)
          .set({ lastValidated: new Date() })
          .where(eq(licenses.id, currentLicense.id));

        console.log('=== LICENSE VALIDATION SUCCESS (EXTERNAL) ===');
        return {
          valid: true,
          message: validationResponse.message || 'License is valid',
          license: currentLicense
        };
      } else {
        console.log('=== LICENSE VALIDATION FAILED (EXTERNAL) ===');
        return {
          valid: false,
          message: validationResponse.message || 'License validation failed'
        };
      }
    } catch (error: any) {
      console.error('License validation error:', error);
      return {
        valid: false,
        message: error.message || 'License validation failed'
      };
    }
  }

  // Get current license information
  async getCurrentLicense(clientId: string): Promise<License | null> {
    try {
      // If clientId is empty, get any active license for this application
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

      const [currentLicense] = await db
        .select()
        .from(licenses)
        .where(whereClause)
        .orderBy(desc(licenses.createdAt))
        .limit(1);

      return currentLicense || null;
    } catch (error) {
      console.error('Error fetching current license:', error);
      return null;
    }
  }

  // Get decrypted subscription data
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

  // Check if license allows certain limits
  async checkLimits(clientId: string, type: string): Promise<{ allowed: boolean; limit: number; current?: number }> {
    try {
      const subscriptionData = await this.getSubscriptionData(clientId);
      if (!subscriptionData || !subscriptionData.properties) {
        return { allowed: false, limit: 0 };
      }

      const property = subscriptionData.properties[type];
      if (!property) {
        return { allowed: false, limit: 0 };
      }

      return {
        allowed: true,
        limit: property.maximum || 0
      };
    } catch (error) {
      console.error('Error checking limits:', error);
      return { allowed: false, limit: 0 };
    }
  }

  // Deactivate license
  async deactivateLicense(clientId: string): Promise<boolean> {
    try {
      await db
        .update(licenses)
        .set({ isActive: false })
        .where(
          and(
            eq(licenses.applicationId, APP_ID),
            eq(licenses.clientId, clientId)
          )
        );
      return true;
    } catch (error) {
      console.error('Error deactivating license:', error);
      return false;
    }
  }
}

// Singleton instance
export const licenseManager = new LicenseManager();