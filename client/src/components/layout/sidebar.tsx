import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { getUserInitials } from "@/lib/utils";
import { User } from "@shared/schema";

type SidebarProps = {
  user: User;
  isOpen: boolean;
  onClose: () => void;
};

export default function Sidebar({ user, isOpen, onClose }: SidebarProps) {
  const [location] = useLocation();
  
  const { data: userOperatedWarehouses = [] } = useQuery<number[]>({
    queryKey: ["/api/users", user?.id, "operated-warehouses"],
    enabled: !!user?.id,
  });

  // Check if user has permission to access check-in functionality
  const hasCheckInPermission = user?.role === 'admin' || user?.role === 'manager' || userOperatedWarehouses.length > 0;
  
  // Check if user is a regular employee (not warehouse operator)
  const isRegularEmployee = user?.role === 'employee' && !user?.isWarehouseOperator;
  
  // Check if user has access to inventory management features
  const hasInventoryAccess = user?.role === 'admin' || user?.role === 'manager' || user?.isWarehouseOperator;
  
  // Check if user has access to reports
  const hasReportAccess = user?.role === 'admin' || user?.role === 'manager' || user?.isWarehouseOperator;
  
  const isActive = (path: string) => {
    return location === path;
  };

  const { data: organizationSettings } = useQuery({
    queryKey: ['/api/organization-settings'],
  });

  return (
    <>
      <aside 
        className={cn(
          "fixed top-0 left-0 z-40 w-64 h-screen transition-transform bg-white border-r border-gray-200",
          "md:relative md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="h-full px-3 py-4 overflow-y-auto flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center mr-3">
                {(organizationSettings as any)?.logo ? (
                  <img 
                    src={(organizationSettings as any).logo} 
                    alt="Company Logo" 
                    className="w-8 h-8 object-contain rounded-lg"
                  />
                ) : (
                  <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-sm">
                      {(organizationSettings as any)?.organizationName?.charAt(0) || 'I'}
                    </span>
                  </div>
                )}
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">
                  {(organizationSettings as any)?.organizationName || 'Inventory'}
                </h1>
                <p className="text-xs text-gray-500">Management System</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="md:hidden p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            >
              <span className="material-icons">close</span>
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1">
            <div className="space-y-1">
              {/* MAIN Section */}
              <div className="mb-4">
                <p className="text-xs font-medium text-gray-500 px-3 py-2">MAIN</p>
                <ul>
                  <li>
                    <Link 
                      href="/"
                      className={cn(
                        "flex items-center px-3 py-2 rounded-md",
                        isActive("/") 
                          ? "bg-primary/10 border-l-4 border-primary text-primary" 
                          : "text-gray-700 hover:text-primary hover:bg-primary/5"
                      )}
                    >
                      <span className="material-icons mr-3">dashboard</span>
                      <span className="whitespace-nowrap">Dashboard</span>
                    </Link>
                  </li>

                  {hasInventoryAccess && (
                    <li>
                      <Link 
                        href="/inventory"
                        className={cn(
                          "flex items-center px-3 py-2 rounded-md",
                          isActive("/inventory") 
                            ? "bg-primary/10 border-l-4 border-primary text-primary" 
                            : "text-gray-700 hover:text-primary hover:bg-primary/5"
                        )}
                      >
                        <span className="material-icons mr-3">inventory_2</span>
                        <span className="whitespace-nowrap">Inventory</span>
                      </Link>
                    </li>
                  )}
                  <li>
                    <Link 
                      href="/items"
                      className={cn(
                        "flex items-center px-3 py-2 rounded-md",
                        isActive("/items") 
                          ? "bg-primary/10 border-l-4 border-primary text-primary" 
                          : "text-gray-700 hover:text-primary hover:bg-primary/5"
                      )}
                    >
                      <span className="material-icons mr-3">category</span>
                      <span className="whitespace-nowrap">Items</span>
                    </Link>
                  </li>
                  {hasInventoryAccess && (
                    <li>
                      <Link 
                        href="/warehouses"
                        className={cn(
                          "flex items-center px-3 py-2 rounded-md",
                          isActive("/warehouses") 
                            ? "bg-primary/10 border-l-4 border-primary text-primary" 
                            : "text-gray-700 hover:text-primary hover:bg-primary/5"
                        )}
                      >
                        <span className="material-icons mr-3">warehouse</span>
                        <span className="whitespace-nowrap">Warehouses</span>
                      </Link>
                    </li>
                  )}
                </ul>
              </div>

              {/* OPERATIONS Section */}
              <div className="mb-4">
                <p className="text-xs font-medium text-gray-500 px-3 py-2">OPERATIONS</p>
                <ul>
                  {hasCheckInPermission && (
                    <li>
                      <Link 
                        href="/check-in"
                        className={cn(
                          "flex items-center px-3 py-2 rounded-md",
                          isActive("/check-in") 
                            ? "bg-primary/10 border-l-4 border-primary text-primary" 
                            : "text-gray-700 hover:text-primary hover:bg-primary/5"
                        )}
                      >
                        <span className="material-icons mr-3">input</span>
                        <span className="whitespace-nowrap">Check In</span>
                      </Link>
                    </li>
                  )}
                  <li>
                    <Link 
                      href="/requests"
                      className={cn(
                        "flex items-center px-3 py-2 rounded-md",
                        isActive("/requests") 
                          ? "bg-primary/10 border-l-4 border-primary text-primary" 
                          : "text-gray-700 hover:text-primary hover:bg-primary/5"
                      )}
                    >
                      <span className="material-icons mr-3">output</span>
                      <span className="whitespace-nowrap">{isRegularEmployee ? "Request Items" : "Check Out"}</span>
                    </Link>
                  </li>
                  {hasInventoryAccess && (
                    <li>
                      <Link 
                        href="/transfers"
                        className={cn(
                          "flex items-center px-3 py-2 rounded-md",
                          isActive("/transfers") 
                            ? "bg-primary/10 border-l-4 border-primary text-primary" 
                            : "text-gray-700 hover:text-primary hover:bg-primary/5"
                        )}
                      >
                        <span className="material-icons mr-3">compare_arrows</span>
                        <span className="whitespace-nowrap">Transfers</span>
                      </Link>
                    </li>
                  )}
                  <li>
                    <Link 
                      href="/my-requests"
                      className={cn(
                        "flex items-center px-3 py-2 rounded-md",
                        isActive("/my-requests") 
                          ? "bg-primary/10 border-l-4 border-primary text-primary" 
                          : "text-gray-700 hover:text-primary hover:bg-primary/5"
                      )}
                    >
                      <span className="material-icons mr-3">receipt_long</span>
                      <span className="whitespace-nowrap">My Requests</span>
                    </Link>
                  </li>
                  {hasInventoryAccess && (
                    <li>
                      <Link 
                        href="/rejected-goods"
                        className={cn(
                          "flex items-center px-3 py-2 rounded-md",
                          isActive("/rejected-goods") 
                            ? "bg-primary/10 border-l-4 border-primary text-primary" 
                            : "text-gray-700 hover:text-primary hover:bg-primary/5"
                        )}
                      >
                        <span className="material-icons mr-3">block</span>
                        <span className="whitespace-nowrap">Rejected Goods</span>
                      </Link>
                    </li>
                  )}
                  <li>
                    <Link 
                      href="/issues"
                      className={cn(
                        "flex items-center px-3 py-2 rounded-md",
                        isActive("/issues") 
                          ? "bg-primary/10 border-l-4 border-primary text-primary" 
                          : "text-gray-700 hover:text-primary hover:bg-primary/5"
                      )}
                    >
                      <span className="material-icons mr-3">notifications</span>
                      <span className="whitespace-nowrap">Notification Center</span>
                    </Link>
                  </li>
                  {(user?.role === 'admin' || user?.role === 'manager') && (
                    <li>
                      <Link 
                        href="/approvals"
                        className={cn(
                          "flex items-center px-3 py-2 rounded-md",
                          isActive("/approvals") 
                            ? "bg-primary/10 border-l-4 border-primary text-primary" 
                            : "text-gray-700 hover:text-primary hover:bg-primary/5"
                        )}
                      >
                        <span className="material-icons mr-3">approval</span>
                        <span className="whitespace-nowrap">Approvals</span>
                      </Link>
                    </li>
                  )}
                </ul>
              </div>

              {/* SALES Section */}
              {hasInventoryAccess && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-gray-500 px-3 py-2">SALES</p>
                  <ul>
                    <li>
                      <Link 
                        href="/clients"
                        className={cn(
                          "flex items-center px-3 py-2 rounded-md",
                          isActive("/clients") 
                            ? "bg-primary/10 border-l-4 border-primary text-primary" 
                            : "text-gray-700 hover:text-primary hover:bg-primary/5"
                        )}
                      >
                        <span className="material-icons mr-3">business</span>
                        <span className="whitespace-nowrap">Clients</span>
                      </Link>
                    </li>
                    <li>
                      <Link 
                        href="/sales-orders"
                        className={cn(
                          "flex items-center px-3 py-2 rounded-md",
                          isActive("/sales-orders") || location.startsWith("/sales-orders/")
                            ? "bg-primary/10 border-l-4 border-primary text-primary" 
                            : "text-gray-700 hover:text-primary hover:bg-primary/5"
                        )}
                      >
                        <span className="material-icons mr-3">receipt</span>
                        <span className="whitespace-nowrap">Sales Orders</span>
                      </Link>
                    </li>
                  </ul>
                </div>
              )}

              {/* REPORTING Section */}
              {hasReportAccess && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-gray-500 px-3 py-2">REPORTING</p>
                  <ul>
                  <li>
                    <Link 
                      href="/stock-report"
                      className={cn(
                        "flex items-center px-3 py-2 rounded-md",
                        isActive("/stock-report") 
                          ? "bg-primary/10 border-l-4 border-primary text-primary" 
                          : "text-gray-700 hover:text-primary hover:bg-primary/5"
                      )}
                    >
                      <span className="material-icons mr-3">assessment</span>
                      <span className="whitespace-nowrap">Stock Report</span>
                    </Link>
                  </li>
                  <li>
                    <Link 
                      href="/movement-report"
                      className={cn(
                        "flex items-center px-3 py-2 rounded-md",
                        isActive("/movement-report") 
                          ? "bg-primary/10 border-l-4 border-primary text-primary" 
                          : "text-gray-700 hover:text-primary hover:bg-primary/5"
                      )}
                    >
                      <span className="material-icons mr-3">analytics</span>
                      <span className="whitespace-nowrap">Movement Report</span>
                    </Link>
                  </li>
                  <li>
                    <Link 
                      href="/reports/inventory-valuation"
                      className={cn(
                        "flex items-center px-3 py-2 rounded-md",
                        isActive("/reports/inventory-valuation") 
                          ? "bg-primary/10 border-l-4 border-primary text-primary" 
                          : "text-gray-700 hover:text-primary hover:bg-primary/5"
                      )}
                    >
                      <span className="material-icons mr-3">monetization_on</span>
                      <span className="whitespace-nowrap">Inventory Valuation</span>
                    </Link>
                  </li>
                  <li>
                    <Link 
                      href="/reports/low-stock"
                      className={cn(
                        "flex items-center px-3 py-2 rounded-md",
                        isActive("/reports/low-stock") 
                          ? "bg-primary/10 border-l-4 border-primary text-primary" 
                          : "text-gray-700 hover:text-primary hover:bg-primary/5"
                      )}
                    >
                      <span className="material-icons mr-3">warning</span>
                      <span className="whitespace-nowrap">Low Stock Report</span>
                    </Link>
                  </li>
                  <li>
                    <Link 
                      href="/reports/disposed-inventory"
                      className={cn(
                        "flex items-center px-3 py-2 rounded-md",
                        isActive("/reports/disposed-inventory") 
                          ? "bg-primary/10 border-l-4 border-primary text-primary" 
                          : "text-gray-700 hover:text-primary hover:bg-primary/5"
                      )}
                    >
                      <span className="material-icons mr-3">delete_forever</span>
                      <span className="whitespace-nowrap">Disposed Inventory</span>
                    </Link>
                  </li>
                  <li>
                    <Link 
                      href="/analytics"
                      className={cn(
                        "flex items-center px-3 py-2 rounded-md",
                        isActive("/analytics") 
                          ? "bg-primary/10 border-l-4 border-primary text-primary" 
                          : "text-gray-700 hover:text-primary hover:bg-primary/5"
                      )}
                    >
                      <span className="material-icons mr-3">insights</span>
                      <span className="whitespace-nowrap">Analytics Report</span>
                    </Link>
                  </li>
                  <li>
                    <Link 
                      href="/reports/client-sales-orders"
                      className={cn(
                        "flex items-center px-3 py-2 rounded-md",
                        isActive("/reports/client-sales-orders") 
                          ? "bg-primary/10 border-l-4 border-primary text-primary" 
                          : "text-gray-700 hover:text-primary hover:bg-primary/5"
                      )}
                      data-testid="link-client-sales-report"
                    >
                      <span className="material-icons mr-3">storefront</span>
                      <span className="whitespace-nowrap">Client Sales Report</span>
                    </Link>
                  </li>
                  </ul>
                </div>
              )}

              {/* MANAGEMENT Section */}
              {(user?.role === 'admin' || user?.role === 'manager') && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-gray-500 px-3 py-2">MANAGEMENT</p>
                  <ul>
                    <li>
                      <Link 
                        href="/users-management"
                        className={cn(
                          "flex items-center px-3 py-2 rounded-md",
                          isActive("/users-management") 
                            ? "bg-primary/10 border-l-4 border-primary text-primary" 
                            : "text-gray-700 hover:text-primary hover:bg-primary/5"
                        )}
                      >
                        <span className="material-icons mr-3">people</span>
                        <span className="whitespace-nowrap">Users</span>
                      </Link>
                    </li>

                    <li>
                      <Link 
                        href="/audit-trail"
                        className={cn(
                          "flex items-center px-3 py-2 rounded-md",
                          isActive("/audit-trail") 
                            ? "bg-primary/10 border-l-4 border-primary text-primary" 
                            : "text-gray-700 hover:text-primary hover:bg-primary/5"
                        )}
                      >
                        <span className="material-icons mr-3">fact_check</span>
                        <span className="whitespace-nowrap">Audit Trail</span>
                      </Link>
                    </li>
                    <li>
                      <Link 
                        href="/my-profile"
                        className={cn(
                          "flex items-center px-3 py-2 rounded-md",
                          isActive("/my-profile") 
                            ? "bg-primary/10 border-l-4 border-primary text-primary" 
                            : "text-gray-700 hover:text-primary hover:bg-primary/5"
                        )}
                      >
                        <span className="material-icons mr-3">account_circle</span>
                        <span className="whitespace-nowrap">My Profile</span>
                      </Link>
                    </li>
                  </ul>
                </div>
              )}

              {/* AUDIT Section */}
              {(user?.role === 'admin' || user?.role === 'audit_manager' || user?.role === 'audit_user') && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-gray-500 px-3 py-2">AUDIT</p>
                  <ul>
                    {(user?.role === 'audit_manager' || user?.role === 'audit_user') && (
                      <li>
                        <Link 
                          href="/audit-dashboard"
                          className={cn(
                            "flex items-center px-3 py-2 rounded-md",
                            isActive("/audit-dashboard") 
                              ? "bg-primary/10 border-l-4 border-primary text-primary" 
                              : "text-gray-700 hover:text-primary hover:bg-primary/5"
                          )}
                        >
                          <span className="material-icons mr-3">assignment</span>
                          <span className="whitespace-nowrap">Audit Dashboard</span>
                        </Link>
                      </li>
                    )}
                    {user?.role === 'admin' && (
                      <li>
                        <Link 
                          href="/audit-users"
                          className={cn(
                            "flex items-center px-3 py-2 rounded-md",
                            isActive("/audit-users") 
                              ? "bg-primary/10 border-l-4 border-primary text-primary" 
                              : "text-gray-700 hover:text-primary hover:bg-primary/5"
                          )}
                        >
                          <span className="material-icons mr-3">verified_user</span>
                          <span className="whitespace-nowrap">Audit Users</span>
                        </Link>
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {/* SYSTEM Section */}
              {user?.role === 'admin' && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-gray-500 px-3 py-2">SYSTEM</p>
                  <ul>
                    <li>
                      <Link 
                        href="/departments"
                        className={cn(
                          "flex items-center px-3 py-2 rounded-md",
                          isActive("/departments") 
                            ? "bg-primary/10 border-l-4 border-primary text-primary" 
                            : "text-gray-700 hover:text-primary hover:bg-primary/5"
                        )}
                      >
                        <span className="material-icons mr-3">corporate_fare</span>
                        <span className="whitespace-nowrap">Departments</span>
                      </Link>
                    </li>

                    <li>
                      <Link 
                        href="/settings"
                        className={cn(
                          "flex items-center px-3 py-2 rounded-md",
                          isActive("/settings") 
                            ? "bg-primary/10 border-l-4 border-primary text-primary" 
                            : "text-gray-700 hover:text-primary hover:bg-primary/5"
                        )}
                      >
                        <span className="material-icons mr-3">settings</span>
                        <span className="whitespace-nowrap">Settings</span>
                      </Link>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </nav>

          {/* User Profile Section */}
          <div className="mt-auto pt-4 border-t border-gray-200">
            <Link 
              href="/my-profile"
              className={cn(
                "flex items-center px-3 py-2 rounded-md mb-2",
                isActive("/my-profile") 
                  ? "bg-primary/10 border-l-4 border-primary text-primary" 
                  : "text-gray-700 hover:text-primary hover:bg-primary/5"
              )}
              onClick={() => {
                console.log("My Profile link clicked");
                onClose();
              }}
            >
              <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center mr-3">
                <span className="text-gray-600 text-sm font-medium">
                  {getUserInitials(user.name)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user.name}
                </p>
                <p className="text-xs text-gray-500 truncate capitalize">
                  {user.role}
                </p>
              </div>
            </Link>
          </div>
        </div>
      </aside>

      {/* Mobile backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-gray-600 bg-opacity-75 z-30 md:hidden"
          onClick={onClose}
        />
      )}
    </>
  );
}