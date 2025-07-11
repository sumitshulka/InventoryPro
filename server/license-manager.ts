import crypto from 'crypto';
import { db } from './db.js';
import { licenses, type License, type InsertLicense } from '../shared/schema.js';
import { eq, and, desc } from 'drizzle-orm';

// Application constants
export const APP_ID = 'a17ba122-e7db-4568-8928-9f749f65e1fe';
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
  valid: boolean;
  message: string;
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

// Checksum calculation following the HMAC-SHA256 guide
export function generateChecksum(
  mutualKey: string,
  clientId: string,
  appId: string,
  licenseKey: string,
  expiryDate: string
): string {
  const dataString = `${clientId}${appId}${licenseKey}${expiryDate}`;
  return crypto.createHmac('sha256', mutualKey).update(dataString).digest('hex');
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

      // Store the license in database with encryption
      const encryptedMutualKey = encrypt(licenseResponse.checksum); // Using checksum as mutual key
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
        return {
          valid: false,
          message: 'No active license found'
        };
      }

      // Check if license is expired
      if (new Date() > new Date(currentLicense.validTill)) {
        return {
          valid: false,
          message: 'License has expired'
        };
      }

      // Decrypt mutual key
      const mutualKey = decrypt(currentLicense.mutualKey);

      // Calculate checksum for validation
      const calculatedChecksum = generateChecksum(
        mutualKey,
        clientId,
        APP_ID,
        currentLicense.licenseKey,
        currentLicense.validTill.toISOString()
      );

      // Prepare validation request
      const validationRequest: LicenseValidationRequest = {
        client_id: clientId,
        app_id: APP_ID,
        license_key: currentLicense.licenseKey,
        checksum: calculatedChecksum,
        domain: domain
      };

      // Make validation request to license manager
      if (!this.licenseManagerUrl) {
        // If no license manager URL, do local validation
        const isChecksumValid = calculatedChecksum === currentLicense.checksum;
        if (isChecksumValid) {
          // Update last validated timestamp
          await db
            .update(licenses)
            .set({ lastValidated: new Date() })
            .where(eq(licenses.id, currentLicense.id));

          return {
            valid: true,
            message: 'License is valid',
            license: currentLicense
          };
        } else {
          return {
            valid: false,
            message: 'License checksum validation failed'
          };
        }
      }

      const response = await fetch(`${this.licenseManagerUrl}/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(validationRequest)
      });

      if (!response.ok) {
        throw new Error(`License validation failed with status: ${response.status}`);
      }

      const validationResponse: LicenseValidationResponse = await response.json();

      if (validationResponse.valid) {
        // Update last validated timestamp
        await db
          .update(licenses)
          .set({ lastValidated: new Date() })
          .where(eq(licenses.id, currentLicense.id));

        return {
          valid: true,
          message: 'License is valid',
          license: currentLicense
        };
      } else {
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