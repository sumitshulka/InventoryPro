import { useAuth } from "@/hooks/use-auth";
import { Loader2, AlertCircle } from "lucide-react";
import { Redirect, Route } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Define role-based access restrictions
const RESTRICTED_PATHS = {
  // Inventory management - only admin, manager, or warehouse operators
  inventory: ['/inventory', '/warehouses', '/transfers', '/rejected-goods'],
  // Reports - only admin, manager, or warehouse operators  
  reports: ['/stock-report', '/movement-report', '/reports/inventory-valuation'],
  // Management - only admin and managers
  management: ['/users', '/users-management', '/categories', '/departments', '/approvals', '/settings', '/audit-trail'],
  // Operations - only admin, manager, or warehouse operators (excluding regular requests)
  operations: ['/check-in']
};

function AccessDeniedPage({ path }: { path: string }) {
  return (
   
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <CardTitle className="text-xl text-red-600">Access Restricted</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-gray-600">
              You don't have permission to access this page. This feature is restricted to users with higher privileges.
            </p>
            <p className="text-sm text-gray-500">
              If you need access to this feature, please contact your manager or administrator.
            </p>
          </CardContent>
        </Card>
      </div>
   
  );
}

export function ProtectedRoute({
  path,
  component: Component,
  requiredRoles,
  requireWarehouseOperator = false,
}: {
  path: string;
  component: () => React.JSX.Element;
  requiredRoles?: string[];
  requireWarehouseOperator?: boolean;
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Route>
    );
  }

  if (!user) {
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  // Check if user has required role or permissions
  const hasRequiredRole = !requiredRoles || requiredRoles.includes(user.role);
  const hasWarehouseOperatorAccess = !requireWarehouseOperator || user.isWarehouseOperator;
  
  // Check role-based path restrictions for regular employees
  const isRegularEmployee = user.role === 'employee' && !user.isWarehouseOperator;
  
  if (isRegularEmployee) {
    // Check if path is restricted for regular employees
    const isInventoryPath = RESTRICTED_PATHS.inventory.some(p => path.startsWith(p));
    const isReportPath = RESTRICTED_PATHS.reports.some(p => path.startsWith(p));
    const isManagementPath = RESTRICTED_PATHS.management.some(p => path.startsWith(p));
    const isOperationPath = RESTRICTED_PATHS.operations.some(p => path.startsWith(p));
    
    if (isInventoryPath || isReportPath || isManagementPath || isOperationPath) {
      return (
        <Route path={path}>
          <AccessDeniedPage path={path} />
        </Route>
      );
    }
  }

  // Additional role/permission checks
  if (!hasRequiredRole || !hasWarehouseOperatorAccess) {
    return (
      <Route path={path}>
        <AccessDeniedPage path={path} />
      </Route>
    );
  }

  return <Route path={path} component={Component} />;
}
