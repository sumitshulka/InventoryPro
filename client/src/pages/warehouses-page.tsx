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
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Plus, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

const formSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  location: z.string().min(2, { message: "Location is required" }),
  managerId: z.string().optional().transform(val => val === "" || val === "none" || !val ? null : parseInt(val)),
  capacity: z.number().min(1, { message: "Capacity is required" }),
  isActive: z.boolean().default(true),
});

type FormValues = z.infer<typeof formSchema>;

export default function WarehousesPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editWarehouseId, setEditWarehouseId] = useState<number | null>(null);

  const { data: warehouses, isLoading } = useQuery({
    queryKey: ["/api/warehouses"],
  });

  const { data: users } = useQuery({
    queryKey: ["/api/users"],
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      location: "",
      managerId: "none",
      capacity: 1000,
      isActive: true,
    },
  });

  const createWarehouseMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const payload = {
        name: data.name,
        location: data.location,
        managerId: data.managerId,
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouses"] });
      toast({
        title: isEditMode ? "Warehouse updated" : "Warehouse created",
        description: isEditMode
          ? "The warehouse has been updated successfully."
          : "The warehouse has been created successfully.",
      });
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    form.reset({
      name: "",
      location: "",
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
      location: warehouse.location,
      managerId: warehouse.managerId?.toString() || "none",
      capacity: warehouse.capacity,
      isActive: warehouse.isActive,
    });
    setIsEditMode(true);
    setEditWarehouseId(warehouse.id);
    setIsDialogOpen(true);
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {warehouses?.map((warehouse: any) => (
          <Card key={warehouse.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-800">{warehouse.name}</h3>
                <span className={`${warehouse.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"} text-xs px-2 py-1 rounded-full`}>
                  {warehouse.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="flex items-center text-sm text-gray-600 mb-2">
                <span className="material-icons text-gray-500 text-sm mr-1">location_on</span>
                {warehouse.location}
              </div>
              <div className="flex items-center text-sm text-gray-600 mb-4">
                <span className="material-icons text-gray-500 text-sm mr-1">person</span>
                Manager: {warehouse.manager || "Not assigned"}
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
                  <p className="font-medium">{warehouse.capacity}</p>
                </div>
                {isAdmin && (
                  <Button
                    variant="outline"
                    className="bg-gray-50 text-gray-600 hover:text-primary hover:bg-gray-100"
                    onClick={() => handleEditWarehouse(warehouse)}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Warehouses</CardTitle>
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
                {warehouses?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 6 : 5} className="text-center py-8 text-gray-500">
                      No warehouses found
                    </TableCell>
                  </TableRow>
                ) : (
                  warehouses?.map((warehouse: any) => (
                    <TableRow key={warehouse.id}>
                      <TableCell className="font-medium">{warehouse.name}</TableCell>
                      <TableCell>{warehouse.location}</TableCell>
                      <TableCell>
                        {warehouse.managerId ? 
                          (users as any[])?.find((u: any) => u.id === warehouse.managerId)?.name || "Unknown Manager" 
                          : "—"
                        }
                      </TableCell>
                      <TableCell>{warehouse.capacity}</TableCell>
                      <TableCell>
                        <span className={`${warehouse.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"} text-xs px-2 py-1 rounded-full`}>
                          {warehouse.isActive ? "Active" : "Inactive"}
                        </span>
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditWarehouse(warehouse)}
                          >
                            <Edit className="h-4 w-4" />
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
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  placeholder="Enter warehouse address"
                  {...form.register("location")}
                />
                {form.formState.errors.location && (
                  <p className="text-sm text-red-500">{form.formState.errors.location.message}</p>
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
                    ).map((manager: any) => (
                      <SelectItem key={manager.id} value={manager.id.toString()}>
                        {manager.name} ({manager.role})
                      </SelectItem>
                    ))}
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
                  {...form.register("capacity")}
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
