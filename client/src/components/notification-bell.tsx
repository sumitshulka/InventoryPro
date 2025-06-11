import { useState, useEffect } from "react";
import { Bell, X, MessageSquare, Archive, CheckCircle, AlertCircle, Info, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

interface NotificationBellProps {
  onOpenNotificationCenter: () => void;
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

const getPriorityIcon = (priority: string) => {
  switch (priority) {
    case 'urgent':
      return <AlertCircle className="h-3 w-3 text-red-500" />;
    case 'high':
      return <AlertCircle className="h-3 w-3 text-orange-500" />;
    case 'normal':
      return <Info className="h-3 w-3 text-blue-500" />;
    case 'low':
      return <Clock className="h-3 w-3 text-gray-500" />;
    default:
      return <Info className="h-3 w-3 text-blue-500" />;
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

export function NotificationBell({ onOpenNotificationCenter }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get unread count
  const { data: unreadCountData } = useQuery({
    queryKey: ['/api/notifications/unread-count'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });
  
  const unreadCount = (unreadCountData as { count: number })?.count || 0;

  // Get latest notifications for dropdown
  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ['/api/notifications'],
    enabled: isOpen,
  });

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to mark as read');
      return response.json();
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

  // Get latest 5 notifications for dropdown
  const latestNotifications = notifications.slice(0, 5);

  const handleMarkAsRead = (notificationId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    markAsReadMutation.mutate(notificationId);
  };

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read if unread
    if (notification.status === 'unread') {
      markAsReadMutation.mutate(notification.id);
    }
    
    // Close dropdown and open notification center
    setIsOpen(false);
    onOpenNotificationCenter();
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Notifications</CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenNotificationCenter();
                  }}
                  className="text-xs"
                >
                  View All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {unreadCount > 0 && (
              <p className="text-sm text-muted-foreground">
                You have {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
              </p>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-80">
              {latestNotifications.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No notifications
                </div>
              ) : (
                <div className="space-y-1">
                  {latestNotifications.map((notification, index) => (
                    <div key={notification.id}>
                      <div
                        className={`p-3 cursor-pointer hover:bg-gray-50 transition-colors border-l-4 ${getPriorityColor(notification.priority)} ${
                          notification.status === 'unread' ? 'bg-blue-50' : ''
                        }`}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {getPriorityIcon(notification.priority)}
                              <p className="text-sm font-medium truncate">
                                {notification.subject}
                              </p>
                              {notification.status === 'unread' && (
                                <div className="h-2 w-2 bg-blue-500 rounded-full flex-shrink-0" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              From: {notification.sender?.name || 'Unknown'}
                            </p>
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                              {notification.message}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatDistanceToNow(new Date(notification.createdAt))} ago
                            </p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {notification.status === 'unread' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => handleMarkAsRead(notification.id, e)}
                                className="h-6 w-6 p-0"
                              >
                                <CheckCircle className="h-3 w-3" />
                              </Button>
                            )}
                            <Badge
                              variant="outline"
                              className="text-xs"
                            >
                              {notification.category}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      {index < latestNotifications.length - 1 && <Separator />}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
            {latestNotifications.length > 0 && (
              <>
                <Separator />
                <div className="p-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsOpen(false);
                      onOpenNotificationCenter();
                    }}
                    className="w-full"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Open Notification Center
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
}