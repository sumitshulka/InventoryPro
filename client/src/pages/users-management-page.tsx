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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { apiRequest, queryClient, invalidateRelatedQueries } from "@/lib/queryClient";
import { Loader2, Plus, Edit, Users, Trash } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

const formSchema = z.object({
  username: z.string().min(3, { message: "Username must be at least 3 characters" }),
  password: z.string().optional(),
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<number | null>(null);

  const isAdmin = user?.role === "admin";
  const isManager = user?.role === "manager";
  const canEdit = isAdmin; // Only admins can edit users

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
      // Validate password requirement based on mode
      if (!isEditMode && (!data.password || data.password.trim() === "")) {
        throw new Error("Password is required when creating a new user");
      }

      const payload: any = {
        username: data.username,
        name: data.name,
        email: data.email,
        role: data.role,
        managerId: data.managerId === "none" || !data.managerId ? null : parseInt(data.managerId),
        warehouseId: data.warehouseId === "none" || !data.warehouseId ? null : parseInt(data.warehouseId),
        departmentId: data.departmentId === "none" || !data.departmentId ? null : parseInt(data.departmentId),
        isWarehouseOperator: data.isWarehouseOperator,
      };

      // Only include password if it's provided (required for create, optional for edit)
      if (data.password && data.password.trim() !== "") {
        payload.password = data.password;
      }

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
      await invalidateRelatedQueries('user', isEditMode ? 'update' : 'create');
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

  const deleteUserMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/users/${id}`);
      return res;
    },
    onSuccess: async () => {
      await invalidateRelatedQueries('user', 'delete');
      toast({
        title: "User deleted",
        description: "The user has been deleted successfully.",
      });
      setDeleteDialogOpen(false);
      setUserToDelete(null);
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

  const handleDeleteUser = (id: number) => {
    setUserToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteUser = () => {
    if (userToDelete) {
      deleteUserMutation.mutate(userToDelete);
    }
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
            <p className="text-muted-foreground">
              {isAdmin 
                ? "Manage system users and their permissions" 
                : "View users you manage"
              }
            </p>
          </div>
          {canEdit && (
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          )}
        </div>

        {isManager && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <div className="text-blue-600 mt-0.5">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-medium text-blue-800">Manager View</h3>
                <p className="text-sm text-blue-700 mt-1">
                  You can view users assigned to you as their manager. Only administrators can create or edit users.
                </p>
              </div>
            </div>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {isManager ? "Your Team Members" : "All Users"}
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
                    {canEdit && <TableHead className="w-[100px]">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(users as any[])?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={canEdit ? 8 : 7} className="text-center py-8 text-gray-500">
                        {isManager ? "No subordinates assigned to you" : "No users found"}
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
                        {canEdit && (
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditUser(userData)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              {userData.id !== user?.id && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600 hover:text-red-700"
                                  onClick={() => handleDeleteUser(userData.id)}
                                >
                                  <Trash className="h-4 w-4" />
                                </Button>
                              )}
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
                      ).length > 0 ? (
                        (users as any[])?.filter((u: any) => 
                          (u.role === 'admin' || u.role === 'manager') && u.id !== editUserId
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
                      {(warehouses as any[])?.length > 0 ? (
                        (warehouses as any[])?.map((warehouse: any) => (
                          <SelectItem key={warehouse.id} value={warehouse.id.toString()}>
                            {warehouse.name}
                          </SelectItem>
                        ))
                      ) : (
                        <div className="p-2 text-sm text-gray-500">
                          No warehouses available
                        </div>
                      )}
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
                      {(departments as any[])?.length > 0 ? (
                        (departments as any[])?.map((department: any) => (
                          <SelectItem key={department.id} value={department.id.toString()}>
                            {department.name}
                          </SelectItem>
                        ))
                      ) : (
                        <div className="p-2 text-sm text-gray-500">
                          No departments available
                        </div>
                      )}
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