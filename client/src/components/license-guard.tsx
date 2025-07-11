import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import LicenseAcquisitionPage from "../pages/license-acquisition-page";

interface LicenseGuardProps {
  children: React.ReactNode;
}

export default function LicenseGuard({ children }: LicenseGuardProps) {
  const [shouldCheckLicense, setShouldCheckLicense] = useState(true);

  // Check license status
  const { data: licenseStatus, isLoading, error, refetch } = useQuery({
    queryKey: ["/api/license/status"],
    enabled: shouldCheckLicense,
    retry: false,
    refetchInterval: 5 * 60 * 1000, // Check every 5 minutes
    staleTime: 1 * 60 * 1000, // Consider data stale after 1 minute
  });

  useEffect(() => {
    if (licenseStatus?.hasLicense && licenseStatus?.isActive) {
      setShouldCheckLicense(false);
    }
  }, [licenseStatus]);

  // Handle license acquisition success
  const handleLicenseAcquired = () => {
    // Force immediate refetch after license acquisition
    refetch();
    setShouldCheckLicense(true);
    
    // Also force a page reload after a short delay to ensure fresh state
    setTimeout(() => {
      window.location.reload();
    }, 2000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Checking license status...</p>
        </div>
      </div>
    );
  }

  // Show license acquisition page if no valid license
  if (!licenseStatus?.hasLicense || !licenseStatus?.isActive || licenseStatus?.isExpired) {
    return <LicenseAcquisitionPage onLicenseAcquired={handleLicenseAcquired} />;
  }

  // License is valid, show the app
  console.log("License is valid, showing app:", licenseStatus);
  return <>{children}</>;
}