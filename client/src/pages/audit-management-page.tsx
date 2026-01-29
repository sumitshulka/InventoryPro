import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Building2, Users, UserCheck, Warehouse, ShieldCheck, UserPlus } from "lucide-react";
import type { User, Warehouse as WarehouseType } from "@shared/schema";

interface AuditManagerWithWarehouses extends User {
  assignedWarehouses: WarehouseType[];
}

export default function AuditManagementPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [assignWarehouseOpen, setAssignWarehouseOpen] = useState(false);
  const [selectedManager, setSelectedManager] = useState<AuditManagerWithWarehouses | null>(null);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("");
  const [addTeamMemberOpen, setAddTeamMemberOpen] = useState(false);
  const [selectedManagerForTeam, setSelectedManagerForTeam] = useState<string>("");
  const [selectedWarehouseForTeam, setSelectedWarehouseForTeam] = useState<string>("");
  const [selectedAuditUser, setSelectedAuditUser] = useState<string>("");

  const { data: auditManagers = [], isLoading: managersLoading } = useQuery<AuditManagerWithWarehouses[]>({
    queryKey: ['/api/audit/managers'],
  });

  const { data: auditUsers = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ['/api/audit/users'],
  });

  const { data: warehouses = [] } = useQuery<WarehouseType[]>({
    queryKey: ['/api/warehouses'],
  });

  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  const assignWarehouseMutation = useMutation({
    mutationFn: async (data: { managerId: number; warehouseId: number }) => {
      return await apiRequest(`/api/audit/managers/${data.managerId}/warehouses`, {
        method: "POST",
        body: JSON.stringify({ warehouseId: data.warehouseId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/audit/managers'] });
      setAssignWarehouseOpen(false);
      setSelectedWarehouseId("");
      toast({ title: "Warehouse assigned successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const removeWarehouseMutation = useMutation({
    mutationFn: async (data: { managerId: number; warehouseId: number }) => {
      return await apiRequest(`/api/audit/managers/${data.managerId}/warehouses/${data.warehouseId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/audit/managers'] });
      toast({ title: "Warehouse removed successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const addTeamMemberMutation = useMutation({
    mutationFn: async (data: { auditUserId: number; auditManagerId: number; warehouseId: number }) => {
      return await apiRequest("/api/audit/team", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/audit/team'] });
      setAddTeamMemberOpen(false);
      setSelectedManagerForTeam("");
      setSelectedWarehouseForTeam("");
      setSelectedAuditUser("");
      toast({ title: "Team member added successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  if (user?.role !== 'admin') {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="p-8 text-center">
            <ShieldCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">Only administrators can access audit management.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getAvailableWarehouses = (manager: AuditManagerWithWarehouses) => {
    const assignedIds = new Set(manager.assignedWarehouses.map(w => w.id));
    return warehouses.filter(w => !assignedIds.has(w.id) && w.isActive);
  };

  const getAvailableWarehousesForTeam = () => {
    if (!selectedManagerForTeam) return [];
    const manager = auditManagers.find(m => m.id === parseInt(selectedManagerForTeam));
    return manager?.assignedWarehouses || [];
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Audit Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage audit managers, audit users, and warehouse assignments
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <UserCheck className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{auditManagers.length}</p>
                <p className="text-sm text-muted-foreground">Audit Managers</p>
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
                <p className="text-2xl font-bold">{auditUsers.length}</p>
                <p className="text-sm text-muted-foreground">Audit Users</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <Warehouse className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {auditManagers.reduce((sum, m) => sum + m.assignedWarehouses.length, 0)}
                </p>
                <p className="text-sm text-muted-foreground">Warehouse Assignments</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="managers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="managers">Audit Managers</TabsTrigger>
          <TabsTrigger value="users">Audit Users</TabsTrigger>
          <TabsTrigger value="team">Team Assignments</TabsTrigger>
        </TabsList>

        <TabsContent value="managers">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5" />
                Audit Managers
              </CardTitle>
              <CardDescription>
                Manage audit managers and their warehouse assignments. Create audit managers from the Users Management page.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {managersLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : auditManagers.length === 0 ? (
                <div className="text-center py-8">
                  <UserCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    No audit managers found. Create users with the "Audit Manager" role from the Users Management page.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Assigned Warehouses</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditManagers.map((manager) => (
                      <TableRow key={manager.id}>
                        <TableCell className="font-medium">{manager.name}</TableCell>
                        <TableCell>{manager.email}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {manager.assignedWarehouses.length === 0 ? (
                              <span className="text-muted-foreground text-sm">No warehouses assigned</span>
                            ) : (
                              manager.assignedWarehouses.map((warehouse) => (
                                <Badge key={warehouse.id} variant="secondary" className="flex items-center gap-1">
                                  <Building2 className="h-3 w-3" />
                                  {warehouse.name}
                                  <button
                                    onClick={() => removeWarehouseMutation.mutate({
                                      managerId: manager.id,
                                      warehouseId: warehouse.id
                                    })}
                                    className="ml-1 hover:text-destructive"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </Badge>
                              ))
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Dialog open={assignWarehouseOpen && selectedManager?.id === manager.id} onOpenChange={(open) => {
                            setAssignWarehouseOpen(open);
                            if (open) setSelectedManager(manager);
                          }}>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Plus className="h-4 w-4 mr-1" />
                                Assign Warehouse
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Assign Warehouse to {manager.name}</DialogTitle>
                                <DialogDescription>
                                  Select a warehouse to assign to this audit manager.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="py-4">
                                <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select a warehouse" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {getAvailableWarehouses(manager).map((warehouse) => (
                                      <SelectItem key={warehouse.id} value={warehouse.id.toString()}>
                                        {warehouse.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <DialogFooter>
                                <Button
                                  onClick={() => {
                                    if (selectedWarehouseId) {
                                      assignWarehouseMutation.mutate({
                                        managerId: manager.id,
                                        warehouseId: parseInt(selectedWarehouseId)
                                      });
                                    }
                                  }}
                                  disabled={!selectedWarehouseId || assignWarehouseMutation.isPending}
                                >
                                  {assignWarehouseMutation.isPending ? "Assigning..." : "Assign"}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Audit Users
              </CardTitle>
              <CardDescription>
                View audit users who can be assigned to audit teams. Create audit users from the Users Management page.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : auditUsers.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    No audit users found. Create users with the "Audit User" role from the Users Management page.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditUsers.map((auditUser) => (
                      <TableRow key={auditUser.id}>
                        <TableCell className="font-medium">{auditUser.name}</TableCell>
                        <TableCell>{auditUser.username}</TableCell>
                        <TableCell>{auditUser.email}</TableCell>
                        <TableCell>
                          <Badge variant={auditUser.isActive ? "default" : "secondary"}>
                            {auditUser.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  Team Assignments
                </CardTitle>
                <CardDescription>
                  Assign audit users to audit managers for specific warehouses.
                </CardDescription>
              </div>
              <Dialog open={addTeamMemberOpen} onOpenChange={setAddTeamMemberOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Team Member
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Team Member</DialogTitle>
                    <DialogDescription>
                      Assign an audit user to an audit manager's team for a specific warehouse.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Audit Manager</label>
                      <Select value={selectedManagerForTeam} onValueChange={(v) => {
                        setSelectedManagerForTeam(v);
                        setSelectedWarehouseForTeam("");
                      }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select audit manager" />
                        </SelectTrigger>
                        <SelectContent>
                          {auditManagers.map((manager) => (
                            <SelectItem key={manager.id} value={manager.id.toString()}>
                              {manager.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Warehouse</label>
                      <Select 
                        value={selectedWarehouseForTeam} 
                        onValueChange={setSelectedWarehouseForTeam}
                        disabled={!selectedManagerForTeam}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select warehouse" />
                        </SelectTrigger>
                        <SelectContent>
                          {getAvailableWarehousesForTeam().map((warehouse) => (
                            <SelectItem key={warehouse.id} value={warehouse.id.toString()}>
                              {warehouse.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Audit User</label>
                      <Select value={selectedAuditUser} onValueChange={setSelectedAuditUser}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select audit user" />
                        </SelectTrigger>
                        <SelectContent>
                          {auditUsers.map((au) => (
                            <SelectItem key={au.id} value={au.id.toString()}>
                              {au.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={() => {
                        if (selectedManagerForTeam && selectedWarehouseForTeam && selectedAuditUser) {
                          addTeamMemberMutation.mutate({
                            auditUserId: parseInt(selectedAuditUser),
                            auditManagerId: parseInt(selectedManagerForTeam),
                            warehouseId: parseInt(selectedWarehouseForTeam)
                          });
                        }
                      }}
                      disabled={!selectedManagerForTeam || !selectedWarehouseForTeam || !selectedAuditUser || addTeamMemberMutation.isPending}
                    >
                      {addTeamMemberMutation.isPending ? "Adding..." : "Add Team Member"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <p>Team assignments are managed here. Once audit managers are assigned warehouses,</p>
                <p>they can also add team members from their own dashboard.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
