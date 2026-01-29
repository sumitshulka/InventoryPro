import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import AppLayout from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Plus, ClipboardCheck, Calendar, Warehouse, AlertTriangle, CheckCircle, Clock, XCircle, ShieldCheck } from "lucide-react";

const createAuditSchema = z.object({
  warehouseId: z.number().min(1, "Please select a warehouse"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  freezeConfirmed: z.boolean().refine(val => val === true, {
    message: "You must confirm the warehouse freeze to proceed"
  })
});

type CreateAuditForm = z.infer<typeof createAuditSchema>;

export default function AuditSessionsPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: warehouses = [] } = useQuery<any[]>({
    queryKey: ["/api/warehouses"]
  });

  const { data: auditSessions = [], refetch: refetchSessions } = useQuery<any[]>({
    queryKey: ["/api/audit/sessions"],
    enabled: user?.role === 'admin'
  });

  const form = useForm<CreateAuditForm>({
    resolver: zodResolver(createAuditSchema),
    defaultValues: {
      warehouseId: 0,
      title: "",
      description: "",
      startDate: "",
      endDate: "",
      freezeConfirmed: false
    }
  });

  const createAuditMutation = useMutation({
    mutationFn: async (data: CreateAuditForm) => {
      return await apiRequest("POST", "/api/audit/sessions", data);
    },
    onSuccess: () => {
      toast({
        title: "Audit Created",
        description: "The audit session has been created successfully."
      });
      setIsCreateDialogOpen(false);
      form.reset();
      refetchSessions();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create audit session",
        variant: "destructive"
      });
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      return await apiRequest("PATCH", `/api/audit/sessions/${id}`, { status });
    },
    onSuccess: () => {
      toast({
        title: "Status Updated",
        description: "The audit status has been updated."
      });
      refetchSessions();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update status",
        variant: "destructive"
      });
    }
  });

  const onSubmit = (data: CreateAuditForm) => {
    createAuditMutation.mutate(data);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <Badge className="bg-blue-100 text-blue-800"><Clock className="w-3 h-3 mr-1" /> Open</Badge>;
      case 'in_progress':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" /> In Progress</Badge>;
      case 'completed':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" /> Completed</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" /> Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (user?.role !== 'admin') {
    return (
      <AppLayout>
        <div className="p-8">
          <Card>
            <CardContent className="p-8 text-center">
              <ShieldCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
              <p className="text-muted-foreground">Only administrators can create and manage audit sessions.</p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Audit Sessions</h1>
            <p className="text-muted-foreground mt-1">Create and manage warehouse audit sessions</p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Audit
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create New Audit Session</DialogTitle>
                <DialogDescription>
                  Start a new inventory audit for a warehouse. The warehouse will be frozen for transactions during the audit period.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="warehouseId">Warehouse</Label>
                  <Select
                    onValueChange={(value) => form.setValue("warehouseId", parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select warehouse" />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses.map((warehouse: any) => (
                        <SelectItem key={warehouse.id} value={warehouse.id.toString()}>
                          {warehouse.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.warehouseId && (
                    <p className="text-sm text-red-500">{form.formState.errors.warehouseId.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">Audit Title</Label>
                  <Input
                    id="title"
                    placeholder="e.g., Q1 2026 Inventory Audit"
                    {...form.register("title")}
                  />
                  {form.formState.errors.title && (
                    <p className="text-sm text-red-500">{form.formState.errors.title.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    placeholder="Additional notes about this audit..."
                    {...form.register("description")}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      {...form.register("startDate")}
                    />
                    {form.formState.errors.startDate && (
                      <p className="text-sm text-red-500">{form.formState.errors.startDate.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">End Date</Label>
                    <Input
                      id="endDate"
                      type="date"
                      {...form.register("endDate")}
                    />
                    {form.formState.errors.endDate && (
                      <p className="text-sm text-red-500">{form.formState.errors.endDate.message}</p>
                    )}
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-amber-800">Warehouse Freeze Notice</p>
                      <p className="text-sm text-amber-700">
                        All inventory values for the warehouse will be frozen and no transactions will be allowed for the warehouse during the audit dates.
                      </p>
                      <div className="flex items-center space-x-2 pt-2">
                        <Checkbox
                          id="freezeConfirmed"
                          checked={form.watch("freezeConfirmed")}
                          onCheckedChange={(checked) => form.setValue("freezeConfirmed", checked as boolean)}
                        />
                        <Label htmlFor="freezeConfirmed" className="text-sm text-amber-800 cursor-pointer">
                          I understand and confirm the warehouse freeze
                        </Label>
                      </div>
                      {form.formState.errors.freezeConfirmed && (
                        <p className="text-sm text-red-500">{form.formState.errors.freezeConfirmed.message}</p>
                      )}
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createAuditMutation.isPending}>
                    {createAuditMutation.isPending ? "Creating..." : "Create Audit"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Audits</CardTitle>
              <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{auditSessions.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Open</CardTitle>
              <Clock className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {auditSessions.filter((s: any) => s.status === 'open').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {auditSessions.filter((s: any) => s.status === 'in_progress').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {auditSessions.filter((s: any) => s.status === 'completed').length}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Audit Sessions</CardTitle>
            <CardDescription>All audit sessions across warehouses</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Audit Code</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditSessions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No audit sessions found. Create one to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  auditSessions.map((session: any) => (
                    <TableRow key={session.id}>
                      <TableCell className="font-medium">{session.auditCode}</TableCell>
                      <TableCell>{session.title}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Warehouse className="w-4 h-4 text-muted-foreground" />
                          {session.warehouseName}
                        </div>
                      </TableCell>
                      <TableCell>
                        {session.startDate ? format(new Date(session.startDate), 'MMM dd, yyyy') : '-'}
                      </TableCell>
                      <TableCell>
                        {session.endDate ? format(new Date(session.endDate), 'MMM dd, yyyy') : '-'}
                      </TableCell>
                      <TableCell>{getStatusBadge(session.status)}</TableCell>
                      <TableCell>{session.creatorName || '-'}</TableCell>
                      <TableCell>
                        {session.status === 'open' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateStatusMutation.mutate({ id: session.id, status: 'cancelled' })}
                          >
                            Cancel
                          </Button>
                        )}
                        {session.status === 'in_progress' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateStatusMutation.mutate({ id: session.id, status: 'completed' })}
                          >
                            Complete
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
