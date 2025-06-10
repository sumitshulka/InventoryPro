import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AppLayout from "@/components/layout/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Clock, User, XCircle, Package, AlertTriangle } from "lucide-react";
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
    };
    items?: {
      id: number;
      itemId: number;
      quantity: number;
      urgency: string;
      justification: string;
      item?: {
        id: number;
        name: string;
        sku: string;
        unit: string;
      };
    }[];
  };
}

export default function ApprovalManagementPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedApproval, setSelectedApproval] = useState<RequestApproval | null>(null);
  const [actionNotes, setActionNotes] = useState("");

  const { data: pendingApprovals = [], isLoading } = useQuery<RequestApproval[]>({
    queryKey: ["/api/pending-approvals"],
  });

  // Fetch additional data for context
  const { data: items = [] } = useQuery({
    queryKey: ["/api/items"],
  });

  const { data: warehouses = [] } = useQuery({
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
      return await apiRequest(`/api/approvals/${approvalId}/${action}`, "PATCH", {
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

  const getItemName = (itemId: number) => {
    const item = items.find((i: any) => i.id === itemId);
    return item ? `${item.name} (${item.sku})` : `Item #${itemId}`;
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

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Approval Management</h1>
          <p className="text-muted-foreground">Review and approve pending checkout requests</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : pendingApprovals.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Approvals List */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold mb-4">
                Pending Approvals ({pendingApprovals.length})
              </h2>
              {pendingApprovals.map((approval: RequestApproval) => (
                <Card 
                  key={approval.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedApproval?.id === approval.id ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setSelectedApproval(approval)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">
                        {approval.request?.requestCode || `Request #${approval.requestId}`}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        {approval.request?.priority && (
                          <Badge className={getPriorityColor(approval.request.priority)} variant="outline">
                            {approval.request.priority}
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

            {/* Approval Details */}
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
                    {/* Request Information */}
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

                    {/* Justification */}
                    {selectedApproval.request?.justification && (
                      <div>
                        <h4 className="font-semibold text-sm text-gray-700 mb-2">Justification</h4>
                        <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                          {selectedApproval.request.justification}
                        </p>
                      </div>
                    )}

                    {/* Requested Items */}
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
                                      ✓ Available
                                    </span>
                                  ) : item.availableQuantity > 0 ? (
                                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                                      ⚠ Partial
                                    </span>
                                  ) : (
                                    <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                                      ✗ Transfer Required
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {selectedApproval.request?.notes && (
                      <div>
                        <h4 className="font-semibold text-sm text-gray-700 mb-2">Additional Notes</h4>
                        <p className="text-sm text-gray-600 bg-blue-50 p-3 rounded border border-blue-200">
                          {selectedApproval.request.notes}
                        </p>
                      </div>
                    )}

                    <Separator />

                    {/* Action Notes */}
                    <div>
                      <h4 className="font-semibold text-sm text-gray-700 mb-2">Approval Notes (Optional)</h4>
                      <Textarea
                        placeholder="Add notes for your approval decision..."
                        value={actionNotes}
                        onChange={(e) => setActionNotes(e.target.value)}
                        rows={3}
                      />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                      <Button
                        onClick={handleApprove}
                        disabled={approvalMutation.isPending}
                        className="flex-1"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        {approvalMutation.isPending ? "Processing..." : "Approve"}
                      </Button>
                      <Button
                        onClick={handleReject}
                        disabled={approvalMutation.isPending}
                        variant="destructive"
                        className="flex-1"
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
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Pending Approvals</h3>
              <p className="text-gray-600 text-center">
                All requests have been reviewed. New requests will appear here for approval.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}