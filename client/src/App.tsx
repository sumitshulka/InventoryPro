import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import LicenseGuard from "@/components/license-guard";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import ResetPasswordPage from "@/pages/reset-password-page";
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
import InventoryValuationReportPage from "@/pages/inventory-valuation-report-page";
import LowStockReportPage from "@/pages/low-stock-report-page";
import UsersManagementPage from "@/pages/users-management-page";
import CategoriesPage from "@/pages/categories-page";
import DepartmentsPage from "@/pages/departments-page";
import ApprovalManagementPage from "@/pages/approval-management-page";
import SettingsPage from "@/pages/settings-page";

import AuditTrailPage from "@/pages/audit-trail-page";
import IssuesPage from "@/pages/issues-page";
import MyProfilePage from "@/pages/my-profile-page";
import DisposedInventoryReportPage from "@/pages/disposed-inventory-report-page";
import AnalyticsReportPage from "@/pages/analytics-report-page";
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

  // If user is authenticated, wrap protected routes with license guard
  if (user) {
    return (
      <div>
        <Switch>
          <ProtectedRoute path="/my-profile" component={MyProfilePage} />
          <ProtectedRoute path="/" component={DashboardPage} />
          <ProtectedRoute path="/inventory" component={InventoryPage} />
          <ProtectedRoute path="/items" component={ItemMasterPage} />
          <ProtectedRoute path="/warehouses" component={WarehousesPage} />
          <ProtectedRoute path="/check-in" component={CheckInPage} />
          <ProtectedRoute path="/issues" component={IssuesPage} />
          <ProtectedRoute path="/requests" component={RequestsPage} />
          <ProtectedRoute path="/transfers" component={EnhancedTransfersPage} />
          <ProtectedRoute path="/transfer-notifications" component={TransferNotificationsPage} />
          <ProtectedRoute path="/rejected-goods" component={RejectedGoodsPage} />
          <ProtectedRoute path="/my-requests" component={MyRequestsPage} />
          <ProtectedRoute path="/stock-report" component={StockReportPage} />
          <ProtectedRoute path="/movement-report" component={MovementReportPage} />
          <ProtectedRoute path="/reports/inventory-valuation" component={InventoryValuationReportPage} />
          <ProtectedRoute path="/reports/low-stock" component={LowStockReportPage} />
          <ProtectedRoute path="/reports/disposed-inventory" component={DisposedInventoryReportPage} />
          <ProtectedRoute path="/users" component={UsersManagementPage} />
          <ProtectedRoute path="/users-management" component={UsersManagementPage} />
          <ProtectedRoute path="/categories" component={CategoriesPage} />
          <ProtectedRoute path="/departments" component={DepartmentsPage} />
          <ProtectedRoute path="/approvals" component={ApprovalManagementPage} />
          <ProtectedRoute path="/audit-trail" component={AuditTrailPage} />
          <ProtectedRoute path="/analytics" component={AnalyticsReportPage} />
          <ProtectedRoute path="/settings" component={SettingsPage} />
          <Route component={NotFound} />
        </Switch>
      </div>
    );
  }
  
  // If user is not authenticated, show auth routes without license guard
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="*" component={AuthPage} />
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
