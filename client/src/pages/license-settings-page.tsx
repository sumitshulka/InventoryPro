import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Shield, CheckCircle, AlertCircle, RefreshCw, Clock, Users, Package } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export default function LicenseSettingsPage() {
  const { toast } = useToast();
  const [licenseManagerUrl, setLicenseManagerUrl] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Get current license status
  const { data: licenseStatus, isLoading, refetch } = useQuery({
    queryKey: ["/api/license/status"],
  });

  // Validate license mutation
  const validateLicenseMutation = useMutation({
    mutationFn: async (url?: string) => {
      const payload = url ? { license_manager_url: url } : {};
      const response = await apiRequest("POST", "/api/license/validate", payload);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.valid) {
        toast({
          title: "License Validated",
          description: "Your license is valid and active.",
        });
        refetch();
      } else {
        toast({
          title: "License Validation Failed",
          description: data.message || 'License validation failed',
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Validation Error",
        description: error.message || 'Failed to validate license',
        variant: "destructive",
      });
    },
  });

  const handleValidateLicense = () => {
    if (licenseManagerUrl.trim()) {
      validateLicenseMutation.mutate(licenseManagerUrl.trim());
      setIsDialogOpen(false);
    } else {
      // Try local validation first
      validateLicenseMutation.mutate();
    }
  };

  const handleValidateWithUrl = () => {
    setIsDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!licenseStatus?.hasLicense) {
    return (
      <div className="p-6">
        <div className="text-center">
          <Shield className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No License Found</h2>
          <p className="text-gray-600 mb-6">
            No license is currently configured for this application.
          </p>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please contact your system administrator to acquire a license for this application.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const { license, isExpired, isActive } = licenseStatus;
  const subscriptionData = license?.subscriptionData;

  const getStatusBadge = () => {
    if (isExpired) {
      return <Badge variant="destructive">Expired</Badge>;
    }
    if (!isActive) {
      return <Badge variant="secondary">Inactive</Badge>;
    }
    return <Badge className="bg-green-100 text-green-800">Active</Badge>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getDaysUntilExpiry = () => {
    if (!license?.validTill) return null;
    const expiryDate = new Date(license.validTill);
    const today = new Date();
    const diffTime = expiryDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const daysUntilExpiry = getDaysUntilExpiry();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">License Management</h1>
          <p className="text-gray-600 mt-1">View and manage your application license</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={handleValidateLicense}
            disabled={validateLicenseMutation.isPending}
            variant="outline"
          >
            {validateLicenseMutation.isPending ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Validating...
              </>
            ) : (
              <>
                <Shield className="h-4 w-4 mr-2" />
                Validate License
              </>
            )}
          </Button>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                onClick={handleValidateWithUrl}
                disabled={validateLicenseMutation.isPending}
                variant="default"
              >
                External Validation
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>External License Validation</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="license-manager-url">License Manager URL</Label>
                  <Input
                    id="license-manager-url"
                    placeholder="https://license-manager.example.com"
                    value={licenseManagerUrl}
                    onChange={(e) => setLicenseManagerUrl(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleValidateLicense} disabled={!licenseManagerUrl.trim()}>
                    Validate
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* License Status Alert */}
      {(isExpired || !isActive) && (
        <Alert className={isExpired ? "border-red-200 bg-red-50" : "border-yellow-200 bg-yellow-50"}>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {isExpired 
              ? "Your license has expired. Please contact your administrator to renew it."
              : "Your license is inactive. Please validate your license or contact your administrator."}
          </AlertDescription>
        </Alert>
      )}

      {/* License expiry warning */}
      {daysUntilExpiry !== null && daysUntilExpiry > 0 && daysUntilExpiry <= 30 && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <Clock className="h-4 w-4" />
          <AlertDescription>
            Your license will expire in {daysUntilExpiry} day{daysUntilExpiry !== 1 ? 's' : ''}. 
            Please contact your administrator to renew it before expiry.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* License Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              License Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-gray-500">Status</Label>
              {getStatusBadge()}
            </div>

            <Separator />

            <div className="space-y-3">
              <div>
                <Label className="text-gray-500">Client ID</Label>
                <p className="font-mono text-sm mt-1 p-2 bg-gray-50 rounded border">
                  {license?.clientId}
                </p>
              </div>

              <div>
                <Label className="text-gray-500">License Key</Label>
                <p className="font-mono text-sm mt-1 p-2 bg-gray-50 rounded border">
                  {license?.licenseKey}
                </p>
              </div>

              <div>
                <Label className="text-gray-500">Subscription Type</Label>
                <p className="mt-1">{license?.subscriptionType}</p>
              </div>

              <div>
                <Label className="text-gray-500">Valid Until</Label>
                <p className="mt-1">
                  {license?.validTill ? formatDate(license.validTill) : 'N/A'}
                </p>
              </div>

              <div>
                <Label className="text-gray-500">Last Validated</Label>
                <p className="mt-1">
                  {license?.lastValidated ? formatDate(license.lastValidated) : 'Never'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Subscription Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Subscription Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            {subscriptionData?.properties ? (
              <div className="space-y-4">
                {Object.entries(subscriptionData.properties).map(([key, value]: [string, any]) => (
                  <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded border">
                    <div className="flex items-center gap-2">
                      {key === 'Users' && <Users className="h-4 w-4 text-blue-600" />}
                      <span className="font-medium">{key}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {value.maximum ? `Up to ${value.maximum}` : 'Unlimited'}
                      </p>
                      {value.minimum && (
                        <p className="text-xs text-gray-500">
                          Minimum: {value.minimum}
                        </p>
                      )}
                    </div>
                  </div>
                ))}

                <Separator className="my-4" />

                <div className="text-xs text-gray-500">
                  <p className="font-medium mb-2">Required Features:</p>
                  <div className="flex flex-wrap gap-1">
                    {subscriptionData.required?.map((feature: string) => (
                      <Badge key={feature} variant="outline" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Package className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">No subscription details available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* License Health */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            License Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 border rounded">
              <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full mb-2 ${
                isActive && !isExpired ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
              }`}>
                {isActive && !isExpired ? <CheckCircle className="h-6 w-6" /> : <AlertCircle className="h-6 w-6" />}
              </div>
              <p className="font-medium">License Status</p>
              <p className="text-sm text-gray-600">
                {isActive && !isExpired ? 'Active & Valid' : 'Inactive or Expired'}
              </p>
            </div>

            <div className="text-center p-4 border rounded">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-2 bg-blue-100 text-blue-600">
                <Clock className="h-6 w-6" />
              </div>
              <p className="font-medium">Days Remaining</p>
              <p className="text-sm text-gray-600">
                {daysUntilExpiry !== null ? (
                  daysUntilExpiry > 0 ? `${daysUntilExpiry} days` : 'Expired'
                ) : 'Unknown'}
              </p>
            </div>

            <div className="text-center p-4 border rounded">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-2 bg-purple-100 text-purple-600">
                <Shield className="h-6 w-6" />
              </div>
              <p className="font-medium">Last Check</p>
              <p className="text-sm text-gray-600">
                {license?.lastValidated ? (
                  new Date(license.lastValidated).toLocaleDateString()
                ) : 'Never'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}