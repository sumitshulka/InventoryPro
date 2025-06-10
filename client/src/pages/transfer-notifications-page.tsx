import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Package, ArrowRightLeft, CheckCircle, XCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface TransferNotification {
  id: number;
  requestId: number;
  warehouseId: number;
  itemId: number;
  requiredQuantity: number;
  availableQuantity: number;
  status: string;
  notifiedUserId: number | null;
  transferId: number | null;
  notes: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

interface Item {
  id: number;
  name: string;
  sku: string;
  unit: string;
}

interface Warehouse {
  id: number;
  name: string;
  location: string;
}

interface Request {
  id: number;
  requestCode: string;
  status: string;
  userId: number;
  warehouseId: number;
  justification: string;
  notes: string;
  submittedAt: string;
}

export default function TransferNotificationsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch transfer notifications
  const { data: notifications = [], isLoading: notificationsLoading } = useQuery({
    queryKey: ["/api/transfer-notifications"],
  });

  // Fetch items for reference
  const { data: items = [] } = useQuery<Item[]>({
    queryKey: ["/api/items"],
  });

  // Fetch warehouses for reference
  const { data: warehouses = [] } = useQuery<Warehouse[]>({
    queryKey: ["/api/warehouses"],
  });

  // Fetch requests for reference
  const { data: requests = [] } = useQuery<Request[]>({
    queryKey: ["/api/requests"],
  });

  const updateNotificationMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: number; status: string; notes?: string }) => {
      return await apiRequest(`/api/transfer-notifications/${id}`, "PATCH", {
        status,
        notes,
        resolvedAt: status !== 'pending' ? new Date().toISOString() : null
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transfer-notifications"] });
      toast({
        title: "Success",
        description: "Transfer notification updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleApprove = (notification: TransferNotification) => {
    updateNotificationMutation.mutate({
      id: notification.id,
      status: "approved",
      notes: `${notification.notes || ''}\n\nApproved for transfer by warehouse manager.`
    });
  };

  const handleReject = (notification: TransferNotification) => {
    updateNotificationMutation.mutate({
      id: notification.id,
      status: "rejected",
      notes: `${notification.notes || ''}\n\nRejected by warehouse manager - insufficient stock or other constraints.`
    });
  };

  const getItemName = (itemId: number) => {
    const item = items.find(i => i.id === itemId);
    return item ? `${item.name} (${item.sku})` : `Item #${itemId}`;
  };

  const getWarehouseName = (warehouseId: number) => {
    const warehouse = warehouses.find(w => w.id === warehouseId);
    return warehouse ? warehouse.name : `Warehouse #${warehouseId}`;
  };

  const getRequestInfo = (requestId: number) => {
    const request = requests.find(r => r.id === requestId);
    return request ? {
      code: request.requestCode,
      targetWarehouse: getWarehouseName(request.warehouseId),
      justification: request.justification
    } : {
      code: `Request #${requestId}`,
      targetWarehouse: 'Unknown',
      justification: ''
    };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'transferred': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (notificationsLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="space-y-4">
          <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-32 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-32 bg-gray-200 rounded animate-pulse"></div>
        </div>
      </div>
    );
  }

  const pendingNotifications = notifications.filter((n: TransferNotification) => n.status === 'pending');

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Transfer Notifications</h1>
        <p className="text-gray-600 mt-2">
          Manage transfer requests for items needed across warehouses
        </p>
      </div>

      {pendingNotifications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Pending Transfer Notifications</h3>
            <p className="text-gray-600 text-center">
              All transfer requests have been processed or there are no current stock transfer needs.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {pendingNotifications.map((notification: TransferNotification) => {
            const requestInfo = getRequestInfo(notification.requestId);
            
            return (
              <Card key={notification.id} className="border-l-4 border-l-yellow-500">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <AlertTriangle className="h-5 w-5 text-yellow-600" />
                      <div>
                        <CardTitle className="text-lg">
                          Transfer Request - {requestInfo.code}
                        </CardTitle>
                        <CardDescription>
                          From {getWarehouseName(notification.warehouseId)} → {requestInfo.targetWarehouse}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge className={getStatusColor(notification.status)}>
                      {notification.status.charAt(0).toUpperCase() + notification.status.slice(1)}
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold text-sm text-gray-700 mb-2">Item Details</h4>
                      <div className="bg-gray-50 p-3 rounded">
                        <p className="font-medium">{getItemName(notification.itemId)}</p>
                        <div className="flex items-center justify-between mt-2 text-sm">
                          <span className="text-gray-600">Required:</span>
                          <span className="font-semibold">{notification.requiredQuantity}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Available:</span>
                          <span className={`font-semibold ${
                            notification.availableQuantity >= notification.requiredQuantity 
                              ? 'text-green-600' 
                              : 'text-red-600'
                          }`}>
                            {notification.availableQuantity}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold text-sm text-gray-700 mb-2">Request Information</h4>
                      <div className="bg-gray-50 p-3 rounded">
                        <p className="text-sm text-gray-600 mb-1">Justification:</p>
                        <p className="text-sm">{requestInfo.justification || 'No justification provided'}</p>
                      </div>
                    </div>
                  </div>

                  {notification.notes && (
                    <div>
                      <h4 className="font-semibold text-sm text-gray-700 mb-2">Notes</h4>
                      <div className="bg-blue-50 p-3 rounded border border-blue-200">
                        <p className="text-sm text-blue-800">{notification.notes}</p>
                      </div>
                    </div>
                  )}

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      <p>Requested: {new Date(notification.createdAt).toLocaleDateString()}</p>
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button
                        onClick={() => handleReject(notification)}
                        disabled={updateNotificationMutation.isPending}
                        variant="outline"
                        size="sm"
                        className="text-red-600 border-red-300 hover:bg-red-50"
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                      <Button
                        onClick={() => handleApprove(notification)}
                        disabled={updateNotificationMutation.isPending}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Approve Transfer
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {notifications.filter((n: TransferNotification) => n.status !== 'pending').length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Processed Notifications</h2>
          <div className="space-y-3">
            {notifications
              .filter((n: TransferNotification) => n.status !== 'pending')
              .slice(0, 5)
              .map((notification: TransferNotification) => {
                const requestInfo = getRequestInfo(notification.requestId);
                
                return (
                  <Card key={notification.id} className="bg-gray-50">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <ArrowRightLeft className="h-4 w-4 text-gray-500" />
                          <div>
                            <p className="font-medium text-sm">{getItemName(notification.itemId)}</p>
                            <p className="text-xs text-gray-600">
                              {requestInfo.code} • {notification.requiredQuantity} units
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge className={getStatusColor(notification.status)} variant="secondary">
                            {notification.status.charAt(0).toUpperCase() + notification.status.slice(1)}
                          </Badge>
                          {notification.resolvedAt && (
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(notification.resolvedAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}