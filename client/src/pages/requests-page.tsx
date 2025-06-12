import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import AppLayout from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Plus, CheckCircle, X, Eye, Download, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { formatDateTime, getStatusColor } from "@/lib/utils";
import { DataTablePagination } from "@/components/ui/data-table-pagination";

const requestItemSchema = z.object({
  itemId: z.string().min(1, { message: "Item is required" }),
  quantity: z.string().min(1, { message: "Quantity is required" }).transform(val => parseInt(val)),
});

const formSchema = z.object({
  warehouseId: z.string().min(1, { message: "Warehouse is required" }),
  priority: z.string().min(1, { message: "Priority is required" }),
  notes: z.string().optional(),
  items: z.array(requestItemSchema).min(1, { message: "At least one item is required" }),
});

type RequestItemFormValues = z.infer<typeof requestItemSchema>;
type FormValues = z.infer<typeof formSchema>;

export default function RequestsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("all");

  const { data: requests, isLoading: requestsLoading, refetch: refetchRequests } = useQuery({
    queryKey: ["/api/requests"],
  });

  const { data: userOperatedWarehouses = [], isLoading: operatedWarehousesLoading } = useQuery<number[]>({
    queryKey: ["/api/users", user?.id, "operated-warehouses"],
    enabled: !!user?.id,
  });

  const { data: items, isLoading: itemsLoading, refetch: refetchItems } = useQuery({
    queryKey: ["/api/items"],
  });

  const { data: warehouses, isLoading: warehousesLoading, refetch: refetchWarehouses } = useQuery({
    queryKey: ["/api/warehouses"],
  });

  const { data: users, isLoading: usersLoading, refetch: refetchUsers } = useQuery({
    queryKey: ["/api/users"],
  });

  const { data: inventory, isLoading: inventoryLoading, refetch: refetchInventory } = useQuery({
    queryKey: ["/api/reports/inventory-stock"],
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      warehouseId: user?.warehouseId ? user.warehouseId.toString() : "",
      priority: "normal",
      notes: "",
      items: [{ itemId: "", quantity: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const createRequestMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const payload = {
        warehouseId: parseInt(data.warehouseId),
        notes: data.notes,
        items: data.items.map(item => ({
          itemId: parseInt(item.itemId),
          quantity: item.quantity,
        })),
      };
      
      const res = await apiRequest("POST", "/api/requests", payload);
      return res.json();
    },
    onSuccess: () => {
      // Optimized: Only invalidate essential queries, not all related data
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      
      toast({
        title: "Request created",
        description: "Your inventory request has been created successfully.",
      });
      form.reset({
        warehouseId: user?.warehouseId ? user.warehouseId.toString() : "",
        notes: "",
        items: [{ itemId: "", quantity: "" }],
      });
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateRequestStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest("PUT", `/api/requests/${id}/status`, { status });
      return res.json();
    },
    onSuccess: () => {
      // Invalidate all related queries to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/inventory-stock"] });
      
      // Force refetch of requests query
      queryClient.refetchQueries({ queryKey: ["/api/requests"] });
      
      toast({
        title: "Request updated",
        description: "The request status has been updated successfully.",
      });
      setDetailsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getRequestDetails = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/requests/${id}`);
      if (!res.ok) {
        throw new Error("Failed to fetch request details");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setSelectedRequest(data);
      setDetailsDialogOpen(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleViewRequest = (requestId: number) => {
    getRequestDetails.mutate(requestId);
  };

  const handleSubmit = (values: FormValues) => {
    createRequestMutation.mutate(values);
  };

  const handleUpdateStatus = (id: number, status: string) => {
    updateRequestStatusMutation.mutate({ id, status });
  };

  // Filter requests based on user permissions
  const isWarehouseOperator = userOperatedWarehouses.length > 0;
  const canViewAllRequests = user?.role === 'admin' || user?.role === 'manager' || isWarehouseOperator;

  const filteredRequests = (requests as any[])
    ? (requests as any[]).filter((request: any) => {
        // Role-based filtering: employees can only see their own requests unless they're warehouse operators
        if (!canViewAllRequests && request.userId !== user?.id) {
          return false;
        }
        
        if (activeTab === "all") return true;
        return request.status === activeTab;
      })
    : [];

  const getUserName = (userId: number) => {
    if (!users) return `User #${userId}`;
    const user = users.find((u: any) => u.id === userId);
    return user ? user.name : `User #${userId}`;
  };

  const getWarehouseName = (warehouseId: number) => {
    if (!warehouses) return `Warehouse #${warehouseId}`;
    const warehouse = warehouses.find((w: any) => w.id === warehouseId);
    return warehouse ? warehouse.name : `Warehouse #${warehouseId}`;
  };

  const getItemName = (itemId: number) => {
    if (!items) return `Item #${itemId}`;
    const item = items.find((i: any) => i.id === itemId);
    return item ? item.name : `Item #${itemId}`;
  };

  const isManager = user?.role === "admin" || user?.role === "manager";

  if (requestsLoading || itemsLoading || warehousesLoading || usersLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Inventory Check Out Requests</h1>
          <p className="text-gray-600">Create and manage inventory requests</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Request
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle>Request List</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await refetchRequests();
                await refetchInventory();
                await refetchUsers();
                await refetchWarehouses();
                await refetchItems();
              }}
              className="ml-2"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
              <TabsTrigger value="rejected">Rejected</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          <DataTablePagination data={filteredRequests}>
            {(paginatedRequests) => (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Request ID</TableHead>
                      <TableHead>Requested By</TableHead>
                      <TableHead>Warehouse</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedRequests.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                          No requests found
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedRequests.map((request: any) => (
                        <TableRow key={request.id}>
                          <TableCell className="font-medium">{request.requestCode}</TableCell>
                          <TableCell>{getUserName(request.userId)}</TableCell>
                          <TableCell>{getWarehouseName(request.warehouseId)}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{request.notes || "—"}</TableCell>
                          <TableCell>{formatDateTime(request.createdAt)}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(request.status)}`}>
                              {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewRequest(request.id)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {isManager && request.status === "pending" && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-green-600"
                                    onClick={() => handleUpdateStatus(request.id, "approved")}
                                  >
                                    <CheckCircle className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-600"
                                    onClick={() => handleUpdateStatus(request.id, "rejected")}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </DataTablePagination>
        </CardContent>
      </Card>

      {/* New Request Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Inventory Request</DialogTitle>
            <DialogDescription>
              Fill in the details to request items for your location
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="warehouseId">Destination Warehouse</Label>
                <Select
                  onValueChange={(value) => form.setValue("warehouseId", value)}
                  defaultValue={form.getValues("warehouseId")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses?.filter((w: any) => w.isActive).map((warehouse: any) => (
                      <SelectItem key={warehouse.id} value={warehouse.id.toString()}>
                        {warehouse.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.warehouseId && (
                  <p className="text-sm text-red-500">{form.formState.errors.warehouseId.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  onValueChange={(value) => form.setValue("priority", value)}
                  defaultValue={form.getValues("priority")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="urgent">🔴 Urgent</SelectItem>
                    <SelectItem value="high">🟠 High</SelectItem>
                    <SelectItem value="normal">🟢 Normal</SelectItem>
                  </SelectContent>
                </Select>
                {form.formState.errors.priority && (
                  <p className="text-sm text-red-500">{form.formState.errors.priority.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Enter any additional notes for this request"
                  {...form.register("notes")}
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Request Items</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append({ itemId: "", quantity: "" })}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Item
                  </Button>
                </div>
                {form.formState.errors.items && "root" in form.formState.errors.items && (
                  <p className="text-sm text-red-500">{form.formState.errors.items.root?.message}</p>
                )}
                
                {fields.map((field, index) => (
                  <div key={field.id} className="flex items-start space-x-3">
                    <div className="flex-1 space-y-2">
                      <Label htmlFor={`items.${index}.itemId`}>Item</Label>
                      <Select
                        onValueChange={(value) => form.setValue(`items.${index}.itemId`, value)}
                        defaultValue={form.getValues(`items.${index}.itemId`)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select an item" />
                        </SelectTrigger>
                        <SelectContent>
                          {items?.filter((item: any) => item.status === "active").length > 0 ? (
                            items.filter((item: any) => item.status === "active").map((item: any) => (
                              <SelectItem key={item.id} value={item.id.toString()}>
                                {item.name} ({item.sku})
                              </SelectItem>
                            ))
                          ) : (
                            <div className="p-2 text-sm text-gray-500">
                              No active items available. Create items in Item Master first.
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                      {form.formState.errors.items?.[index]?.itemId && (
                        <p className="text-sm text-red-500">
                          {form.formState.errors.items[index]?.itemId?.message}
                        </p>
                      )}
                    </div>
                    <div className="w-24 space-y-2">
                      <Label htmlFor={`items.${index}.quantity`}>Quantity</Label>
                      <Input
                        id={`items.${index}.quantity`}
                        type="number"
                        min="1"
                        placeholder="Qty"
                        {...form.register(`items.${index}.quantity`)}
                      />
                      {form.formState.errors.items?.[index]?.quantity && (
                        <p className="text-sm text-red-500">
                          {form.formState.errors.items[index]?.quantity?.message}
                        </p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="mt-8"
                      onClick={() => fields.length > 1 && remove(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createRequestMutation.isPending}
              >
                {createRequestMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Request"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Request Details Dialog */}
      {selectedRequest && (
        <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Request Details</DialogTitle>
              <DialogDescription>
                {selectedRequest.requestCode} • {formatDateTime(selectedRequest.createdAt)}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Requested By</h4>
                  <p className="text-gray-900">{getUserName(selectedRequest.userId)}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Destination Warehouse</h4>
                  <p className="text-gray-900">{getWarehouseName(selectedRequest.warehouseId)}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Status</h4>
                  <span className={`inline-block mt-1 px-2 py-1 text-xs rounded-full ${getStatusColor(selectedRequest.status)}`}>
                    {selectedRequest.status.charAt(0).toUpperCase() + selectedRequest.status.slice(1)}
                  </span>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Priority</h4>
                  <span className={`inline-block mt-1 px-2 py-1 text-xs rounded-full ${
                    selectedRequest.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                    selectedRequest.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {selectedRequest.priority === 'urgent' ? '🔴 Urgent' :
                     selectedRequest.priority === 'high' ? '🟠 High' :
                     '🟢 Normal'}
                  </span>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Created On</h4>
                  <p className="text-gray-900">{formatDateTime(selectedRequest.createdAt)}</p>
                </div>
              </div>

              {selectedRequest.notes && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Notes</h4>
                  <p className="text-gray-900 mt-1 p-3 bg-gray-50 rounded-md">{selectedRequest.notes}</p>
                </div>
              )}

              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2">Requested Items</h4>
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedRequest.items?.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell>{getItemName(item.itemId)}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>

            <DialogFooter>
              {isManager && (
                <div className="flex space-x-2 mr-auto">
                  {selectedRequest.status === "pending" && (
                    <>
                      <Button
                        variant="outline"
                        className="border-green-500 text-green-600 hover:bg-green-50"
                        onClick={() => handleUpdateStatus(selectedRequest.id, "approved")}
                        disabled={updateRequestStatusMutation.isPending}
                      >
                        {updateRequestStatusMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle className="mr-2 h-4 w-4" />
                        )}
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        className="border-red-500 text-red-600 hover:bg-red-50"
                        onClick={() => handleUpdateStatus(selectedRequest.id, "rejected")}
                        disabled={updateRequestStatusMutation.isPending}
                      >
                        {updateRequestStatusMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <X className="mr-2 h-4 w-4" />
                        )}
                        Reject
                      </Button>
                    </>
                  )}
                  {selectedRequest.status === "approved" && (
                    <Button
                      variant="outline"
                      className="border-blue-500 text-blue-600 hover:bg-blue-50"
                      onClick={() => handleUpdateStatus(selectedRequest.id, "completed")}
                      disabled={updateRequestStatusMutation.isPending}
                    >
                      {updateRequestStatusMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle className="mr-2 h-4 w-4" />
                      )}
                      Complete Request
                    </Button>
                  )}
                </div>
              )}
              <Button
                variant="outline"
                onClick={() => setDetailsDialogOpen(false)}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </AppLayout>
  );
}
