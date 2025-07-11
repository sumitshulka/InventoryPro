import { useQuery } from "@tanstack/react-query";

interface LicenseInfo {
  hasLicense: boolean;
  isActive: boolean;
  isExpired: boolean;
  license?: {
    clientId: string;
    licenseKey: string;
    subscriptionType: string;
    validTill: string;
    lastValidated: string;
    subscriptionData?: {
      type: string;
      properties: {
        Users?: {
          type: string;
          minimum: number;
          maximum: number;
        };
        Products?: {
          type: string;
          minimum: number;
          maximum: number;
        };
      };
      required: string[];
    };
  };
}

export function useLicense() {
  const { data: licenseStatus, isLoading, error } = useQuery<LicenseInfo>({
    queryKey: ["/api/license/status"],
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000, // Check every 5 minutes
  });

  const getUserLimit = () => {
    if (!licenseStatus?.license?.subscriptionData?.properties?.Users) {
      return null;
    }
    return licenseStatus.license.subscriptionData.properties.Users.maximum;
  };

  const getProductLimit = () => {
    if (!licenseStatus?.license?.subscriptionData?.properties?.Products) {
      return null; // Unlimited if not specified
    }
    return licenseStatus.license.subscriptionData.properties.Products.maximum;
  };

  const hasUserLimit = () => {
    return getUserLimit() !== null;
  };

  const hasProductLimit = () => {
    return getProductLimit() !== null;
  };

  return {
    licenseStatus,
    isLoading,
    error,
    getUserLimit,
    getProductLimit,
    hasUserLimit,
    hasProductLimit,
    isValidLicense: licenseStatus?.hasLicense && licenseStatus?.isActive && !licenseStatus?.isExpired,
  };
}