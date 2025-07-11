# License Management System - API Endpoints Reference

## Base URL

**Temporary Development URL:**
```
https://44853c54-3cec-4694-af17-d60bd826961c-00-2iidd83wsan4s.spock.replit.dev
```

**Production Base URL Pattern:**
```
https://[your-replit-app-name].replit.app
```

## Authentication

Most admin endpoints require session-based authentication. For client-facing APIs, use HMAC-SHA256 checksum validation.

## Public Client API Endpoints

**⚠️ IMPORTANT**: All license management endpoints require **POST** requests with proper JSON body. GET requests will return a 405 Method Not Allowed error with helpful instructions.

### 1. License Acquisition
```
POST /api/acquire-license
```
**Request Body:**
```json
{
  "client_id": "efe2ae66-b484-4923-9e28-5f04df532c0e",
  "app_id": "a17ba122-e7db-4568-8928-9f749f65e1fe",
  "base_url": "https://yourapp.com"
}
```

### 2. License Validation
```
POST /api/validate-license
```
**Request Body:**
```json
{
  "client_id": "efe2ae66-b484-4923-9e28-5f04df532c0e",
  "app_id": "a17ba122-e7db-4568-8928-9f749f65e1fe",
  "license_key": "ABC-DEF-GHI-JKL",
  "checksum": "calculated_hmac_sha256_checksum",
  "domain": "yourapp.com"
}
```

### 3. License Revalidation
```
POST /api/revalidate-license
```
**Request Body:**
```json
{
  "client_id": "efe2ae66-b484-4923-9e28-5f04df532c0e",
  "app_id": "a17ba122-e7db-4568-8928-9f749f65e1fe"
}
```

### 4. License Renewal Request (New Approval Workflow)
```
POST /api/request-renewal
```
**Request Body:**
```json
{
  "client_id": "efe2ae66-b484-4923-9e28-5f04df532c0e",
  "app_id": "a17ba122-e7db-4568-8928-9f749f65e1fe",
  "license_key": "ABC-DEF-GHI-JKL",
  "checksum": "calculated_hmac_sha256_checksum",
  "renewal_reason": "license_expiry",
  "reason_description": "License expiring soon, need renewal",
  "requested_extension_years": 1,
  "requested_by": "user@company.com"
}
```

### 5. Check Renewal Status
```
POST /api/check-renewal-status
```
**Request Body:**
```json
{
  "client_id": "efe2ae66-b484-4923-9e28-5f04df532c0e",
  "app_id": "a17ba122-e7db-4568-8928-9f749f65e1fe",
  "license_key": "ABC-DEF-GHI-JKL",
  "checksum": "calculated_hmac_sha256_checksum"
}
```

### 6. Get Available Schemes
```
POST /api/get-schemes
```
**Request Body:**
```json
{
  "client_id": "efe2ae66-b484-4923-9e28-5f04df532c0e",
  "app_id": "a17ba122-e7db-4568-8928-9f749f65e1fe",
  "license_key": "ABC-DEF-GHI-JKL",
  "checksum": "calculated_hmac_sha256_checksum"
}
```

### 7. Request Scheme Change (Upgrade/Downgrade)
```
POST /api/request-scheme-change
```
**Request Body:**
```json
{
  "client_id": "efe2ae66-b484-4923-9e28-5f04df532c0e",
  "app_id": "a17ba122-e7db-4568-8928-9f749f65e1fe",
  "license_key": "ABC-DEF-GHI-JKL",
  "checksum": "calculated_hmac_sha256_checksum",
  "target_schema_id": "schema-uuid-here",
  "request_type": "upgrade",
  "requested_by": "user@company.com"
}
```

### 8. Check Upgrade Status
```
POST /api/check-upgrade-status
```
**Request Body:**
```json
{
  "client_id": "efe2ae66-b484-4923-9e28-5f04df532c0e",
  "app_id": "a17ba122-e7db-4568-8928-9f749f65e1fe",
  "license_key": "ABC-DEF-GHI-JKL",
  "checksum": "calculated_hmac_sha256_checksum"
}
```

### 9. License Renewal (Deprecated - Use request-renewal instead)
```
POST /api/renew-license
```
**Note:** This endpoint is deprecated. Use `/api/request-renewal` for new implementations.

## Authentication API Endpoints

### 1. Check Super Admin Exists
```
GET /api/auth/has-super-admin
```

### 2. Login
```
POST /api/auth/login
```
**Request Body:**
```json
{
  "username": "admin",
  "password": "your_password"
}
```

### 3. Get Current User
```
GET /api/auth/me
```
**Requires:** Session authentication

### 4. Logout
```
POST /api/auth/logout
```
**Requires:** Session authentication

### 5. Change Password
```
POST /api/auth/change-password
```
**Requires:** Session authentication
**Request Body:**
```json
{
  "current_password": "current_password",
  "new_password": "new_password"
}
```

## Admin API Endpoints (Require Authentication)

### Client Management
```
GET /api/clients                    # Get all clients
POST /api/clients                   # Create client
PUT /api/clients/:id                # Update client
DELETE /api/clients/:id             # Delete client
```

### Application Management
```
GET /api/applications               # Get all applications
POST /api/applications              # Create application
PUT /api/applications/:id           # Update application
DELETE /api/applications/:id        # Delete application
```

### Client-Application Associations
```
GET /api/client-applications        # Get all associations
POST /api/client-applications       # Create association
PUT /api/client-applications/:id    # Update association
DELETE /api/client-applications/:id # Delete association
```

### License Management
```
GET /api/licenses                   # Get all licenses
POST /api/licenses                  # Create license
PUT /api/licenses/:id               # Update license
DELETE /api/licenses/:id            # Delete license
```

### Webhook Management
```
GET /api/webhooks                   # Get all webhooks
POST /api/webhooks                  # Create webhook
PUT /api/webhooks/:id               # Update webhook
DELETE /api/webhooks/:id            # Delete webhook
```

### Analytics
```
GET /api/analytics/usage            # Get usage analytics
GET /api/analytics/validation       # Get validation analytics
```

### Dashboard Stats
```
GET /api/dashboard/stats            # Get dashboard statistics
```

### Upgrade Request Management
```
GET /api/upgrade-requests           # Get all upgrade requests
POST /api/upgrade-requests/:id/approve  # Approve upgrade request
POST /api/upgrade-requests/:id/reject   # Reject upgrade request
```

### Renewal Request Management
```
GET /api/renewal-requests           # Get all renewal requests
POST /api/renewal-requests/:id/approve  # Approve renewal request
POST /api/renewal-requests/:id/reject   # Reject renewal request
```

### Audit Trail
```
GET /api/audit-trail                # Get audit trail logs
```

### Alerts
```
GET /api/alerts                     # Get system alerts
```

### Email Configuration
```
GET /api/email-config               # Get email configuration
POST /api/email-config              # Set email configuration
POST /api/email-config/test         # Test email configuration
```

### Email Templates
```
GET /api/email-templates            # Get all email templates
PUT /api/email-templates/:id        # Update email template
```

### Manual Email Sending
```
POST /api/send-email                # Send manual email
```

### Notification Events
```
GET /api/notification-events        # Get notification events
POST /api/notification-events       # Create notification event
PUT /api/notification-events/:id    # Update notification event
DELETE /api/notification-events/:id # Delete notification event
```

### Admin Profile
```
GET /api/admin-profile              # Get admin profile
PUT /api/admin-profile              # Update admin profile
```

### App Subscription Schemas
```
GET /api/app-subscription-schemas   # Get all schemas
POST /api/app-subscription-schemas  # Create schema
PUT /api/app-subscription-schemas/:id # Update schema
DELETE /api/app-subscription-schemas/:id # Delete schema
```

### Report Generation
```
POST /api/generate-report           # Generate CSV report
```

## Testing and Development

### API Testing Interface
The system includes a built-in API testing interface accessible at:
```
https://44853c54-3cec-4694-af17-d60bd826961c-00-2iidd83wsan4s.spock.replit.dev/api-testing
```

### Test Headers
For testing the validate-license endpoint with domain override:
```
x-test-domain-override: your-test-domain.com
```

## Response Formats

### Success Response (200)
```json
{
  "status": "success",
  "data": { ... },
  "message": "Operation completed successfully"
}
```

### Error Response (400/404/500)
```json
{
  "status": "error",
  "message": "Error description",
  "details": { ... }
}
```

### License Validation Success
```json
{
  "status": "Valid",
  "message": "License is valid and verified",
  "validated_at": "2025-07-11T15:30:33.899Z",
  "expires_at": "2026-07-11T15:30:33.899Z"
}
```

## Security Notes

1. **HTTPS Only**: All API calls must use HTTPS
2. **Checksum Validation**: Client APIs require HMAC-SHA256 checksums
3. **Session Authentication**: Admin endpoints require session-based authentication
4. **Rate Limiting**: Consider implementing rate limiting for production use
5. **Domain Validation**: License validation includes domain checking

## Common HTTP Status Codes

- **200**: Success
- **201**: Created successfully
- **400**: Bad request (validation error)
- **401**: Unauthorized (authentication required)
- **403**: Forbidden (insufficient permissions)
- **404**: Not found
- **500**: Internal server error

## Usage Examples

### cURL Examples

**License Validation:**
```bash
curl -X POST https://44853c54-3cec-4694-af17-d60bd826961c-00-2iidd83wsan4s.spock.replit.dev/api/validate-license \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "efe2ae66-b484-4923-9e28-5f04df532c0e",
    "app_id": "a17ba122-e7db-4568-8928-9f749f65e1fe",
    "license_key": "ABC-DEF-GHI-JKL",
    "checksum": "your_calculated_checksum",
    "domain": "yourapp.com"
  }'
```

**License Acquisition:**
```bash
curl -X POST https://44853c54-3cec-4694-af17-d60bd826961c-00-2iidd83wsan4s.spock.replit.dev/api/acquire-license \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "efe2ae66-b484-4923-9e28-5f04df532c0e",
    "app_id": "a17ba122-e7db-4568-8928-9f749f65e1fe",
    "base_url": "https://yourapp.com"
  }'
```

---

**Last Updated**: July 11, 2025  
**Version**: 1.0  
**Base URL**: https://44853c54-3cec-4694-af17-d60bd826961c-00-2iidd83wsan4s.spock.replit.dev