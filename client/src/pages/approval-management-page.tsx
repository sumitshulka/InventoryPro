import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Clock, User, XCircle, Package, AlertTriangle, PackageX, RotateCcw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface Approval {
  id: number;
  type: "request_approval" | "rejected_goods";
  // For request approvals
  requestId?: number;
  approverId?: number;
  approvalLevel?: string;
  status?: string;
  approvedAt?: string | null;
  notes?: string | null;

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
      department?: { id: number; name: string };
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
      availableQuantity?: number;
      isAvailable?: boolean;
    }[];
  };

  // For rejected goods
  item?: any;
  warehouse?: any;
  quantity?: number;
  rejectedBy?: any;
  transfer?: any;
  availableQuantity?: number;
}

export default function ApprovalManagementPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedApproval, setSelectedApproval] = useState<Approval | null>(null);
  const [actionNotes, setActionNotes] = useState("");

  // Fetch pending approvals (both types)
  const { data: pendingApprovals = [], isLoading } = useQuery<Approval[]>({
    queryKey: ["/api/pending-approvals"],
  });

  // Items for helper display
  const { data: unsafeitems = [] } = useQuery({ queryKey: ["/api/items"] });
  const items = unsafeitems || [];

  const { data: warehouses = [] } = useQuery({ queryKey: ["/api/warehouses"] });

  // Ensure selected approval still exists
  useEffect(() => {
    if (!selectedApproval) return;

    const stillExists = pendingApprovals.some((p) => p.id === selectedApproval.id);

    if (!stillExists) {
      setSelectedApproval(null);
      setActionNotes("");

      toast({
        title: "Updated",
        description: "This approval was already processed by another manager.",
      });
    }
  }, [pendingApprovals, selectedApproval, toast]);

  // Mutation — existing request approval
  const approvalMutation = useMutation({
    mutationFn: async ({
      approvalId,
      action,
      notes
    }: {
      approvalId: number;
      action: "approve" | "reject";
      notes?: string;
    }) => {
      return await apiRequest("PATCH", `/api/approvals/${approvalId}/${action}`, {
        notes: notes || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pending-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      setSelectedApproval(null);
      setActionNotes("");
      toast({
        title: "Success",
        description: "Approval processed successfully",
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

  // Handle Approve
  const handleApprove = async () => {
    if (!selectedApproval) return;

    // TYPE 1 → Request Approval
    if (selectedApproval.type === "request_approval") {
      approvalMutation.mutate({
        approvalId: selectedApproval.id,
        action: "approve",
        notes: actionNotes,
      });
      return;
    }

    // TYPE 2 → Rejected Goods Approval
    if (selectedApproval.type === "rejected_goods") {
      await apiRequest("PATCH", `/api/rejected-goods/${selectedApproval.id}`, {
        isApproved: true,
        notes: actionNotes,
      });

      toast({ title: "Approved", description: "Rejected goods processed successfully." });

      queryClient.invalidateQueries({ queryKey: ["/api/pending-approvals"] });

      setSelectedApproval(null);
      setActionNotes("");
      return;
    }
  };

  // Handle Reject
  const handleReject = async () => {
    if (!selectedApproval) return;

    // TYPE 1 → Request Approval
    if (selectedApproval.type === "request_approval") {
      approvalMutation.mutate({
        approvalId: selectedApproval.id,
        action: "reject",
        notes: actionNotes,
      });
      return;
    }

    // TYPE 2 → Rejected Goods Approval
    if (selectedApproval.type === "rejected_goods") {
      await apiRequest("PATCH", `/api/rejected-goods/${selectedApproval.id}`, {
        isApproved: false,
        notes: actionNotes,
      });

      toast({ title: "Rejected", description: "Rejected goods request denied." });

      queryClient.invalidateQueries({ queryKey: ["/api/pending-approvals"] });

      setSelectedApproval(null);
      setActionNotes("");
      return;
    }
  };

  const getWarehouseName = (warehouseId: number) => {
    const warehouse = warehouses.find((w: any) => w.id === warehouseId);
    return warehouse ? warehouse.name : `Warehouse #${warehouseId}`;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800";
      case "low":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Approval Management</h1>
        <p className="text-muted-foreground">Review and approve pending requests & rejected goods</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : pendingApprovals.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT SIDEBAR — List */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-4">
              Pending Approvals ({pendingApprovals.length})
            </h2>

            {pendingApprovals.map((approval) => (
              <Card
                key={approval.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  selectedApproval?.id === approval.id ? "ring-2 ring-primary" : ""
                }`}
                onClick={() => setSelectedApproval(approval)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {approval.type === "request_approval" ? (
                        <>
                          <Package className="w-4 h-4 text-blue-600" />
                          {approval.request?.requestCode || `Request #${approval.id}`}
                        </>
                      ) : (
                        <>
                          <PackageX className="w-4 h-4 text-red-600" />
                          Rejected Goods #{approval.id}
                        </>
                      )}
                    </CardTitle>

                    <Badge variant="outline">
                      <Clock className="w-3 h-3 mr-1" /> Pending
                    </Badge>
                  </div>

                  <CardDescription>
                    {approval.type === "request_approval" ? (
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Requested by {approval.request?.user?.name || "Unknown"}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <RotateCcw className="w-4 h-4 text-red-500" />
                        {approval.status === "restock_requested"
                          ? "Restock Requested"
                          : "Dispose Requested"}
                      </div>
                    )}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>

          {/* RIGHT SIDE — Details */}
          <div className="lg:sticky lg:top-6">
            {selectedApproval ? (
              <Card>
                {/* DETAILS FOR REQUEST APPROVAL */}
                {selectedApproval.type === "request_approval" && (
                  <>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        Approval Details
                        <Badge className={getPriorityColor(selectedApproval.request?.priority || "medium")}>
                          {selectedApproval.request?.priority || "Medium"} Priority
                        </Badge>
                      </CardTitle>
                      <CardDescription>
                        {selectedApproval.request?.requestCode} •{" "}
                        {getWarehouseName(selectedApproval.request?.warehouseId || 0)}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-6">
                      {/* Request Info */}
                      <div>
                        <h4 className="font-semibold text-sm text-gray-700 mb-2">Request Information</h4>
                        <div className="bg-gray-50 p-3 rounded space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Requester:</span>
                            <span>{selectedApproval.request?.user?.name}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Submitted:</span>
                            <span>
                              {new Date(
                                selectedApproval.request?.submittedAt || ""
                              ).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Warehouse:</span>
                            <span>
                              {getWarehouseName(selectedApproval.request?.warehouseId || 0)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Items */}
                      {selectedApproval.request?.items && (
                        <div>
                          <h4 className="font-semibold text-sm text-gray-700 mb-2">Requested Items</h4>
                          <div className="space-y-2">
                            {selectedApproval.request.items.map((item) => (
                              <div
                                key={item.id}
                                className="p-3 bg-gray-50 rounded border-l-4 border-l-blue-500"
                              >
                                <div className="font-medium">{item.item?.name}</div>
                                <div className="text-sm">Requested: {item.quantity}</div>
                                <div className="text-xs text-gray-500">
                                  Available: {item.availableQuantity}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Approval Notes */}
                      <Separator />
                      <div>
                        <h4 className="font-semibold text-sm mb-2">Approval Notes (optional)</h4>
                        <Textarea
                          placeholder="Add notes..."
                          value={actionNotes}
                          onChange={(e) => setActionNotes(e.target.value)}
                        />
                      </div>

                      {/* Buttons */}
                      <div className="flex gap-3">
                        <Button className="flex-1" onClick={handleApprove}>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Approve
                        </Button>

                        <Button
                          className="flex-1"
                          variant="destructive"
                          onClick={handleReject}
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Reject
                        </Button>
                      </div>
                    </CardContent>
                  </>
                )}

                {/* DETAILS FOR REJECTED GOODS */}
                {selectedApproval.type === "rejected_goods" && (
                  <>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <PackageX className="w-5 h-5 text-red-600" />
                        Rejected Goods Approval
                      </CardTitle>
                      <CardDescription>
                        Item: {selectedApproval.item?.name} • Warehouse:{" "}
                        {selectedApproval.warehouse?.name}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-6">
                      {/* Info */}
                      <div className="bg-gray-50 p-3 rounded space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Item:</span>
                          <span>{selectedApproval.item?.name}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Quantity:</span>
                          <span>{selectedApproval.quantity}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Requested Action:</span>
                          <Badge variant="outline">
                            {selectedApproval.status === "restock_requested"
                              ? "Restock Requested"
                              : "Dispose Requested"}
                          </Badge>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Available Stock:</span>
                          <span>{selectedApproval.availableQuantity}</span>
                        </div>
                      </div>

                      {/* Notes */}
                      <Separator />
                      <div>
                        <h4 className="font-semibold text-sm mb-2">Approval Notes (optional)</h4>
                        <Textarea
                          placeholder="Add notes..."
                          value={actionNotes}
                          onChange={(e) => setActionNotes(e.target.value)}
                        />
                      </div>

                      {/* Buttons */}
                      <div className="flex gap-3">
                        <Button className="flex-1" onClick={handleApprove}>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Approve
                        </Button>

                        <Button
                          className="flex-1"
                          variant="destructive"
                          onClick={handleReject}
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Reject
                        </Button>
                      </div>
                    </CardContent>
                  </>
                )}
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 flex flex-col items-center">
                  <AlertTriangle className="h-10 w-10 text-gray-400 mb-4" />
                  <h3 className="font-semibold text-lg">Select an Approval</h3>
                  <p className="text-gray-600 text-center">
                    Choose a request to review and take action
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
            <h3 className="text-lg font-semibold">No Pending Approvals</h3>
            <p className="text-gray-600 text-center">Everything is up to date!</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
