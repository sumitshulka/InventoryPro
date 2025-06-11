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
    content: `Welcome to your inventory management system! This guide will help you get started with the basics.

**First Steps:**
1. Set up your organization settings
2. Create warehouses and locations
3. Add items to your inventory
4. Configure user roles and permissions

**Dashboard Overview:**
The dashboard provides a quick overview of your inventory status, recent transactions, and key metrics. You can see:
- Current stock levels
- Low stock alerts
- Recent activities
- Performance metrics`,
    category: "getting-started",
    tags: ["basics", "setup", "dashboard"],
    difficulty: "beginner"
  },
  {
    id: "managing-inventory",
    title: "Managing Inventory Items",
    content: `Learn how to effectively manage your inventory items and stock levels.

**Adding New Items:**
1. Navigate to Inventory → Items
2. Click "Add New Item"
3. Fill in item details (name, SKU, description)
4. Set minimum stock levels
5. Assign categories and units

**Stock Adjustments:**
- Use the "Adjust Stock" feature for corrections
- Record reasons for all adjustments
- Monitor adjustment history in audit trail

**Item Categories:**
Organize items using categories for better management and reporting.`,
    category: "inventory",
    tags: ["items", "stock", "categories"],
    difficulty: "beginner"
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
    description: "Create a new inventory item",
    icon: Package,
    action: "/inventory",
    category: "inventory"
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
    id: "view-reports",
    title: "View Reports",
    description: "Access inventory reports and analytics",
    icon: BarChart3,
    action: "/reports",
    category: "reports"
  },
  {
    id: "manage-users",
    title: "Manage Users",
    description: "Add or edit user accounts",
    icon: Users,
    action: "/settings",
    category: "users"
  },
  {
    id: "warehouse-settings",
    title: "Warehouse Settings",
    description: "Configure warehouses and locations",
    icon: Warehouse,
    action: "/settings",
    category: "warehouses"
  },
  {
    id: "system-settings",
    title: "System Settings",
    description: "Configure system preferences",
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
            <div className="flex items-center gap-2">
              <span>Version 1.0.0</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}