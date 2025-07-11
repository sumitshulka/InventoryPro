import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, AlertCircle, CheckCircle, RefreshCw, Eye, EyeOff } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const licenseAcquisitionSchema = z.object({
  client_id: z.string().min(1, "Client ID is required"),
  product_id: z.string().min(1, "Product ID is required"),
  license_manager_url: z.string().url("Please enter a valid URL"),
});

type LicenseAcquisitionFormValues = z.infer<typeof licenseAcquisitionSchema>;

interface LicenseAcquisitionPageProps {
  onLicenseAcquired: () => void;
}

export default function LicenseAcquisitionPage({ onLicenseAcquired }: LicenseAcquisitionPageProps) {
  const [step, setStep] = useState<'form' | 'acquiring' | 'success' | 'error'>('form');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [lastRequest, setLastRequest] = useState<any>(null);
  const [lastResponse, setLastResponse] = useState<any>(null);
  const { toast } = useToast();

  // Get current license status
  const { data: licenseStatus } = useQuery({
    queryKey: ["/api/license/status"],
    retry: false,
  });

  const form = useForm<LicenseAcquisitionFormValues>({
    resolver: zodResolver(licenseAcquisitionSchema),
    defaultValues: {
      client_id: "",
      product_id: "",
      license_manager_url: "",
    },
  });

  const acquireLicenseMutation = useMutation({
    mutationFn: async (data: LicenseAcquisitionFormValues) => {
      const baseUrl = window.location.origin;
      const requestData = {
        client_id: data.client_id,
        product_id: data.product_id,
        base_url: baseUrl,
        license_manager_url: data.license_manager_url,
      };
      
      // Store request for debug panel
      setLastRequest(requestData);
      
      const response = await apiRequest("POST", "/api/license/acquire", requestData);
      const responseData = await response.json();
      
      // Store response for debug panel
      setLastResponse(responseData);
      
      return responseData;
    },
    onSuccess: (data) => {
      if (data.success) {
        setStep('success');
        toast({
          title: "License Acquired Successfully",
          description: "Your application license has been activated.",
        });
        setTimeout(() => {
          onLicenseAcquired();
        }, 2000);
      } else {
        setErrorMessage(data.message || 'Failed to acquire license');
        setStep('error');
      }
    },
    onError: (error: Error) => {
      setErrorMessage(error.message || 'Failed to acquire license');
      setStep('error');
    },
  });

  const validateLicenseMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/license/validate", {});
      return response.json();
    },
    onSuccess: (data) => {
      if (data.valid) {
        toast({
          title: "License Validated",
          description: "Your license is valid and active.",
        });
        onLicenseAcquired();
      } else {
        setErrorMessage(data.message || 'License validation failed');
        setStep('error');
      }
    },
    onError: (error: Error) => {
      setErrorMessage(error.message || 'License validation failed');
      setStep('error');
    },
  });

  const onSubmit = (data: LicenseAcquisitionFormValues) => {
    setStep('acquiring');
    acquireLicenseMutation.mutate(data);
  };

  const handleRetry = () => {
    setStep('form');
    setErrorMessage('');
  };

  const handleValidateExisting = () => {
    validateLicenseMutation.mutate();
  };

  const renderLicenseStatus = () => {
    if (!licenseStatus?.hasLicense) return null;

    const { license, isExpired, isActive } = licenseStatus;

    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Current License Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <Label className="text-gray-500">Client ID</Label>
              <p className="font-mono">{license?.clientId}</p>
            </div>
            <div>
              <Label className="text-gray-500">License Key</Label>
              <p className="font-mono">{license?.licenseKey}</p>
            </div>
            <div>
              <Label className="text-gray-500">Subscription Type</Label>
              <p>{license?.subscriptionType}</p>
            </div>
            <div>
              <Label className="text-gray-500">Valid Until</Label>
              <p>{license?.validTill ? new Date(license.validTill).toLocaleDateString() : 'N/A'}</p>
            </div>
          </div>
          
          <Alert className={isExpired ? "border-red-200 bg-red-50" : !isActive ? "border-yellow-200 bg-yellow-50" : "border-green-200 bg-green-50"}>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {isExpired 
                ? "License has expired. Please acquire a new license."
                : !isActive 
                ? "License is inactive. Please validate or acquire a new license."
                : "License is expired or inactive. Please validate or acquire a new license."}
            </AlertDescription>
          </Alert>

          {licenseStatus.hasLicense && (
            <Button 
              onClick={handleValidateExisting}
              disabled={validateLicenseMutation.isPending}
              className="w-full"
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
                  Validate Existing License
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Shield className="h-16 w-16 text-blue-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900">License Required</h1>
          <p className="text-gray-600 mt-2">
            This application requires a valid license to operate. Please acquire a license to continue.
          </p>
        </div>

        {renderLicenseStatus()}

        {step === 'form' && (
          <Card>
            <CardHeader>
              <CardTitle>Acquire License</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="client_id">Client ID</Label>
                  <Input
                    id="client_id"
                    placeholder="Enter your client ID"
                    {...form.register("client_id")}
                  />
                  {form.formState.errors.client_id && (
                    <p className="text-sm text-red-500">
                      {form.formState.errors.client_id.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="product_id">Product ID</Label>
                  <Input
                    id="product_id"
                    placeholder="Enter your product ID"
                    {...form.register("product_id")}
                  />
                  {form.formState.errors.product_id && (
                    <p className="text-sm text-red-500">
                      {form.formState.errors.product_id.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="license_manager_url">License Manager URL</Label>
                  <Input
                    id="license_manager_url"
                    placeholder="https://license-manager.example.com"
                    {...form.register("license_manager_url")}
                  />
                  {form.formState.errors.license_manager_url && (
                    <p className="text-sm text-red-500">
                      {form.formState.errors.license_manager_url.message}
                    </p>
                  )}
                </div>

                <Button type="submit" className="w-full">
                  <Shield className="h-4 w-4 mr-2" />
                  Acquire License
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {step === 'acquiring' && (
          <Card>
            <CardContent className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h3 className="text-lg font-semibold mb-2">Acquiring License</h3>
              <p className="text-gray-600">Please wait while we acquire your license...</p>
            </CardContent>
          </Card>
        )}

        {step === 'success' && (
          <Card>
            <CardContent className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-green-700 mb-2">License Acquired Successfully</h3>
              <p className="text-gray-600">Redirecting to application...</p>
            </CardContent>
          </Card>
        )}

        {step === 'error' && (
          <Card>
            <CardContent className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-red-700 mb-2">License Acquisition Failed</h3>
              <p className="text-gray-600 mb-4">{errorMessage}</p>
              <div className="space-y-2">
                <Button onClick={handleRetry} className="w-full">
                  Try Again
                </Button>
                {licenseStatus?.hasLicense && (
                  <Button onClick={handleValidateExisting} variant="outline" className="w-full">
                    Validate Existing License
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Debug Panel */}
        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Debug Information</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowDebugPanel(!showDebugPanel)}
              >
                {showDebugPanel ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {showDebugPanel ? 'Hide' : 'Show'} Debug
              </Button>
            </div>
          </CardHeader>
          {showDebugPanel && (
            <CardContent className="space-y-4">
              {lastRequest && (
                <div>
                  <Label className="text-sm font-medium">Last Request:</Label>
                  <div className="mt-1 p-3 bg-gray-50 rounded-md">
                    <pre className="text-xs overflow-x-auto">
                      {JSON.stringify(lastRequest, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
              {lastResponse && (
                <div>
                  <Label className="text-sm font-medium">Last Response:</Label>
                  <div className="mt-1 p-3 bg-gray-50 rounded-md">
                    <pre className="text-xs overflow-x-auto">
                      {JSON.stringify(lastResponse, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
              {!lastRequest && !lastResponse && (
                <p className="text-sm text-gray-500">Submit the form to see request/response data</p>
              )}
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}