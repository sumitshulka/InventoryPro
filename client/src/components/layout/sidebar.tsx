import { Link, useLocation } from "wouter";
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
  

  
  const isActive = (path: string) => {
    return location === path;
  };

  const handleNavClick = () => {
    // Close sidebar on mobile after navigation
    if (window.innerWidth < 768) {
      onClose();
    }
  };

  return (
    <>
      <aside 
        id="sidebar"
        className={cn(
          "bg-white shrink-0 shadow-md overflow-y-auto transition-all duration-300 z-30 md:static",
          "w-64 block"
        )}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h1 className="text-xl font-medium text-primary">Inventory Manager</h1>
          <button 
            onClick={onClose}
            className="md:hidden text-gray-500 hover:text-primary"
          >
            <span className="material-icons">close</span>
          </button>
        </div>
        
        {/* User Profile */}
        <div className="p-4 border-b">
          <div className="flex items-center space-x-3">
            <div className="bg-primary rounded-full w-10 h-10 flex items-center justify-center text-white font-medium">
              <span>{getUserInitials(user.name)}</span>
            </div>
            <div>
              <p className="font-medium">{user.name}</p>
              <p className="text-xs text-gray-500 capitalize">{user.role}</p>
            </div>
          </div>
        </div>
        
        {/* Navigation */}
        <nav className="p-2">
          {/* MAIN Section */}
          <div className="mb-4">
            <p className="text-xs font-medium text-gray-500 px-3 py-2">MAIN</p>
            <ul>
              <li>
                <Link 
                  href="/"
                  onClick={handleNavClick}
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
              <li>
                <Link 
                  href="/inventory"
                  onClick={handleNavClick}
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
              <li>
                <Link 
                  href="/items"
                  onClick={handleNavClick}
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
              <li>
                <Link 
                  href="/warehouses"
                  onClick={handleNavClick}
                  className={cn(
                    "flex items-center px-3 py-2 rounded-md",
                    isActive("/warehouses") 
                      ? "bg-primary/10 border-l-4 border-primary text-primary" 
                      : "text-gray-700 hover:text-primary hover:bg-primary/5"
                  )}
                >
                  <span className="material-icons mr-3">store</span>
                  <span className="whitespace-nowrap">Warehouses</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* OPERATIONS Section */}
          <div className="mb-4">
            <p className="text-xs font-medium text-gray-500 px-3 py-2">OPERATIONS</p>
            <ul>
              <li>
                <Link 
                  href="/check-in"
                  onClick={handleNavClick}
                  className={cn(
                    "flex items-center px-3 py-2 rounded-md",
                    isActive("/check-in") 
                      ? "bg-primary/10 border-l-4 border-primary text-primary" 
                      : "text-gray-700 hover:text-primary hover:bg-primary/5"
                  )}
                >
                  <span className="material-icons mr-3">login</span>
                  <span className="whitespace-nowrap">CheckIn</span>
                </Link>
              </li>
              <li>
                <Link 
                  href="/requests"
                  onClick={handleNavClick}
                  className={cn(
                    "flex items-center px-3 py-2 rounded-md",
                    isActive("/requests") 
                      ? "bg-primary/10 border-l-4 border-primary text-primary" 
                      : "text-gray-700 hover:text-primary hover:bg-primary/5"
                  )}
                >
                  <span className="material-icons mr-3">assignment</span>
                  <span className="whitespace-nowrap">Requests</span>
                </Link>
              </li>
              <li>
                <Link 
                  href="/transfers"
                  onClick={handleNavClick}
                  className={cn(
                    "flex items-center px-3 py-2 rounded-md",
                    isActive("/transfers") 
                      ? "bg-primary/10 border-l-4 border-primary text-primary" 
                      : "text-gray-700 hover:text-primary hover:bg-primary/5"
                  )}
                >
                  <span className="material-icons mr-3">swap_horiz</span>
                  <span className="whitespace-nowrap">Transfers</span>
                </Link>
              </li>
              {(user.role === "manager" || user.role === "admin") && (
                <li>
                  <Link 
                    href="/approvals"
                    onClick={handleNavClick}
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

          {/* REPORTS Section */}
          <div className="mb-4">
            <p className="text-xs font-medium text-gray-500 px-3 py-2">REPORTS</p>
            <ul>
              <li>
                <Link 
                  href="/stock-report"
                  onClick={handleNavClick}
                  className={cn(
                    "flex items-center px-3 py-2 rounded-md",
                    isActive("/stock-report") 
                      ? "bg-primary/10 border-l-4 border-primary text-primary" 
                      : "text-gray-700 hover:text-primary hover:bg-primary/5"
                  )}
                >
                  <span className="material-icons mr-3">bar_chart</span>
                  <span className="whitespace-nowrap">Stock</span>
                </Link>
              </li>
              <li>
                <Link 
                  href="/movement-report"
                  onClick={handleNavClick}
                  className={cn(
                    "flex items-center px-3 py-2 rounded-md",
                    isActive("/movement-report") 
                      ? "bg-primary/10 border-l-4 border-primary text-primary" 
                      : "text-gray-700 hover:text-primary hover:bg-primary/5"
                  )}
                >
                  <span className="material-icons mr-3">timeline</span>
                  <span className="whitespace-nowrap">Movement</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* SYSTEM Section - Only for admins */}
          {user.role === "admin" && (
            <div className="mb-4">
              <p className="text-xs font-medium text-gray-500 px-3 py-2">SYSTEM</p>
              <ul>
                <li>
                  <Link 
                    href="/users"
                    onClick={handleNavClick}
                    className={cn(
                      "flex items-center px-3 py-2 rounded-md",
                      isActive("/users") 
                        ? "bg-primary/10 border-l-4 border-primary text-primary" 
                        : "text-gray-700 hover:text-primary hover:bg-primary/5"
                    )}
                  >
                    <span className="material-icons mr-3">people</span>
                    <span className="whitespace-nowrap">Users</span>
                  </Link>
                </li>
              </ul>
            </div>
          )}
        </nav>
      </aside>
    </>
  );
}