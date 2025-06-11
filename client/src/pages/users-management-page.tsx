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
import { Loader2, Plus, Edit, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

const formSchema = z.object({
  username: z.string().min(3, { message: "Username must be at least 3 characters" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  email: z.string().email({ message: "Invalid email address" }),
  role: z.enum(["admin", "manager", "employee"], { message: "Role is required" }),
  managerId: z.string().optional(),
  warehouseId: z.string().optional(),
  departmentId: z.string().optional(),
  isWarehouseOperator: z.boolean().default(false),
});

type FormValues = z.infer<typeof formSchema>;

export default function UsersManagementPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editUserId, setEditUserId] = useState<number | null>(null);

  const isAdmin = user?.role === "admin";

  const { data: users, isLoading, refetch: refetchUsers } = useQuery({
    queryKey: ["/api/users"],
    staleTime: 0, // Always consider data stale
    refetchOnWindowFocus: true,
  });

  const { data: warehouses } = useQuery({
    queryKey: ["/api/warehouses"],
  });

  const { data: departments } = useQuery({
    queryKey: ["/api/departments"],
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      password: "",
      name: "",
      email: "",
      role: "employee" as const,
      managerId: "none",
      warehouseId: "none", 
      departmentId: "none",
      isWarehouseOperator: false,
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const payload = {
        username: data.username,
        password: data.password,
        name: data.name,
        email: data.email,
        role: data.role,
        managerId: data.managerId === "none" || !data.managerId ? null : parseInt(data.managerId),
        warehouseId: data.warehouseId === "none" || !data.warehouseId ? null : parseInt(data.warehouseId),
        departmentId: data.departmentId === "none" || !data.departmentId ? null : parseInt(data.departmentId),
        isWarehouseOperator: data.isWarehouseOperator,
      };

      if (isEditMode && editUserId) {
        const res = await apiRequest("PUT", `/api/users/${editUserId}`, payload);
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/users", payload);
        return res.json();
      }
    },
    onSuccess: async () => {
      // Force immediate cache invalidation and refetch
      await queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      await refetchUsers();
      toast({
        title: isEditMode ? "User updated" : "User created",
        description: isEditMode
          ? "The user has been updated successfully."
          : "The user has been created successfully.",
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
      username: "",
      password: "",
      name: "",
      email: "",
      role: "employee" as const,
      managerId: "none",
      warehouseId: "none",
      departmentId: "none",
      isWarehouseOperator: false,
    });
    setIsEditMode(false);
    setEditUserId(null);
    setIsDialogOpen(false);
  };

  const handleEditUser = (userData: any) => {
    form.reset({
      username: userData.username,
      password: "",
      name: userData.name,
      email: userData.email,
      role: userData.role,
      managerId: userData.managerId?.toString() || "none",
      warehouseId: userData.warehouseId?.toString() || "none",
      departmentId: userData.departmentId?.toString() || "none",
      isWarehouseOperator: userData.isWarehouseOperator || false,
    });
    setIsEditMode(true);
    setEditUserId(userData.id);
    setIsDialogOpen(true);
  };

  const handleSubmit = (values: FormValues) => {
    createUserMutation.mutate(values);
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
            <p className="text-muted-foreground">Manage system users and their permissions</p>
          </div>
          {isAdmin && (
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              All Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Manager</TableHead>
                    <TableHead>Warehouse</TableHead>
                    <TableHead>Warehouse Operator</TableHead>
                    {isAdmin && <TableHead className="w-[100px]">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(users as any[])?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isAdmin ? 8 : 7} className="text-center py-8 text-gray-500">
                        No users found
                      </TableCell>
                    </TableRow>
                  ) : (
                    (users as any[])?.map((userData: any) => (
                      <TableRow key={userData.id}>
                        <TableCell className="font-medium">{userData.name}</TableCell>
                        <TableCell>{userData.username}</TableCell>
                        <TableCell>{userData.email}</TableCell>
                        <TableCell>
                          <span className={`capitalize px-2 py-1 rounded-full text-xs ${
                            userData.role === 'admin' ? 'bg-red-100 text-red-800' :
                            userData.role === 'manager' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {userData.role}
                          </span>
                        </TableCell>
                        <TableCell>
                          {userData.managerId ? 
                            (users as any[])?.find((u: any) => u.id === userData.managerId)?.name || "Unknown Manager" 
                            : "—"
                          }
                        </TableCell>
                        <TableCell>
                          {userData.warehouseId ? 
                            (warehouses as any[])?.find((w: any) => w.id === userData.warehouseId)?.name || "Unknown Warehouse" 
                            : "—"
                          }
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            userData.isWarehouseOperator 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {userData.isWarehouseOperator ? 'Yes' : 'No'}
                          </span>
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditUser(userData)}
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
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {isEditMode ? "Edit User" : "Add New User"}
              </DialogTitle>
              <DialogDescription>
                {isEditMode 
                  ? "Update the user details and permissions below."
                  : "Create a new user account with appropriate permissions."
                }
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    placeholder="Enter username"
                    {...form.register("username")}
                  />
                  {form.formState.errors.username && (
                    <p className="text-sm text-red-500">{form.formState.errors.username.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder={isEditMode ? "Leave blank to keep current password" : "Enter password"}
                    {...form.register("password")}
                  />
                  {form.formState.errors.password && (
                    <p className="text-sm text-red-500">{form.formState.errors.password.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    placeholder="Enter full name"
                    {...form.register("name")}
                  />
                  {form.formState.errors.name && (
                    <p className="text-sm text-red-500">{form.formState.errors.name.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter email address"
                    {...form.register("email")}
                  />
                  {form.formState.errors.email && (
                    <p className="text-sm text-red-500">{form.formState.errors.email.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={form.watch("role")}
                    onValueChange={(value) => form.setValue("role", value as "admin" | "manager" | "employee")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="employee">Employee</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.formState.errors.role && (
                    <p className="text-sm text-red-500">{form.formState.errors.role.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="managerId">Reports To</Label>
                  <Select
                    value={form.watch("managerId")?.toString() || "none"}
                    onValueChange={(value) => form.setValue("managerId", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select manager" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Manager</SelectItem>
                      {(users as any[])?.filter((u: any) => 
                        (u.role === 'admin' || u.role === 'manager') && u.id !== editUserId
                      ).map((manager: any) => (
                        <SelectItem key={manager.id} value={manager.id.toString()}>
                          {manager.name} ({manager.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="warehouseId">Default Warehouse</Label>
                  <Select
                    value={form.watch("warehouseId")?.toString() || "none"}
                    onValueChange={(value) => form.setValue("warehouseId", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select warehouse" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Default Warehouse</SelectItem>
                      {(warehouses as any[])?.map((warehouse: any) => (
                        <SelectItem key={warehouse.id} value={warehouse.id.toString()}>
                          {warehouse.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="departmentId">Department</Label>
                  <Select
                    value={form.watch("departmentId")?.toString() || "none"}
                    onValueChange={(value) => form.setValue("departmentId", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Department</SelectItem>
                      {(departments as any[])?.map((department: any) => (
                        <SelectItem key={department.id} value={department.id.toString()}>
                          {department.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="isWarehouseOperator">Warehouse Operator</Label>
                    <p className="text-sm text-muted-foreground">
                      Grant access to inventory operations (check-in, transfers, reports)
                    </p>
                  </div>
                  <Switch
                    id="isWarehouseOperator"
                    checked={form.watch("isWarehouseOperator")}
                    onCheckedChange={(checked) => form.setValue("isWarehouseOperator", checked)}
                  />
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
                  disabled={createUserMutation.isPending}
                >
                  {createUserMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isEditMode ? "Updating..." : "Creating..."}
                    </>
                  ) : (
                    isEditMode ? "Update User" : "Create User"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}