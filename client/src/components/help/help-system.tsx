import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  Video,
  MessageSquare
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
    content: `Welcome to your comprehensive inventory management system! This guide will help you get started with the basics.

**First Steps:**
1. Set up your organization settings and currency preferences
2. Create warehouses and locations with detailed address information
3. Add items to your inventory with categories and pricing
4. Configure user roles and permissions
5. Set up email notifications and approval workflows
6. Configure barcode scanning for check-in processes

**Dashboard Overview:**
The dashboard provides a real-time overview of your inventory status with:
- Current stock levels across all warehouses
- Low stock alerts with automated notifications
- Recent transaction history and activities
- Performance metrics and analytics
- Quick access to pending approvals
- Warehouse capacity utilization charts

**Advanced Features Available:**
- Multi-warehouse inventory tracking
- Advanced analytics and reporting
- Issue tracking and resolution system
- Comprehensive notification center
- Audit trail and compliance tracking
- Price tracking and valuation reports
- Disposed inventory management
- Transfer request workflow`,
    category: "getting-started",
    tags: ["basics", "setup", "dashboard", "overview"],
    difficulty: "beginner"
  },
  {
    id: "managing-inventory",
    title: "Advanced Inventory Management",
    content: `Learn how to effectively manage your inventory items, pricing, and stock levels across multiple warehouses.

**Adding New Items:**
1. Navigate to Inventory → Items
2. Click "Add New Item"
3. Fill in complete item details (name, SKU, description, specifications)
4. Set minimum and maximum stock levels
5. Assign categories and units of measurement
6. Configure pricing information and cost tracking
7. Set up reorder points and preferred suppliers

**Multi-Warehouse Stock Management:**
- Track inventory across multiple warehouse locations
- Set warehouse-specific minimum stock levels
- Monitor stock distribution and utilization
- Transfer items between warehouses with full audit trail

**Advanced Stock Operations:**
- Bulk stock adjustments with reason codes
- Cycle counting and physical inventory reconciliation
- Automatic low stock alerts with email notifications
- Stock reservation for pending requests
- Real-time stock level updates across all locations

**Price Tracking and Valuation:**
- Track unit costs and pricing history
- Calculate inventory valuations using FIFO/LIFO methods
- Monitor price variations over time
- Generate cost analysis reports
- Set up price alerts for significant changes

**Barcode Integration:**
- Generate and print barcode labels for items
- Use mobile devices for barcode scanning during check-in
- Quick inventory lookups using barcode scanning
- Streamlined receiving and put-away processes

**Item Categories:**
Organize items using hierarchical categories for better management and reporting.`,
    category: "inventory",
    tags: ["items", "stock", "categories", "pricing", "barcode"],
    difficulty: "intermediate"
  },
  {
    id: "warehouse-management",
    title: "Warehouse and Location Management",
    content: `Set up and manage multiple warehouses and storage locations.

**Creating Warehouses:**
1. Go to Settings → Warehouses
2. Add warehouse details and location
3. Configure storage areas within warehouses
4. Assign managers and operators

**Location Hierarchy:**
- Warehouses contain multiple locations
- Locations can have specific storage types
- Use location codes for quick identification

**Transfer Management:**
Move inventory between warehouses and locations efficiently using the transfer system.`,
    category: "warehouses",
    tags: ["warehouses", "locations", "transfers"],
    difficulty: "intermediate"
  },
  {
    id: "user-roles",
    title: "User Management and Roles",
    content: `Configure user access and permissions for your team.

**User Roles:**
- **Admin:** Full system access and configuration
- **Manager:** Warehouse management and reporting
- **Operator:** Daily operations and transactions
- **Viewer:** Read-only access to reports

**Setting Up Users:**
1. Navigate to Settings → Users
2. Add user details and credentials
3. Assign appropriate role
4. Set warehouse assignments if needed

**Permission Management:**
Each role has specific permissions for different system areas.`,
    category: "users",
    tags: ["users", "roles", "permissions"],
    difficulty: "intermediate"
  },
  {
    id: "requests-approvals",
    title: "Request and Approval System",
    content: `Manage inventory requests and approval workflows.

**Creating Requests:**
1. Go to Requests → New Request
2. Select items and quantities
3. Add justification and priority
4. Submit for approval

**Approval Workflow:**
- Requests route to designated approvers
- Multi-level approval for high-value items
- Email notifications for pending approvals
- Automatic approval for low-value requests

**Request Types:**
- Issue requests (removing from inventory)
- Purchase requests (adding to inventory)
- Transfer requests (moving between locations)`,
    category: "requests",
    tags: ["requests", "approvals", "workflow"],
    difficulty: "intermediate"
  },
  {
    id: "reporting-analytics",
    title: "Reports and Analytics",
    content: `Generate insights from your inventory data.

**Available Reports:**
- Inventory Stock Report: Current stock levels
- Movement Report: Transaction history
- Valuation Report: Inventory value calculations
- Low Stock Report: Items below minimum levels

**Report Features:**
- Export to Excel/PDF
- Schedule automated reports
- Filter by date ranges, warehouses, categories
- Drill-down capabilities

**Analytics Dashboard:**
Monitor key performance indicators and trends over time.`,
    category: "reports",
    tags: ["reports", "analytics", "export"],
    difficulty: "advanced"
  },
  {
    id: "notifications-alerts",
    title: "Notifications and Alerts",
    content: `Stay informed with system notifications and alerts.

**Notification Types:**
- Low stock alerts
- Approval requests
- Transfer notifications
- System announcements

**Managing Notifications:**
1. Click the notification bell in the header
2. View unread notifications
3. Mark as read or archive
4. Reply to notifications when applicable

**Notification Settings:**
Configure which notifications you want to receive via email or in-system alerts.`,
    category: "notifications",
    tags: ["notifications", "alerts", "communication"],
    difficulty: "beginner"
  },
  {
    id: "transfer-management",
    title: "Transfer Request Management",
    content: `Manage complex transfer workflows between warehouses with approval processes.

**Creating Transfer Requests:**
1. Navigate to Transfers → New Transfer Request
2. Select source and destination warehouses
3. Add items and quantities to transfer
4. Set priority level and justification
5. Submit for approval workflow

**Transfer Lifecycle:**
- **Pending:** Awaiting approval from warehouse managers
- **Approved:** Ready for shipment preparation
- **In Transit:** Items being moved between locations
- **Delivered:** Items received at destination
- **Rejected:** Transfer denied with reasons

**Rejected Goods Management:**
- Handle items that don't meet quality standards
- Document rejection reasons and conditions
- Choose disposal or return options
- Track rejected goods separately from main inventory
- Generate reports on rejection patterns

**Transfer Notifications:**
- Automatic notifications to warehouse managers
- Real-time status updates for all stakeholders
- Email alerts for urgent transfers
- Mobile notifications for warehouse operators`,
    category: "transfers",
    tags: ["transfers", "warehouses", "approval", "rejected-goods"],
    difficulty: "advanced"
  },
  {
    id: "analytics-reporting",
    title: "Advanced Analytics & Reporting",
    content: `Leverage comprehensive analytics and reporting capabilities for data-driven decisions.

**Available Reports:**
- **Inventory Valuation Report:** Real-time asset valuation with price tracking
- **Movement Report:** Detailed transaction history with filtering
- **Low Stock Report:** Items below minimum thresholds
- **Disposed Inventory Report:** Track waste and disposal costs
- **Price Variation Analysis:** Monitor cost fluctuations over time
- **Warehouse Utilization:** Capacity and efficiency metrics

**Analytics Dashboard:**
- Interactive charts and graphs
- Trend analysis over multiple time periods
- Drill-down capabilities for detailed insights
- Customizable dashboard widgets
- Real-time data updates

**Export Capabilities:**
- Excel exports with formatting
- PDF reports for presentations
- Scheduled automated reports via email
- API access for external systems integration

**Price Tracking Features:**
- Historical price charts
- Cost variance analysis
- Profit margin calculations
- Supplier price comparison
- Alert system for significant price changes`,
    category: "analytics",
    tags: ["reports", "analytics", "pricing", "trends", "export"],
    difficulty: "advanced"
  },
  {
    id: "issues-communication",
    title: "Issue Tracking & Communication Center",
    content: `Comprehensive system for managing issues and internal communication.

**Issue Management:**
- **Create Issues:** Report problems with detailed descriptions
- **Priority Levels:** Critical, High, Medium, Low prioritization
- **Category System:** Equipment, Safety, Inventory, Maintenance
- **Assignment Workflow:** Route issues to appropriate personnel
- **Resolution Tracking:** Monitor progress and closure

**Issue Lifecycle:**
1. **Open:** New issue reported
2. **In Progress:** Assigned and being worked on
3. **Resolved:** Solution implemented
4. **Closed:** Verified and archived
5. **Reopened:** If issue resurfaces

**Communication Features:**
- **Notification Center:** Centralized message hub
- **Direct Messaging:** Send targeted communications
- **Broadcast Messages:** System-wide announcements
- **Email Integration:** Automatic email notifications
- **Mobile Alerts:** Push notifications for urgent matters

**Notification Types:**
- Low stock alerts
- Approval requests
- Transfer status updates
- Issue assignments
- System maintenance notices
- Custom user messages`,
    category: "communication",
    tags: ["issues", "notifications", "messaging", "alerts"],
    difficulty: "intermediate"
  },
  {
    id: "check-in-barcode",
    title: "Check-in & Barcode Scanning",
    content: `Streamline receiving processes with mobile barcode scanning and check-in workflows.

**Barcode Scanning Setup:**
1. Enable barcode scanning in system settings
2. Generate barcode labels for all inventory items
3. Configure mobile devices for scanning
4. Train staff on scanning procedures

**Check-in Process:**
1. Navigate to Check-in page
2. Scan item barcodes using mobile device
3. Verify item details and quantities
4. Record condition and quality notes
5. Assign to warehouse locations
6. Complete check-in with digital signature

**Mobile Features:**
- Camera-based barcode scanning
- Offline capability for remote locations
- Bulk scanning for multiple items
- Photo capture for condition documentation
- GPS location tracking for verification

**Quality Control:**
- Document item condition upon receipt
- Flag damaged or defective items
- Route problem items to quality review
- Generate quality reports and trends
- Integration with supplier performance tracking`,
    category: "operations",
    tags: ["check-in", "barcode", "mobile", "quality", "receiving"],
    difficulty: "intermediate"
  },
  {
    id: "user-management-advanced",
    title: "Advanced User Management & Security",
    content: `Comprehensive user management with role-based security and audit trails.

**User Roles & Permissions:**
- **System Admin:** Full system access and configuration
- **Manager:** Multi-warehouse oversight and reporting
- **Warehouse Manager:** Single warehouse operations
- **Operator:** Daily transactions and inventory tasks
- **Viewer:** Read-only access to reports and data
- **Quality Inspector:** Quality control and check-in processes

**Advanced Security Features:**
- Role-based access control (RBAC)
- Warehouse-specific permissions
- Time-based access restrictions
- IP address restrictions
- Two-factor authentication support
- Password complexity requirements

**User Activity Monitoring:**
- Complete audit trail of all user actions
- Login/logout tracking
- Transaction history per user
- Permission change logs
- Failed login attempt monitoring
- Data export activity tracking

**Department Management:**
- Organize users by departments
- Department-specific approval workflows
- Budget allocation and tracking per department
- Performance metrics by department`,
    category: "security",
    tags: ["users", "security", "audit", "permissions", "departments"],
    difficulty: "advanced"
  },
  {
    id: "email-notifications",
    title: "Email Configuration & Notifications",
    content: `Configure comprehensive email notification system for automated communications.

**Email Provider Setup:**
- Support for SMTP, SendGrid, Gmail, Outlook
- Secure connection configuration
- Test email functionality
- Email template customization
- Delivery status monitoring

**Notification Types:**
- **Stock Alerts:** Low stock, out of stock warnings
- **Approval Requests:** Pending approvals requiring action
- **Transfer Updates:** Status changes in transfer requests
- **Issue Assignments:** New issues assigned to users
- **System Alerts:** Maintenance, updates, security notices
- **Reports:** Scheduled report delivery

**Email Templates:**
- Professional branded templates
- Customizable content and styling
- Multi-language support
- Dynamic content insertion
- HTML and plain text versions

**Notification Preferences:**
- User-specific notification settings
- Frequency controls (immediate, daily digest, weekly)
- Category-based preferences
- Escalation rules for urgent matters
- Unsubscribe options for non-critical alerts`,
    category: "email",
    tags: ["email", "notifications", "automation", "templates"],
    difficulty: "intermediate"
  },
  {
    id: "troubleshooting",
    title: "Common Issues and Troubleshooting",
    content: `Solutions for common problems and issues.

**Login Issues:**
- Verify username and password
- Check with administrator for account status
- Clear browser cache and cookies

**Data Not Loading:**
- Refresh the page
- Check internet connection
- Contact support if issues persist

**Permission Errors:**
- Verify your user role has required permissions
- Contact administrator to update access

**Performance Issues:**
- Use supported browsers (Chrome, Firefox, Safari)
- Disable browser extensions that may interfere
- Clear browser cache regularly`,
    category: "troubleshooting",
    tags: ["troubleshooting", "issues", "performance"],
    difficulty: "beginner"
  }
];

const quickActions: QuickAction[] = [
  {
    id: "add-item",
    title: "Add New Item",
    description: "Create a new inventory item with barcode",
    icon: Package,
    action: "/inventory",
    category: "inventory"
  },
  {
    id: "check-in-items",
    title: "Check-in Items",
    description: "Scan and receive new inventory",
    icon: Package,
    action: "/check-in",
    category: "operations"
  },
  {
    id: "create-transfer",
    title: "Create Transfer",
    description: "Transfer items between warehouses",
    icon: ArrowRight,
    action: "/transfers",
    category: "transfers"
  },
  {
    id: "create-request",
    title: "Create Request",
    description: "Submit a new inventory request",
    icon: FileText,
    action: "/requests",
    category: "requests"
  },
  {
    id: "view-analytics",
    title: "View Analytics",
    description: "Access advanced reports and analytics",
    icon: BarChart3,
    action: "/analytics",
    category: "analytics"
  },
  {
    id: "track-issues",
    title: "Track Issues",
    description: "Manage issues and communication",
    icon: MessageSquare,
    action: "/issues",
    category: "communication"
  },
  {
    id: "manage-users",
    title: "Manage Users",
    description: "Add or edit user accounts and permissions",
    icon: Users,
    action: "/users-management",
    category: "security"
  },
  {
    id: "warehouse-settings",
    title: "Warehouse Settings",
    description: "Configure warehouses and locations",
    icon: Warehouse,
    action: "/warehouses",
    category: "warehouses"
  },
  {
    id: "email-settings",
    title: "Email Settings",
    description: "Configure email notifications",
    icon: MessageSquare,
    action: "/settings",
    category: "email"
  },
  {
    id: "system-settings",
    title: "System Settings",
    description: "Configure organization preferences",
    icon: Settings,
    action: "/settings",
    category: "settings"
  }
];

export default function HelpSystem({ open, onOpenChange }: HelpSystemProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedArticle, setSelectedArticle] = useState<HelpArticle | null>(null);

  const categories = [
    { id: "all", name: "All Topics", icon: BookOpen },
    { id: "getting-started", name: "Getting Started", icon: HelpCircle },
    { id: "inventory", name: "Inventory", icon: Package },
    { id: "warehouses", name: "Warehouses", icon: Warehouse },
    { id: "transfers", name: "Transfers", icon: ArrowRight },
    { id: "analytics", name: "Analytics", icon: BarChart3 },
    { id: "communication", name: "Communication", icon: MessageSquare },
    { id: "operations", name: "Operations", icon: Settings },
    { id: "security", name: "Security", icon: Users },
    { id: "email", name: "Email", icon: MessageSquare },
    { id: "users", name: "Users", icon: Users },
    { id: "requests", name: "Requests", icon: FileText },
    { id: "reports", name: "Reports", icon: BarChart3 },
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[80vh]" aria-describedby="help-system-description">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Help & Documentation
          </DialogTitle>
          <div id="help-system-description" className="text-sm text-gray-600">
            Search for help topics, view documentation, and find quick actions.
          </div>
        </DialogHeader>

        <div className="flex gap-6 h-full">
          {/* Sidebar */}
          <div className="w-64 border-r pr-4">
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search help topics..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="space-y-1">
                {categories.map((category) => {
                  const Icon = category.icon;
                  return (
                    <Button
                      key={category.id}
                      variant={selectedCategory === category.id ? "default" : "ghost"}
                      className="w-full justify-start"
                      onClick={() => {
                        setSelectedCategory(category.id);
                        setSelectedArticle(null);
                      }}
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {category.name}
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {selectedArticle ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedArticle(null)}
                  >
                    ← Back to Help Topics
                  </Button>
                </div>
                
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <h2 className="text-2xl font-bold">{selectedArticle.title}</h2>
                    <Badge variant={
                      selectedArticle.difficulty === 'beginner' ? 'default' :
                      selectedArticle.difficulty === 'intermediate' ? 'secondary' : 'destructive'
                    }>
                      {selectedArticle.difficulty}
                    </Badge>
                  </div>
                  
                  <div className="flex gap-2 mb-4">
                    {selectedArticle.tags.map(tag => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  
                  <ScrollArea className="h-[500px]">
                    <div className="prose max-w-none">
                      {selectedArticle.content.split('\n').map((paragraph, index) => {
                        if (paragraph.startsWith('**') && paragraph.endsWith('**')) {
                          return (
                            <h3 key={index} className="text-lg font-semibold mt-4 mb-2">
                              {paragraph.slice(2, -2)}
                            </h3>
                          );
                        } else if (paragraph.trim() === '') {
                          return <br key={index} />;
                        } else if (paragraph.startsWith('- ')) {
                          return (
                            <li key={index} className="ml-4">
                              {paragraph.slice(2)}
                            </li>
                          );
                        } else if (/^\d+\./.test(paragraph)) {
                          return (
                            <li key={index} className="ml-4 list-decimal">
                              {paragraph.replace(/^\d+\.\s/, '')}
                            </li>
                          );
                        } else {
                          return (
                            <p key={index} className="mb-2">
                              {paragraph}
                            </p>
                          );
                        }
                      })}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            ) : (
              <Tabs defaultValue="topics" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="topics">Help Topics</TabsTrigger>
                  <TabsTrigger value="quick-actions">Quick Actions</TabsTrigger>
                </TabsList>

                <TabsContent value="topics" className="space-y-4">
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-3">
                      {filteredArticles.map((article) => (
                        <Card 
                          key={article.id} 
                          className="cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => setSelectedArticle(article)}
                        >
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-lg">{article.title}</CardTitle>
                              <ArrowRight className="h-4 w-4 text-gray-400" />
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="flex items-center gap-2 mb-2">
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
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="quick-actions" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredQuickActions.map((action) => {
                      const Icon = action.icon;
                      return (
                        <Card key={action.id} className="cursor-pointer hover:shadow-md transition-shadow">
                          <CardHeader>
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-primary/10 rounded-lg">
                                <Icon className="h-5 w-5 text-primary" />
                              </div>
                              <div>
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
                </TabsContent>
              </Tabs>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t pt-4 mt-4">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center gap-4">
              <span>Need more help?</span>
              <Button variant="outline" size="sm">
                <MessageSquare className="h-4 w-4 mr-2" />
                Contact Support
              </Button>
            </div>
            <div className="flex items-center gap-4">
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
      </DialogContent>
    </Dialog>
  );
}