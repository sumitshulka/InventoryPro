import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import DashboardPage from "@/pages/dashboard-page";
import InventoryPage from "@/pages/inventory-page";
import ItemMasterPage from "@/pages/item-master-page";
import WarehousesPage from "@/pages/warehouses-page";
import CheckInPage from "@/pages/check-in-page";
import RequestsPage from "@/pages/requests-page";
import TransfersPage from "@/pages/transfers-page";
import StockReportPage from "@/pages/stock-report-page";
import MovementReportPage from "@/pages/movement-report-page";
import UserManagementPage from "@/pages/user-management-page";
import { ProtectedRoute } from "./lib/protected-route";

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <ProtectedRoute path="/" component={DashboardPage} />
      <ProtectedRoute path="/inventory" component={InventoryPage} />
      <ProtectedRoute path="/items" component={ItemMasterPage} />
      <ProtectedRoute path="/warehouses" component={WarehousesPage} />
      <ProtectedRoute path="/check-in" component={CheckInPage} />
      <ProtectedRoute path="/requests" component={RequestsPage} />
      <ProtectedRoute path="/transfers" component={TransfersPage} />
      <ProtectedRoute path="/stock-report" component={StockReportPage} />
      <ProtectedRoute path="/movement-report" component={MovementReportPage} />
      <ProtectedRoute path="/users" component={UserManagementPage} />
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
