import { useState } from "react";
import { Bell, Send, Reply, Archive, CheckCircle, X, AlertCircle, Info, Clock, Search, Filter, MessageSquare, Trash2, User, Calendar, ArrowLeft, RefreshCw } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDistanceToNow, format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { DataTablePagination } from "@/components/ui/data-table-pagination";

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

interface Recipient {
  id: number;
  name: string;
  role: string;
  email: string;
}

const newNotificationSchema = z.object({
  recipientId: z.number().min(1, "Please select a recipient"),
  subject: z.string().min(1, "Subject is required").max(200, "Subject too long"),
  message: z.string().min(1, "Message is required").max(2000, "Message too long"),
  category: z.string().min(1, "Category is required"),
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
});

const replySchema = z.object({
  message: z.string().min(1, "Reply message is required").max(2000, "Message too long"),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
});

const getPriorityIcon = (priority: string) => {
  switch (priority) {
    case 'urgent':
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    case 'high':
      return <AlertCircle className="h-4 w-4 text-orange-500" />;
    case 'normal':
      return <Info className="h-4 w-4 text-blue-500" />;
    case 'low':
      return <Clock className="h-4 w-4 text-gray-500" />;
    default:
      return <Info className="h-4 w-4 text-blue-500" />;
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'urgent':
      return 'border-l-red-500 bg-red-50';
    case 'high':
      return 'border-l-orange-500 bg-orange-50';
    case 'normal':
      return 'border-l-blue-500 bg-blue-50';
    case 'low':
      return 'border-l-gray-500 bg-gray-50';
    default:
      return 'border-l-blue-500 bg-blue-50';
  }
};

export default function NotificationCenterPage() {
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [activeTab, setActiveTab] = useState("inbox");
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showNewNotificationDialog, setShowNewNotificationDialog] = useState(false);
  const [showReplyDialog, setShowReplyDialog] = useState(false);
  const [showThreadDialog, setShowThreadDialog] = useState(false);
  const [threadNotifications, setThreadNotifications] = useState<Notification[]>([]);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Get all notifications
  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ['/api/notifications'],
  });

  // Get available recipients
  const { data: recipients = [] } = useQuery<Recipient[]>({
    queryKey: ['/api/notifications/recipients'],
  });

  // New notification form
  const newNotificationForm = useForm<z.infer<typeof newNotificationSchema>>({
    resolver: zodResolver(newNotificationSchema),
    defaultValues: {
      priority: 'normal',
      category: 'general',
    },
  });

  // Reply form
  const replyForm = useForm<z.infer<typeof replySchema>>({
    resolver: zodResolver(replySchema),
    defaultValues: {
      priority: 'normal',
    },
  });

  // Create notification mutation
  const createNotificationMutation = useMutation({
    mutationFn: (data: z.infer<typeof newNotificationSchema>) =>
      apiRequest('/api/notifications', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
      setShowNewNotificationDialog(false);
      newNotificationForm.reset();
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

  // Reply mutation
  const replyMutation = useMutation({
    mutationFn: ({ notificationId, data }: { notificationId: number; data: z.infer<typeof replySchema> }) =>
      apiRequest(`/api/notifications/${notificationId}/reply`, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
      setShowReplyDialog(false);
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

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: (notificationId: number) =>
      apiRequest(`/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
    },
  });

  // Close notification mutation
  const closeNotificationMutation = useMutation({
    mutationFn: (notificationId: number) =>
      apiRequest(`/api/notifications/${notificationId}/close`, {
        method: 'PATCH',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      setSelectedNotification(null);
      toast({
        title: "Success",
        description: "Notification closed",
      });
    },
  });

  // Archive notification mutation
  const archiveNotificationMutation = useMutation({
    mutationFn: (notificationId: number) =>
      apiRequest(`/api/notifications/${notificationId}/archive`, {
        method: 'PATCH',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      setSelectedNotification(null);
      toast({
        title: "Success", 
        description: "Notification archived",
      });
    },
  });

  // Get thread mutation
  const getThreadMutation = useMutation({
    mutationFn: (notificationId: number) =>
      apiRequest(`/api/notifications/${notificationId}/thread`),
    onSuccess: (data) => {
      setThreadNotifications(data);
      setShowThreadDialog(true);
    },
  });

  // Filter notifications
  const filteredNotifications = notifications.filter(notification => {
    // Tab filtering
    if (activeTab === "unread" && notification.status !== "unread") return false;
    if (activeTab === "archived" && !notification.isArchived) return false;
    if (activeTab === "inbox" && notification.isArchived) return false;

    // Search filtering
    if (searchTerm && !notification.subject.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !notification.message.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !(notification.sender?.name || '').toLowerCase().includes(searchTerm.toLowerCase())) return false;

    // Category filtering
    if (categoryFilter !== "all" && notification.category !== categoryFilter) return false;

    // Priority filtering
    if (priorityFilter !== "all" && notification.priority !== priorityFilter) return false;

    // Status filtering
    if (statusFilter !== "all" && notification.status !== statusFilter) return false;

    return true;
  });

  const handleNewNotification = (data: z.infer<typeof newNotificationSchema>) => {
    createNotificationMutation.mutate(data);
  };

  const handleReply = (data: z.infer<typeof replySchema>) => {
    if (selectedNotification) {
      replyMutation.mutate({
        notificationId: selectedNotification.id,
        data,
      });
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    setSelectedNotification(notification);
    
    // Mark as read if unread
    if (notification.status === 'unread') {
      markAsReadMutation.mutate(notification.id);
    }
  };

  const handleShowThread = (notification: Notification) => {
    getThreadMutation.mutate(notification.id);
  };

  // Get unique categories for filter
  const categories = Array.from(new Set(notifications.map(n => n.category)));

  return (
    <div className="container mx-auto p-6">
      {/* Back to Dashboard Button */}
      <div className="mb-4">
        <Button
          variant="outline"
          onClick={() => setLocation("/")}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
      </div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Bell className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold">Notification Center</h1>
            <p className="text-muted-foreground">Manage your communications and messages</p>
          </div>
        </div>
        <Dialog open={showNewNotificationDialog} onOpenChange={setShowNewNotificationDialog}>
          <DialogTrigger asChild>
            <Button>
              <Send className="h-4 w-4 mr-2" />
              New Message
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Send New Notification</DialogTitle>
            </DialogHeader>
            <Form {...newNotificationForm}>
              <form onSubmit={newNotificationForm.handleSubmit(handleNewNotification)} className="space-y-4">
                <FormField
                  control={newNotificationForm.control}
                  name="recipientId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Recipient</FormLabel>
                      <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select recipient" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {recipients.map((recipient) => (
                            <SelectItem key={recipient.id} value={recipient.id.toString()}>
                              {recipient.name} ({recipient.role})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={newNotificationForm.control}
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
                            <SelectItem value="general">General</SelectItem>
                            <SelectItem value="inventory">Inventory</SelectItem>
                            <SelectItem value="request">Request</SelectItem>
                            <SelectItem value="transfer">Transfer</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                            <SelectItem value="maintenance">Maintenance</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={newNotificationForm.control}
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
                  control={newNotificationForm.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subject</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter subject" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={newNotificationForm.control}
                  name="message"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Message</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Enter your message" rows={6} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowNewNotificationDialog(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createNotificationMutation.isPending}>
                    {createNotificationMutation.isPending ? "Sending..." : "Send"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Notifications List */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Messages</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search notifications..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-64"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      await queryClient.refetchQueries({ queryKey: ['/api/notifications'] });
                      await queryClient.refetchQueries({ queryKey: ['/api/users'] });
                    }}
                    className="ml-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {/* Filters */}
              <div className="flex flex-wrap gap-2 mt-4">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(category => (
                      <SelectItem key={category} value={category}>{category}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="unread">Unread</SelectItem>
                    <SelectItem value="read">Read</SelectItem>
                    <SelectItem value="replied">Replied</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="inbox">Inbox</TabsTrigger>
                  <TabsTrigger value="unread">Unread</TabsTrigger>
                  <TabsTrigger value="archived">Archived</TabsTrigger>
                </TabsList>
                <TabsContent value={activeTab} className="mt-0">
                  <ScrollArea className="h-[600px]">
                    {isLoading ? (
                      <div className="p-4 text-center">Loading notifications...</div>
                    ) : filteredNotifications.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground">
                        <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No notifications found</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {filteredNotifications.map((notification) => (
                          <div
                            key={notification.id}
                            className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors border-l-4 ${getPriorityColor(notification.priority)} ${
                              notification.status === 'unread' ? 'bg-blue-50' : ''
                            } ${selectedNotification?.id === notification.id ? 'bg-blue-100' : ''}`}
                            onClick={() => handleNotificationClick(notification)}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  {getPriorityIcon(notification.priority)}
                                  <h3 className="font-semibold text-sm truncate">
                                    {notification.subject}
                                  </h3>
                                  {notification.status === 'unread' && (
                                    <div className="h-2 w-2 bg-blue-500 rounded-full flex-shrink-0" />
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                                  <User className="h-3 w-3" />
                                  <span>From: {notification.sender?.name || 'Unknown'}</span>
                                  <span>•</span>
                                  <Calendar className="h-3 w-3" />
                                  <span>{formatDistanceToNow(new Date(notification.createdAt))} ago</span>
                                </div>
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                  {notification.message}
                                </p>
                              </div>
                              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                <Badge variant="outline" className="text-xs">
                                  {notification.category}
                                </Badge>
                                <Badge 
                                  variant={notification.status === 'unread' ? 'default' : 'secondary'}
                                  className="text-xs"
                                >
                                  {notification.status}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Notification Detail */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Message Details</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedNotification ? (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      {getPriorityIcon(selectedNotification.priority)}
                      <h3 className="font-semibold">{selectedNotification.subject}</h3>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                      <User className="h-4 w-4" />
                      <span>From: {selectedNotification.sender?.name || 'Unknown'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                      <Calendar className="h-4 w-4" />
                      <span>{format(new Date(selectedNotification.createdAt), 'PPpp')}</span>
                    </div>
                    <div className="flex gap-2 mb-4">
                      <Badge variant="outline">{selectedNotification.category}</Badge>
                      <Badge variant={selectedNotification.status === 'unread' ? 'default' : 'secondary'}>
                        {selectedNotification.status}
                      </Badge>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <h4 className="font-medium mb-2">Message</h4>
                    <p className="text-sm whitespace-pre-wrap">{selectedNotification.message}</p>
                  </div>
                  
                  <Separator />
                  
                  <div className="flex flex-col gap-2">
                    {selectedNotification.status !== 'closed' && (
                      <>
                        <Dialog open={showReplyDialog} onOpenChange={setShowReplyDialog}>
                          <DialogTrigger asChild>
                            <Button size="sm" className="w-full">
                              <Reply className="h-4 w-4 mr-2" />
                              Reply
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Reply to: {selectedNotification.subject}</DialogTitle>
                            </DialogHeader>
                            <Form {...replyForm}>
                              <form onSubmit={replyForm.handleSubmit(handleReply)} className="space-y-4">
                                <FormField
                                  control={replyForm.control}
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
                                          <SelectItem value="normal">Normal</SelectItem>
                                          <SelectItem value="high">High</SelectItem>
                                          <SelectItem value="urgent">Urgent</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={replyForm.control}
                                  name="message"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Reply Message</FormLabel>
                                      <FormControl>
                                        <Textarea {...field} placeholder="Enter your reply" rows={6} />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <div className="flex justify-end gap-2">
                                  <Button type="button" variant="outline" onClick={() => setShowReplyDialog(false)}>
                                    Cancel
                                  </Button>
                                  <Button type="submit" disabled={replyMutation.isPending}>
                                    {replyMutation.isPending ? "Sending..." : "Send Reply"}
                                  </Button>
                                </div>
                              </form>
                            </Form>
                          </DialogContent>
                        </Dialog>
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => closeNotificationMutation.mutate(selectedNotification.id)}
                          disabled={closeNotificationMutation.isPending}
                          className="w-full"
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Mark as Closed
                        </Button>
                      </>
                    )}
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleShowThread(selectedNotification)}
                      className="w-full"
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      View Thread
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => archiveNotificationMutation.mutate(selectedNotification.id)}
                      disabled={archiveNotificationMutation.isPending}
                      className="w-full"
                    >
                      <Archive className="h-4 w-4 mr-2" />
                      Archive
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Select a notification to view details</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Thread Dialog */}
      <Dialog open={showThreadDialog} onOpenChange={setShowThreadDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Conversation Thread</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh]">
            <div className="space-y-4">
              {threadNotifications.map((notification, index) => (
                <div
                  key={notification.id}
                  className={`p-4 rounded-lg border-l-4 ${getPriorityColor(notification.priority)}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getPriorityIcon(notification.priority)}
                      <h4 className="font-semibold">{notification.subject}</h4>
                      <Badge variant="outline" className="text-xs">
                        {notification.category}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(notification.createdAt))} ago
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                    <User className="h-3 w-3" />
                    <span>{notification.sender?.name || 'Unknown'} ({notification.sender?.role})</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{notification.message}</p>
                  {index < threadNotifications.length - 1 && <Separator className="mt-4" />}
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}