import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import AppLayout from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Building2, Users, ClipboardCheck, ShieldCheck, UserPlus, Warehouse } from "lucide-react";
import type { User, Warehouse as WarehouseType } from "@shared/schema";

interface AuditInfo {
  role: string;
  warehouses?: Array<WarehouseType & { teamCount: number }>;
  totalWarehouses?: number;
  assignments?: Array<{
    warehouse: WarehouseType;
    manager: { id: number; name: string } | null;
  }>;
}

interface TeamMember {
  id: number;
  auditUserId: number;
  auditManagerId: number;
  warehouseId: number;
  isActive: boolean;
  user: User;
  warehouse: WarehouseType;
}

export default function AuditDashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedWarehouse, setSelectedWarehouse] = useState<number | null>(null);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [selectedWarehouseForAdd, setSelectedWarehouseForAdd] = useState<string>("");
  const [selectedUser, setSelectedUser] = useState<string>("");

  const { data: auditInfo, isLoading: infoLoading } = useQuery<AuditInfo>({
    queryKey: ['/api/audit/my-info'],
  });

  const { data: teamMembers = [], isLoading: teamLoading } = useQuery<TeamMember[]>({
    queryKey: ['/api/audit/team', selectedWarehouse],
    queryFn: async () => {
      const params = selectedWarehouse ? `?warehouseId=${selectedWarehouse}` : '';
      const response = await fetch(`/api/audit/team${params}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch team');
      return response.json();
    },
    enabled: user?.role === 'audit_manager',
  });

  const { data: availableUsers = [] } = useQuery<User[]>({
    queryKey: ['/api/audit/available-users', selectedWarehouseForAdd],
    queryFn: async () => {
      const params = selectedWarehouseForAdd ? `?warehouseId=${selectedWarehouseForAdd}` : '';
      const response = await fetch(`/api/audit/available-users${params}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch available users');
      return response.json();
    },
    enabled: user?.role === 'audit_manager' && !!selectedWarehouseForAdd,
  });

  const addTeamMemberMutation = useMutation({
    mutationFn: async (data: { auditUserId: number; warehouseId: number }) => {
      return await apiRequest("/api/audit/team", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/audit/team'] });
      queryClient.invalidateQueries({ queryKey: ['/api/audit/my-info'] });
      setAddMemberOpen(false);
      setSelectedWarehouseForAdd("");
      setSelectedUser("");
      toast({ title: "Team member added successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const removeTeamMemberMutation = useMutation({
    mutationFn: async (memberId: number) => {
      return await apiRequest(`/api/audit/team/${memberId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/audit/team'] });
      queryClient.invalidateQueries({ queryKey: ['/api/audit/my-info'] });
      toast({ title: "Team member removed successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  if (user?.role !== 'audit_manager' && user?.role !== 'audit_user') {
    return (
      <AppLayout>
        <div className="p-8">
          <Card>
            <CardContent className="p-8 text-center">
              <ShieldCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
              <p className="text-muted-foreground">This dashboard is only for audit managers and audit users.</p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (infoLoading) {
    return (
      <AppLayout>
        <div className="p-8">
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        </div>
      </AppLayout>
    );
  }

  if (user?.role === 'audit_user') {
    return (
      <AppLayout>
        <div className="p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Audit Dashboard</h1>
          <p className="text-muted-foreground mt-1">Your audit assignments</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              Your Assignments
            </CardTitle>
            <CardDescription>
              Warehouses you are assigned to audit
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!auditInfo?.assignments || auditInfo.assignments.length === 0 ? (
              <div className="text-center py-8">
                <Warehouse className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  You haven't been assigned to any warehouses yet.
                </p>
                <p className="text-sm text-muted-foreground">
                  Contact your audit manager to be added to their team.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {auditInfo.assignments.map((assignment, index) => (
                  <Card key={index}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                          <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <h3 className="font-medium">{assignment.warehouse?.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            Manager: {assignment.manager?.name || "Unknown"}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Audit Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Manage your audit team and warehouse assignments
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <Building2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{auditInfo?.totalWarehouses || 0}</p>
                <p className="text-sm text-muted-foreground">Assigned Warehouses</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                <Users className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{teamMembers.length}</p>
                <p className="text-sm text-muted-foreground">Team Members</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Warehouse className="h-5 w-5" />
            Your Assigned Warehouses
          </CardTitle>
          <CardDescription>
            Warehouses you are assigned to audit. Click on a warehouse to view its team.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!auditInfo?.warehouses || auditInfo.warehouses.length === 0 ? (
            <div className="text-center py-8">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                No warehouses have been assigned to you yet.
              </p>
              <p className="text-sm text-muted-foreground">
                Contact the administrator to be assigned warehouses.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {auditInfo.warehouses.map((warehouse) => (
                <Card 
                  key={warehouse.id} 
                  className={`cursor-pointer transition-colors ${selectedWarehouse === warehouse.id ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => setSelectedWarehouse(warehouse.id === selectedWarehouse ? null : warehouse.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                          <Building2 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                          <h3 className="font-medium">{warehouse.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {warehouse.teamCount} team member{warehouse.teamCount !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      {selectedWarehouse === warehouse.id && (
                        <Badge variant="default">Selected</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team Members
              {selectedWarehouse && auditInfo?.warehouses && (
                <Badge variant="outline">
                  {auditInfo.warehouses.find(w => w.id === selectedWarehouse)?.name}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {selectedWarehouse 
                ? "Team members assigned to the selected warehouse" 
                : "Select a warehouse above to filter team members, or view all"
              }
            </CardDescription>
          </div>
          <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
            <DialogTrigger asChild>
              <Button disabled={!auditInfo?.warehouses?.length}>
                <UserPlus className="h-4 w-4 mr-2" />
                Add Team Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Team Member</DialogTitle>
                <DialogDescription>
                  Add an audit user to your team for a specific warehouse.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Warehouse</label>
                  <Select value={selectedWarehouseForAdd} onValueChange={setSelectedWarehouseForAdd}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select warehouse" />
                    </SelectTrigger>
                    <SelectContent>
                      {auditInfo?.warehouses?.map((warehouse) => (
                        <SelectItem key={warehouse.id} value={warehouse.id.toString()}>
                          {warehouse.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Audit User</label>
                  <Select 
                    value={selectedUser} 
                    onValueChange={setSelectedUser}
                    disabled={!selectedWarehouseForAdd}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select audit user" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableUsers.map((au) => (
                        <SelectItem key={au.id} value={au.id.toString()}>
                          {au.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedWarehouseForAdd && availableUsers.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No available audit users for this warehouse.
                    </p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => {
                    if (selectedWarehouseForAdd && selectedUser) {
                      addTeamMemberMutation.mutate({
                        auditUserId: parseInt(selectedUser),
                        warehouseId: parseInt(selectedWarehouseForAdd)
                      });
                    }
                  }}
                  disabled={!selectedWarehouseForAdd || !selectedUser || addTeamMemberMutation.isPending}
                >
                  {addTeamMemberMutation.isPending ? "Adding..." : "Add Team Member"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {teamLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : teamMembers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {selectedWarehouse 
                  ? "No team members assigned to this warehouse yet." 
                  : "No team members found."
                }
              </p>
              <p className="text-sm text-muted-foreground">
                Add audit users to your team using the button above.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamMembers.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{member.user?.name}</TableCell>
                    <TableCell>{member.user?.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        <Building2 className="h-3 w-3 mr-1" />
                        {member.warehouse?.name}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={member.isActive ? "default" : "secondary"}>
                        {member.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeTeamMemberMutation.mutate(member.id)}
                        disabled={removeTeamMemberMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      </div>
    </AppLayout>
  );
}
