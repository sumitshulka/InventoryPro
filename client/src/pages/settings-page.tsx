import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import AppLayout from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest, queryClient, invalidateRelatedQueries } from "@/lib/queryClient";
import { Loader2, Plus, Edit, Trash2, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const approvalSettingsSchema = z.object({
  requestType: z.string().min(1, "Request type is required"),
  minApprovalLevel: z.string().min(1, "Minimum approval level is required"),
  maxAmount: z.string().optional(),
  requiresSecondApproval: z.boolean(),
  isActive: z.boolean(),
});

const organizationSettingsSchema = z.object({
  organizationName: z.string().min(1, "Organization name is required"),
  logo: z.string().optional(),
  currency: z.string().min(1, "Currency is required"),
  currencySymbol: z.string().min(1, "Currency symbol is required"),
  timezone: z.string().min(1, "Timezone is required"),
  defaultUnits: z.array(z.string()).min(1, "At least one unit is required"),
  allowedCategories: z.array(z.string()).min(1, "At least one category is required"),
  inventoryValuationMethod: z.enum(["Last Value", "Earliest Value", "Average Value"], {
    errorMap: () => ({ message: "Please select a valid inventory valuation method" }),
  }),
});

const locationSchema = z.object({
  name: z.string().min(1, "Location name is required"),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zipCode: z.string().min(1, "ZIP code is required"),
  country: z.string().min(1, "Country is required"),
  isActive: z.boolean(),
});

const departmentSchema = z.object({
  name: z.string().min(1, "Department name is required"),
  description: z.string().optional(),
  managerId: z.number().optional(),
  isActive: z.boolean().default(true),
});

type ApprovalSettingsFormValues = z.infer<typeof approvalSettingsSchema>;
type OrganizationSettingsFormValues = z.infer<typeof organizationSettingsSchema>;
type LocationFormValues = z.infer<typeof locationSchema>;
type DepartmentFormValues = z.infer<typeof departmentSchema>;

export default function SettingsPage() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false);
  const [isDepartmentDialogOpen, setIsDepartmentDialogOpen] = useState(false);
  const [editingSettings, setEditingSettings] = useState<any>(null);
  const [editingLocation, setEditingLocation] = useState<any>(null);
  const [editingDepartment, setEditingDepartment] = useState<any>(null);

  const { data: approvalSettings, isLoading } = useQuery({
    queryKey: ["/api/approval-settings"],
  });

  const { data: organizationSettings, isLoading: orgSettingsLoading } = useQuery({
    queryKey: ["/api/organization-settings"],
  });

  const { data: locations, isLoading: locationsLoading } = useQuery({
    queryKey: ["/api/locations"],
  });

  const { data: departments, isLoading: departmentsLoading } = useQuery({
    queryKey: ["/api/departments"],
  });

  const { data: user } = useQuery({
    queryKey: ["/api/user"],
  });

  const { data: users } = useQuery({
    queryKey: ["/api/users"],
  });

  const { data: warehouses } = useQuery({
    queryKey: ["/api/warehouses"],
  });

  // Check if user is admin
  const isAdmin = (user as any)?.role === 'admin';

  const form = useForm<ApprovalSettingsFormValues>({
    resolver: zodResolver(approvalSettingsSchema),
    defaultValues: {
      requestType: "issue",
      minApprovalLevel: "manager",
      maxAmount: "",
      requiresSecondApproval: false,
      isActive: true,
    },
  });

  const orgForm = useForm<OrganizationSettingsFormValues>({
    resolver: zodResolver(organizationSettingsSchema),
    defaultValues: {
      organizationName: "My Organization",
      logo: "",
      currency: "USD",
      currencySymbol: "₹",
      timezone: "UTC",
      defaultUnits: ["pcs", "boxes", "reams", "kg", "liters"],
      allowedCategories: ["Electronics", "Office Supplies", "Furniture"],
      inventoryValuationMethod: "Last Value",
    },
  });

  const locationForm = useForm<LocationFormValues>({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      name: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      country: "India",
      isActive: true,
    },
  });

  const departmentForm = useForm<DepartmentFormValues>({
    resolver: zodResolver(departmentSchema),
    defaultValues: {
      name: "",
      description: "",
      managerId: undefined,
      isActive: true,
    },
  });

  // Update form when organization settings load
  useEffect(() => {
    if (organizationSettings) {
      orgForm.reset({
        organizationName: (organizationSettings as any).organizationName || "My Organization",
        logo: (organizationSettings as any).logo || "",
        currency: (organizationSettings as any).currency || "USD",
        currencySymbol: (organizationSettings as any).currencySymbol || "₹",
        timezone: (organizationSettings as any).timezone || "UTC",
        defaultUnits: (organizationSettings as any).defaultUnits || ["pcs", "boxes", "reams", "kg", "liters"],
        allowedCategories: (organizationSettings as any).allowedCategories || ["Electronics", "Office Supplies", "Furniture"],
        inventoryValuationMethod: (organizationSettings as any).inventoryValuationMethod || "Last Value",
      });
    }
  }, [organizationSettings, orgForm]);

  const createMutation = useMutation({
    mutationFn: async (data: ApprovalSettingsFormValues) => {
      const payload = {
        ...data,
        maxAmount: data.maxAmount ? parseFloat(data.maxAmount) : null,
      };
      const res = await apiRequest("POST", "/api/approval-settings", payload);
      return res.json();
    },
    onSuccess: async () => {
      await invalidateRelatedQueries('approval-settings', 'create');
      toast({
        title: "Approval settings created",
        description: "The approval settings have been created successfully.",
      });
      form.reset();
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create settings",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: ApprovalSettingsFormValues) => {
      const payload = {
        ...data,
        maxAmount: data.maxAmount ? parseFloat(data.maxAmount) : null,
      };
      const res = await apiRequest("PUT", `/api/approval-settings/${editingSettings.id}`, payload);
      return res.json();
    },
    onSuccess: async () => {
      await invalidateRelatedQueries('approval-settings', 'update');
      toast({
        title: "Approval settings updated",
        description: "The approval settings have been updated successfully.",
      });
      form.reset();
      setIsDialogOpen(false);
      setEditingSettings(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update settings",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/approval-settings/${id}`);
      return res.json();
    },
    onSuccess: async () => {
      await invalidateRelatedQueries('approval-settings', 'delete');
      toast({
        title: "Approval settings deleted",
        description: "The approval settings have been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete settings",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateOrgSettingsMutation = useMutation({
    mutationFn: async (data: OrganizationSettingsFormValues) => {
      const res = await apiRequest("PUT", "/api/organization-settings", data);
      return res.json();
    },
    onSuccess: async () => {
      await invalidateRelatedQueries('organization-settings', 'update');
      toast({
        title: "Organization settings updated",
        description: "The organization settings have been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update organization settings",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createLocationMutation = useMutation({
    mutationFn: async (data: LocationFormValues) => {
      const res = await apiRequest("POST", "/api/locations", data);
      return res.json();
    },
    onSuccess: async () => {
      await invalidateRelatedQueries('location', 'create');
      toast({
        title: "Location created",
        description: "The office location has been created successfully.",
      });
      locationForm.reset();
      setIsLocationDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create location",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateLocationMutation = useMutation({
    mutationFn: async (data: LocationFormValues & { id: number }) => {
      const { id, ...updateData } = data;
      const res = await apiRequest("PUT", `/api/locations/${id}`, updateData);
      return res.json();
    },
    onSuccess: async () => {
      await invalidateRelatedQueries('location', 'update');
      toast({
        title: "Location updated",
        description: "The office location has been updated successfully.",
      });
      locationForm.reset();
      setIsLocationDialogOpen(false);
      setEditingLocation(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update location",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteLocationMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/locations/${id}`);
      return res.json();
    },
    onSuccess: async () => {
      await invalidateRelatedQueries('location', 'delete');
      toast({
        title: "Location deleted",
        description: "The office location has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete location",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Department mutations
  const createDepartmentMutation = useMutation({
    mutationFn: async (data: DepartmentFormValues) => {
      const res = await apiRequest("POST", "/api/departments", data);
      return res.json();
    },
    onSuccess: async () => {
      await invalidateRelatedQueries('department', 'create');
      toast({
        title: "Department created",
        description: "The department has been created successfully.",
      });
      departmentForm.reset();
      setIsDepartmentDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create department",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateDepartmentMutation = useMutation({
    mutationFn: async (data: DepartmentFormValues & { id: number }) => {
      const { id, ...updateData } = data;
      const res = await apiRequest("PUT", `/api/departments/${id}`, updateData);
      return res.json();
    },
    onSuccess: async () => {
      await invalidateRelatedQueries('department', 'update');
      toast({
        title: "Department updated",
        description: "The department has been updated successfully.",
      });
      departmentForm.reset();
      setIsDepartmentDialogOpen(false);
      setEditingDepartment(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update department",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteDepartmentMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/departments/${id}`);
      return res.json();
    },
    onSuccess: async () => {
      await invalidateRelatedQueries('department', 'delete');
      toast({
        title: "Department deleted",
        description: "The department has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete department",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ApprovalSettingsFormValues) => {
    if (editingSettings) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const onLocationSubmit = (data: LocationFormValues) => {
    if (editingLocation) {
      updateLocationMutation.mutate({ ...data, id: editingLocation.id });
    } else {
      createLocationMutation.mutate(data);
    }
  };

  const onDepartmentSubmit = (data: DepartmentFormValues) => {
    if (editingDepartment) {
      updateDepartmentMutation.mutate({ ...data, id: editingDepartment.id });
    } else {
      createDepartmentMutation.mutate(data);
    }
  };

  const onOrgSubmit = (data: OrganizationSettingsFormValues) => {
    updateOrgSettingsMutation.mutate(data);
  };

  const handleEdit = (settings: any) => {
    setEditingSettings(settings);
    form.reset({
      requestType: settings.requestType,
      minApprovalLevel: settings.minApprovalLevel,
      maxAmount: settings.maxAmount ? settings.maxAmount.toString() : "",
      requiresSecondApproval: settings.requiresSecondApproval,
      isActive: settings.isActive,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this approval setting?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleEditDepartment = (department: any) => {
    setEditingDepartment(department);
    departmentForm.reset({
      name: department.name,
      description: department.description || "",
      managerId: department.managerId || undefined,
      isActive: department.isActive,
    });
    setIsDepartmentDialogOpen(true);
  };

  const handleDeleteDepartment = (id: number) => {
    if (confirm("Are you sure you want to delete this department?")) {
      deleteDepartmentMutation.mutate(id);
    }
  };

  // Show access denied message for non-admin users
  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">System Settings</h1>
              <p className="text-muted-foreground">Configure system-wide settings and approval workflows</p>
            </div>
          </div>

          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Settings className="h-16 w-16 text-gray-400 mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Restricted</h2>
              <p className="text-gray-600 text-center max-w-md">
                System settings including organization configuration, office locations, and approval workflows 
                can only be accessed by administrators. Please contact your system administrator if you need 
                to make changes to these settings.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">System Settings</h1>
            <p className="text-muted-foreground">Configure system-wide settings and approval workflows</p>
          </div>
        </div>

        <Tabs defaultValue="approval-hierarchy" className="space-y-4">
          <TabsList>
            <TabsTrigger value="approval-hierarchy">Approval Hierarchy</TabsTrigger>
            <TabsTrigger value="departments">Departments</TabsTrigger>
            <TabsTrigger value="office-locations">Office Locations</TabsTrigger>
            <TabsTrigger value="organization">Organization</TabsTrigger>
            <TabsTrigger value="system-config">System Configuration</TabsTrigger>
          </TabsList>

          <TabsContent value="approval-hierarchy" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div>
                  <CardTitle>Approval Settings</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Configure approval requirements for different request types
                  </p>
                </div>
                <Button onClick={() => setIsDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Setting
                </Button>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Request Type</TableHead>
                        <TableHead>Min Approval Level</TableHead>
                        <TableHead>Max Amount</TableHead>
                        <TableHead>Second Approval</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {approvalSettings && Array.isArray(approvalSettings) && approvalSettings.length > 0 ? (
                        approvalSettings.map((setting: any) => (
                          <TableRow key={setting.id}>
                            <TableCell className="font-medium capitalize">
                              {setting.requestType}
                            </TableCell>
                            <TableCell className="capitalize">
                              {setting.minApprovalLevel}
                            </TableCell>
                            <TableCell>
                              {setting.maxAmount ? `$${setting.maxAmount}` : "No limit"}
                            </TableCell>
                            <TableCell>
                              {setting.requiresSecondApproval ? "Yes" : "No"}
                            </TableCell>
                            <TableCell>
                              <span
                                className={`px-2 py-1 text-xs rounded-full ${
                                  setting.isActive
                                    ? "bg-green-100 text-green-800"
                                    : "bg-gray-100 text-gray-800"
                                }`}
                              >
                                {setting.isActive ? "Active" : "Inactive"}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex space-x-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEdit(setting)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDelete(setting.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                            No approval settings configured
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="departments" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div>
                  <CardTitle>Department Management</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Manage organizational departments and assign users
                  </p>
                </div>
                <Button onClick={() => {
                  setEditingDepartment(null);
                  departmentForm.reset();
                  setIsDepartmentDialogOpen(true);
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Department
                </Button>
              </CardHeader>
              <CardContent>
                {departmentsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Department Name</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Manager</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {departments && Array.isArray(departments) && departments.length > 0 ? (
                        departments.map((department: any) => {
                          const manager = users && Array.isArray(users) ? users.find((u: any) => u.id === department.managerId) : null;
                          return (
                            <TableRow key={department.id}>
                              <TableCell className="font-medium">
                                {department.name}
                              </TableCell>
                              <TableCell>
                                {department.description || "No description"}
                              </TableCell>
                              <TableCell>
                                {manager ? manager.name : "No manager assigned"}
                              </TableCell>
                              <TableCell>
                                <span
                                  className={`px-2 py-1 text-xs rounded-full ${
                                    department.isActive
                                      ? "bg-green-100 text-green-800"
                                      : "bg-gray-100 text-gray-800"
                                  }`}
                                >
                                  {department.isActive ? "Active" : "Inactive"}
                                </span>
                              </TableCell>
                              <TableCell>
                                <div className="flex space-x-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleEditDepartment(department)}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDeleteDepartment(department.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                            No departments configured
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="office-locations" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div>
                  <CardTitle>Office Locations</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Manage office locations for warehouses and operations
                  </p>
                </div>
                <Button onClick={() => {
                  setEditingLocation(null);
                  locationForm.reset();
                  setIsLocationDialogOpen(true);
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Location
                </Button>
              </CardHeader>
              <CardContent>
                {locationsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Location Name</TableHead>
                        <TableHead>Address</TableHead>
                        <TableHead>City</TableHead>
                        <TableHead>State</TableHead>
                        <TableHead>Country</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {locations && Array.isArray(locations) && locations.length > 0 ? (
                        locations.map((location: any) => (
                          <TableRow key={location.id}>
                            <TableCell className="font-medium">
                              {location.name}
                            </TableCell>
                            <TableCell>{location.address}</TableCell>
                            <TableCell>{location.city}</TableCell>
                            <TableCell>{location.state}</TableCell>
                            <TableCell>{location.country}</TableCell>
                            <TableCell>
                              <span
                                className={`px-2 py-1 text-xs rounded-full ${
                                  location.isActive
                                    ? "bg-green-100 text-green-800"
                                    : "bg-red-100 text-red-800"
                                }`}
                              >
                                {location.isActive ? "Active" : "Inactive"}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex space-x-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setEditingLocation(location);
                                    locationForm.reset({
                                      name: location.name,
                                      address: location.address,
                                      city: location.city,
                                      state: location.state,
                                      zipCode: location.zipCode,
                                      country: location.country,
                                      isActive: location.isActive,
                                    });
                                    setIsLocationDialogOpen(true);
                                  }}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => deleteLocationMutation.mutate(location.id)}
                                  disabled={deleteLocationMutation.isPending}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            No office locations found. Add your first location to get started.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="organization" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Organization Settings</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Configure organization-wide settings including default currency
                </p>
              </CardHeader>
              <CardContent>
                {orgSettingsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <form onSubmit={orgForm.handleSubmit(onOrgSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="organizationName">Organization Name</Label>
                        <Input
                          id="organizationName"
                          placeholder="Enter organization name"
                          {...orgForm.register("organizationName")}
                        />
                        {orgForm.formState.errors.organizationName && (
                          <p className="text-sm text-red-500">
                            {orgForm.formState.errors.organizationName.message}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="logo">Company Logo</Label>
                        <div className="flex items-center space-x-4">
                          {orgForm.watch("logo") && (
                            <div className="w-16 h-16 border rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center">
                              <img 
                                src={orgForm.watch("logo")} 
                                alt="Logo preview" 
                                className="max-w-full max-h-full object-contain"
                              />
                            </div>
                          )}
                          <div className="flex-1">
                            <Input
                              type="file"
                              accept=".png,.jpg,.jpeg"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  if (file.size > 2 * 1024 * 1024) {
                                    toast({
                                      title: "File too large",
                                      description: "Please select an image smaller than 2MB.",
                                      variant: "destructive",
                                    });
                                    return;
                                  }
                                  
                                  const reader = new FileReader();
                                  reader.onload = (event) => {
                                    const base64 = event.target?.result as string;
                                    orgForm.setValue("logo", base64);
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              PNG, JPG, or JPEG. Max file size 2MB.
                            </p>
                          </div>
                          {orgForm.watch("logo") && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => orgForm.setValue("logo", "")}
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="timezone">Default Timezone</Label>
                        <Select
                          onValueChange={(value) => orgForm.setValue("timezone", value)}
                          defaultValue={orgForm.getValues("timezone")}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select timezone" />
                          </SelectTrigger>
                          <SelectContent className="max-h-60 overflow-y-auto">
                            <SelectItem value="UTC">UTC (GMT+0:00) - Coordinated Universal Time</SelectItem>
                            <SelectItem value="America/New_York">EST (GMT-5:00) - Eastern Time</SelectItem>
                            <SelectItem value="America/Chicago">CST (GMT-6:00) - Central Time</SelectItem>
                            <SelectItem value="America/Denver">MST (GMT-7:00) - Mountain Time</SelectItem>
                            <SelectItem value="America/Los_Angeles">PST (GMT-8:00) - Pacific Time</SelectItem>
                            <SelectItem value="Europe/London">GMT (GMT+0:00) - London</SelectItem>
                            <SelectItem value="Europe/Paris">CET (GMT+1:00) - Paris</SelectItem>
                            <SelectItem value="Europe/Berlin">CET (GMT+1:00) - Berlin</SelectItem>
                            <SelectItem value="Europe/Rome">CET (GMT+1:00) - Rome</SelectItem>
                            <SelectItem value="Europe/Madrid">CET (GMT+1:00) - Madrid</SelectItem>
                            <SelectItem value="Europe/Amsterdam">CET (GMT+1:00) - Amsterdam</SelectItem>
                            <SelectItem value="Europe/Moscow">MSK (GMT+3:00) - Moscow</SelectItem>
                            <SelectItem value="Asia/Tokyo">JST (GMT+9:00) - Tokyo</SelectItem>
                            <SelectItem value="Asia/Shanghai">CST (GMT+8:00) - Shanghai</SelectItem>
                            <SelectItem value="Asia/Hong_Kong">HKT (GMT+8:00) - Hong Kong</SelectItem>
                            <SelectItem value="Asia/Singapore">SGT (GMT+8:00) - Singapore</SelectItem>
                            <SelectItem value="Asia/Mumbai">IST (GMT+5:30) - Mumbai</SelectItem>
                            <SelectItem value="Asia/Dubai">GST (GMT+4:00) - Dubai</SelectItem>
                            <SelectItem value="Australia/Sydney">AEDT (GMT+11:00) - Sydney</SelectItem>
                            <SelectItem value="Australia/Melbourne">AEDT (GMT+11:00) - Melbourne</SelectItem>
                            <SelectItem value="Pacific/Auckland">NZDT (GMT+13:00) - Auckland</SelectItem>
                            <SelectItem value="America/Toronto">EST (GMT-5:00) - Toronto</SelectItem>
                            <SelectItem value="America/Vancouver">PST (GMT-8:00) - Vancouver</SelectItem>
                            <SelectItem value="America/Sao_Paulo">BRT (GMT-3:00) - São Paulo</SelectItem>
                            <SelectItem value="America/Mexico_City">CST (GMT-6:00) - Mexico City</SelectItem>
                            <SelectItem value="Africa/Cairo">EET (GMT+2:00) - Cairo</SelectItem>
                            <SelectItem value="Africa/Johannesburg">SAST (GMT+2:00) - Johannesburg</SelectItem>
                          </SelectContent>
                        </Select>
                        {orgForm.formState.errors.timezone && (
                          <p className="text-sm text-red-500">
                            {orgForm.formState.errors.timezone.message}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="currency">Default Currency</Label>
                        <Select
                          onValueChange={(value) => {
                            orgForm.setValue("currency", value);
                            // Set currency symbol based on currency
                            const symbols: Record<string, string> = {
                              USD: "$",
                              EUR: "€",
                              GBP: "£",
                              JPY: "¥",
                              CAD: "C$",
                              AUD: "A$",
                              CHF: "CHF",
                              CNY: "¥",
                              INR: "₹"
                            };
                            orgForm.setValue("currencySymbol", symbols[value] || "₹");
                          }}
                          defaultValue={orgForm.getValues("currency")}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select currency" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="USD">USD - US Dollar</SelectItem>
                            <SelectItem value="EUR">EUR - Euro</SelectItem>
                            <SelectItem value="GBP">GBP - British Pound</SelectItem>
                            <SelectItem value="JPY">JPY - Japanese Yen</SelectItem>
                            <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                            <SelectItem value="AUD">AUD - Australian Dollar</SelectItem>
                            <SelectItem value="CHF">CHF - Swiss Franc</SelectItem>
                            <SelectItem value="CNY">CNY - Chinese Yuan</SelectItem>
                            <SelectItem value="INR">INR - Indian Rupee</SelectItem>
                          </SelectContent>
                        </Select>
                        {orgForm.formState.errors.currency && (
                          <p className="text-sm text-red-500">
                            {orgForm.formState.errors.currency.message}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="currencySymbol">Currency Symbol</Label>
                        <Input
                          id="currencySymbol"
                          placeholder="Enter currency symbol"
                          {...orgForm.register("currencySymbol")}
                        />
                        {orgForm.formState.errors.currencySymbol && (
                          <p className="text-sm text-red-500">
                            {orgForm.formState.errors.currencySymbol.message}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="inventoryValuationMethod">Inventory Valuation Method</Label>
                      <p className="text-sm text-muted-foreground">
                        Select the method used for valuing inventory items
                      </p>
                      <Select
                        onValueChange={(value) => {
                          orgForm.setValue("inventoryValuationMethod", value as "Last Value" | "Earliest Value" | "Average Value");
                        }}
                        defaultValue={orgForm.getValues("inventoryValuationMethod")}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select valuation method" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Last Value">Last Value</SelectItem>
                          <SelectItem value="Earliest Value">Earliest Value</SelectItem>
                          <SelectItem value="Average Value">Average Value</SelectItem>
                        </SelectContent>
                      </Select>
                      {orgForm.formState.errors.inventoryValuationMethod && (
                        <p className="text-sm text-red-500">
                          {orgForm.formState.errors.inventoryValuationMethod.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-4">
                        <Label className="text-base font-semibold">Default Unit Types</Label>
                        <p className="text-sm text-muted-foreground">
                          Define the available unit types for items in your inventory
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {["pcs", "boxes", "reams", "kg", "liters", "meters", "tons", "gallons", "cases", "pallets"].map((unit) => (
                            <div key={unit} className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id={`unit-${unit}`}
                                checked={orgForm.watch("defaultUnits").includes(unit)}
                                onChange={(e) => {
                                  const currentUnits = orgForm.getValues("defaultUnits");
                                  if (e.target.checked) {
                                    orgForm.setValue("defaultUnits", [...currentUnits, unit]);
                                  } else {
                                    orgForm.setValue("defaultUnits", currentUnits.filter(u => u !== unit));
                                  }
                                }}
                                className="rounded border-gray-300"
                              />
                              <Label htmlFor={`unit-${unit}`} className="text-sm capitalize">
                                {unit}
                              </Label>
                            </div>
                          ))}
                        </div>
                        {orgForm.formState.errors.defaultUnits && (
                          <p className="text-sm text-red-500">
                            {orgForm.formState.errors.defaultUnits.message}
                          </p>
                        )}
                      </div>

                      <div className="space-y-4">
                        <Label className="text-base font-semibold">Default Item Categories</Label>
                        <p className="text-sm text-muted-foreground">
                          Define the available categories for organizing your inventory items
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {["Electronics", "Office Supplies", "Furniture", "Raw Materials", "Finished Goods", "Tools & Equipment", "Safety Equipment", "Consumables"].map((category) => (
                            <div key={category} className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id={`category-${category}`}
                                checked={orgForm.watch("allowedCategories").includes(category)}
                                onChange={(e) => {
                                  const currentCategories = orgForm.getValues("allowedCategories");
                                  if (e.target.checked) {
                                    orgForm.setValue("allowedCategories", [...currentCategories, category]);
                                  } else {
                                    orgForm.setValue("allowedCategories", currentCategories.filter(c => c !== category));
                                  }
                                }}
                                className="rounded border-gray-300"
                              />
                              <Label htmlFor={`category-${category}`} className="text-sm">
                                {category}
                              </Label>
                            </div>
                          ))}
                        </div>
                        {orgForm.formState.errors.allowedCategories && (
                          <p className="text-sm text-red-500">
                            {orgForm.formState.errors.allowedCategories.message}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        disabled={updateOrgSettingsMutation.isPending}
                      >
                        {updateOrgSettingsMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          "Save Organization Settings"
                        )}
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          </TabsContent>



          <TabsContent value="system-config" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>System Configuration</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Additional system-wide configuration options
                </p>
              </CardHeader>
              <CardContent>
                <p className="text-gray-500">System configuration options will be available in future updates.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingSettings ? "Edit Approval Setting" : "Add Approval Setting"}
            </DialogTitle>
            <DialogDescription>
              Configure approval requirements for request types
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="requestType">Request Type</Label>
              <Select
                value={form.watch("requestType")}
                onValueChange={(value) => form.setValue("requestType", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select request type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="issue">Issue</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                  <SelectItem value="purchase">Purchase</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="minApprovalLevel">Minimum Approval Level</Label>
              <Select
                value={form.watch("minApprovalLevel")}
                onValueChange={(value) => form.setValue("minApprovalLevel", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select approval level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxAmount">Maximum Amount (Optional)</Label>
              <Input
                id="maxAmount"
                type="number"
                step="0.01"
                placeholder="Enter maximum amount"
                {...form.register("maxAmount")}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="requiresSecondApproval"
                checked={form.watch("requiresSecondApproval")}
                onCheckedChange={(checked) => form.setValue("requiresSecondApproval", checked)}
              />
              <Label htmlFor="requiresSecondApproval">Requires Second Approval</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={form.watch("isActive")}
                onCheckedChange={(checked) => form.setValue("isActive", checked)}
              />
              <Label htmlFor="isActive">Active</Label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                  setEditingSettings(null);
                  form.reset();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {editingSettings ? "Updating..." : "Creating..."}
                  </>
                ) : (
                  editingSettings ? "Update Setting" : "Create Setting"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Location Dialog */}
      <Dialog open={isLocationDialogOpen} onOpenChange={setIsLocationDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {editingLocation ? "Edit Office Location" : "Add Office Location"}
            </DialogTitle>
            <DialogDescription>
              {editingLocation 
                ? "Update the details of this office location."
                : "Create a new office location for warehouses and operations."
              }
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={locationForm.handleSubmit(onLocationSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Location Name</Label>
                <Input
                  id="name"
                  placeholder="Enter location name"
                  {...locationForm.register("name")}
                />
                {locationForm.formState.errors.name && (
                  <p className="text-sm text-red-500">
                    {locationForm.formState.errors.name.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  placeholder="Enter country"
                  {...locationForm.register("country")}
                />
                {locationForm.formState.errors.country && (
                  <p className="text-sm text-red-500">
                    {locationForm.formState.errors.country.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                placeholder="Enter full address"
                {...locationForm.register("address")}
              />
              {locationForm.formState.errors.address && (
                <p className="text-sm text-red-500">
                  {locationForm.formState.errors.address.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  placeholder="Enter city"
                  {...locationForm.register("city")}
                />
                {locationForm.formState.errors.city && (
                  <p className="text-sm text-red-500">
                    {locationForm.formState.errors.city.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  placeholder="Enter state"
                  {...locationForm.register("state")}
                />
                {locationForm.formState.errors.state && (
                  <p className="text-sm text-red-500">
                    {locationForm.formState.errors.state.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="zipCode">ZIP Code</Label>
                <Input
                  id="zipCode"
                  placeholder="Enter ZIP code"
                  {...locationForm.register("zipCode")}
                />
                {locationForm.formState.errors.zipCode && (
                  <p className="text-sm text-red-500">
                    {locationForm.formState.errors.zipCode.message}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={locationForm.watch("isActive")}
                onCheckedChange={(checked) => locationForm.setValue("isActive", checked)}
              />
              <Label htmlFor="isActive">Active Location</Label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsLocationDialogOpen(false);
                  setEditingLocation(null);
                  locationForm.reset();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createLocationMutation.isPending || updateLocationMutation.isPending}
              >
                {createLocationMutation.isPending || updateLocationMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {editingLocation ? "Updating..." : "Creating..."}
                  </>
                ) : (
                  editingLocation ? "Update Location" : "Create Location"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Department Form Dialog */}
      <Dialog open={isDepartmentDialogOpen} onOpenChange={setIsDepartmentDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingDepartment ? "Edit Department" : "Add New Department"}
            </DialogTitle>
            <DialogDescription>
              {editingDepartment 
                ? "Update the department information below." 
                : "Create a new department for your organization."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={departmentForm.handleSubmit(onDepartmentSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dept-name">Department Name</Label>
              <Input
                id="dept-name"
                {...departmentForm.register("name")}
                placeholder="Enter department name"
              />
              {departmentForm.formState.errors.name && (
                <p className="text-sm text-destructive">
                  {departmentForm.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="dept-description">Description</Label>
              <Input
                id="dept-description"
                {...departmentForm.register("description")}
                placeholder="Enter department description (optional)"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dept-manager">Department Manager</Label>
              <Select
                value={departmentForm.watch("managerId")?.toString() || ""}
                onValueChange={(value) => 
                  departmentForm.setValue("managerId", value ? parseInt(value) : undefined)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a manager (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No manager assigned</SelectItem>
                  {users && Array.isArray(users) && users.map((user: any) => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.name} ({user.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="dept-isActive"
                checked={departmentForm.watch("isActive")}
                onCheckedChange={(checked) => departmentForm.setValue("isActive", checked)}
              />
              <Label htmlFor="dept-isActive">Active Department</Label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsDepartmentDialogOpen(false);
                  setEditingDepartment(null);
                  departmentForm.reset();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createDepartmentMutation.isPending || updateDepartmentMutation.isPending}
              >
                {createDepartmentMutation.isPending || updateDepartmentMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {editingDepartment ? "Updating..." : "Creating..."}
                  </>
                ) : (
                  editingDepartment ? "Update Department" : "Create Department"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}