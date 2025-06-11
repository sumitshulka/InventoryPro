import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";
import { AlertTriangle, Plus, Search, Filter, CheckCircle, Clock, X, Flag, Bell, MessageSquare, Archive, Reply, Mail, MailOpen } from "lucide-react";
import AppLayout from "@/components/layout/app-layout";

interface Issue {
  id: number;
  title: string;
  description: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
  reportedBy: number;
  assignedTo?: number;
  warehouseId?: number;
  itemId?: number;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  reporter?: {
    id: number;
    name: string;
  };
  assignee?: {
    id: number;
    name: string;
  };
  warehouse?: {
    id: number;
    name: string;
  };
  item?: {
    id: number;
    name: string;
  };
}

interface Notification {
  id: number;
  senderId: number;
  recipientId: number;
  subject: string;
  message: string;
  category: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'unread' | 'read' | 'replied' | 'closed';
  createdAt: string;
  updatedAt: string;
  parentId: number | null;
  relatedEntityType: string | null;
  relatedEntityId: number | null;
  isArchived: boolean;
  archivedAt: string | null;
  sender: {
    id: number;
    name: string;
    role: string;
  } | null;
}

const issueSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title too long"),
  description: z.string().min(1, "Description is required").max(1000, "Description too long"),
  category: z.enum(['inventory', 'equipment', 'safety', 'quality', 'process', 'other']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  warehouseId: z.number().optional(),
  itemId: z.number().optional(),
});

export default function IssuesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showNewIssueDialog, setShowNewIssueDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("issues");
  const [notificationFilter, setNotificationFilter] = useState("all");
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);

  const { data: issues = [], isLoading } = useQuery({
    queryKey: ['/api/issues'],
    queryFn: () => fetch('/api/issues').then(res => res.json()).catch(() => [])
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ['/api/warehouses'],
  });

  const { data: items = [] } = useQuery({
    queryKey: ['/api/items'],
  });

  const { data: users = [] } = useQuery({
    queryKey: ['/api/users'],
  });

  // Notification queries
  const { data: notifications = [], isLoading: notificationsLoading } = useQuery({
    queryKey: ['/api/notifications'],
    queryFn: () => fetch('/api/notifications').then(res => res.json()).catch(() => [])
  });

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['/api/notifications/unread-count'],
    queryFn: () => fetch('/api/notifications/unread-count').then(res => res.json()).then(data => data.count).catch(() => 0),
    refetchInterval: 30000,
  });

  const form = useForm<z.infer<typeof issueSchema>>({
    resolver: zodResolver(issueSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "other",
      priority: "medium",
    },
  });

  const createIssueMutation = useMutation({
    mutationFn: (data: z.infer<typeof issueSchema>) =>
      apiRequest('/api/issues', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/issues'] });
      setShowNewIssueDialog(false);
      form.reset();
      toast({
        title: "Success",
        description: "Issue reported successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to report issue",
        variant: "destructive",
      });
    },
  });

  // Notification mutations
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      return apiRequest(`/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to mark notification as read",
        variant: "destructive",
      });
    },
  });

  const archiveNotificationMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      return apiRequest(`/api/notifications/${notificationId}/archive`, {
        method: 'PATCH',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      toast({
        title: "Success",
        description: "Notification archived",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to archive notification",
        variant: "destructive",
      });
    },
  });

  const replyToNotificationMutation = useMutation({
    mutationFn: async ({ id, message }: { id: number; message: string }) => {
      return apiRequest(`/api/notifications/${id}/reply`, {
        method: 'POST',
        body: JSON.stringify({ message }),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      toast({
        title: "Success",
        description: "Reply sent successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send reply",
        variant: "destructive",
      });
    },
  });

  const updateIssueStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest(`/api/issues/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
        headers: { 'Content-Type': 'application/json' },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/issues'] });
      toast({
        title: "Success",
        description: "Issue status updated",
      });
    },
  });

  const filteredIssues = issues.filter((issue: Issue) => {
    if (searchTerm && !issue.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !issue.description.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (categoryFilter !== "all" && issue.category !== categoryFilter) return false;
    if (priorityFilter !== "all" && issue.priority !== priorityFilter) return false;
    if (statusFilter !== "all" && issue.status !== statusFilter) return false;
    return true;
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-red-100 text-red-800';
      case 'in-progress': return 'bg-blue-100 text-blue-800';
      case 'resolved': return 'bg-green-100 text-green-800';
      case 'closed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'critical': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'high': return <Flag className="h-4 w-4 text-orange-500" />;
      case 'medium': return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'low': return <CheckCircle className="h-4 w-4 text-green-500" />;
      default: return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  // Notification filtering and helpers
  const filteredNotifications = notifications.filter((notification: Notification) => {
    if (notificationFilter === "all") return true;
    if (notificationFilter === "unread") return notification.status === "unread";
    if (notificationFilter === "read") return notification.status === "read";
    if (notificationFilter === "archived") return notification.isArchived;
    return true;
  });

  const getNotificationPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'border-l-red-500 bg-red-50 text-red-900';
      case 'high':
        return 'border-l-orange-500 bg-orange-50 text-orange-900';
      case 'normal':
        return 'border-l-blue-500 bg-blue-50 text-blue-900';
      case 'low':
        return 'border-l-gray-500 bg-gray-50 text-gray-900';
      default:
        return 'border-l-blue-500 bg-blue-50 text-blue-900';
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (notification.status === 'unread') {
      markAsReadMutation.mutate(notification.id);
    }
    setSelectedNotification(notification);
  };

  const onSubmit = (data: z.infer<typeof issueSchema>) => {
    createIssueMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Issues Management</h1>
            <p className="text-gray-600">Report and track inventory and operational issues</p>
          </div>
          <Dialog open={showNewIssueDialog} onOpenChange={setShowNewIssueDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Report Issue
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Report New Issue</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input placeholder="Brief description of the issue" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Detailed description of the issue" 
                            className="min-h-[100px]"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="inventory">Inventory</SelectItem>
                              <SelectItem value="equipment">Equipment</SelectItem>
                              <SelectItem value="safety">Safety</SelectItem>
                              <SelectItem value="quality">Quality</SelectItem>
                              <SelectItem value="process">Process</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="priority"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Priority</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="critical">Critical</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="warehouseId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Warehouse (Optional)</FormLabel>
                          <Select onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select warehouse" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {warehouses.map((warehouse: any) => (
                                <SelectItem key={warehouse.id} value={warehouse.id.toString()}>
                                  {warehouse.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="itemId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Item (Optional)</FormLabel>
                          <Select onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select item" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {items.map((item: any) => (
                                <SelectItem key={item.id} value={item.id.toString()}>
                                  {item.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={() => setShowNewIssueDialog(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createIssueMutation.isPending}>
                      {createIssueMutation.isPending ? "Reporting..." : "Report Issue"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search issues..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="inventory">Inventory</SelectItem>
                  <SelectItem value="equipment">Equipment</SelectItem>
                  <SelectItem value="safety">Safety</SelectItem>
                  <SelectItem value="quality">Quality</SelectItem>
                  <SelectItem value="process">Process</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Priorities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Issues List */}
        <Card>
          <CardHeader>
            <CardTitle>Issues ({filteredIssues.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredIssues.length === 0 ? (
              <div className="text-center py-8">
                <AlertTriangle className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No issues found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {issues.length === 0 ? "No issues have been reported yet." : "No issues match your current filters."}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredIssues.map((issue: Issue) => (
                  <div key={issue.id} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          {getPriorityIcon(issue.priority)}
                          <h3 className="font-medium text-gray-900">{issue.title}</h3>
                          <Badge className={getPriorityColor(issue.priority)}>
                            {issue.priority.toUpperCase()}
                          </Badge>
                          <Badge className={getStatusColor(issue.status)}>
                            {issue.status.replace('-', ' ').toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-gray-600 mb-3">{issue.description}</p>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span>Category: {issue.category}</span>
                          {issue.warehouse && <span>Warehouse: {issue.warehouse.name}</span>}
                          {issue.item && <span>Item: {issue.item.name}</span>}
                          <span>Reported: {format(new Date(issue.createdAt), 'MMM dd, yyyy')}</span>
                          {issue.reporter && <span>By: {issue.reporter.name}</span>}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {issue.status !== 'closed' && (
                          <Select
                            value={issue.status}
                            onValueChange={(status) => updateIssueStatusMutation.mutate({ id: issue.id, status })}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="open">Open</SelectItem>
                              <SelectItem value="in-progress">In Progress</SelectItem>
                              <SelectItem value="resolved">Resolved</SelectItem>
                              <SelectItem value="closed">Closed</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}