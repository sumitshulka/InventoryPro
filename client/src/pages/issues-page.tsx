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
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";
import { AlertTriangle, Plus, Search, Filter, CheckCircle, Clock, X, Flag, Bell, MessageSquare, Archive, Reply, Mail, MailOpen, RefreshCw } from "lucide-react";
import AppLayout from "@/components/layout/app-layout";
import { DataTablePagination } from "@/components/ui/data-table-pagination";

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
  resolutionNotes?: string;
  closedBy?: number;
  closedAt?: string;
  reopenedBy?: number;
  reopenedAt?: string;
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

interface IssueActivity {
  id: number;
  action: string;
  previousValue?: string;
  newValue?: string;
  comment?: string;
  createdAt: string;
  user: {
    id: number;
    name: string;
    username: string;
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

const notificationSchema = z.object({
  subject: z.string().min(1, "Subject is required").max(200, "Subject too long"),
  message: z.string().min(1, "Message is required").max(2000, "Message too long"),
  category: z.enum(['general', 'inventory', 'request', 'transfer', 'approval']),
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
  recipientType: z.enum(['specific', 'admins', 'managers', 'all']),
  recipientIds: z.array(z.number()).optional(),
});

const replySchema = z.object({
  message: z.string().min(1, "Reply message is required").max(2000, "Message too long"),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
});

const closeIssueSchema = z.object({
  resolutionNotes: z.string().min(1, "Resolution comments are required when closing an issue").max(1000, "Comments too long"),
});

export default function IssuesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showNewIssueDialog, setShowNewIssueDialog] = useState(false);
  const [showNewNotificationDialog, setShowNewNotificationDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("issues");
  const [notificationFilter, setNotificationFilter] = useState("all");
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [showReplyDialog, setShowReplyDialog] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [showCloseIssueDialog, setShowCloseIssueDialog] = useState(false);
  const [showActivityDialog, setShowActivityDialog] = useState(false);
  const [showFullTextModal, setShowFullTextModal] = useState(false);
  const [fullTextContent, setFullTextContent] = useState("");

  // Helper function to truncate text and show "View More" button
  const TruncatedText = ({ text, maxLength = 150 }: { text: string; maxLength?: number }) => {
    if (text.length <= maxLength) {
      return <div className="text-sm bg-gray-50 rounded p-3">{text}</div>;
    }

    const truncated = text.substring(0, maxLength);
    
    return (
      <div className="text-sm bg-gray-50 rounded p-3">
        <div className="mb-2">{truncated}...</div>
        <Button 
          variant="link" 
          size="sm" 
          className="h-auto p-0 text-blue-600 hover:text-blue-800"
          onClick={() => {
            setFullTextContent(text);
            setShowFullTextModal(true);
          }}
        >
          View More
        </Button>
      </div>
    );
  };

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

  const { data: recipients = [] } = useQuery({
    queryKey: ['/api/notifications/recipients'],
    queryFn: () => fetch('/api/notifications/recipients').then(res => res.json()).catch(() => [])
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

  const notificationForm = useForm<z.infer<typeof notificationSchema>>({
    resolver: zodResolver(notificationSchema),
    defaultValues: {
      subject: "",
      message: "",
      category: "general",
      priority: "normal",
      recipientType: "admins",
      recipientIds: [],
    },
  });

  const replyForm = useForm<z.infer<typeof replySchema>>({
    resolver: zodResolver(replySchema),
    defaultValues: {
      message: "",
      priority: "normal",
    },
  });

  const closeIssueForm = useForm<z.infer<typeof closeIssueSchema>>({
    resolver: zodResolver(closeIssueSchema),
    defaultValues: {
      resolutionNotes: "",
    },
  });

  // Issue activity query
  const { data: issueActivities = [] } = useQuery({
    queryKey: ['/api/issues', selectedIssue?.id, 'activities'],
    queryFn: () => selectedIssue ? fetch(`/api/issues/${selectedIssue.id}/activities`).then(res => res.json()).catch(() => []) : [],
    enabled: !!selectedIssue && showActivityDialog,
  });

  const createIssueMutation = useMutation({
    mutationFn: (data: z.infer<typeof issueSchema>) =>
      apiRequest('POST', '/api/issues', data),
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
        description: error.message || "Failed to create issue",
        variant: "destructive",
      });
    },
  });

  const createNotificationMutation = useMutation({
    mutationFn: (data: z.infer<typeof notificationSchema>) =>
      apiRequest('POST', '/api/notifications', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
      setShowNewNotificationDialog(false);
      notificationForm.reset();
      toast({
        title: "Success",
        description: "Notification sent successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send notification",
        variant: "destructive",
      });
    },
  });

  const closeIssueMutation = useMutation({
    mutationFn: (data: { issueId: number; resolutionNotes: string }) =>
      apiRequest('PATCH', `/api/issues/${data.issueId}/close`, { resolutionNotes: data.resolutionNotes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/issues'] });
      setShowCloseIssueDialog(false);
      closeIssueForm.reset();
      toast({
        title: "Success",
        description: "Issue closed successfully with resolution comments",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to close issue",
        variant: "destructive",
      });
    },
  });

  const reopenIssueMutation = useMutation({
    mutationFn: (issueId: number) =>
      apiRequest('PATCH', `/api/issues/${issueId}/reopen`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/issues'] });
      toast({
        title: "Success",
        description: "Issue reopened successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reopen issue",
        variant: "destructive",
      });
    },
  });

  // Notification mutations
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      return apiRequest('PATCH', `/api/notifications/${notificationId}/read`);
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
      return apiRequest('PATCH', `/api/notifications/${notificationId}/archive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
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
    mutationFn: async (data: z.infer<typeof replySchema> & { id: number }) => {
      return apiRequest('POST', `/api/notifications/${data.id}/reply`, {
        message: data.message,
        priority: data.priority,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
      setShowReplyDialog(false);
      setSelectedNotification(null); // Close the notification detail modal
      replyForm.reset();
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
      apiRequest('PATCH', `/api/issues/${id}/status`, { status }),
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

  const handleNotificationClick = async (notification: Notification) => {
    try {
      if (notification.status === 'unread') {
        await markAsReadMutation.mutateAsync(notification.id);
      }
      setSelectedNotification(notification);
    } catch (error) {
      console.error('Error handling notification click:', error);
    }
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
    queryClient.invalidateQueries({ queryKey: ['/api/issues'] });
    queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    queryClient.invalidateQueries({ queryKey: ['/api/warehouses'] });
    queryClient.invalidateQueries({ queryKey: ['/api/items'] });
    toast({
      title: "Refreshed",
      description: "Data refreshed successfully",
    });
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
            <h1 className="text-3xl font-bold text-gray-900">Issues & Notification Center</h1>
            <p className="text-gray-600">Manage issues, notifications, and communication</p>
          </div>
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <Bell className="h-3 w-3" />
                {unreadCount} unread
              </Badge>
            )}
            <Dialog open={showNewNotificationDialog} onOpenChange={setShowNewNotificationDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Mail className="h-4 w-4 mr-2" />
                  Send Message
                </Button>
              </DialogTrigger>
            </Dialog>
            <Dialog open={showNewIssueDialog} onOpenChange={setShowNewIssueDialog}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Report Issue
                </Button>
              </DialogTrigger>
            </Dialog>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Tabbed Interface */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="issues" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Issues ({filteredIssues.length})
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notifications ({filteredNotifications.length})
              {unreadCount > 0 && (
                <Badge variant="destructive" className="ml-1">
                  {unreadCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Issues Tab */}
          <TabsContent value="issues" className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Search issues..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="flex gap-2">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Category" />
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
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priority</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4">
              {filteredIssues.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No issues found</h3>
                    <p className="text-gray-600">Try adjusting your filters or report a new issue.</p>
                  </CardContent>
                </Card>
              ) : (
                filteredIssues.map((issue: any) => (
                  <Card key={issue.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            {getPriorityIcon(issue.priority)}
                            <h3 className="font-semibold text-gray-900">{issue.title}</h3>
                            <Badge className={getPriorityColor(issue.priority)}>
                              {issue.priority}
                            </Badge>
                            <Badge className={getStatusColor(issue.status)}>
                              {issue.status.replace('-', ' ')}
                            </Badge>
                          </div>
                          <p className="text-gray-600 mb-3">{issue.description}</p>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span>Category: {issue.category}</span>
                            <span>•</span>
                            <span>Reported: {format(new Date(issue.createdAt), 'MMM dd, yyyy')}</span>
                            {issue.reporter && (
                              <>
                                <span>•</span>
                                <span>By: {issue.reporter.name}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          {issue.resolutionNotes && (
                            <div className="bg-green-50 border border-green-200 rounded p-3 mb-2">
                              <div className="text-sm font-medium text-green-800 mb-1">Resolution Comments:</div>
                              <div className="text-sm text-green-700">{issue.resolutionNotes}</div>
                              {issue.closedAt && (
                                <div className="text-xs text-green-600 mt-1">
                                  Closed on {format(new Date(issue.closedAt), 'PPp')}
                                </div>
                              )}
                            </div>
                          )}
                          <div className="flex gap-2">
                            {issue.status === 'closed' && issue.reportedBy === 1 && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => reopenIssueMutation.mutate(issue.id)}
                                disabled={reopenIssueMutation.isPending}
                              >
                                <RefreshCw className="h-4 w-4 mr-1" />
                                Reopen
                              </Button>
                            )}
                            {issue.status !== 'closed' && (
                              <>
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
                                  </SelectContent>
                                </Select>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedIssue(issue);
                                    setShowCloseIssueDialog(true);
                                  }}
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Close
                                </Button>
                              </>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedIssue(issue);
                                setShowActivityDialog(true);
                              }}
                            >
                              <Clock className="h-4 w-4 mr-1" />
                              Activity
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex gap-2">
                <Select value={notificationFilter} onValueChange={setNotificationFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Notifications</SelectItem>
                    <SelectItem value="unread">Unread</SelectItem>
                    <SelectItem value="read">Read</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    notifications.filter((n: Notification) => n.status === 'unread').forEach((n: Notification) => {
                      markAsReadMutation.mutate(n.id);
                    });
                  }}
                  disabled={unreadCount === 0}
                >
                  <MailOpen className="h-4 w-4 mr-2" />
                  Mark All Read
                </Button>
              </div>
            </div>

            <div className="grid gap-4">
              {notificationsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
                </div>
              ) : filteredNotifications.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No notifications found</h3>
                    <p className="text-gray-600">No notifications match your current filter.</p>
                  </CardContent>
                </Card>
              ) : (
                <DataTablePagination data={filteredNotifications}>
                  {(paginatedNotifications) => (
                    <div className="space-y-3">
                      {paginatedNotifications.map((notification: Notification) => (
                        <Card 
                          key={notification.id} 
                          className={`cursor-pointer transition-all hover:shadow-md ${
                            notification.status === 'unread' ? 'border-l-4 border-l-primary bg-primary/5' : ''
                          } ${getNotificationPriorityColor(notification.priority)}`}
                          onClick={() => handleNotificationClick(notification)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  {notification.status === 'unread' && (
                                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                                  )}
                                  <h4 className="font-semibold text-gray-900">{notification.subject}</h4>
                                  <Badge variant="outline" className="text-xs">
                                    {notification.priority}
                                  </Badge>
                                  <Badge variant="secondary" className="text-xs">
                                    {notification.category}
                                  </Badge>
                                  {notification.isArchived && (
                                    <Badge variant="secondary" className="text-xs bg-gray-200 text-gray-700">
                                      <Archive className="h-3 w-3 mr-1" />
                                      Archived
                                    </Badge>
                                  )}
                                  {notification.status === 'replied' && (
                                    <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      Replied
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-gray-600 text-sm mb-2 line-clamp-2">{notification.message}</p>
                                <div className="flex items-center gap-3 text-xs text-gray-500">
                                  <span>From: {notification.sender?.name || 'System'}</span>
                                  <span>•</span>
                                  <span>{formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}</span>
                                </div>
                              </div>
                              <div className="flex gap-1 ml-4">
                                {notification.status === 'unread' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      try {
                                        await markAsReadMutation.mutateAsync(notification.id);
                                      } catch (error) {
                                        console.error('Error marking as read:', error);
                                      }
                                    }}
                                  >
                                    <Mail className="h-3 w-3" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                      await archiveNotificationMutation.mutateAsync(notification.id);
                                    } catch (error) {
                                      console.error('Error archiving notification:', error);
                                    }
                                  }}
                                >
                                  <Archive className="h-3 w-3" />
                                </Button>
                                {notification.status !== 'replied' && notification.status !== 'closed' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedNotification(notification);
                                      setShowReplyDialog(true);
                                      replyForm.reset({
                                        message: "",
                                        priority: "normal",
                                      });
                                    }}
                                  >
                                    <Reply className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </DataTablePagination>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Issue Creation Dialog */}
        <Dialog open={showNewIssueDialog} onOpenChange={setShowNewIssueDialog}>
          <DialogContent className="sm:max-w-md" aria-describedby="issue-dialog-description">
            <DialogHeader>
              <DialogTitle>Report New Issue</DialogTitle>
              <div id="issue-dialog-description" className="text-sm text-gray-600">
                Fill out the form below to report a new issue.
              </div>
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

        {/* Notification Detail Dialog */}
        <Dialog open={!!selectedNotification} onOpenChange={() => setSelectedNotification(null)}>
          <DialogContent className="sm:max-w-2xl" aria-describedby="notification-dialog-description">
            <DialogHeader>
              <DialogTitle>Notification Details</DialogTitle>
              <div id="notification-dialog-description" className="text-sm text-gray-600">
                View and manage notification details.
              </div>
            </DialogHeader>
            {selectedNotification && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{selectedNotification.priority}</Badge>
                  <Badge variant="secondary">{selectedNotification.category}</Badge>
                  <Badge className={selectedNotification.status === 'unread' ? 'bg-primary' : 'bg-gray-500'}>
                    {selectedNotification.status}
                  </Badge>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">{selectedNotification.subject}</h3>
                  <p className="text-gray-600 whitespace-pre-wrap">{selectedNotification.message}</p>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>From: {selectedNotification.sender?.name || 'System'}</span>
                  <span>•</span>
                  <span>{format(new Date(selectedNotification.createdAt), 'MMM dd, yyyy HH:mm')}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={async () => {
                      try {
                        if (selectedNotification.status === 'unread') {
                          await markAsReadMutation.mutateAsync(selectedNotification.id);
                        }
                        setSelectedNotification(null);
                      } catch (error) {
                        console.error('Error marking notification as read:', error);
                      }
                    }}
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Mark as Read
                  </Button>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      try {
                        await archiveNotificationMutation.mutateAsync(selectedNotification.id);
                        setSelectedNotification(null);
                      } catch (error) {
                        console.error('Error archiving notification:', error);
                      }
                    }}
                  >
                    <Archive className="h-4 w-4 mr-2" />
                    Archive
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Create Notification Dialog */}
        <Dialog open={showNewNotificationDialog} onOpenChange={setShowNewNotificationDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby="notification-dialog-description">
            <DialogHeader>
              <DialogTitle>Send Message</DialogTitle>
              <p id="notification-dialog-description" className="text-sm text-gray-600">
                Create and send a message to users, groups, or administrators.
              </p>
            </DialogHeader>
            <Form {...notificationForm}>
              <form onSubmit={notificationForm.handleSubmit((data) => createNotificationMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={notificationForm.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subject</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter message subject" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={notificationForm.control}
                  name="message"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Message</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Enter your message"
                          className="min-h-[120px]"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={notificationForm.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="general">General</SelectItem>
                            <SelectItem value="inventory">Inventory</SelectItem>
                            <SelectItem value="request">Request</SelectItem>
                            <SelectItem value="transfer">Transfer</SelectItem>
                            <SelectItem value="approval">Approval</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={notificationForm.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select priority" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={notificationForm.control}
                  name="recipientType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Send To</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select recipients" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="admins">All Admins</SelectItem>
                          <SelectItem value="managers">All Managers</SelectItem>
                          <SelectItem value="specific">Specific Users</SelectItem>
                          <SelectItem value="all">All Users (Admin Only)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {notificationForm.watch("recipientType") === "specific" && (
                  <FormField
                    control={notificationForm.control}
                    name="recipientIds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Select Users</FormLabel>
                        <div className="max-h-32 overflow-y-auto border rounded-md p-2 space-y-2">
                          {recipients.map((user: any) => (
                            <label key={user.id} className="flex items-center space-x-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={field.value?.includes(user.id) || false}
                                onChange={(e) => {
                                  const currentIds = field.value || [];
                                  if (e.target.checked) {
                                    field.onChange([...currentIds, user.id]);
                                  } else {
                                    field.onChange(currentIds.filter((id: number) => id !== user.id));
                                  }
                                }}
                                className="rounded"
                              />
                              <span className="text-sm">
                                {user.name} ({user.role})
                              </span>
                            </label>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <div className="flex justify-end gap-3 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowNewNotificationDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createNotificationMutation.isPending}>
                    {createNotificationMutation.isPending ? "Sending..." : "Send Message"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Create Issue Dialog */}
        <Dialog open={showNewIssueDialog} onOpenChange={setShowNewIssueDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby="issue-dialog-description">
            <DialogHeader>
              <DialogTitle>Report New Issue</DialogTitle>
              <p id="issue-dialog-description" className="text-sm text-gray-600">
                Report a new issue with detailed description and categorization.
              </p>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Issue Title</FormLabel>
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
                          className="min-h-[120px]"
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
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
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
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select priority" />
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
                        <FormLabel>Related Warehouse (Optional)</FormLabel>
                        <Select onValueChange={(value) => field.onChange(value === "none" ? undefined : parseInt(value))}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select warehouse" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {Array.isArray(warehouses) && warehouses.map((warehouse: any) => (
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
                        <FormLabel>Related Item (Optional)</FormLabel>
                        <Select onValueChange={(value) => field.onChange(value === "none" ? undefined : parseInt(value))}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select item" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {Array.isArray(items) && items.map((item: any) => (
                              <SelectItem key={item.id} value={item.id.toString()}>
                                {item.name} ({item.sku})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowNewIssueDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createIssueMutation.isPending}>
                    {createIssueMutation.isPending ? "Creating..." : "Report Issue"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Reply Dialog */}
        <Dialog open={showReplyDialog} onOpenChange={setShowReplyDialog}>
          <DialogContent className="sm:max-w-md" aria-describedby="reply-dialog-description">
            <DialogHeader>
              <DialogTitle>Reply to: {selectedNotification?.subject}</DialogTitle>
              <div id="reply-dialog-description" className="text-sm text-gray-600">
                Write your reply message below.
              </div>
            </DialogHeader>
            <Form {...replyForm}>
              <form 
                onSubmit={replyForm.handleSubmit((data) => {
                  if (selectedNotification) {
                    replyToNotificationMutation.mutate({
                      ...data,
                      id: selectedNotification.id,
                    });
                  }
                })} 
                className="space-y-4"
              >
                <FormField
                  control={replyForm.control}
                  name="message"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reply Message</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          placeholder="Type your reply here..." 
                          rows={6}
                          className="min-h-[120px]"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={replyForm.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowReplyDialog(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={replyToNotificationMutation.isPending}>
                    {replyToNotificationMutation.isPending ? "Sending..." : "Send Reply"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Close Issue Dialog */}
        <Dialog open={showCloseIssueDialog} onOpenChange={setShowCloseIssueDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Close Issue</DialogTitle>
            </DialogHeader>
            <Form {...closeIssueForm}>
              <form onSubmit={closeIssueForm.handleSubmit((data) => {
                if (selectedIssue) {
                  closeIssueMutation.mutate({
                    issueId: selectedIssue.id,
                    resolutionNotes: data.resolutionNotes
                  });
                }
              })} className="space-y-4">
                <FormField
                  control={closeIssueForm.control}
                  name="resolutionNotes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Resolution Comments *</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Please provide detailed resolution comments explaining how the issue was resolved..."
                          className="min-h-[120px]"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowCloseIssueDialog(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={closeIssueMutation.isPending}>
                    {closeIssueMutation.isPending ? "Closing..." : "Close Issue"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Activity Log Dialog */}
        <Dialog open={showActivityDialog} onOpenChange={setShowActivityDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Issue Activity Log</DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-4">
                {issueActivities.map((activity: IssueActivity) => (
                  <div key={activity.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <div className="font-medium">{activity.user.name}</div>
                        <Badge variant="outline" className="text-xs">
                          {activity.action}
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-500">
                        {format(new Date(activity.createdAt), 'PPp')}
                      </div>
                    </div>
                    {activity.previousValue && activity.newValue && (
                      <div className="text-sm text-gray-600 mb-2">
                        Changed from <span className="font-medium">{activity.previousValue}</span> to{' '}
                        <span className="font-medium">{activity.newValue}</span>
                      </div>
                    )}
                    {activity.comment && (
                      <TruncatedText text={activity.comment} />
                    )}
                  </div>
                ))}
                {issueActivities.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    No activity recorded for this issue
                  </div>
                )}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>

        {/* Full Text Modal */}
        <Dialog open={showFullTextModal} onOpenChange={setShowFullTextModal}>
          <DialogContent className="max-w-3xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>Full Comment Text</DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="text-sm bg-gray-50 rounded p-4 whitespace-pre-wrap">
                {fullTextContent}
              </div>
            </ScrollArea>
            <div className="flex justify-end pt-4">
              <Button onClick={() => setShowFullTextModal(false)}>
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}