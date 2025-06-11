import { useState } from "react";
import { User } from "@shared/schema";
import { getUserInitials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";

type HeaderProps = {
  user: User;
  onMenuClick: () => void;
};

export default function Header({ user, onMenuClick }: HeaderProps) {
  const { logoutMutation } = useAuth();
  const [_, navigate] = useLocation();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <header className="bg-white shadow-sm z-10">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center">
          <button 
            onClick={onMenuClick}
            className="md:hidden mr-3 text-gray-500 hover:text-primary"
          >
            <span className="material-icons">menu</span>
          </button>
          <div className="relative">
            <span className="material-icons absolute left-3 top-2 text-gray-400">search</span>
            <input 
              type="text" 
              placeholder="Search..." 
              className="pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-gray-50 transition-colors text-sm w-64"
            />
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <button 
            className="text-gray-500 hover:text-primary"
            onClick={() => navigate('/notifications')}
          >
            <span className="material-icons">notifications</span>
          </button>
          <button className="text-gray-500 hover:text-primary">
            <span className="material-icons">help_outline</span>
          </button>
          <div className="border-l pl-4">
            <DropdownMenu open={isUserMenuOpen} onOpenChange={setIsUserMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center space-x-1 text-gray-700 hover:text-primary p-1">
                  <div className="flex items-center space-x-2">
                    <div className="bg-primary/10 w-8 h-8 rounded-full flex items-center justify-center">
                      <span className="text-primary font-medium">{getUserInitials(user.name)}</span>
                    </div>
                    <span>{user.name}</span>
                  </div>
                  <span className="material-icons text-sm">arrow_drop_down</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="p-2">
                  <p className="font-medium">{user.name}</p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                  <p className="text-xs text-gray-500 capitalize mt-1">{user.role}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="cursor-pointer"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    // Placeholder for profile page
                    // navigate('/profile');
                  }}
                >
                  <span className="material-icons text-gray-500 mr-2 text-sm">account_circle</span>
                  <span>My Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="cursor-pointer"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    navigate('/settings');
                  }}
                >
                  <span className="material-icons text-gray-500 mr-2 text-sm">settings</span>
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="cursor-pointer text-red-600"
                  onClick={handleLogout}
                >
                  <span className="material-icons text-red-600 mr-2 text-sm">logout</span>
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
