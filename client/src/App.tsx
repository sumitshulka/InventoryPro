import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import DashboardPage from "@/pages/dashboard-page";
import InventoryPage from "@/pages/inventory-page";
import ItemMasterPage from "@/pages/item-master-page";
import WarehousesPage from "@/pages/warehouses-page";
import CheckInPage from "@/pages/check-in-page";
import RequestsPage from "@/pages/requests-page";
import EnhancedTransfersPage from "@/pages/enhanced-transfers-page";
import TransferNotificationsPage from "@/pages/transfer-notifications-page";
import RejectedGoodsPage from "@/pages/rejected-goods-page";
import MyRequestsPage from "@/pages/my-requests-page";
import StockReportPage from "@/pages/stock-report-page";
import MovementReportPage from "@/pages/movement-report-page";
import UserManagementPage from "@/pages/user-management-page";
import UsersManagementPage from "@/pages/users-management-page";
import CategoriesPage from "@/pages/categories-page";
import DepartmentsPage from "@/pages/departments-page";
import ApprovalManagementPage from "@/pages/approval-management-page";
import SettingsPage from "@/pages/settings-page";
import NotificationCenterPage from "@/pages/notification-center-page";
import { ProtectedRoute } from "./lib/protected-route";

function Router() {
  const { user, isLoading } = useAuth();
  console.log("Router user state:", { user, isLoading });
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }
  
  return (
    <Switch>
      <Route path="/auth">
        {user ? <Route path="/" component={DashboardPage} /> : <AuthPage />}
      </Route>
      <ProtectedRoute path="/" component={DashboardPage} />
      <ProtectedRoute path="/inventory" component={InventoryPage} />
      <ProtectedRoute path="/items" component={ItemMasterPage} />
      <ProtectedRoute path="/warehouses" component={WarehousesPage} />
      <ProtectedRoute path="/check-in" component={CheckInPage} />
      <ProtectedRoute path="/requests" component={RequestsPage} />
      <ProtectedRoute path="/transfers" component={EnhancedTransfersPage} />
      <ProtectedRoute path="/transfer-notifications" component={TransferNotificationsPage} />
      <ProtectedRoute path="/rejected-goods" component={RejectedGoodsPage} />
      <ProtectedRoute path="/my-requests" component={MyRequestsPage} />
      <ProtectedRoute path="/stock-report" component={StockReportPage} />
      <ProtectedRoute path="/movement-report" component={MovementReportPage} />
      <ProtectedRoute path="/users" component={UserManagementPage} />
      <ProtectedRoute path="/users-management" component={UsersManagementPage} />
      <ProtectedRoute path="/categories" component={CategoriesPage} />
      <ProtectedRoute path="/departments" component={DepartmentsPage} />
      <ProtectedRoute path="/approvals" component={ApprovalManagementPage} />
      <ProtectedRoute path="/notifications" component={NotificationCenterPage} />
      <ProtectedRoute path="/settings" component={SettingsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router />
      <Toaster />
    </AuthProvider>
  );
}

export default App;
