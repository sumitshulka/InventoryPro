import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

type PendingRequestsProps = {
  requests: any[];
};

export default function PendingRequests({ requests }: PendingRequestsProps) {
  const [_, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const { data: users } = useQuery({
    queryKey: ["/api/users"],
  });
  
  const { data: warehouses } = useQuery({
    queryKey: ["/api/warehouses"],
  });

  const updateRequestMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest("PUT", `/api/requests/${id}/status`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      toast({
        title: "Request updated",
        description: "The request status has been updated successfully.",
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

  const handleApprove = (id: number) => {
    updateRequestMutation.mutate({ id, status: "approved" });
  };

  const handleReject = (id: number) => {
    updateRequestMutation.mutate({ id, status: "rejected" });
  };

  const getUserName = (userId: number) => {
    if (!users) return "";
    const user = users.find((u: any) => u.id === userId);
    return user ? user.name : "";
  };

  const getWarehouseName = (warehouseId: number) => {
    if (!warehouses) return "";
    const warehouse = warehouses.find((w: any) => w.id === warehouseId);
    return warehouse ? warehouse.name : "";
  };

  const isManager = user?.role === "admin" || user?.role === "manager";

  return (
    <Card>
      <CardHeader className="p-6 border-b flex flex-row items-center justify-between">
        <h3 className="text-lg font-medium text-gray-800">Pending Requests</h3>
        <Button 
          variant="ghost" 
          className="text-primary text-sm hover:bg-primary/5"
          onClick={() => navigate("/requests?filter=pending")}
        >
          View All
          <span className="material-icons text-sm ml-1">chevron_right</span>
        </Button>
      </CardHeader>
      
      <CardContent className="p-2">
        {requests.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No pending requests
          </div>
        ) : (
          requests.map(request => (
            <div key={request.id} className="border-b last:border-b-0 p-4 hover:bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">{request.requestCode}</span>
                <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">Pending</span>
              </div>
              <p className="font-medium text-gray-800 mb-1">{request.notes || "Inventory Request"}</p>
              <p className="text-sm text-gray-600 mb-2">
                {request.items?.length || 0} items requested for {getWarehouseName(request.warehouseId)}
              </p>
              <div className="flex items-center text-xs text-gray-500 mb-3">
                <span className="material-icons text-gray-400 text-xs mr-1">person</span>
                {getUserName(request.userId)}
                <span className="mx-2">•</span>
                <span className="material-icons text-gray-400 text-xs mr-1">schedule</span>
                {formatDateTime(request.createdAt)}
              </div>
              {isManager && (
                <div className="flex space-x-2">
                  <Button 
                    className="flex-1 bg-primary text-white rounded-md px-3 py-1 text-xs font-medium hover:bg-primary-dark"
                    onClick={() => handleApprove(request.id)}
                    disabled={updateRequestMutation.isPending}
                  >
                    {updateRequestMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : "Approve"}
                  </Button>
                  <Button 
                    className="flex-1 border border-gray-300 text-gray-700 rounded-md px-3 py-1 text-xs font-medium hover:bg-gray-50"
                    variant="outline"
                    onClick={() => handleReject(request.id)}
                    disabled={updateRequestMutation.isPending}
                  >
                    Reject
                  </Button>
                  <Button 
                    className="border border-gray-300 text-gray-700 rounded-md px-2 py-1 text-xs font-medium hover:bg-gray-50"
                    variant="outline"
                    size="icon"
                    onClick={() => navigate("/requests")}
                  >
                    <span className="material-icons text-xs">more_vert</span>
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
