import { useState } from "react";
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
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Plus, Edit, Trash2, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const approvalSettingsSchema = z.object({
  requestType: z.string().min(1, "Request type is required"),
  minApprovalLevel: z.string().min(1, "Minimum approval level is required"),
  maxAmount: z.string().optional(),
  requiresSecondApproval: z.boolean(),
  isActive: z.boolean(),
});

type ApprovalSettingsFormValues = z.infer<typeof approvalSettingsSchema>;

export default function SettingsPage() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSettings, setEditingSettings] = useState<any>(null);

  const { data: approvalSettings, isLoading } = useQuery({
    queryKey: ["/api/approval-settings"],
  });

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

  const createMutation = useMutation({
    mutationFn: async (data: ApprovalSettingsFormValues) => {
      const payload = {
        ...data,
        maxAmount: data.maxAmount ? parseFloat(data.maxAmount) : null,
      };
      const res = await apiRequest("POST", "/api/approval-settings", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/approval-settings"] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/approval-settings"] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/approval-settings"] });
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

  const onSubmit = (data: ApprovalSettingsFormValues) => {
    if (editingSettings) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
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
    </AppLayout>
  );
}