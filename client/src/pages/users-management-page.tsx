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
import { Loader2, Plus, Edit, Users, Trash, RefreshCw, Power, PowerOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useLicense } from "@/hooks/use-license";

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
  const { getUserLimit, hasUserLimit, isValidLicense } = useLicense();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editUserId, setEditUserId] = useState<number | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

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

      // Check user limit for new user creation
      if (!isEditMode && hasUserLimit()) {
        const activeUsers = (users as any[])?.filter(u => u.isActive).length || 0;
        const userLimit = getUserLimit();
        if (activeUsers >= userLimit!) {
          throw new Error(`Cannot create user. License allows maximum ${userLimit} active users. Currently have ${activeUsers} active users.`);
        }
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
      // Format error messages to be more user-friendly
      let userMessage = error.message;
      
      if (error.message.includes("Cannot change warehouse assignment")) {
        userMessage = "Cannot change warehouse assignment - this user manages a warehouse and must remain assigned to it.";
      } else if (error.message.includes("Cannot assign user as warehouse manager")) {
        userMessage = "This user cannot be assigned as a warehouse manager because they are not assigned to that warehouse.";
      } else if (error.message.includes("Username already exists")) {
        userMessage = "This username is already taken. Please choose a different username.";
      } else if (error.message.includes("Email already exists")) {
        userMessage = "This email address is already registered. Please use a different email.";
      }
      
      toast({
        title: isEditMode ? "Failed to update user" : "Failed to create user",
        description: userMessage,
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
      let userMessage = error.message;
      
      if (error.message.includes("Cannot delete your own account")) {
        userMessage = "You cannot delete your own account.";
      } else if (error.message.includes("User not found")) {
        userMessage = "The user you're trying to delete was not found.";
      }
      
      toast({
        title: "Failed to delete user",
        description: userMessage,
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

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    queryClient.invalidateQueries({ queryKey: ["/api/warehouses"] });
    queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
    refetchUsers();
  };

  const toggleUserStatusMutation = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: number; isActive: boolean }) => {
      return apiRequest(`/api/users/${userId}/status`, "PATCH", { isActive });
    },
    onSuccess: () => {
      toast({
        title: "User status updated",
        description: "User status has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update user status",
        variant: "destructive",
      });
    },
  });

  const handleToggleUserStatus = (userId: number, currentStatus: boolean) => {
    toggleUserStatusMutation.mutate({ userId, isActive: !currentStatus });
  };

  // Filter users based on status
  const filteredUsers = (users as any[])?.filter((userData: any) => {
    if (statusFilter === 'active') return userData.isActive;
    if (statusFilter === 'inactive') return !userData.isActive;
    return true; // 'all' shows all users
  }) || [];

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
            <h1 className="text-3xl font-bold tracking-tight">
              User Management
              {hasUserLimit() && (
                <span className="text-lg font-normal text-muted-foreground ml-2">
                  ({(users as any[])?.filter(u => u.isActive).length || 0}/{getUserLimit()})
                </span>
              )}
            </h1>
            <p className="text-muted-foreground">
              {isAdmin 
                ? "Manage system users and their permissions" 
                : "View users you manage"
              }
              {hasUserLimit() && (
                <span className="ml-2 text-sm">
                  • License allows maximum {getUserLimit()} users
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {canEdit && (
              <Button 
                onClick={() => setIsDialogOpen(true)}
                disabled={hasUserLimit() && (users as any[])?.filter(u => u.isActive).length >= getUserLimit()!}
                title={hasUserLimit() && (users as any[])?.filter(u => u.isActive).length >= getUserLimit()! 
                  ? `User limit reached (${getUserLimit()})` 
                  : undefined}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add User
              </Button>
            )}
          </div>
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
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {isManager ? "Your Team Members" : "All Users"}
              </CardTitle>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Filter by status:</label>
                <Select value={statusFilter} onValueChange={(value: 'all' | 'active' | 'inactive') => setStatusFilter(value)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
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
                    <TableHead>Status</TableHead>
                    {canEdit && <TableHead className="w-[100px]">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={canEdit ? 9 : 8} className="text-center py-8 text-gray-500">
                        {statusFilter === 'active' ? "No active users found" :
                         statusFilter === 'inactive' ? "No inactive users found" :
                         isManager ? "No subordinates assigned to you" : "No users found"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((userData: any) => (
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
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              userData.isActive 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {userData.isActive ? 'Active' : 'Inactive'}
                            </span>
                            {canEdit && userData.role !== 'admin' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleUserStatus(userData.id, userData.isActive)}
                                disabled={toggleUserStatusMutation.isPending}
                                title={userData.isActive ? 'Deactivate user' : 'Activate user'}
                              >
                                {userData.isActive ? (
                                  <PowerOff className="h-4 w-4 text-red-600" />
                                ) : (
                                  <Power className="h-4 w-4 text-green-600" />
                                )}
                              </Button>
                            )}
                          </div>
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

        {/* Delete User Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-red-600">⚠️ Permanently Delete User</AlertDialogTitle>
              <AlertDialogDescription className="text-sm text-muted-foreground">
                You are about to permanently delete this user from the system.
              </AlertDialogDescription>
              <div className="space-y-3 mt-3">
                {userToDelete && users && (
                  <div className="bg-gray-50 p-3 rounded-md">
                    <div className="font-medium text-sm">
                      {(users as any[])?.find((u: any) => u.id === userToDelete)?.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {(users as any[])?.find((u: any) => u.id === userToDelete)?.username} • {(users as any[])?.find((u: any) => u.id === userToDelete)?.role}
                    </div>
                  </div>
                )}

                <div className="text-sm text-gray-700">
                  <div className="font-medium">This will permanently:</div>
                  <ul className="list-disc list-inside mt-1 space-y-1 text-xs">
                    <li>Remove the user from the database completely</li>
                    <li>Delete all their notifications and messages</li>
                    <li>Remove their activity history from issues</li>
                    <li>Clear their assignments from issues and transactions</li>
                    <li>Remove manager relationships where applicable</li>
                  </ul>
                </div>

                <div className="bg-red-50 p-3 rounded-md border border-red-200">
                  <div className="text-xs font-medium text-red-800">
                    ⚠️ This action cannot be undone and the user data will not be recoverable.
                  </div>
                </div>
              </div>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDeleteUser}
                className="bg-red-600 hover:bg-red-700"
                disabled={deleteUserMutation.isPending}
              >
                {deleteUserMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Deleting...
                  </>
                ) : (
                  "Delete Permanently"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}