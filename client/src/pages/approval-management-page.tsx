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

export default function ApprovalManagementPage() {
  const { data: pendingApprovals, isLoading } = useQuery({
    queryKey: ["/api/pending-approvals"],
  });

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
        ) : pendingApprovals && pendingApprovals.length > 0 ? (
          <div className="grid gap-4">
            {pendingApprovals.map((approval: any) => (
              <Card key={approval.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      Request {approval.request?.requestCode || approval.requestId}
                    </CardTitle>
                    <Badge variant="outline">
                      <Clock className="w-3 h-3 mr-1" />
                      Pending
                    </Badge>
                  </div>
                  <CardDescription>
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Requested by {approval.requester?.name || 'Unknown'}
                    </div>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600">
                    Request details and approval actions will be implemented here.
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Pending Approvals</h3>
              <p className="text-gray-500 text-center">
                All requests have been processed. Great work!
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}