import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import AppLayout from "@/components/layout/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Clock, User, XCircle, Package, AlertTriangle, FileText, ShoppingCart, Building, ExternalLink } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface RequestApproval {
  id: number;
  requestId: number;
  approverId: number;
  approvalLevel: string;
  status: string;
  approvedAt: string | null;
  notes: string | null;
  request?: {
    id: number;
    requestCode: string;
    userId: number;
    status: string;
    priority: string;
    justification: string;
    notes: string;
    submittedAt: string;
    warehouseId: number;
    user?: {
      id: number;
      name: string;
      email: string;
      role: string;
      department?: { name: string };
    };
    items?: {
      id: number;
      itemId: number;
      quantity: number;
      urgency: string;
      justification: string;
      availableQuantity?: number;
      item?: {
        id: number;
        name: string;
        sku: string;
        unit: string;
      };
    }[];
  };
}

interface SalesOrderApproval {
  id: number;
  salesOrderId: number;
  approverId: number;
  approvalLevel: string;
  status: string;
  comments: string | null;
  approvedAt: string | null;
  createdAt: string;
  salesOrder?: {
    id: number;
    orderCode: string;
    orderDate: string;
    status: string;
    currencyCode: string;
    totalAmount: string;
    itemCount: number;
    notes?: string | null;
    client?: {
      id: number;
      companyName: string;
      contactPerson: string;
    } | null;
    warehouse?: {
      id: number;
      name: string;
    } | null;
    creator?: {
      id: number;
      name: string;
    } | null;
  };
}

export default function ApprovalManagementPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("requests");
  const [selectedApproval, setSelectedApproval] = useState<RequestApproval | null>(null);
  const [selectedSalesOrderApproval, setSelectedSalesOrderApproval] = useState<SalesOrderApproval | null>(null);
  const [actionNotes, setActionNotes] = useState("");

  const { data: pendingApprovals = [], isLoading: isLoadingRequests } = useQuery<RequestApproval[]>({
    queryKey: ["/api/pending-approvals"],
  });

  const { data: pendingSalesOrderApprovals = [], isLoading: isLoadingSalesOrders } = useQuery<SalesOrderApproval[]>({
    queryKey: ["/api/pending-sales-order-approvals"],
  });

  const { data: items = [] } = useQuery<{ id: number; name: string; sku: string }[]>({
    queryKey: ["/api/items"],
  });

  const { data: warehouses = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ["/api/warehouses"],
  });

  const approvalMutation = useMutation({
    mutationFn: async ({ 
      approvalId, 
      action, 
      notes 
    }: { 
      approvalId: number; 
      action: 'approve' | 'reject'; 
      notes?: string;
    }) => {
      return await apiRequest("PATCH", `/api/approvals/${approvalId}/${action}`, {
        notes: notes || null
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pending-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      setSelectedApproval(null);
      setActionNotes("");
      toast({
        title: "Success",
        description: "Request approval processed successfully",
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

  const salesOrderApprovalMutation = useMutation({
    mutationFn: async ({ 
      approvalId, 
      action, 
      comments 
    }: { 
      approvalId: number; 
      action: 'approve' | 'reject'; 
      comments?: string;
    }) => {
      return await apiRequest("PATCH", `/api/sales-order-approvals/${approvalId}/${action}`, {
        comments: comments || null
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pending-sales-order-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales-orders"] });
      setSelectedSalesOrderApproval(null);
      setActionNotes("");
      toast({
        title: "Success",
        description: "Sales order approval processed successfully",
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

  const handleApprove = () => {
    if (!selectedApproval) return;
    approvalMutation.mutate({
      approvalId: selectedApproval.id,
      action: 'approve',
      notes: actionNotes
    });
  };

  const handleReject = () => {
    if (!selectedApproval) return;
    approvalMutation.mutate({
      approvalId: selectedApproval.id,
      action: 'reject',
      notes: actionNotes
    });
  };

  const handleSalesOrderApprove = () => {
    if (!selectedSalesOrderApproval) return;
    salesOrderApprovalMutation.mutate({
      approvalId: selectedSalesOrderApproval.id,
      action: 'approve',
      comments: actionNotes
    });
  };

  const handleSalesOrderReject = () => {
    if (!selectedSalesOrderApproval) return;
    salesOrderApprovalMutation.mutate({
      approvalId: selectedSalesOrderApproval.id,
      action: 'reject',
      comments: actionNotes
    });
  };

  const getWarehouseName = (warehouseId: number) => {
    const warehouse = warehouses.find((w: any) => w.id === warehouseId);
    return warehouse ? warehouse.name : `Warehouse #${warehouseId}`;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatCurrency = (amount: string, currencyCode: string) => {
    const symbols: Record<string, string> = {
      USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥'
    };
    return `${symbols[currencyCode] || currencyCode + ' '}${parseFloat(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  };

  const totalPending = pendingApprovals.length + pendingSalesOrderApprovals.length;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Approval Management</h1>
          <p className="text-muted-foreground">
            Review and approve pending requests and sales orders
            {totalPending > 0 && (
              <Badge className="ml-2" variant="secondary">{totalPending} pending</Badge>
            )}
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="requests" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Inventory Requests
              {pendingApprovals.length > 0 && (
                <Badge variant="secondary" className="ml-1">{pendingApprovals.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="sales-orders" className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Sales Orders
              {pendingSalesOrderApprovals.length > 0 && (
                <Badge variant="secondary" className="ml-1">{pendingSalesOrderApprovals.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="requests" className="mt-6">
            {isLoadingRequests ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : pendingApprovals.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold mb-4">
                    Pending Inventory Requests ({pendingApprovals.length})
                  </h2>
                  {pendingApprovals.map((approval: RequestApproval) => (
                    <Card 
                      key={approval.id}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        selectedApproval?.id === approval.id ? 'ring-2 ring-primary' : ''
                      }`}
                      onClick={() => {
                        setSelectedApproval(approval);
                        setActionNotes("");
                      }}
                      data-testid={`card-request-approval-${approval.id}`}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">
                            {approval.request?.requestCode || `Request #${approval.requestId}`}
                          </CardTitle>
                          <div className="flex items-center gap-2">
                            {approval.request?.priority && (
                              <Badge 
                                variant="outline" 
                                className={`${
                                  approval.request.priority === 'urgent' ? 'border-red-500 text-red-700 bg-red-50' :
                                  approval.request.priority === 'high' ? 'border-orange-500 text-orange-700 bg-orange-50' :
                                  'border-green-500 text-green-700 bg-green-50'
                                }`}
                              >
                                {approval.request.priority === 'urgent' ? 'Urgent' :
                                 approval.request.priority === 'high' ? 'High' :
                                 'Normal'}
                              </Badge>
                            )}
                            <Badge variant="outline">
                              <Clock className="w-3 h-3 mr-1" />
                              Pending
                            </Badge>
                          </div>
                        </div>
                        <CardDescription>
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            Requested by {approval.request?.user?.name || 'Unknown User'}
                            {approval.request?.user?.department && (
                              <span className="text-xs text-gray-500">
                                • {approval.request.user.department.name}
                              </span>
                            )}
                          </div>
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="flex items-center justify-between text-sm text-gray-600">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1">
                              <Package className="h-4 w-4" />
                              <span>{getWarehouseName(approval.request?.warehouseId || 0)}</span>
                            </div>
                            <span>{new Date(approval.request?.submittedAt || '').toLocaleDateString()}</span>
                          </div>
                        </div>
                        {approval.request?.justification && (
                          <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                            {approval.request.justification}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="lg:sticky lg:top-6">
                  {selectedApproval ? (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          Approval Details
                          <Badge className={getPriorityColor(selectedApproval.request?.priority || 'medium')}>
                            {selectedApproval.request?.priority || 'Medium'} Priority
                          </Badge>
                        </CardTitle>
                        <CardDescription>
                          {selectedApproval.request?.requestCode} • {getWarehouseName(selectedApproval.request?.warehouseId || 0)}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div>
                          <h4 className="font-semibold text-sm text-gray-700 mb-2">Request Information</h4>
                          <div className="bg-gray-50 p-3 rounded space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Requester:</span>
                              <span>{selectedApproval.request?.user?.name || 'Unknown'}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Submitted:</span>
                              <span>{new Date(selectedApproval.request?.submittedAt || '').toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Warehouse:</span>
                              <span>{getWarehouseName(selectedApproval.request?.warehouseId || 0)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Status:</span>
                              <Badge variant="outline">{selectedApproval.request?.status}</Badge>
                            </div>
                          </div>
                        </div>

                        {selectedApproval.request?.justification && (
                          <div>
                            <h4 className="font-semibold text-sm text-gray-700 mb-2">Justification</h4>
                            <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                              {selectedApproval.request.justification}
                            </p>
                          </div>
                        )}

                        {selectedApproval.request?.items && selectedApproval.request.items.length > 0 && (
                          <div>
                            <h4 className="font-semibold text-sm text-gray-700 mb-2">Requested Items</h4>
                            <div className="space-y-2">
                              {selectedApproval.request.items.map((item: any) => (
                                <div key={item.id} className="p-3 bg-gray-50 rounded border-l-4 border-l-blue-500">
                                  <div className="flex items-center justify-between mb-2">
                                    <div>
                                      <p className="font-medium text-sm">{item.item?.name || `Item #${item.itemId}`}</p>
                                      <p className="text-xs text-gray-500">{item.item?.sku || 'N/A'}</p>
                                      {item.justification && (
                                        <p className="text-xs text-gray-600 mt-1">{item.justification}</p>
                                      )}
                                    </div>
                                    <div className="text-right">
                                      <p className="font-semibold text-sm">Requested: {item.quantity}</p>
                                      <p className="text-xs text-gray-500">Urgency: {item.urgency}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-gray-600">Available:</span>
                                      <span className={`text-xs font-semibold ${
                                        item.availableQuantity >= item.quantity 
                                          ? 'text-green-600' 
                                          : item.availableQuantity > 0 
                                            ? 'text-yellow-600' 
                                            : 'text-red-600'
                                      }`}>
                                        {item.availableQuantity || 0} {item.item?.unit || 'units'}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      {item.availableQuantity >= item.quantity ? (
                                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                          Available
                                        </span>
                                      ) : item.availableQuantity > 0 ? (
                                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                                          Partial
                                        </span>
                                      ) : (
                                        <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                                          Transfer Required
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {selectedApproval.request?.notes && (
                          <div>
                            <h4 className="font-semibold text-sm text-gray-700 mb-2">Additional Notes</h4>
                            <p className="text-sm text-gray-600 bg-blue-50 p-3 rounded border border-blue-200">
                              {selectedApproval.request.notes}
                            </p>
                          </div>
                        )}

                        <Separator />

                        <div>
                          <h4 className="font-semibold text-sm text-gray-700 mb-2">Approval Notes (Optional)</h4>
                          <Textarea
                            placeholder="Add notes for your approval decision..."
                            value={actionNotes}
                            onChange={(e) => setActionNotes(e.target.value)}
                            rows={3}
                            data-testid="input-approval-notes"
                          />
                        </div>

                        <div className="flex gap-3">
                          <Button
                            onClick={handleApprove}
                            disabled={approvalMutation.isPending}
                            className="flex-1"
                            data-testid="button-approve-request"
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            {approvalMutation.isPending ? "Processing..." : "Approve"}
                          </Button>
                          <Button
                            onClick={handleReject}
                            disabled={approvalMutation.isPending}
                            variant="destructive"
                            className="flex-1"
                            data-testid="button-reject-request"
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            {approvalMutation.isPending ? "Processing..." : "Reject"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <AlertTriangle className="h-12 w-12 text-gray-400 mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Select an Approval</h3>
                        <p className="text-gray-600 text-center">
                          Choose a request from the list to review details and take action
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CheckCircle className="h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Pending Inventory Requests</h3>
                  <p className="text-gray-600 text-center">
                    All inventory requests have been reviewed. New requests will appear here for approval.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="sales-orders" className="mt-6">
            {isLoadingSalesOrders ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : pendingSalesOrderApprovals.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold mb-4">
                    Pending Sales Orders ({pendingSalesOrderApprovals.length})
                  </h2>
                  {pendingSalesOrderApprovals.map((approval: SalesOrderApproval) => (
                    <Card 
                      key={approval.id}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        selectedSalesOrderApproval?.id === approval.id ? 'ring-2 ring-primary' : ''
                      }`}
                      onClick={() => {
                        setSelectedSalesOrderApproval(approval);
                        setActionNotes("");
                      }}
                      data-testid={`card-sales-order-approval-${approval.id}`}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            {approval.salesOrder?.orderCode || `Order #${approval.salesOrderId}`}
                          </CardTitle>
                          <Badge variant="outline">
                            <Clock className="w-3 h-3 mr-1" />
                            Pending
                          </Badge>
                        </div>
                        <CardDescription>
                          <div className="flex items-center gap-2">
                            <Building className="w-4 h-4" />
                            {approval.salesOrder?.client?.companyName || 'Unknown Client'}
                          </div>
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-4 text-gray-600">
                            <span>{approval.salesOrder?.itemCount || 0} items</span>
                            <span>{new Date(approval.salesOrder?.orderDate || '').toLocaleDateString()}</span>
                          </div>
                          <span className="font-semibold text-primary">
                            {formatCurrency(approval.salesOrder?.totalAmount || '0', approval.salesOrder?.currencyCode || 'USD')}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="lg:sticky lg:top-6">
                  {selectedSalesOrderApproval ? (
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="flex items-center gap-2">
                              Sales Order Details
                            </CardTitle>
                            <CardDescription>
                              {selectedSalesOrderApproval.salesOrder?.orderCode}
                            </CardDescription>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/sales-orders/${selectedSalesOrderApproval.salesOrderId}`)}
                            data-testid="button-view-order"
                          >
                            <ExternalLink className="h-4 w-4 mr-1" />
                            View Order
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div>
                          <h4 className="font-semibold text-sm text-gray-700 mb-2">Order Information</h4>
                          <div className="bg-gray-50 p-3 rounded space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Client:</span>
                              <span className="font-medium">{selectedSalesOrderApproval.salesOrder?.client?.companyName || 'Unknown'}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Contact:</span>
                              <span>{selectedSalesOrderApproval.salesOrder?.client?.contactPerson || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Order Date:</span>
                              <span>{new Date(selectedSalesOrderApproval.salesOrder?.orderDate || '').toLocaleDateString()}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Warehouse:</span>
                              <span>{selectedSalesOrderApproval.salesOrder?.warehouse?.name || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Created By:</span>
                              <span>{selectedSalesOrderApproval.salesOrder?.creator?.name || 'Unknown'}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Items:</span>
                              <span>{selectedSalesOrderApproval.salesOrder?.itemCount || 0} line items</span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-primary/10 p-4 rounded-lg">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium">Total Amount:</span>
                            <span className="text-xl font-bold text-primary">
                              {formatCurrency(
                                selectedSalesOrderApproval.salesOrder?.totalAmount || '0',
                                selectedSalesOrderApproval.salesOrder?.currencyCode || 'USD'
                              )}
                            </span>
                          </div>
                        </div>

                        {selectedSalesOrderApproval.salesOrder?.notes && (
                          <div>
                            <h4 className="font-semibold text-sm text-gray-700 mb-2">Order Notes</h4>
                            <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                              {selectedSalesOrderApproval.salesOrder.notes}
                            </p>
                          </div>
                        )}

                        <Separator />

                        <div>
                          <h4 className="font-semibold text-sm text-gray-700 mb-2">Approval Comments (Optional)</h4>
                          <Textarea
                            placeholder="Add comments for your approval decision..."
                            value={actionNotes}
                            onChange={(e) => setActionNotes(e.target.value)}
                            rows={3}
                            data-testid="input-sales-order-approval-comments"
                          />
                        </div>

                        <div className="flex gap-3">
                          <Button
                            onClick={handleSalesOrderApprove}
                            disabled={salesOrderApprovalMutation.isPending}
                            className="flex-1"
                            data-testid="button-approve-sales-order"
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            {salesOrderApprovalMutation.isPending ? "Processing..." : "Approve"}
                          </Button>
                          <Button
                            onClick={handleSalesOrderReject}
                            disabled={salesOrderApprovalMutation.isPending}
                            variant="destructive"
                            className="flex-1"
                            data-testid="button-reject-sales-order"
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            {salesOrderApprovalMutation.isPending ? "Processing..." : "Reject"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <AlertTriangle className="h-12 w-12 text-gray-400 mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Select a Sales Order</h3>
                        <p className="text-gray-600 text-center">
                          Choose a sales order from the list to review details and take action
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CheckCircle className="h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Pending Sales Orders</h3>
                  <p className="text-gray-600 text-center">
                    All sales orders have been reviewed. New orders awaiting approval will appear here.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
