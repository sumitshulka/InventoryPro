import { ReactNode, useState, useEffect } from "react";
import { useLocation } from "wouter";
import Sidebar from "./sidebar";
import Header from "./header";
import Footer from "./footer";
import { useAuth } from "@/hooks/use-auth";
import { useMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

type AppLayoutProps = {
  children: ReactNode;
};

export default function AppLayout({ children }: AppLayoutProps) {
  const { user } = useAuth();
  const isMobile = useMobile();
  const [isSidebarOpen, setIsSidebarOpen] = useState(!isMobile); // Open on desktop, closed on mobile
  const [location, setLocation] = useLocation();

  // Update sidebar state when screen size changes - but preserve user preference on desktop
  useEffect(() => {
    if (isMobile) {
      setIsSidebarOpen(false); // Close on mobile
    } else {
      setIsSidebarOpen(true); // Always open on desktop
    }
  }, [isMobile]);



  // If user is not authenticated, redirect to login
  useEffect(() => {
    if (!user) {
      setLocation("/auth");
    }
  }, [user, setLocation]);

  // Close sidebar on mobile when clicking away - ONLY on mobile
  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      // Only apply this logic on mobile devices
      if (isMobile && isSidebarOpen) {
        const sidebar = document.getElementById("sidebar");
        const target = event.target as Node;
        
        if (sidebar && !sidebar.contains(target)) {
          setIsSidebarOpen(false);
        }
      }
    }

    // Only add event listener on mobile
    if (isMobile) {
      document.addEventListener("mousedown", handleOutsideClick);
      return () => {
        document.removeEventListener("mousedown", handleOutsideClick);
      };
    }
  }, [isMobile, isSidebarOpen]);

  // No automatic sidebar closing on route changes

  // Prevent scrolling when sidebar is open on mobile
  useEffect(() => {
    if (isMobile) {
      if (isSidebarOpen) {
        document.body.style.overflow = "hidden";
      } else {
        document.body.style.overflow = "auto";
      }
    }
    
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isMobile, isSidebarOpen]);

  if (!user) {
    return null; // Don't render anything if user is not authenticated, will redirect
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <Sidebar 
        user={user} 
        isOpen={isSidebarOpen} 
        onClose={() => {
          // Only allow closing on mobile
          if (isMobile) {
            setIsSidebarOpen(false);
          }
        }}
      />
      
      {/* Overlay for mobile sidebar */}
      {isMobile && isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-gray-900 bg-opacity-50 z-20"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          user={user} 
          onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} 
        />
        
        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-gray-100 p-4">
          {children}
        </main>
        
        <Footer />
      </div>
    </div>
  );
}
