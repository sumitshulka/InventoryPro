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

  // Array of navigation items grouped by category
  const navigationItems = [
    {
      category: "MAIN",
      items: [
        { name: "Dashboard", path: "/", icon: "dashboard" },
        { name: "Inventory", path: "/inventory", icon: "inventory_2" },
        { name: "Items", path: "/items", icon: "category" },
        { name: "Warehouses", path: "/warehouses", icon: "store" },
      ],
    },
    {
      category: "OPERATIONS",
      items: [
        { name: "CheckIn", path: "/check-in", icon: "login" },
        { name: "Requests", path: "/requests", icon: "assignment" },
        { name: "Transfers", path: "/transfers", icon: "swap_horiz" },
      ],
    },
    {
      category: "REPORTS",
      items: [
        { name: "Stock", path: "/stock-report", icon: "bar_chart" },
        { name: "Movement", path: "/movement-report", icon: "timeline" },
      ],
    },
  ];

  // Only show User Management for admins
  if (user.role === "admin") {
    navigationItems.push({
      category: "SYSTEM",
      items: [
        { name: "Users", path: "/users", icon: "people" },
      ],
    });
  }

  return (
    <>
      <aside 
        id="sidebar"
        className={cn(
          "bg-white shrink-0 shadow-md overflow-y-auto transition-all duration-300 z-30",
          isOpen ? "w-64 block" : "w-0 hidden md:block md:w-64",
          "md:static"
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
          {navigationItems.map((group, groupIndex) => (
            <div key={groupIndex} className="mb-4">
              <p className="text-xs font-medium text-gray-500 px-3 py-2">{group.category}</p>
              <ul>
                {group.items.map((item, itemIndex) => (
                  <li key={itemIndex}>
                    <Link 
                      href={item.path}
                      className={cn(
                        "sidebar-nav-item flex items-center px-3 py-2 rounded-md",
                        isActive(item.path) 
                          ? "active bg-primary/10 border-l-4 border-primary text-primary" 
                          : "text-gray-700 hover:text-primary hover:bg-primary/5"
                      )}
                      onClick={onClose}
                    >
                      <span className="material-icons mr-3">{item.icon}</span>
                      <span>{item.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
