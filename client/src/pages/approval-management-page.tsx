import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle, XCircle, Clock, User, FileText, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface PendingApproval {
  id: number;
  requestId: number;
  approverId: number;
  approvalLevel: string;
  status: string;
  comments: string | null;
  createdAt: string;
  request: {
    id: number;
    requestCode: string;
    userId: number;
    warehouseId: number;
    status: string;
    priority: string;
    justification: string | null;
    notes: string | null;
    createdAt: string;
  };
  requestItems: Array<{
    id: number;
    requestId: number;
    itemId: number;
    quantity: number;
    item: {
      id: number;
      name: string;
      sku: string;
      unit: string;
    };
  }>;
  requester: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
}

export default function ApprovalManagementPage() {
  const { toast } = useToast();
  const [selectedApproval, setSelectedApproval] = useState<PendingApproval | null>(null);
  const [comments, setComments] = useState("");

  // Fetch pending approvals
  const { data: pendingApprovals = [], isLoading } = useQuery<PendingApproval[]>({
    queryKey: ["/api/pending-approvals"],
  });

  // Approve request mutation
  const approveMutation = useMutation({
    mutationFn: async ({ approvalId, comments }: { approvalId: number; comments: string }) => {
      const res = await apiRequest("POST", `/api/request-approvals/${approvalId}/approve`, { comments });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pending-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      setSelectedApproval(null);
      setComments("");
      toast({
        title: "Request Approved",
        description: "The request has been successfully approved.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Approval Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Reject request mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ approvalId, comments }: { approvalId: number; comments: string }) => {
      const res = await apiRequest("POST", `/api/request-approvals/${approvalId}/reject`, { comments });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pending-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      setSelectedApproval(null);
      setComments("");
      toast({
        title: "Request Rejected",
        description: "The request has been rejected.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Rejection Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleApprove = () => {
    if (!selectedApproval) return;
    approveMutation.mutate({ approvalId: selectedApproval.id, comments });
  };

  const handleReject = () => {
    if (!selectedApproval) return;
    if (!comments.trim()) {
      toast({
        title: "Comments Required",
        description: "Please provide comments when rejecting a request.",
        variant: "destructive",
      });
      return;
    }
    rejectMutation.mutate({ approvalId: selectedApproval.id, comments });
  };

  const getPriorityBadge = (priority: string) => {
    const variants = {
      high: "destructive" as const,
      normal: "secondary" as const,
      low: "outline" as const,
    };
    return <Badge variant={variants[priority as keyof typeof variants] || "secondary"}>{priority}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Clock className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading pending approvals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Approval Management</h1>
        <p className="text-muted-foreground">Review and approve pending checkout requests</p>
      </div>

      {pendingApprovals.length === 0 ? (
        <Card>
          <CardContent className="text-center py-16">
            <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500" />
            <h3 className="text-xl font-semibold mb-2">No Pending Approvals</h3>
            <p className="text-muted-foreground">All requests have been processed. Great work!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pending Approvals List */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Pending Approvals ({pendingApprovals.length})</h2>
            <ScrollArea className="h-[calc(100vh-200px)]">
              <div className="space-y-4 pr-4">
                {pendingApprovals.map((approval) => (
                  <Card
                    key={approval.id}
                    className={`cursor-pointer transition-colors ${
                      selectedApproval?.id === approval.id 
                        ? "ring-2 ring-primary bg-primary/5" 
                        : "hover:bg-muted/50"
                    }`}
                    onClick={() => setSelectedApproval(approval)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">{approval.request.requestCode}</CardTitle>
                          <CardDescription className="flex items-center gap-2 mt-1">
                            <User className="h-4 w-4" />
                            {approval.requester.name} ({approval.requester.role})
                          </CardDescription>
                        </div>
                        {getPriorityBadge(approval.request.priority)}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Package className="h-4 w-4" />
                          {approval.requestItems.length} item(s) requested
                        </div>
                        {approval.request.justification && (
                          <div className="flex items-start gap-2 text-sm text-muted-foreground">
                            <FileText className="h-4 w-4 mt-0.5" />
                            <span className="line-clamp-2">{approval.request.justification}</span>
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          Submitted {new Date(approval.request.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Approval Details */}
          <div>
            {selectedApproval ? (
              <Card>
                <CardHeader>
                  <CardTitle>Request Details</CardTitle>
                  <CardDescription>Review and approve or reject this request</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Request Information */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium">Request Code</Label>
                        <p className="text-sm text-muted-foreground">{selectedApproval.request.requestCode}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Priority</Label>
                        <div className="mt-1">
                          {getPriorityBadge(selectedApproval.request.priority)}
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm font-medium">Requester</Label>
                      <p className="text-sm text-muted-foreground">
                        {selectedApproval.requester.name} ({selectedApproval.requester.email})
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {selectedApproval.requester.role}
                      </p>
                    </div>

                    {selectedApproval.request.justification && (
                      <div>
                        <Label className="text-sm font-medium">Justification</Label>
                        <p className="text-sm text-muted-foreground">{selectedApproval.request.justification}</p>
                      </div>
                    )}

                    {selectedApproval.request.notes && (
                      <div>
                        <Label className="text-sm font-medium">Notes</Label>
                        <p className="text-sm text-muted-foreground">{selectedApproval.request.notes}</p>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Requested Items */}
                  <div>
                    <Label className="text-sm font-medium mb-3 block">Requested Items</Label>
                    <div className="space-y-3">
                      {selectedApproval.requestItems.map((item) => (
                        <div key={item.id} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                          <div>
                            <p className="font-medium">{item.item.name}</p>
                            <p className="text-sm text-muted-foreground">SKU: {item.item.sku}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{item.quantity} {item.item.unit}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Approval Comments */}
                  <div>
                    <Label htmlFor="comments" className="text-sm font-medium">
                      Comments
                    </Label>
                    <Textarea
                      id="comments"
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                      placeholder="Add your comments (required for rejection)..."
                      className="mt-2"
                      rows={3}
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <Button
                      onClick={handleApprove}
                      disabled={approveMutation.isPending}
                      className="flex-1"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve
                    </Button>
                    <Button
                      onClick={handleReject}
                      disabled={rejectMutation.isPending}
                      variant="destructive"
                      className="flex-1"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="text-center py-16">
                  <Clock className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="text-xl font-semibold mb-2">Select a Request</h3>
                  <p className="text-muted-foreground">Choose a pending approval from the list to review details</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}