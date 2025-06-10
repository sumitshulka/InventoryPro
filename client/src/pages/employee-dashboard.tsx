import { useQuery } from "@tanstack/react-query";
import AppLayout from "@/components/layout/app-layout";
import MetricCard from "@/components/dashboard/metric-card";
import { Loader2, FileText, Clock, CheckCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";

export default function EmployeeDashboard() {
  const { user } = useAuth();
  
  // Get all requests and filter by user
  const { data: allRequests, isLoading } = useQuery({
    queryKey: ["/api/requests"],
  });
  
  const userRequests = allRequests?.filter((request: any) => request.userId === user?.id) || [];

  if (isLoading) {
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
      {/* Page Title */}
      <div className="mb-6">
        <h1 className="text-2xl font-medium text-gray-800">My Workspace</h1>
        <p className="text-gray-600">Welcome back, {user?.name}! View your requests and activity.</p>
      </div>

      {/* Employee Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <MetricCard
          title="My Requests"
          value={userRequests?.length || 0}
          icon="assignment"
          iconBgColor="bg-blue-50"
          iconColor="text-blue-600"
          changeText="Total submitted"
        />
        <MetricCard
          title="Pending"
          value={userRequests?.filter((r: any) => r.status === 'pending' || r.status === 'pending-transfer')?.length || 0}
          icon="pending_actions"
          iconBgColor="bg-yellow-50"
          iconColor="text-yellow-600"
          changeText="Awaiting approval"
        />
        <MetricCard
          title="Approved"
          value={userRequests?.filter((r: any) => r.status === 'approved')?.length || 0}
          icon="check_circle"
          iconBgColor="bg-green-50"
          iconColor="text-green-600"
          changeText="Ready for fulfillment"
        />
      </div>

      {/* Employee Content */}
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">My Recent Requests</h3>
            <Link href="/requests" className="text-sm text-primary hover:text-primary/80">
              View all requests
            </Link>
          </div>
          
          {userRequests && userRequests.length > 0 ? (
            <div className="space-y-3">
              {userRequests.slice(0, 5).map((request: any) => (
                <div key={request.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <FileText className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-900">{request.requestCode}</p>
                        <p className="text-sm text-gray-600">{request.justification || 'No description provided'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      request.status === 'approved' ? 'bg-green-100 text-green-800' :
                      request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      request.status === 'rejected' ? 'bg-red-100 text-red-800' :
                      request.status === 'pending-transfer' ? 'bg-blue-100 text-blue-800' :
                      request.status === 'fulfilled' ? 'bg-purple-100 text-purple-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {request.status === 'pending-transfer' ? 'Transfer Required' : 
                       request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                    </span>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(request.submittedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <FileText className="h-16 w-16 mx-auto" />
              </div>
              <h4 className="text-lg font-medium text-gray-900 mb-2">No requests yet</h4>
              <p className="text-gray-500 mb-6">Submit your first request to get started with inventory management</p>
              <Link 
                href="/requests" 
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              >
                Create Request
              </Link>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link 
              href="/requests" 
              className="flex items-center p-4 border border-gray-200 rounded-lg hover:border-primary hover:bg-primary/5 transition-colors"
            >
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-900">New Request</p>
                <p className="text-sm text-gray-500">Submit a new inventory request</p>
              </div>
            </Link>
            
            <div className="flex items-center p-4 border border-gray-200 rounded-lg bg-gray-50">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                  <Clock className="h-5 w-5 text-gray-400" />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Request Status</p>
                <p className="text-sm text-gray-400">Track your pending requests</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}