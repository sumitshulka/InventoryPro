import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AppLayout from "@/components/layout/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";
import { Search, FileText, Calendar, Package } from "lucide-react";
import { Link } from "wouter";

interface Request {
  id: number;
  requestCode: string;
  status: string;
  priority: string;
  justification: string;
  notes: string;
  submittedAt: string;
  warehouseId: number;
}

interface RequestItem {
  id: number;
  requestId: number;
  itemId: number;
  quantity: number;
  urgency: string;
  justification: string;
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

export default function MyRequestsPage() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);

  // Fetch user's requests
  const { data: allRequests = [], isLoading: requestsLoading } = useQuery({
    queryKey: ["/api/requests"],
  });

  // Filter requests for current user
  const userRequests = allRequests.filter((request: Request) => request.userId === user?.id) || [];

  // Fetch request items for selected request
  const { data: requestItems = [] } = useQuery<RequestItem[]>({
    queryKey: ["/api/requests", selectedRequest?.id, "items"],
    enabled: !!selectedRequest?.id,
  });

  // Fetch items and warehouses for reference
  const { data: items = [] } = useQuery<Item[]>({
    queryKey: ["/api/items"],
  });

  const { data: warehouses = [] } = useQuery<Warehouse[]>({
    queryKey: ["/api/warehouses"],
  });

  // Filter requests based on search and status
  const filteredRequests = userRequests.filter((request: Request) => {
    const matchesSearch = !searchTerm || 
      request.requestCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.justification?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || request.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'pending-transfer': return 'bg-blue-100 text-blue-800';
      case 'fulfilled': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const getItemName = (itemId: number) => {
    console.log('Looking up item:', itemId, 'from items:', items);
    const item = items.find(i => i.id === itemId);
    return item ? `${item.name} (${item.sku})` : `Item #${itemId || 'unknown'}`;
  };

  const getWarehouseName = (warehouseId: number) => {
    const warehouse = warehouses.find(w => w.id === warehouseId);
    return warehouse ? warehouse.name : `Warehouse #${warehouseId}`;
  };

  if (requestsLoading) {
    return (
      <AppLayout>
        <div className="container mx-auto p-6">
          <div className="space-y-4">
            <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-32 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-32 bg-gray-200 rounded animate-pulse"></div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">My Requests</h1>
          <p className="text-gray-600 mt-2">
            View and track all your inventory requests and their status
          </p>
        </div>

        {/* Filters and Search */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search requests..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="pending-transfer">Transfer Required</SelectItem>
              <SelectItem value="fulfilled">Fulfilled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Requests List */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-4">
              Your Requests ({filteredRequests.length})
            </h2>
            
            {filteredRequests.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {searchTerm || statusFilter !== "all" ? "No requests found" : "No requests yet"}
                  </h3>
                  <p className="text-gray-600 text-center mb-4">
                    {searchTerm || statusFilter !== "all" 
                      ? "Try adjusting your search or filter criteria"
                      : "Submit your first request to get started"
                    }
                  </p>
                  {!searchTerm && statusFilter === "all" && (
                    <Link href="/requests">
                      <Button>Create New Request</Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            ) : (
              filteredRequests.map((request: Request) => (
                <Card 
                  key={request.id} 
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedRequest?.id === request.id ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setSelectedRequest(request)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{request.requestCode}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge className={getPriorityColor(request.priority)} variant="outline">
                          {request.priority}
                        </Badge>
                        <Badge className={getStatusColor(request.status)}>
                          {request.status === 'pending-transfer' ? 'Transfer Required' : 
                           request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </Badge>
                      </div>
                    </div>
                    <CardDescription>
                      {request.justification || 'No description provided'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>{new Date(request.submittedAt).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Package className="h-4 w-4" />
                          <span>{getWarehouseName(request.warehouseId)}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Request Details */}
          <div className="lg:sticky lg:top-6">
            {selectedRequest ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    Request Details
                    <Badge className={getStatusColor(selectedRequest.status)}>
                      {selectedRequest.status === 'pending-transfer' ? 'Transfer Required' : 
                       selectedRequest.status.charAt(0).toUpperCase() + selectedRequest.status.slice(1)}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    {selectedRequest.requestCode} • {getWarehouseName(selectedRequest.warehouseId)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-sm text-gray-700 mb-2">Request Information</h4>
                    <div className="bg-gray-50 p-3 rounded space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Submitted:</span>
                        <span>{new Date(selectedRequest.submittedAt).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Priority:</span>
                        <span className={getPriorityColor(selectedRequest.priority)}>
                          {selectedRequest.priority.charAt(0).toUpperCase() + selectedRequest.priority.slice(1)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Warehouse:</span>
                        <span>{getWarehouseName(selectedRequest.warehouseId)}</span>
                      </div>
                    </div>
                  </div>

                  {selectedRequest.justification && (
                    <div>
                      <h4 className="font-semibold text-sm text-gray-700 mb-2">Justification</h4>
                      <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                        {selectedRequest.justification}
                      </p>
                    </div>
                  )}

                  {requestItems.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-sm text-gray-700 mb-2">Requested Items</h4>
                      <div className="space-y-2">
                        {requestItems.map((item: RequestItem) => (
                          <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                            <div>
                              <p className="font-medium text-sm">{getItemName(item.itemId)}</p>
                              {item.justification && (
                                <p className="text-xs text-gray-500">{item.justification}</p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-sm">{item.quantity}</p>
                              <p className="text-xs text-gray-500">{item.urgency}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedRequest.notes && (
                    <div>
                      <h4 className="font-semibold text-sm text-gray-700 mb-2">Notes</h4>
                      <p className="text-sm text-gray-600 bg-blue-50 p-3 rounded border border-blue-200">
                        {selectedRequest.notes}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Select a Request</h3>
                  <p className="text-gray-600 text-center">
                    Choose a request from the list to view its details and track its progress
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}