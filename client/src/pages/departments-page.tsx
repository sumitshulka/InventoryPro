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
import { Textarea } from "@/components/ui/textarea";
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
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Plus, Edit, Trash2, Building2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

const formSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  description: z.string().optional(),
  managerId: z.string().optional().transform(val => val === "" || val === "none" ? null : parseInt(val || "0")),
  isActive: z.boolean().default(true),
});

type FormValues = z.infer<typeof formSchema>;

export default function DepartmentsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editDepartmentId, setEditDepartmentId] = useState<number | null>(null);

  const isAdmin = user?.role === "admin";

  const { data: departments, isLoading } = useQuery({
    queryKey: ["/api/departments"],
  });

  const { data: users } = useQuery({
    queryKey: ["/api/users"],
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      managerId: "none",
      isActive: true,
    },
  });

  const createDepartmentMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const payload = {
        name: data.name,
        description: data.description || null,
        managerId: data.managerId,
        isActive: data.isActive,
      };

      if (isEditMode && editDepartmentId) {
        const res = await apiRequest("PUT", `/api/departments/${editDepartmentId}`, payload);
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/departments", payload);
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      toast({
        title: isEditMode ? "Department updated" : "Department created",
        description: isEditMode
          ? "The department has been updated successfully."
          : "The department has been created successfully.",
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

  const deleteDepartmentMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/departments/${id}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      toast({
        title: "Department deleted",
        description: "The department has been deleted successfully.",
      });
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
      description: "",
      managerId: "none",
      isActive: true,
    });
    setIsEditMode(false);
    setEditDepartmentId(null);
    setIsDialogOpen(false);
  };

  const handleEditDepartment = (departmentData: any) => {
    form.reset({
      name: departmentData.name,
      description: departmentData.description || "",
      managerId: departmentData.managerId?.toString() || "none",
      isActive: departmentData.isActive,
    });
    setIsEditMode(true);
    setEditDepartmentId(departmentData.id);
    setIsDialogOpen(true);
  };

  const handleDeleteDepartment = (id: number) => {
    if (confirm("Are you sure you want to delete this department?")) {
      deleteDepartmentMutation.mutate(id);
    }
  };

  const handleSubmit = (values: FormValues) => {
    createDepartmentMutation.mutate(values);
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
            <h1 className="text-3xl font-bold tracking-tight">Departments Management</h1>
            <p className="text-muted-foreground">Manage organizational departments and their managers</p>
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await queryClient.invalidateQueries({ queryKey: ['/api/departments'] });
                  await queryClient.invalidateQueries({ queryKey: ['/api/users'] });
                  await queryClient.refetchQueries({ queryKey: ['/api/departments'] });
                  await queryClient.refetchQueries({ queryKey: ['/api/users'] });
                  toast({
                    title: "Refreshed",
                    description: "Departments table has been refreshed",
                  });
                }}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Department
              </Button>
            </div>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              All Departments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Manager</TableHead>
                    <TableHead>Status</TableHead>
                    {isAdmin && <TableHead className="w-[120px]">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(departments as any[])?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isAdmin ? 5 : 4} className="text-center py-8 text-gray-500">
                        No departments found
                      </TableCell>
                    </TableRow>
                  ) : (
                    (departments as any[])?.map((department: any) => (
                      <TableRow key={department.id}>
                        <TableCell className="font-medium">{department.name}</TableCell>
                        <TableCell>{department.description || "—"}</TableCell>
                        <TableCell>
                          {department.managerId ? 
                            (users as any[])?.find((u: any) => u.id === department.managerId)?.name || "Unknown Manager" 
                            : "—"
                          }
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            department.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {department.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditDepartment(department)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteDepartment(department.id)}
                                disabled={deleteDepartmentMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {isEditMode ? "Edit Department" : "Add New Department"}
              </DialogTitle>
              <DialogDescription>
                {isEditMode 
                  ? "Update the department details below."
                  : "Create a new department for organizing users."
                }
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Department Name</Label>
                <Input
                  id="name"
                  placeholder="Enter department name"
                  {...form.register("name")}
                />
                {form.formState.errors.name && (
                  <p className="text-sm text-red-500">{form.formState.errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  placeholder="Enter department description"
                  {...form.register("description")}
                />
                {form.formState.errors.description && (
                  <p className="text-sm text-red-500">{form.formState.errors.description.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="managerId">Department Manager</Label>
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
                      u.role === 'admin' || u.role === 'manager'
                    ).map((manager: any) => (
                      <SelectItem key={manager.id} value={manager.id.toString()}>
                        {manager.name} ({manager.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                  disabled={createDepartmentMutation.isPending}
                >
                  {createDepartmentMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isEditMode ? "Updating..." : "Creating..."}
                    </>
                  ) : (
                    isEditMode ? "Update Department" : "Create Department"
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