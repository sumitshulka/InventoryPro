import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Search, 
  BookOpen, 
  Settings, 
  Package, 
  Warehouse, 
  Users, 
  FileText, 
  BarChart3,
  HelpCircle,
  ArrowRight,
  ExternalLink,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  X,
  ArrowLeft
} from "lucide-react";

interface HelpSystemProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface HelpArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: any;
  action: string;
  category: string;
}

const helpArticles: HelpArticle[] = [
  {
    id: "getting-started",
    title: "Getting Started with Inventory Management",
    content: `Welcome to the comprehensive inventory management system! This guide will help you navigate through all the features and capabilities.

**System Overview**
This system provides complete inventory tracking across multiple warehouses with advanced features including real-time notifications, barcode scanning, price tracking, and comprehensive analytics.

**Key Features:**
- Multi-warehouse inventory management
- Real-time stock tracking with barcode scanning
- Advanced price variation analysis
- Transfer workflows with approval processes
- Comprehensive reporting and analytics
- Role-based access control
- Email notifications and alerts

**Getting Started Steps:**
1. Set up your warehouses and locations
2. Configure user roles and permissions
3. Add your inventory items with categories
4. Set up suppliers and pricing information
5. Begin tracking transactions and movements

The dashboard provides an overview of all critical metrics including stock levels, pending approvals, recent transactions, and warehouse performance.`,
    category: "getting-started",
    tags: ["basics", "overview", "setup"],
    difficulty: "beginner"
  },
  {
    id: "inventory-management",
    title: "Advanced Inventory Operations",
    content: `Master the complete inventory lifecycle with advanced tracking and management features.

**Inventory Tracking**
Track every item movement with detailed transaction history, including stock adjustments, transfers, and disposals. Each item maintains comprehensive records of price variations and supplier information.

**Barcode Integration**
Use barcode scanning for quick item identification and processing. The system supports standard barcode formats and integrates with mobile devices for warehouse operations.

**Stock Management Features:**
- Real-time stock level monitoring
- Automated low-stock alerts
- Batch and serial number tracking
- Expiration date management
- Multi-location inventory tracking

**Price Tracking**
Monitor price variations across suppliers and time periods. Track cost fluctuations and analyze purchasing patterns to optimize procurement decisions.

**Quality Control:**
- Incoming goods inspection
- Rejected goods management
- Return processing workflows
- Disposal tracking and compliance`,
    category: "inventory",
    tags: ["tracking", "barcode", "stock", "pricing"],
    difficulty: "intermediate"
  },
  {
    id: "transfer-management",
    title: "Transfer Workflows and Inter-Warehouse Operations",
    content: `Manage complex transfer operations between warehouses with comprehensive approval workflows.

**Transfer Types**
Handle various transfer scenarios including regular transfers, emergency shipments, and return processes. Each transfer maintains complete audit trails and status tracking.

**Workflow Management:**
- Create transfer requests with detailed item specifications
- Multi-level approval processes for different transfer values
- Real-time status tracking and notifications
- Automatic inventory updates upon completion

**Transfer Statuses:**
- Pending: Awaiting approval
- Approved: Ready for shipment
- In Transit: Currently being transported
- Delivered: Received at destination
- Completed: Fully processed and inventoried

**Special Processes:**
- Emergency transfers for urgent requirements
- Rejected goods handling and return processing
- Transfer cancellations and modifications
- Bulk transfer operations

**Notifications:**
Automated email and system notifications keep all stakeholders informed of transfer status changes, delivery confirmations, and any issues requiring attention.`,
    category: "transfers",
    tags: ["workflows", "approvals", "shipping", "notifications"],
    difficulty: "advanced"
  },
  {
    id: "analytics-reporting",
    title: "Comprehensive Analytics and Reporting",
    content: `Leverage powerful analytics tools to gain insights into inventory performance and operational efficiency.

**Available Reports:**
- Inventory Valuation Reports with real-time pricing
- Stock Movement Analysis across all locations
- Low Stock Alerts and Reorder Recommendations
- Disposed Inventory Tracking and Compliance
- Transfer Performance Metrics
- Supplier Performance Analysis

**Advanced Analytics:**
- Price trend analysis and forecasting
- Demand pattern recognition
- Seasonal inventory planning
- Cost optimization recommendations
- Performance benchmarking across warehouses

**Real-time Dashboards:**
Monitor key performance indicators with live data updates, including inventory turnover rates, stock accuracy, and operational efficiency metrics.

**Custom Reports:**
Create tailored reports for specific business requirements, with filtering options for date ranges, warehouses, categories, and suppliers.

**Data Export:**
Export reports in multiple formats (PDF, Excel, CSV) for further analysis or compliance documentation.`,
    category: "analytics",
    tags: ["reports", "insights", "performance", "trends"],
    difficulty: "intermediate"
  },
  {
    id: "issue-tracking",
    title: "Issue Management and Resolution",
    content: `Efficiently track and resolve inventory-related issues with comprehensive issue management tools.

**Issue Categories:**
- Stock Discrepancies: Handle count variations and adjustments
- Quality Issues: Track defective items and quality problems
- System Issues: Technical problems and resolution tracking
- Process Issues: Workflow improvements and process optimization

**Issue Lifecycle:**
1. Issue Creation: Log problems with detailed descriptions
2. Assignment: Route to appropriate team members
3. Investigation: Research and analysis phase
4. Resolution: Implement fixes and solutions
5. Verification: Confirm resolution effectiveness
6. Closure: Complete documentation and lessons learned

**Priority Levels:**
- Critical: Immediate attention required
- High: Resolve within 24 hours
- Medium: Standard resolution timeframe
- Low: Address when resources available

**Collaboration Features:**
- Comment threads for team communication
- File attachments for documentation
- Status updates and progress tracking
- Notification system for stakeholders

**Resolution Tracking:**
Monitor resolution times, identify recurring issues, and implement preventive measures to improve overall system reliability.`,
    category: "issues",
    tags: ["problems", "resolution", "tracking", "quality"],
    difficulty: "intermediate"
  },
  {
    id: "check-in-procedures",
    title: "Goods Receipt and Check-in Procedures",
    content: `Streamline receiving operations with comprehensive check-in procedures and quality controls.

**Receiving Process:**
1. Purchase Order Verification: Confirm delivery against PO
2. Physical Inspection: Check quantities and condition
3. Quality Assessment: Verify item specifications
4. System Entry: Record receipt in inventory system
5. Location Assignment: Store items in designated areas

**Documentation Requirements:**
- Delivery challans and shipping documents
- Purchase order references
- Quality inspection reports
- Supplier certification documents
- Receiving acknowledgments

**Quality Control Checks:**
- Visual inspection for damage
- Quantity verification against orders
- Specification compliance checking
- Expiration date validation
- Packaging integrity assessment

**Discrepancy Handling:**
Process for managing delivery discrepancies including short shipments, damaged goods, and specification mismatches. Automated notifications to procurement teams for resolution.

**Integration Features:**
- Barcode scanning for quick processing
- Mobile device compatibility
- Real-time inventory updates
- Automatic supplier notifications
- Purchase order closure workflows`,
    category: "receiving",
    tags: ["receipt", "quality", "procedures", "documentation"],
    difficulty: "beginner"
  },
  {
    id: "security-access",
    title: "Security, Access Control, and User Management",
    content: `Maintain system security with comprehensive user management and access control features.

**User Roles:**
- Admin: Full system access and configuration
- Manager: Department-level management and reporting
- Warehouse Operator: Location-specific operations
- Employee: Basic transaction and request capabilities
- Viewer: Read-only access to designated areas

**Permission Management:**
Granular permission controls for different system functions including inventory viewing, transaction processing, approval authorities, and report access.

**Security Features:**
- Multi-factor authentication support
- Session management and timeout controls
- Password complexity requirements
- Access logging and audit trails
- IP-based access restrictions

**Data Protection:**
- Encrypted data transmission
- Secure password storage
- Regular security updates
- Backup and recovery procedures
- Compliance with data protection regulations

**Audit Capabilities:**
Comprehensive audit logs track all user activities, system changes, and data modifications for compliance and security monitoring.

**Account Management:**
- User provisioning and deprovisioning
- Role assignment and modification
- Access review and certification
- Temporary access grants
- Emergency access procedures`,
    category: "security",
    tags: ["access", "permissions", "audit", "compliance"],
    difficulty: "advanced"
  },
  {
    id: "email-notifications",
    title: "Email Notifications and Communication",
    content: `Configure and manage email notifications to keep teams informed of critical inventory events.

**Notification Types:**
- Low stock alerts for proactive reordering
- Transfer status updates and approvals
- Quality issue notifications
- System maintenance announcements
- Performance report summaries

**Configuration Options:**
- Recipient lists for different notification types
- Frequency settings (immediate, daily, weekly)
- Threshold configurations for alerts
- Custom message templates
- Escalation procedures for critical alerts

**Email Settings:**
Configure SMTP servers, authentication credentials, and delivery options. Support for multiple email providers and backup delivery methods.

**Notification Preferences:**
Users can customize their notification preferences including:
- Notification types to receive
- Delivery frequency
- Email vs. system notifications
- Mobile push notification settings

**Template Management:**
Create and customize email templates for different notification types with dynamic content insertion and branding options.

**Delivery Tracking:**
Monitor email delivery status, bounce handling, and notification effectiveness with detailed reporting and analytics.`,
    category: "notifications",
    tags: ["email", "alerts", "communication", "settings"],
    difficulty: "intermediate"
  },
  {
    id: "user-management",
    title: "User Management and Administration",
    content: `Comprehensive user management system for controlling access and managing team members across the inventory system.

**User Creation and Setup:**
- Add new users with complete profile information
- Assign appropriate roles based on job responsibilities
- Set warehouse and department associations
- Configure initial passwords and security settings
- Enable or disable user accounts as needed

**User Roles and Permissions:**
- Admin: Full system access including user management and system configuration
- Manager: Department-level oversight with reporting and approval capabilities
- Warehouse Operator: Location-specific inventory operations and transactions
- Employee: Basic inventory requests and transaction viewing
- Viewer: Read-only access to designated inventory information

**User Profile Management:**
- Update contact information and personal details
- Modify role assignments and permissions
- Change warehouse and department associations
- Reset passwords and manage authentication settings
- Track user activity and last login information

**Bulk Operations:**
- Import users from CSV or Excel files
- Bulk role assignments and updates
- Mass password resets for security purposes
- Batch user activation or deactivation
- Export user lists for compliance reporting

**Access Control Features:**
- Warehouse-specific access restrictions
- Department-based permission inheritance
- Temporary access grants for contractors
- Manager hierarchies and reporting structures
- Emergency access procedures for critical situations

**User Activity Monitoring:**
Track user login patterns, transaction history, and system usage for security and compliance purposes.`,
    category: "administration",
    tags: ["users", "permissions", "roles", "access"],
    difficulty: "intermediate"
  },
  {
    id: "audit-trail",
    title: "Audit Trail and Activity Logging",
    content: `Comprehensive audit trail system for tracking all system activities, changes, and transactions for compliance and security monitoring.

**Audit Log Coverage:**
- All user login and logout activities
- Inventory transactions and stock movements
- System configuration changes
- User management actions and role modifications
- Data exports and report generation
- Failed login attempts and security events

**Detailed Activity Tracking:**
- User identification and IP address logging
- Timestamp recording with timezone information
- Before and after values for all data changes
- Transaction reference numbers and batch operations
- Integration with external system activities
- Mobile and web access differentiation

**Audit Search and Filtering:**
- Search by user, date range, or activity type
- Filter by warehouse, department, or transaction type
- Advanced queries for compliance reporting
- Export filtered results for external analysis
- Real-time monitoring dashboards
- Automated anomaly detection and alerts

**Compliance Features:**
- Immutable audit log storage
- Digital signatures for critical transactions
- Regulatory compliance reporting templates
- Data retention policy enforcement
- Automatic backup and archival processes
- Integration with external compliance systems

**Security Monitoring:**
- Failed access attempt tracking
- Unusual activity pattern detection
- Privilege escalation monitoring
- Data access pattern analysis
- Integration with security information systems
- Real-time alert generation for suspicious activities

**Reporting and Analytics:**
Generate comprehensive audit reports for internal reviews, external audits, and regulatory compliance requirements.`,
    category: "administration",
    tags: ["audit", "compliance", "logging", "security"],
    difficulty: "advanced"
  },
  {
    id: "system-settings",
    title: "System Settings and Configuration",
    content: `Complete system configuration management for customizing the inventory management system to meet organizational requirements.

**Organization Settings:**
- Company name and branding configuration
- Currency settings and exchange rate management
- Time zone and regional format preferences
- Business rules and workflow customization
- Default values and system behaviors
- Integration with corporate identity systems

**Inventory Configuration:**
- Item numbering schemes and SKU formats
- Category and classification hierarchies
- Unit of measure definitions and conversions
- Pricing structures and cost calculation methods
- Stock level thresholds and reorder points
- Barcode format specifications and printing

**Warehouse Settings:**
- Location hierarchies and naming conventions
- Storage capacity configurations
- Picking and packing workflow rules
- Temperature and environmental monitoring
- Security access controls per location
- Integration with warehouse management systems

**Workflow Customization:**
- Approval process definitions and routing
- Transfer workflow configurations
- Request processing rules and timelines
- Notification trigger conditions
- Escalation procedures and timeouts
- Custom fields and data collection forms

**Integration Settings:**
- API endpoint configurations
- Third-party system connections
- Data synchronization schedules
- Authentication and security protocols
- Error handling and retry mechanisms
- Performance monitoring and optimization

**System Maintenance:**
- Database optimization and cleanup procedures
- Backup and recovery configurations
- Performance monitoring and alerting
- Security patch management
- User session management
- System health monitoring dashboards

**Customization Options:**
Configure dashboard layouts, report templates, and user interface preferences to match organizational needs.`,
    category: "administration",
    tags: ["configuration", "settings", "customization", "integration"],
    difficulty: "advanced"
  },
  {
    id: "department-management",
    title: "Department Management and Organization",
    content: `Comprehensive department management system for organizing users, inventory, and workflows across different organizational units.

**Department Structure:**
- Create hierarchical department structures
- Define department codes and naming conventions
- Set up parent-child relationships between departments
- Configure cost centers and budget allocations
- Establish reporting hierarchies and management chains
- Map departments to physical locations and warehouses

**Department Configuration:**
- Assign department managers and supervisors
- Define department-specific workflows and procedures
- Set up approval hierarchies for requests and transfers
- Configure budget limits and spending authorities
- Establish inventory allocation rules per department
- Create department-specific item catalogs and restrictions

**User Assignment:**
- Assign users to primary and secondary departments
- Configure cross-departmental access permissions
- Set up temporary department assignments
- Manage department transfer procedures for users
- Define manager and supervisor relationships
- Control department-based data visibility

**Inventory Allocation:**
- Department-specific inventory budgets and limits
- Allocation rules for shared inventory items
- Department cost center assignment for transactions
- Transfer approval requirements between departments
- Department-specific pricing and discount structures
- Inventory reservation and allocation tracking

**Reporting and Analytics:**
- Department-wise inventory consumption reports
- Cost analysis and budget utilization tracking
- Department performance metrics and KPIs
- Cross-departmental transfer analysis
- Manager dashboards with department insights
- Compliance reporting for departmental activities

**Workflow Integration:**
- Department-based request routing and approvals
- Automated escalation to department managers
- Department-specific notification preferences
- Integration with HR systems for organizational updates
- Department budget controls and spending limits
- Custom workflow rules per department type

**Access Control:**
Configure department-based permissions ensuring users only access inventory and functions relevant to their departmental responsibilities.`,
    category: "administration",
    tags: ["departments", "organization", "hierarchy", "management"],
    difficulty: "intermediate"
  },
  {
    id: "approval-workflows",
    title: "Approval Workflows and Request Management",
    content: `Comprehensive approval system for managing inventory requests, transfers, and other business processes requiring authorization.

**Approval Types:**
- Inventory request approvals for item procurement
- Transfer approvals for inter-warehouse movements
- Purchase order approvals for supplier transactions
- Budget approval workflows for cost management
- User access approvals for system permissions
- Disposal approvals for inventory write-offs

**Workflow Configuration:**
- Multi-level approval hierarchies with escalation rules
- Conditional approval routing based on request values
- Department-specific approval chains and authorities
- Time-based escalation and automatic routing
- Parallel and sequential approval processing
- Emergency override procedures for urgent requests

**Approval Dashboard:**
- Centralized view of all pending approvals
- Priority-based request sorting and filtering
- Bulk approval capabilities for routine requests
- Approval history and audit trail tracking
- Performance metrics and processing time analysis
- Mobile-friendly interface for remote approvals

**Request Management:**
- Request creation with detailed specifications
- Attachment support for supporting documentation
- Comment threads for approval communication
- Status tracking and real-time updates
- Automatic notifications for all stakeholders
- Integration with procurement and inventory systems

**Approval Rules and Policies:**
- Value-based approval thresholds and limits
- Category-specific approval requirements
- Vendor-specific approval workflows
- Geographic location-based routing rules
- Time-sensitive approval processing
- Compliance-driven approval documentation

**Reporting and Analytics:**
- Approval processing time and bottleneck analysis
- Approval rate statistics and trends
- User performance metrics for approvers
- Request volume analysis and forecasting
- Compliance reporting for audit purposes
- Cost impact analysis of approved requests

**Integration Features:**
Seamless integration with inventory, procurement, and financial systems for complete request-to-fulfillment workflows.`,
    category: "approvals",
    tags: ["workflows", "requests", "authorization", "management"],
    difficulty: "intermediate"
  },
  {
    id: "notification-system",
    title: "Notification System and Alert Management",
    content: `Comprehensive notification system for keeping users informed of critical inventory events, system updates, and workflow changes.

**Notification Categories:**
- Inventory alerts for stock levels and reorder points
- Transfer notifications for shipment status updates
- Approval notifications for pending and completed requests
- System maintenance and security alerts
- Performance notifications for KPI thresholds
- User activity notifications for account changes

**Delivery Channels:**
- In-system notifications with priority indicators
- Email notifications with customizable templates
- SMS alerts for critical and urgent notifications
- Mobile push notifications for real-time updates
- Dashboard widgets and notification centers
- Integration with external communication platforms

**Notification Preferences:**
- User-specific notification settings and preferences
- Frequency controls for different notification types
- Quiet hours and do-not-disturb settings
- Role-based default notification configurations
- Department-specific notification routing
- Emergency notification override capabilities

**Alert Rules and Triggers:**
- Threshold-based alerts for inventory levels
- Time-based notifications for pending actions
- Event-driven notifications for system changes
- Conditional alerts based on business rules
- Escalation notifications for overdue items
- Batch processing for high-volume notifications

**Template Management:**
- Customizable email and SMS templates
- Dynamic content insertion with system data
- Multi-language template support
- Brand-consistent notification formatting
- Template versioning and approval workflows
- A/B testing for notification effectiveness

**Notification Analytics:**
- Delivery rate monitoring and troubleshooting
- User engagement metrics and click-through rates
- Response time analysis for critical notifications
- Notification volume trends and optimization
- System performance impact assessment
- User feedback collection and satisfaction tracking

**Administrative Controls:**
- Global notification settings and policies
- User permission management for notification access
- Notification archival and retention policies
- Integration with external monitoring systems
- Compliance logging for regulatory requirements
- Performance optimization and scaling configurations

**Mobile and Remote Access:**
Ensure critical notifications reach users regardless of location with mobile-optimized delivery and offline notification queuing.`,
    category: "notifications",
    tags: ["alerts", "communication", "messaging", "monitoring"],
    difficulty: "intermediate"
  },
  {
    id: "troubleshooting-guide",
    title: "Troubleshooting and Problem Resolution",
    content: `Comprehensive troubleshooting guide for resolving common issues and maintaining optimal system performance.

**Common Issues and Solutions:**

**Login and Access Problems:**
- Password reset procedures and account recovery
- Browser compatibility issues and recommended settings
- Network connectivity troubleshooting
- Session timeout and authentication problems
- Role-based access permission issues
- Multi-factor authentication setup and problems

**Inventory Data Issues:**
- Stock discrepancies and reconciliation procedures
- Barcode scanning problems and device configuration
- Data synchronization issues between systems
- Transaction processing errors and recovery
- Price update failures and correction methods
- Category and classification data inconsistencies

**Transfer and Workflow Problems:**
- Transfer approval delays and escalation procedures
- Shipment tracking and status update issues
- Rejected goods processing and return workflows
- Approval workflow stuck or frozen processes
- Notification delivery failures and resending
- Integration failures with external systems

**Performance and System Issues:**
- Slow page loading and performance optimization
- Database connection problems and recovery
- Report generation timeouts and alternatives
- Search functionality problems and indexing
- Mobile app synchronization issues
- Backup and recovery procedures

**Data Export and Import Problems:**
- CSV/Excel file format requirements and validation
- Bulk upload failures and error correction
- Report generation errors and troubleshooting
- Data mapping issues during imports
- Character encoding and special character problems
- File size limitations and workaround solutions

**Integration and API Issues:**
- Third-party system connection failures
- API authentication and permission problems
- Data mapping and transformation errors
- Webhook configuration and testing
- Real-time synchronization delays
- Error logging and diagnostic procedures

**Diagnostic Tools:**
- System health monitoring dashboards
- Error log analysis and interpretation
- Performance monitoring and bottleneck identification
- User activity tracking for issue reproduction
- Database query optimization tools
- Network connectivity testing utilities

**Escalation Procedures:**
- Internal IT support contact information
- Vendor support escalation processes
- Emergency contact procedures for critical issues
- Documentation requirements for support tickets
- Remote assistance setup and security protocols
- Known issue tracking and status updates

**Preventive Maintenance:**
Regular system maintenance schedules, backup verification, and proactive monitoring to prevent common issues before they impact operations.`,
    category: "troubleshooting",
    tags: ["problems", "solutions", "support", "maintenance"],
    difficulty: "beginner"
  }
];

const quickActions: QuickAction[] = [
  {
    id: "view-inventory",
    title: "View Inventory",
    description: "Browse all inventory items with search and filtering",
    icon: Package,
    action: "/inventory",
    category: "inventory"
  },
  {
    id: "create-transfer",
    title: "Create Transfer",
    description: "Initiate a new inventory transfer between warehouses",
    icon: Warehouse,
    action: "/transfers",
    category: "transfers"
  },
  {
    id: "process-requests",
    title: "Process Requests",
    description: "Review and approve pending inventory requests",
    icon: FileText,
    action: "/requests",
    category: "approvals"
  },
  {
    id: "check-in-goods",
    title: "Check-in Goods",
    description: "Process incoming inventory and deliveries",
    icon: Package,
    action: "/check-in",
    category: "receiving"
  },
  {
    id: "view-analytics",
    title: "View Analytics",
    description: "Access comprehensive reports and analytics",
    icon: BarChart3,
    action: "/analytics-report",
    category: "analytics"
  },
  {
    id: "manage-users",
    title: "Manage Users",
    description: "User administration and access control",
    icon: Users,
    action: "/users-management",
    category: "administration"
  },
  {
    id: "track-issues",
    title: "Track Issues",
    description: "Monitor and resolve inventory issues",
    icon: Settings,
    action: "/issues",
    category: "issues"
  },
  {
    id: "manage-warehouses",
    title: "Manage Warehouses",
    description: "Configure warehouse settings and locations",
    icon: Warehouse,
    action: "/warehouses",
    category: "administration"
  },
  {
    id: "approval-management",
    title: "Approval Management",
    description: "Handle pending approvals and workflows",
    icon: FileText,
    action: "/approval-management",
    category: "approvals"
  },
  {
    id: "system-settings",
    title: "System Settings",
    description: "Configure system preferences and options",
    icon: Settings,
    action: "/settings",
    category: "settings"
  }
];

export default function HelpSystem({ open, onOpenChange }: HelpSystemProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedArticle, setSelectedArticle] = useState<HelpArticle | null>(null);
  const [activeTab, setActiveTab] = useState<"topics" | "actions">("topics");
  const [currentPage, setCurrentPage] = useState(1);
  const [currentActionsPage, setCurrentActionsPage] = useState(1);
  const articlesPerPage = 6;
  const actionsPerPage = 6;

  const categories = [
    { id: "all", name: "All Topics", icon: BookOpen },
    { id: "getting-started", name: "Getting Started", icon: HelpCircle },
    { id: "inventory", name: "Inventory", icon: Package },
    { id: "transfers", name: "Transfers", icon: Warehouse },
    { id: "analytics", name: "Analytics", icon: BarChart3 },
    { id: "administration", name: "Administration", icon: Users },
    { id: "receiving", name: "Receiving", icon: FileText },
    { id: "issues", name: "Issues", icon: Settings },
    { id: "approvals", name: "Approvals", icon: FileText },
    { id: "security", name: "Security", icon: Settings },
    { id: "notifications", name: "Notifications", icon: MessageSquare },
    { id: "troubleshooting", name: "Troubleshooting", icon: Settings }
  ];

  const filteredArticles = helpArticles.filter(article => {
    const matchesSearch = searchQuery === "" || 
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = selectedCategory === "all" || article.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const filteredQuickActions = quickActions.filter(action => 
    selectedCategory === "all" || action.category === selectedCategory
  );

  // Pagination calculations
  const totalArticles = filteredArticles.length;
  const totalArticlePages = Math.ceil(totalArticles / articlesPerPage);
  const startArticleIndex = (currentPage - 1) * articlesPerPage;
  const endArticleIndex = startArticleIndex + articlesPerPage;
  const currentArticles = filteredArticles.slice(startArticleIndex, endArticleIndex);

  const totalActions = filteredQuickActions.length;
  const totalActionPages = Math.ceil(totalActions / actionsPerPage);
  const startActionIndex = (currentActionsPage - 1) * actionsPerPage;
  const endActionIndex = startActionIndex + actionsPerPage;
  const currentActions = filteredQuickActions.slice(startActionIndex, endActionIndex);

  // Reset pagination when filters change
  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    setCurrentPage(1);
    setCurrentActionsPage(1);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
    setCurrentActionsPage(1);
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-40"
        onClick={() => onOpenChange(false)}
      />
      
      {/* Slide-out Panel */}
      <div className={`fixed top-0 right-0 h-full w-full sm:w-[600px] md:w-[700px] lg:w-[800px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-gray-50">
          <div className="flex items-center gap-3">
            <HelpCircle className="h-6 w-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold">Help & Documentation</h2>
              <p className="text-sm text-gray-600">Find answers and learn about system features</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Application
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="h-[calc(100vh-120px)] flex">
          
          {/* Sidebar */}
          <div className="w-64 border-r bg-gray-50/50 p-4">
            <div className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search help topics..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Tab Selection */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={activeTab === "topics" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveTab("topics")}
                  className="w-full"
                >
                  <BookOpen className="h-4 w-4 mr-2" />
                  Topics
                </Button>
                <Button
                  variant={activeTab === "actions" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveTab("actions")}
                  className="w-full"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Actions
                </Button>
              </div>

              {/* Categories */}
              <div className="space-y-1">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Categories</h3>
                <ScrollArea className="h-80">
                  {categories.map((category) => {
                    const Icon = category.icon;
                    return (
                      <Button
                        key={category.id}
                        variant={selectedCategory === category.id ? "default" : "ghost"}
                        className="w-full justify-start mb-1"
                        size="sm"
                        onClick={() => {
                          handleCategoryChange(category.id);
                          setSelectedArticle(null);
                        }}
                      >
                        <Icon className="h-4 w-4 mr-2" />
                        {category.name}
                      </Button>
                    );
                  })}
                </ScrollArea>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col">
            
            {selectedArticle ? (
              /* Article View */
              <div className="flex flex-col h-full">
                <div className="p-4 border-b">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedArticle(null)}
                    className="mb-3"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Back to Help Topics
                  </Button>
                  
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
                    <h1 className="text-2xl font-bold">{selectedArticle.title}</h1>
                    <Badge variant={
                      selectedArticle.difficulty === 'beginner' ? 'default' :
                      selectedArticle.difficulty === 'intermediate' ? 'secondary' : 'destructive'
                    }>
                      {selectedArticle.difficulty}
                    </Badge>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {selectedArticle.tags.map(tag => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
                
                <ScrollArea className="flex-1 p-6">
                  <div className="prose prose-sm max-w-none">
                    {selectedArticle.content.split('\n').map((paragraph, index) => {
                      if (paragraph.startsWith('**') && paragraph.endsWith('**')) {
                        return (
                          <h3 key={index} className="text-lg font-semibold mt-6 mb-3 text-blue-600">
                            {paragraph.slice(2, -2)}
                          </h3>
                        );
                      } else if (paragraph.trim() === '') {
                        return <div key={index} className="h-4" />;
                      } else if (paragraph.startsWith('- ')) {
                        return (
                          <li key={index} className="ml-4 mb-1">
                            {paragraph.slice(2)}
                          </li>
                        );
                      } else if (/^\d+\./.test(paragraph)) {
                        return (
                          <li key={index} className="ml-4 mb-1 list-decimal">
                            {paragraph.replace(/^\d+\.\s/, '')}
                          </li>
                        );
                      } else {
                        return (
                          <p key={index} className="mb-3 leading-relaxed">
                            {paragraph}
                          </p>
                        );
                      }
                    })}
                  </div>
                </ScrollArea>
              </div>
            ) : (
              /* List View */
              <div className="flex flex-col h-full">
                <div className="p-4 border-b">
                  <h3 className="text-lg font-semibold">
                    {activeTab === "topics" ? "Help Topics" : "Quick Actions"}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {activeTab === "topics" 
                      ? `${totalArticles} articles available` 
                      : `${totalActions} actions available`
                    }
                  </p>
                </div>

                <ScrollArea className="flex-1 p-4">
                  {activeTab === "topics" ? (
                    <div className="space-y-3">
                      {currentArticles.map((article) => (
                        <Card 
                          key={article.id} 
                          className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-blue-500"
                          onClick={() => setSelectedArticle(article)}
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-lg">{article.title}</CardTitle>
                              <ArrowRight className="h-5 w-5 text-gray-400" />
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="flex items-center gap-2 mb-3">
                              <Badge variant="outline" className="text-xs">
                                {article.category}
                              </Badge>
                              <Badge variant={
                                article.difficulty === 'beginner' ? 'default' :
                                article.difficulty === 'intermediate' ? 'secondary' : 'destructive'
                              } className="text-xs">
                                {article.difficulty}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600 line-clamp-2">
                              {article.content.split('\n')[0]}
                            </p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      {currentActions.map((action) => {
                        const Icon = action.icon;
                        return (
                          <Card key={action.id} className="cursor-pointer hover:shadow-md transition-shadow">
                            <CardHeader>
                              <div className="flex items-center gap-3">
                                <div className="p-3 bg-blue-50 rounded-lg">
                                  <Icon className="h-5 w-5 text-blue-600" />
                                </div>
                                <div className="flex-1">
                                  <CardTitle className="text-base">{action.title}</CardTitle>
                                  <CardDescription>{action.description}</CardDescription>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent>
                              <Button 
                                className="w-full" 
                                onClick={() => {
                                  onOpenChange(false);
                                  window.location.href = action.action;
                                }}
                              >
                                Go to {action.title}
                                <ArrowRight className="h-4 w-4 ml-2" />
                              </Button>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>

                {/* Pagination */}
                {((activeTab === "topics" && totalArticlePages > 1) || (activeTab === "actions" && totalActionPages > 1)) && (
                  <div className="border-t p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-600">
                        {activeTab === "topics" 
                          ? `Showing ${startArticleIndex + 1} to ${Math.min(endArticleIndex, totalArticles)} of ${totalArticles} articles`
                          : `Showing ${startActionIndex + 1} to ${Math.min(endActionIndex, totalActions)} of ${totalActions} actions`
                        }
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (activeTab === "topics") {
                              setCurrentPage(Math.max(1, currentPage - 1));
                            } else {
                              setCurrentActionsPage(Math.max(1, currentActionsPage - 1));
                            }
                          }}
                          disabled={activeTab === "topics" ? currentPage === 1 : currentActionsPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </Button>
                        <span className="text-sm">
                          Page {activeTab === "topics" ? currentPage : currentActionsPage} of {activeTab === "topics" ? totalArticlePages : totalActionPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (activeTab === "topics") {
                              setCurrentPage(Math.min(totalArticlePages, currentPage + 1));
                            } else {
                              setCurrentActionsPage(Math.min(totalActionPages, currentActionsPage + 1));
                            }
                          }}
                          disabled={activeTab === "topics" ? currentPage === totalArticlePages : currentActionsPage === totalActionPages}
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-4 bg-gray-50">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-4">
              <span>Need more help?</span>
              <Button variant="outline" size="sm">
                <MessageSquare className="h-4 w-4 mr-2" />
                Contact Support
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <a 
                href="https://docs.inventoryms.com/privacy-policy" 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:text-blue-600 transition-colors"
              >
                <ExternalLink className="h-3 w-3 inline mr-1" />
                Privacy Policy
              </a>
              <a 
                href="https://docs.inventoryms.com/terms-of-service" 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:text-blue-600 transition-colors"
              >
                <ExternalLink className="h-3 w-3 inline mr-1" />
                Terms of Service
              </a>
              <a 
                href="https://help.inventoryms.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:text-blue-600 transition-colors"
              >
                <ExternalLink className="h-3 w-3 inline mr-1" />
                Help Center
              </a>
              <span className="text-gray-400">|</span>
              <span>Version 2.0.0</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}