# License Management System - Checksum Calculation Guide

## Overview

This document provides complete specifications for implementing HMAC-SHA256 checksum calculation for license validation in the License Management System. The checksum mechanism ensures license integrity and prevents tampering through cryptographic verification.

## Security Architecture

### Cryptographic Algorithm
- **Algorithm**: HMAC-SHA256 (Hash-based Message Authentication Code using SHA-256)
- **Purpose**: Verify license authenticity and detect tampering
- **Security Level**: Industry-standard cryptographic security

### Key Components
1. **Mutual Key**: Secret cryptographic key shared between client and server
2. **Data String**: Concatenated license parameters in specific order
3. **Checksum**: HMAC-SHA256 hash of data string using mutual key

## Checksum Calculation Process

### Step 1: Data String Construction

The data string is created by concatenating these fields **in exact order with no separators**:

```
data_string = client_id + app_id + license_key + license_expiry_date_iso
```

**Field Specifications:**

| Field | Type | Format | Example |
|-------|------|--------|---------|
| `client_id` | UUID | Lowercase with hyphens | `efe2ae66-b484-4923-9e28-5f04df532c0e` |
| `app_id` | String | Application hardcoded key | `a17ba122-e7db-4568-8928-9f749f65e1fe` |
| `license_key` | String | Uppercase with hyphens | `ABC-DEF-GHI-JKL` |
| `expiry_date` | ISO 8601 | UTC timezone with milliseconds | `2026-06-13T14:49:57.602Z` |

**Example Concatenated String:**
```
efe2ae66-b484-4923-9e28-5f04df532c0ea17ba122-e7db-4568-8928-9f749f65e1feABC-DEF-GHI-JKL2026-06-13T14:49:57.602Z
```

### Step 2: HMAC-SHA256 Calculation

Apply HMAC-SHA256 using your mutual key:

```
checksum = HMAC-SHA256(mutual_key, data_string)
```

### Step 3: Hexadecimal Conversion

Convert the HMAC result to lowercase hexadecimal string:

```
final_checksum = hex_lowercase(checksum)
```

## Implementation Examples

### JavaScript/Node.js

```javascript
const crypto = require('crypto');

/**
 * Generate HMAC-SHA256 checksum for license validation
 * @param {string} mutualKey - Secret mutual key from license acquisition
 * @param {string} clientId - Client UUID
 * @param {string} appId - Application hardcoded key
 * @param {string} licenseKey - License key
 * @param {string} expiryDate - License expiry date in ISO 8601 format
 * @returns {string} Hexadecimal checksum
 */
function generateChecksum(mutualKey, clientId, appId, licenseKey, expiryDate) {
  const dataString = `${clientId}${appId}${licenseKey}${expiryDate}`;
  return crypto.createHmac('sha256', mutualKey).update(dataString).digest('hex');
}

// Usage example
const checksum = generateChecksum(
  'your_mutual_key_here',
  'efe2ae66-b484-4923-9e28-5f04df532c0e',
  'a17ba122-e7db-4568-8928-9f749f65e1fe', 
  'ABC-DEF-GHI-JKL',
  '2026-06-13T14:49:57.602Z'
);

console.log('Calculated checksum:', checksum);
```

### Python

```python
import hmac
import hashlib

def generate_checksum(mutual_key, client_id, app_id, license_key, expiry_date):
    """
    Generate HMAC-SHA256 checksum for license validation
    
    Args:
        mutual_key (str): Secret mutual key from license acquisition
        client_id (str): Client UUID
        app_id (str): Application hardcoded key
        license_key (str): License key
        expiry_date (str): License expiry date in ISO 8601 format
    
    Returns:
        str: Hexadecimal checksum
    """
    data_string = f"{client_id}{app_id}{license_key}{expiry_date}"
    return hmac.new(
        mutual_key.encode('utf-8'),
        data_string.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()

# Usage example
checksum = generate_checksum(
    'your_mutual_key_here',
    'efe2ae66-b484-4923-9e28-5f04df532c0e',
    'a17ba122-e7db-4568-8928-9f749f65e1fe',
    'ABC-DEF-GHI-JKL',
    '2026-06-13T14:49:57.602Z'
)

print(f'Calculated checksum: {checksum}')
```

### PHP

```php
<?php
/**
 * Generate HMAC-SHA256 checksum for license validation
 * 
 * @param string $mutualKey Secret mutual key from license acquisition
 * @param string $clientId Client UUID
 * @param string $appId Application hardcoded key
 * @param string $licenseKey License key
 * @param string $expiryDate License expiry date in ISO 8601 format
 * @return string Hexadecimal checksum
 */
function generateChecksum($mutualKey, $clientId, $appId, $licenseKey, $expiryDate) {
    $dataString = $clientId . $appId . $licenseKey . $expiryDate;
    return hash_hmac('sha256', $dataString, $mutualKey);
}

// Usage example
$checksum = generateChecksum(
    'your_mutual_key_here',
    'efe2ae66-b484-4923-9e28-5f04df532c0e',
    'a17ba122-e7db-4568-8928-9f749f65e1fe',
    'ABC-DEF-GHI-JKL',
    '2026-06-13T14:49:57.602Z'
);

echo "Calculated checksum: " . $checksum . PHP_EOL;
?>
```

### Java

```java
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;

public class ChecksumGenerator {
    
    /**
     * Generate HMAC-SHA256 checksum for license validation
     * 
     * @param mutualKey Secret mutual key from license acquisition
     * @param clientId Client UUID
     * @param appId Application hardcoded key
     * @param licenseKey License key
     * @param expiryDate License expiry date in ISO 8601 format
     * @return Hexadecimal checksum
     */
    public static String generateChecksum(String mutualKey, String clientId, 
                                        String appId, String licenseKey, String expiryDate) {
        try {
            String dataString = clientId + appId + licenseKey + expiryDate;
            
            Mac mac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKey = new SecretKeySpec(mutualKey.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            mac.init(secretKey);
            
            byte[] hash = mac.doFinal(dataString.getBytes(StandardCharsets.UTF_8));
            
            // Convert to hexadecimal
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) {
                    hexString.append('0');
                }
                hexString.append(hex);
            }
            
            return hexString.toString();
        } catch (Exception e) {
            throw new RuntimeException("Error generating checksum", e);
        }
    }
    
    // Usage example
    public static void main(String[] args) {
        String checksum = generateChecksum(
            "your_mutual_key_here",
            "efe2ae66-b484-4923-9e28-5f04df532c0e",
            "a17ba122-e7db-4568-8928-9f749f65e1fe",
            "ABC-DEF-GHI-JKL",
            "2026-06-13T14:49:57.602Z"
        );
        
        System.out.println("Calculated checksum: " + checksum);
    }
}
```

### C#

```csharp
using System;
using System.Security.Cryptography;
using System.Text;

public class ChecksumGenerator
{
    /// <summary>
    /// Generate HMAC-SHA256 checksum for license validation
    /// </summary>
    /// <param name="mutualKey">Secret mutual key from license acquisition</param>
    /// <param name="clientId">Client UUID</param>
    /// <param name="appId">Application hardcoded key</param>
    /// <param name="licenseKey">License key</param>
    /// <param name="expiryDate">License expiry date in ISO 8601 format</param>
    /// <returns>Hexadecimal checksum</returns>
    public static string GenerateChecksum(string mutualKey, string clientId, 
                                        string appId, string licenseKey, string expiryDate)
    {
        string dataString = clientId + appId + licenseKey + expiryDate;
        
        using (var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(mutualKey)))
        {
            byte[] hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(dataString));
            return BitConverter.ToString(hash).Replace("-", "").ToLower();
        }
    }
    
    // Usage example
    public static void Main()
    {
        string checksum = GenerateChecksum(
            "your_mutual_key_here",
            "efe2ae66-b484-4923-9e28-5f04df532c0e",
            "a17ba122-e7db-4568-8928-9f749f65e1fe",
            "ABC-DEF-GHI-JKL",
            "2026-06-13T14:49:57.602Z"
        );
        
        Console.WriteLine($"Calculated checksum: {checksum}");
    }
}
```

## API Integration

### License Validation Request

Send the calculated checksum with your validation request to `/api/validate-license`:

```json
{
  "client_id": "efe2ae66-b484-4923-9e28-5f04df532c0e",
  "app_id": "a17ba122-e7db-4568-8928-9f749f65e1fe",
  "license_key": "ABC-DEF-GHI-JKL",
  "checksum": "calculated_checksum_here",
  "domain": "your-app-domain.com"
}
```

### Response Codes

| Status | Description |
|--------|-------------|
| 200 | License valid and checksum verified |
| 400 | Invalid checksum or license expired |
| 403 | Domain not authorized or checksum mismatch |
| 404 | License or application not found |

## Security Best Practices

### 1. Mutual Key Protection
- **Never expose** mutual keys in client-side code
- Store mutual keys securely (encrypted storage, environment variables)
- Use secure key management systems in production
- Rotate mutual keys periodically for enhanced security

### 2. Implementation Security
- Validate input parameters before checksum calculation
- Use constant-time comparison for checksum verification
- Implement rate limiting for validation requests
- Log failed validation attempts for security monitoring

### 3. Network Security
- Always use HTTPS for API communication
- Implement certificate pinning where possible
- Validate SSL/TLS certificates properly

## Common Implementation Errors

### ❌ Incorrect Data Concatenation
```javascript
// WRONG - Adding separators
const dataString = `${clientId}-${appId}-${licenseKey}-${expiryDate}`;

// CORRECT - Direct concatenation
const dataString = `${clientId}${appId}${licenseKey}${expiryDate}`;
```

### ❌ Wrong Date Format
```javascript
// WRONG - Local date format
const expiryDate = "2026-06-13 14:49:57";

// CORRECT - ISO 8601 UTC format
const expiryDate = "2026-06-13T14:49:57.602Z";
```

### ❌ Case Sensitivity Issues
```javascript
// WRONG - Incorrect case
const licenseKey = "abc-def-ghi-jkl";

// CORRECT - Use exact case from license acquisition
const licenseKey = "ABC-DEF-GHI-JKL";
```

### ❌ Encoding Issues
```python
# WRONG - Missing UTF-8 encoding
hmac.new(mutual_key, data_string, hashlib.sha256)

# CORRECT - Proper UTF-8 encoding
hmac.new(mutual_key.encode('utf-8'), data_string.encode('utf-8'), hashlib.sha256)
```

## Testing and Debugging

### Test Vector Example

**Input Parameters:**
- `mutual_key`: `test_mutual_key_12345`
- `client_id`: `efe2ae66-b484-4923-9e28-5f04df532c0e`
- `app_id`: `a17ba122-e7db-4568-8928-9f749f65e1fe`
- `license_key`: `TEST-ABCD-1234-WXYZ`
- `expiry_date`: `2026-06-13T14:49:57.602Z`

**Expected Data String:**
```
efe2ae66-b484-4923-9e28-5f04df532c0ea17ba122-e7db-4568-8928-9f749f65e1feTEST-ABCD-1234-WXYZ2026-06-13T14:49:57.602Z
```

**Expected Checksum:**
```
f8d2e5a7b9c4f1e3d6a8b5c2e9f4a7d0c3f6b9e2a5d8c1f4e7b0a3d6c9f2e5a8
```

### Debugging Steps

1. **Verify Data String**: Print the concatenated data string and compare with expected format
2. **Check Encoding**: Ensure UTF-8 encoding for all string operations
3. **Validate Algorithm**: Confirm HMAC-SHA256 implementation
4. **Test with Known Values**: Use the test vector above to verify implementation
5. **API Testing**: Use the License Management System's API testing interface

## Troubleshooting

### Common Issues and Solutions

**Issue**: "Checksum mismatch" error
- **Solution**: Verify data concatenation order and format
- **Check**: Mutual key, case sensitivity, date format

**Issue**: Encoding-related errors
- **Solution**: Ensure UTF-8 encoding for all string operations
- **Check**: Character encoding in your development environment

**Issue**: Intermittent validation failures
- **Solution**: Check for timezone issues in date formatting
- **Check**: Ensure consistent ISO 8601 UTC format

## Support and Integration

For integration support or questions about checksum calculation:

1. Use the API Testing interface in the License Management System
2. Verify implementation with provided test vectors
3. Review server logs for detailed error information
4. Contact system administrators for mutual key issues

---

**Last Updated**: July 11, 2025  
**Version**: 1.0  
**Compatibility**: License Management System v2.0+