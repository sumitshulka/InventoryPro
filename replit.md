# Inventory Management System

## Overview

A comprehensive inventory management system built with React (frontend) and Express.js (backend), featuring role-based access control, warehouse management, and real-time inventory tracking. The system supports multiple user roles including administrators, managers, warehouse operators, and employees with varying levels of access and functionality.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query (React Query) for server state management
- **UI Components**: Custom components built with Radix UI primitives and Tailwind CSS
- **Form Handling**: React Hook Form with Zod validation
- **Build Tool**: Vite for development and production builds

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Passport.js with local strategy and session-based auth
- **Session Management**: PostgreSQL session store with express-session
- **API Design**: RESTful API architecture

### Database Design
- **ORM**: Drizzle ORM for type-safe database interactions
- **Schema**: Comprehensive schema covering users, departments, warehouses, items, inventory, transactions, transfers, and audit logs
- **Migrations**: Version-controlled database migrations in `/migrations`

## Key Components

### Authentication & Authorization
- **Session-based authentication** using Passport.js
- **Role-based access control** with four user roles:
  - Admin: Full system access
  - Manager: Department and warehouse management
  - Warehouse Operator: Inventory operations
  - Employee: Request submission only
- **Password hashing** using MD5 with salt (upgradeable)
- **Password reset** functionality with email tokens

### Inventory Management
- **Multi-warehouse support** with location tracking
- **Item master data** with categories and SKU management
- **Real-time inventory tracking** across warehouses
- **Stock level monitoring** with low stock alerts
- **Disposal tracking** for rejected and disposed items

### Request & Approval System
- **Request workflow** for inventory items
- **Configurable approval settings** based on request type and amount
- **Multi-level approval process** with status tracking
- **Transfer notifications** for inter-warehouse transfers

### Reporting & Analytics
- **Stock reports** with filtering and export capabilities
- **Movement reports** tracking all inventory transactions
- **Valuation reports** showing inventory worth
- **Analytics dashboard** with fastest-moving items and trends
- **Audit trail** for all system activities

### User Interface
- **Responsive design** using Tailwind CSS
- **Professional theme** with consistent styling
- **Data tables** with pagination, sorting, and filtering
- **Modal dialogs** for forms and confirmations
- **Toast notifications** for user feedback

## Data Flow

### Request Processing Flow
1. Employee submits item request
2. System checks approval requirements
3. Request routed to appropriate approver(s)
4. Upon approval, system checks inventory availability
5. If unavailable, transfer notification created
6. Warehouse operator processes transfer/fulfillment
7. Transaction recorded and inventory updated

### Inventory Update Flow
1. Check-in creates inbound transaction
2. Transfer moves inventory between warehouses
3. Issue/disposal creates outbound transaction
4. All transactions update inventory quantities
5. Audit logs track all changes

### Authentication Flow
1. User submits credentials
2. Passport.js validates against database
3. Session created and stored in PostgreSQL
4. Frontend receives user data
5. Subsequent requests include session cookie

## External Dependencies

### Frontend Dependencies
- **@tanstack/react-query**: Server state management
- **@radix-ui/***: Headless UI components
- **react-hook-form**: Form handling
- **zod**: Schema validation
- **tailwindcss**: Styling framework
- **wouter**: Lightweight routing
- **lucide-react**: Icon library

### Backend Dependencies
- **express**: Web framework
- **drizzle-orm**: Database ORM
- **passport**: Authentication middleware
- **express-session**: Session management
- **connect-pg-simple**: PostgreSQL session store
- **nodemailer**: Email functionality
- **pdfkit**: PDF generation
- **pg**: PostgreSQL client

### Database
- **PostgreSQL 16**: Primary database
- **Connection pooling** for performance
- **Session storage** in database

## Deployment Strategy

### Environment Configuration
- **Development**: Uses local PostgreSQL with hot reload
- **Production**: Configured for cloud deployment with environment variables
- **Build Process**: Vite builds frontend, esbuild bundles backend

### Replit Configuration
- **Modules**: Node.js 20, Web, PostgreSQL 16
- **Auto-scaling**: Configured for automatic scaling
- **Port mapping**: 5000 (internal) → 80 (external)
- **Workflows**: Automated build and start processes

### Database Management
- **Migrations**: Automated via drizzle-kit
- **Schema synchronization**: Push-based deployment
- **Connection management**: Pool-based with error handling

### Multi-Currency Support
- **Client-level currency**: Clients can have a specific currency assigned (USD, EUR, GBP, INR, etc.) or default to organization currency
- **Sales order currency tracking**: Each sales order stores its currency code, conversion rate, and base currency amounts
- **Dual-currency display**: When order currency differs from organization currency, shows both original and converted base amounts
- **Conversion rate audit trail**: Stores conversion rate at time of order creation to prevent retroactive rate drift

## Changelog

- June 16, 2025. Initial setup
- July 11, 2025. Implemented comprehensive license management system with external license manager integration, HMAC-SHA256 checksum validation, and user limit enforcement
- July 11, 2025. Fixed license acquisition flow with proper JSON response validation, debug panel for troubleshooting, and improved license status checking. Added comprehensive logging for license validation process. Updated API endpoints to use /api/validate-license format as per external license manager specification.
- July 11, 2025. Resolved critical checksum calculation bug by fixing mutual key storage (was storing checksum instead of actual mutual_key from response). Updated license acquisition to properly extract mutual_key field from external license manager response. Implemented validation response parsing to handle {"status": "Valid"} format. Added request deduplication with 30-second caching to prevent multiple simultaneous validation calls to external license server.
- December 8, 2025. Added multi-currency support for sales orders: client-level currency field, order-level currency/conversion rate tracking, base currency calculations, and dual-currency display in order details and list views.
- December 8, 2025. Added Delivery Challan feature for dispatched items: PDF generation with company header, consignee details, transport info, itemized table, and signature blocks. Users can download PDF or email it with custom message using configured email provider.

## User Preferences

Preferred communication style: Simple, everyday language.