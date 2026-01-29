import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import AppLayout from "@/components/layout/app-layout";
import MetricCard from "@/components/dashboard/metric-card";
import RecentTransactions from "@/components/dashboard/recent-transactions";
import WarehouseOverview from "@/components/dashboard/warehouse-overview";
import PendingRequests from "@/components/dashboard/pending-requests";
import LowStockItems from "@/components/dashboard/low-stock-items";
import RecentActivity from "@/components/dashboard/recent-activity";
import { Loader2, Bell, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import EmployeeDashboard from "./employee-dashboard";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function DashboardPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  
  const { data: userOperatedWarehouses = [] } = useQuery<number[]>({
    queryKey: ["/api/users", user?.id, "operated-warehouses"],
    enabled: !!user?.id,
  });

  const isEmployeeOnly = user?.role === 'employee' && userOperatedWarehouses.length === 0;
  
  // For audit users (both audit_user and audit_manager), redirect to audit dashboard
  useEffect(() => {
    if (user?.role === 'audit_user' || user?.role === 'audit_manager') {
      setLocation('/audit-dashboard');
    }
  }, [user?.role, setLocation]);
  
  // Return null while redirecting audit users
  if (user?.role === 'audit_user' || user?.role === 'audit_manager') {
    return null;
  }
  
  // For employees only, redirect to simplified dashboard
  if (isEmployeeOnly) {
    return <EmployeeDashboard />;
  }
  
  // Role-based data fetching for managers and admins
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ["/api/dashboard/summary"],
  });

  const { data: warehouseStats, isLoading: warehouseStatsLoading } = useQuery({
    queryKey: ["/api/warehouses/stats"],
  });

  // Fetch pending approvals count for current user
  const { data: pendingApprovals } = useQuery({
    queryKey: ["/api/pending-approvals"],
    enabled: !!user?.id && (user?.role === 'admin' || user?.role === 'manager'),
  });

  const pendingApprovalsCount = Array.isArray(pendingApprovals) ? pendingApprovals.length : 0;
  
  if (isLoading || warehouseStatsLoading) {
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-medium text-gray-800">
            {isEmployeeOnly ? 'My Workspace' : 'Dashboard'}
          </h1>
          <p className="text-gray-600">
            {isEmployeeOnly 
              ? `Welcome back, ${user?.name}! View your requests and activity.`
              : "Welcome back! Here's what's happening with your inventory today."
            }
          </p>
        </div>
        {!isEmployeeOnly && (
          <div className="flex space-x-2">
            <button className="bg-white border border-gray-300 text-gray-700 rounded-md px-4 py-2 text-sm font-medium flex items-center hover:bg-gray-50">
              <span className="material-icons mr-1 text-sm">date_range</span>
              Last 30 days
            </button>
            <button className="bg-primary text-white rounded-md px-4 py-2 text-sm font-medium flex items-center hover:bg-primary/90">
              <span className="material-icons mr-1 text-sm">refresh</span>
              Refresh
            </button>
          </div>
        )}
      </div>

      {/* Pending Approvals Notification Strip */}
      {pendingApprovalsCount > 0 && (user?.role === 'admin' || user?.role === 'manager') && (
        <div className="mb-6">
          <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-4 rounded-lg shadow-lg border-l-4 border-orange-600">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <Bell className="h-6 w-6 text-white animate-pulse" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">
                    {pendingApprovalsCount} Approval{pendingApprovalsCount !== 1 ? 's' : ''} Pending
                  </h3>
                  <p className="text-orange-100 text-sm">
                    You have {pendingApprovalsCount} request{pendingApprovalsCount !== 1 ? 's' : ''} waiting for your approval
                  </p>
                </div>
              </div>
              <Button
                onClick={() => setLocation('/approvals')}
                variant="secondary"
                className="bg-white/20 hover:bg-white/30 text-white border-white/30 hover:border-white/50"
              >
                Review Now
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Dashboard Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Total Items"
          value={dashboardData?.totalItems || 0}
          icon="inventory_2"
          iconBgColor="bg-primary bg-opacity-10"
          iconColor="text-primary"
          changeValue={dashboardData?.statistics?.totalItemsChange || 0}
          changeDirection={dashboardData?.statistics?.totalItemsChange >= 0 ? "up" : "down"}
          changeColor={dashboardData?.statistics?.totalItemsChange >= 0 ? "text-success" : "text-error"}
          changeText="vs last month"
        />
        <MetricCard
          title="Low Stock Items"
          value={dashboardData?.lowStockItemsCount || 0}
          icon="warning"
          iconBgColor="bg-warning bg-opacity-10"
          iconColor="text-warning"
          changeValue={Math.abs(dashboardData?.statistics?.lowStockChange || 0)}
          changeDirection={dashboardData?.statistics?.lowStockChange >= 0 ? "up" : "down"}
          changeColor={dashboardData?.statistics?.lowStockChange >= 0 ? "text-error" : "text-success"}
          changeText="vs last month"
        />
        <MetricCard
          title="Pending Requests"
          value={dashboardData?.pendingRequestsCount || 0}
          icon="pending_actions"
          iconBgColor="bg-info bg-opacity-10"
          iconColor="text-info"
          changeValue={Math.abs(dashboardData?.statistics?.pendingRequestsChange || 0)}
          changeDirection={dashboardData?.statistics?.pendingRequestsChange >= 0 ? "up" : "down"}
          changeColor={dashboardData?.statistics?.pendingRequestsChange >= 0 ? "text-error" : "text-success"}
          changeText="vs last month"
        />
        <MetricCard
          title="Active Transfers"
          value={dashboardData?.activeTransfersCount || 0}
          icon="swap_horiz"
          iconBgColor="bg-secondary bg-opacity-10"
          iconColor="text-secondary"
          changeValue={Math.abs(dashboardData?.statistics?.activeTransfersChange || 0)}
          changeDirection={dashboardData?.statistics?.activeTransfersChange >= 0 ? "up" : "down"}
          changeColor={dashboardData?.statistics?.activeTransfersChange >= 0 ? "text-info" : "text-success"}
          changeText="vs last month"
        />
      </div>

      {/* Dashboard Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          <RecentTransactions transactions={dashboardData?.recentTransactions || []} />
          <WarehouseOverview warehouses={warehouseStats || []} />
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <PendingRequests requests={dashboardData?.pendingRequests || []} />
          <LowStockItems items={dashboardData?.lowStockItems || []} />
          <RecentActivity />
        </div>
      </div>
    </AppLayout>
  );
}
