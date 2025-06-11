import { useAuth } from "@/hooks/use-auth";

export function usePermissions() {
  const { user } = useAuth();

  const isAdmin = user?.role === "admin";
  const isManager = user?.role === "manager";
  const isWarehouseOperator = user?.isWarehouseOperator || false;

  // Check if user has warehouse operator permissions
  const canAccessInventoryOperations = isAdmin || isManager || isWarehouseOperator;
  
  // Check if user can perform check-in operations
  const canCheckIn = isAdmin || isManager || isWarehouseOperator;
  
  // Check if user can perform transfer operations
  const canTransfer = isAdmin || isManager || isWarehouseOperator;
  
  // Check if user can access inventory reports
  const canAccessInventoryReports = isAdmin || isManager || isWarehouseOperator;
  
  // Check if user can manage users (admin only)
  const canManageUsers = isAdmin;
  
  // Check if user can manage warehouses (admin only)
  const canManageWarehouses = isAdmin;
  
  // Check if user can approve requests
  const canApproveRequests = isAdmin || isManager;
  
  // Check if user can create requests
  const canCreateRequests = isAdmin || isManager || user?.role === "employee";

  return {
    isAdmin,
    isManager,
    isWarehouseOperator,
    canAccessInventoryOperations,
    canCheckIn,
    canTransfer,
    canAccessInventoryReports,
    canManageUsers,
    canManageWarehouses,
    canApproveRequests,
    canCreateRequests,
  };
}