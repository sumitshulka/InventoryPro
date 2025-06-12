import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import AppLayout from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest, queryClient, invalidateRelatedQueries } from "@/lib/queryClient";
import { Loader2, Plus, Edit, MapPin, Trash2, RefreshCw, Archive } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { formatCapacity } from "@/lib/formatters";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const formSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  locationId: z.string().min(1, { message: "Location is required" }),
  managerId: z.string().optional(),
  capacity: z.coerce.number().min(1, { message: "Capacity must be at least 1" }),
  isActive: z.boolean().default(true),
});

type FormValues = {
  name: string;
  locationId: string;
  managerId?: string;
  capacity: number;
  isActive: boolean;
};

// WarehouseCard component
const WarehouseCard = ({ warehouse, locations, isAdmin, onEdit, isArchived = false }: {
  warehouse: any;
  locations: any;
  isAdmin: boolean;
  onEdit: (warehouse: any) => void;
  isArchived?: boolean;
}) => {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-gray-800">{warehouse.name}</h3>
          <span className={`${warehouse.status !== 'deleted' ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"} text-xs px-2 py-1 rounded-full`}>
            {warehouse.status !== 'deleted' ? "Active" : "Archived"}
          </span>
        </div>
        <div className="flex items-center text-sm text-gray-600 mb-2">
          <MapPin className="h-4 w-4 text-gray-500 mr-1" />
          {(locations as any[])?.find((loc: any) => loc.id === warehouse.locationId)?.name || 'Location not found'}
        </div>
        <div className="flex items-center text-sm text-gray-600 mb-4">
          <span className="material-icons text-gray-500 text-sm mr-1">person</span>
          Manager: {warehouse.manager ? warehouse.manager.name : "Not assigned"}
        </div>
        {warehouse.capacityUsed !== undefined && (
          <div className="mb-3">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-gray-600">Capacity Used</span>
              <span className="font-medium">{warehouse.capacityUsed}%</span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full">
              <div
                className="h-2 bg-primary rounded-full"
                style={{ width: `${warehouse.capacityUsed}%` }}
              ></div>
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 text-center mt-4">
          <div className="bg-gray-50 rounded p-2">
            <p className="text-xs text-gray-500">Capacity</p>
            <p className="font-medium">{formatCapacity(warehouse.capacity)}</p>
          </div>
          {isAdmin && (
            <Button
              variant="outline"
              className="bg-gray-50 text-gray-600 hover:text-primary hover:bg-gray-100"
              onClick={() => onEdit(warehouse)}
            >
              {isArchived ? <Archive className="h-4 w-4 mr-1" /> : <Edit className="h-4 w-4 mr-1" />}
              {isArchived ? "Restore" : "Edit"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default function WarehousesPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editWarehouseId, setEditWarehouseId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("active");

  const { data: warehouses, isLoading } = useQuery({
    queryKey: ["/api/warehouses"],
  });

  const { data: locations } = useQuery({
    queryKey: ["/api/locations"],
  });

  const { data: users } = useQuery({
    queryKey: ["/api/users"],
  });

  // Filter warehouses based on archive status
  const activeWarehouses = warehouses?.filter((warehouse: any) => warehouse.status !== 'deleted') || [];
  const archivedWarehouses = warehouses?.filter((warehouse: any) => warehouse.status === 'deleted') || [];

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      locationId: "",
      managerId: "none",
      capacity: 1000,
      isActive: true,
    },
  });

  const createWarehouseMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const payload = {
        name: data.name,
        locationId: parseInt(data.locationId),
        managerId: data.managerId === "none" || !data.managerId ? null : parseInt(data.managerId),
        capacity: data.capacity,
        isActive: data.isActive,
      };
      
      if (isEditMode && editWarehouseId) {
        const res = await apiRequest("PUT", `/api/warehouses/${editWarehouseId}`, payload);
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/warehouses", payload);
        return res.json();
      }
    },
    onSuccess: async () => {
      await invalidateRelatedQueries('warehouse', isEditMode ? 'update' : 'create');
      toast({
        title: isEditMode ? "Warehouse updated" : "Warehouse created",
        description: isEditMode
          ? "The warehouse has been updated successfully."
          : "The warehouse has been created successfully.",
      });
      resetForm();
    },
    onError: (error: Error) => {
      let userMessage = error.message;
      
      if (error.message.includes("Cannot assign user as warehouse manager")) {
        userMessage = "This user cannot be assigned as warehouse manager because they are not assigned to this warehouse.";
      } else if (error.message.includes("Warehouse already exists")) {
        userMessage = "A warehouse with this name already exists.";
      }
      
      toast({
        title: isEditMode ? "Failed to update warehouse" : "Failed to create warehouse",
        description: userMessage,
        variant: "destructive",
      });
    },
  });

  const deleteWarehouseMutation = useMutation({
    mutationFn: async (warehouseId: number) => {
      const response = await fetch(`/api/warehouses/${warehouseId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        throw new Error("Failed to archive warehouse");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouses/stats"] });
      invalidateRelatedQueries();
      toast({
        title: "Success",
        description: "Warehouse has been archived successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to archive warehouse",
        variant: "destructive",
      });
    },
  });

  const restoreWarehouseMutation = useMutation({
    mutationFn: async (warehouseId: number) => {
      const response = await fetch(`/api/warehouses/${warehouseId}/restore`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        throw new Error("Failed to restore warehouse");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouses/stats"] });
      invalidateRelatedQueries();
      toast({
        title: "Success",
        description: "Warehouse has been restored successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to restore warehouse",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    form.reset({
      name: "",
      locationId: "",
      managerId: "none",
      capacity: 1000,
      isActive: true,
    });
    setIsEditMode(false);
    setEditWarehouseId(null);
    setIsDialogOpen(false);
  };

  const handleEditWarehouse = (warehouse: any) => {
    form.reset({
      name: warehouse.name,
      locationId: warehouse.locationId?.toString() || "",
      managerId: warehouse.managerId?.toString() || "none",
      capacity: warehouse.capacity,
      isActive: warehouse.isActive,
    });
    setIsEditMode(true);
    setEditWarehouseId(warehouse.id);
    setIsDialogOpen(true);
  };

  const handleArchiveWarehouse = (warehouseId: number) => {
    deleteWarehouseMutation.mutate(warehouseId);
  };

  const handleRestoreWarehouse = (warehouseId: number) => {
    restoreWarehouseMutation.mutate(warehouseId);
  };

  const handleSubmit = (values: FormValues) => {
    createWarehouseMutation.mutate(values);
  };

  const isAdmin = user?.role === "admin";

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-medium text-gray-800">Warehouses</h1>
          <p className="text-gray-600">Manage your warehouse locations</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Warehouse
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="active">
            Active Warehouses ({activeWarehouses.length})
          </TabsTrigger>
          <TabsTrigger value="archived">
            Archived Warehouses ({archivedWarehouses.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {activeWarehouses.map((warehouse: any) => (
              <WarehouseCard
                key={warehouse.id}
                warehouse={warehouse}
                locations={locations}
                isAdmin={isAdmin}
                onEdit={handleEditWarehouse}
              />
            ))}
            {activeWarehouses.length === 0 && (
              <div className="col-span-full text-center py-8">
                <p className="text-gray-500">No active warehouses found.</p>
              </div>
            )}
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Active Warehouses</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await queryClient.invalidateQueries({ queryKey: ['/api/warehouses'] });
                    await queryClient.refetchQueries({ queryKey: ['/api/warehouses'] });
                    toast({
                      title: "Refreshed",
                      description: "Active warehouses table has been refreshed",
                    });
                  }}
                  className="ml-2"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Manager</TableHead>
                      <TableHead>Capacity</TableHead>
                      <TableHead>Status</TableHead>
                      {isAdmin && <TableHead>Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeWarehouses.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={isAdmin ? 6 : 5} className="text-center py-8 text-gray-500">
                          No active warehouses found
                        </TableCell>
                      </TableRow>
                    ) : (
                      activeWarehouses.map((warehouse: any) => (
                        <TableRow key={warehouse.id}>
                          <TableCell className="font-medium">{warehouse.name}</TableCell>
                          <TableCell>
                            {(locations as any[])?.find((loc: any) => loc.id === warehouse.locationId)?.name || 'Location not found'}
                          </TableCell>
                          <TableCell>
                            {warehouse.managerId ? 
                              (users as any[])?.find((u: any) => u.id === warehouse.managerId)?.name || "Unknown Manager" 
                              : "—"
                            }
                          </TableCell>
                          <TableCell>{formatCapacity(warehouse.capacity)}</TableCell>
                          <TableCell>
                            <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                              Active
                            </span>
                          </TableCell>
                          {isAdmin && (
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditWarehouse(warehouse)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-red-600 hover:text-red-700"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Archive Warehouse</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to archive "{warehouse.name}"? This will move it to the archived section.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleArchiveWarehouse(warehouse.id)}>
                                        Archive
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="archived" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {archivedWarehouses.map((warehouse: any) => (
              <WarehouseCard
                key={warehouse.id}
                warehouse={warehouse}
                locations={locations}
                isAdmin={isAdmin}
                onEdit={handleEditWarehouse}
                isArchived={true}
              />
            ))}
            {archivedWarehouses.length === 0 && (
              <div className="col-span-full text-center py-8">
                <p className="text-gray-500">No archived warehouses found.</p>
              </div>
            )}
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Archived Warehouses</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await queryClient.invalidateQueries({ queryKey: ['/api/warehouses'] });
                    await queryClient.refetchQueries({ queryKey: ['/api/warehouses'] });
                    toast({
                      title: "Refreshed",
                      description: "Archived warehouses table has been refreshed",
                    });
                  }}
                  className="ml-2"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Manager</TableHead>
                      <TableHead>Capacity</TableHead>
                      <TableHead>Status</TableHead>
                      {isAdmin && <TableHead>Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {archivedWarehouses.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={isAdmin ? 6 : 5} className="text-center py-8 text-gray-500">
                          No archived warehouses found
                        </TableCell>
                      </TableRow>
                    ) : (
                      archivedWarehouses.map((warehouse: any) => (
                        <TableRow key={warehouse.id} className="opacity-60">
                          <TableCell className="font-medium">
                            {warehouse.name}
                            <span className="text-red-500 text-xs ml-1 font-bold">✗</span>
                          </TableCell>
                          <TableCell>
                            {(locations as any[])?.find((loc: any) => loc.id === warehouse.locationId)?.name || 'Location not found'}
                          </TableCell>
                          <TableCell>
                            {warehouse.managerId ? 
                              (users as any[])?.find((u: any) => u.id === warehouse.managerId)?.name || "Unknown Manager" 
                              : "—"
                            }
                          </TableCell>
                          <TableCell>{formatCapacity(warehouse.capacity)}</TableCell>
                          <TableCell>
                            <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">
                              Archived
                            </span>
                          </TableCell>
                          {isAdmin && (
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRestoreWarehouse(warehouse.id)}
                                className="text-green-600 hover:text-green-700"
                              >
                                <Archive className="h-4 w-4 mr-1" />
                                Restore
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>



      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEditMode ? "Edit Warehouse" : "Add New Warehouse"}</DialogTitle>
            <DialogDescription>
              {isEditMode
                ? "Update the details of an existing warehouse"
                : "Fill in the details to add a new warehouse location"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Warehouse Name</Label>
                <Input
                  id="name"
                  placeholder="Enter warehouse name"
                  {...form.register("name")}
                />
                {form.formState.errors.name && (
                  <p className="text-sm text-red-500">{form.formState.errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="locationId">Office Location</Label>
                <Select
                  value={form.watch("locationId") || ""}
                  onValueChange={(value) => form.setValue("locationId", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an office location" />
                  </SelectTrigger>
                  <SelectContent>
                    {(locations as any[])?.filter((location: any) => location.isActive).map((location: any) => (
                      <SelectItem key={location.id} value={location.id.toString()}>
                        {location.name} - {location.city}, {location.state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.locationId && (
                  <p className="text-sm text-red-500">{form.formState.errors.locationId.message}</p>
                )}
                {(!locations || (locations as any[]).length === 0) && (
                  <p className="text-sm text-amber-600">
                    No office locations available. Please create locations in Settings first.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="managerId">Manager</Label>
                <Select
                  value={form.watch("managerId")?.toString() || "none"}
                  onValueChange={(value) => form.setValue("managerId", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a manager" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Manager</SelectItem>
                    {(users as any[])?.filter((u: any) => 
                      u.role === 'admin' || u.role === 'manager'
                    ).length > 0 ? (
                      (users as any[])?.filter((u: any) => 
                        u.role === 'admin' || u.role === 'manager'
                      ).map((manager: any) => (
                        <SelectItem key={manager.id} value={manager.id.toString()}>
                          {manager.name} ({manager.role})
                        </SelectItem>
                      ))
                    ) : (
                      <div className="p-2 text-sm text-gray-500">
                        No managers available
                      </div>
                    )}
                  </SelectContent>
                </Select>
                {form.formState.errors.managerId && (
                  <p className="text-sm text-red-500">{form.formState.errors.managerId.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="capacity">Capacity</Label>
                <Input
                  id="capacity"
                  type="number"
                  min="1"
                  placeholder="Enter warehouse capacity"
                  {...form.register("capacity", { valueAsNumber: true })}
                />
                {form.formState.errors.capacity && (
                  <p className="text-sm text-red-500">{form.formState.errors.capacity.message}</p>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={form.watch("isActive")}
                  onCheckedChange={(checked) => form.setValue("isActive", checked)}
                />
                <Label htmlFor="isActive">Active</Label>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={resetForm}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createWarehouseMutation.isPending}
              >
                {createWarehouseMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isEditMode ? "Updating..." : "Creating..."}
                  </>
                ) : (
                  isEditMode ? "Update Warehouse" : "Create Warehouse"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
