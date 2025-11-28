import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { RefreshCw } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { DataTablePagination } from "@/components/ui/data-table-pagination";

export default function AuditTrailPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");

  const { data: auditLogs = [], isLoading } = useQuery({
    queryKey: ['/api/audit-logs'],
  });

  const { data: users = [] } = useQuery({
    queryKey: ['/api/users'],
  });

  const filteredLogs = auditLogs.filter((log: any) => {
    const matchesSearch = searchTerm === "" || 
      log.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    
  const matchesAction =
    actionFilter === "all" ||
    log.action?.toLowerCase() === actionFilter.toLowerCase();
    const matchesUser = userFilter === "all" || log.userId?.toString() === userFilter;
    
    return matchesSearch && matchesAction && matchesUser;
  });

  const getActionBadgeColor = (action: string) => {
    const a = action?.toLowerCase();

    if (a.includes("create")) return "bg-green-100 text-green-800";
    if (a.includes("update")) return "bg-blue-100 text-blue-800";
    if (a.includes("delete")) return "bg-red-100 text-red-800";
    if (a.includes("login")) return "bg-purple-100 text-purple-800";
    if (a.includes("logout")) return "bg-gray-100 text-gray-800";
    if (a.includes("dispose")) return "bg-orange-100 text-orange-800";

    return "bg-gray-100 text-gray-800";
  };


  const uniqueActions = [...new Set(auditLogs.map((log: any) => log.action))];

  if (isLoading) {
    return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
    );
  }

  return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Audit Trail</h1>
            <p className="text-gray-600">Track all system activities and user actions</p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search
                </label>
                <Input
                  placeholder="Search actions, details, or users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Action Type
                </label>
                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Actions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    {uniqueActions.map((action) => (
                      <SelectItem key={action} value={action}>
                        {action?.charAt(0).toUpperCase() + action?.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  User
                </label>
                <Select value={userFilter} onValueChange={setUserFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Users" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    {users.map((user: any) => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Audit Logs */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                Audit Logs ({filteredLogs.length})
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await queryClient.refetchQueries({ queryKey: ['/api/audit-logs'] });
                  await queryClient.refetchQueries({ queryKey: ['/api/users'] });
                }}
                className="ml-2"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <DataTablePagination data={filteredLogs}>
              {(paginatedLogs) => (
                <>
                  {paginatedLogs.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500">No audit logs found matching your criteria.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {paginatedLogs.map((log: any) => (
                        <div key={log.id} className="border rounded-lg p-4 hover:bg-gray-50">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <Badge className={getActionBadgeColor(log.action)}>
                                  {log.action?.toUpperCase()}
                                </Badge>
                                <span className="text-sm text-gray-600">
                                  by {log.user?.name || 'Unknown User'}
                                </span>
                                <span className="text-sm text-gray-500">
                                  {log.createdAt ? format(new Date(log.createdAt), 'MMM dd, yyyy HH:mm:ss') : 'Unknown time'}
                                </span>
                              </div>
                              
                              <p className="text-gray-900 mb-1">
                                {log.details || 'No details available'}
                              </p>
                              
                              {/* Enhanced display for transfer updates
                              {log.entityType === 'transfer' && log.action === 'UPDATE' && (log.oldValues || log.newValues) && (
                                <div className="mt-2 space-y-2">
                                  {(() => {
                                    try {
                                      const oldValues = log.oldValues ? JSON.parse(log.oldValues) : {};
                                      const newValues = log.newValues ? JSON.parse(log.newValues) : {};
                                      const changes = [];
                                      
                                      // Show meaningful changes for transfers
                                      if (newValues.status && oldValues.status !== newValues.status) {
                                        changes.push(`Status: ${oldValues.status || 'None'} → ${newValues.status}`);
                                      }
                                      if (newValues.courierName !== undefined && oldValues.courierName !== newValues.courierName) {
                                        changes.push(`Courier: ${oldValues.courierName || 'None'} → ${newValues.courierName || 'None'}`);
                                      }
                                      if (newValues.courierPhone !== undefined && oldValues.courierPhone !== newValues.courierPhone) {
                                        changes.push(`Courier Phone: ${oldValues.courierPhone || 'None'} → ${newValues.courierPhone || 'None'}`);
                                      }
                                      if (newValues.handoverPersonName !== undefined && oldValues.handoverPersonName !== newValues.handoverPersonName) {
                                        changes.push(`Pickup Person: ${oldValues.handoverPersonName || 'None'} → ${newValues.handoverPersonName || 'None'}`);
                                      }
                                      if (newValues.handoverPersonPhone !== undefined && oldValues.handoverPersonPhone !== newValues.handoverPersonPhone) {
                                        changes.push(`Pickup Phone: ${oldValues.handoverPersonPhone || 'None'} → ${newValues.handoverPersonPhone || 'None'}`);
                                      }
                                      if (newValues.trackingNumber !== undefined && oldValues.trackingNumber !== newValues.trackingNumber) {
                                        changes.push(`Tracking: ${oldValues.trackingNumber || 'None'} → ${newValues.trackingNumber || 'None'}`);
                                      }
                                      if (newValues.transportMethod !== undefined && oldValues.transportMethod !== newValues.transportMethod) {
                                        changes.push(`Transport Method: ${oldValues.transportMethod || 'None'} → ${newValues.transportMethod || 'None'}`);
                                      }
                                      if (newValues.notes !== undefined && oldValues.notes !== newValues.notes) {
                                        changes.push(`Notes: ${oldValues.notes || 'None'} → ${newValues.notes || 'None'}`);
                                      }
                                      
                                      return changes.length > 0 ? (
                                        <div className="text-sm">
                                          <div className="font-medium text-gray-700 mb-1">Changes:</div>
                                          <ul className="list-disc list-inside space-y-1 text-gray-600">
                                            {changes.map((change, idx) => (
                                              <li key={idx}>{change}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      ) : null;
                                    } catch (e) {
                                      return null;
                                    }
                                  })()}
                                </div>
                              )}
                              
                              {/* Enhanced display for user updates */}
                              {/* {log.entityType === 'user' && log.action === 'UPDATE' && (log.oldValues || log.newValues) && (
                                <div className="mt-2 space-y-2">
                                  {(() => {
                                    try {
                                      const oldValues = log.oldValues ? JSON.parse(log.oldValues) : {};
                                      const newValues = log.newValues ? JSON.parse(log.newValues) : {};
                                      const changes = [];
                                      
                                      if (newValues.username && oldValues.username !== newValues.username) {
                                        changes.push(`Username: ${oldValues.username} → ${newValues.username}`);
                                      }
                                      if (newValues.email && oldValues.email !== newValues.email) {
                                        changes.push(`Email: ${oldValues.email} → ${newValues.email}`);
                                      }
                                      if (newValues.name && oldValues.name !== newValues.name) {
                                        changes.push(`Name: ${oldValues.name} → ${newValues.name}`);
                                      }
                                      if (newValues.role && oldValues.role !== newValues.role) {
                                        changes.push(`Role: ${oldValues.role} → ${newValues.role}`);
                                      }
                                      if (newValues.warehouseId !== undefined && oldValues.warehouseId !== newValues.warehouseId) {
                                        changes.push(`Warehouse Assignment: ${oldValues.warehouseId || 'None'} → ${newValues.warehouseId || 'None'}`);
                                      }
                                      if (newValues.isActive !== undefined && oldValues.isActive !== newValues.isActive) {
                                        changes.push(`Status: ${oldValues.isActive ? 'Active' : 'Inactive'} → ${newValues.isActive ? 'Active' : 'Inactive'}`);
                                      }
                                      
                                      return changes.length > 0 ? (
                                        <div className="text-sm">
                                          <div className="font-medium text-gray-700 mb-1">Changes:</div>
                                          <ul className="list-disc list-inside space-y-1 text-gray-600">
                                            {changes.map((change, idx) => (
                                              <li key={idx}>{change}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      ) : null;
                                    } catch (e) {
                                      return null;
                                    }
                                  })()}
                                </div>
                              )} */} 
                              {/* Universal Diff Renderer */}
                             {/* Universal Diff Renderer */}
                              {(log.oldValues || log.newValues) && (
                                <div className="mt-2 space-y-2">
                                  {(() => {
                                    try {
                                      const oldValues = log.oldValues ? JSON.parse(log.oldValues) : {};
                                      const newValues = log.newValues ? JSON.parse(log.newValues) : {};

                                      const changes = [];

                                      for (const key of Object.keys(newValues)) {
                                        const oldVal = oldValues[key];
                                        const newVal = newValues[key];

                                        const hasMeaningfulOld =
                                          oldVal !== null && oldVal !== undefined && oldVal !== "";

                                        if (!hasMeaningfulOld) {
                                          // show ONLY the new value
                                          changes.push({
                                            field: key,
                                            old: null,
                                            new: newVal,
                                            showDirection: false
                                          });
                                        } else if (oldVal !== newVal) {
                                          // show old → new diff
                                          changes.push({
                                            field: key,
                                            old: oldVal,
                                            new: newVal,
                                            showDirection: true
                                          });
                                        }
                                      }

                                      if (changes.length === 0) return null;

                                      return (
                                        <div className="text-sm">
                                          <div className="font-medium text-gray-700 mb-1">Changes:</div>
                                          <ul className="list-disc list-inside space-y-1 text-gray-600">
                                            {changes.map((c, idx) => (
                                              <li key={idx}>
                                                <strong>{c.field}:</strong>{" "}
                                                {c.showDirection
                                                  ? `${c.old} → ${c.new}`
                                                  : `${c.new}`} 
                                              </li>
                                            ))}
                                          </ul>
                                        </div>
                                      );
                                    } catch (e) {
                                      console.error("Diff parse error", e);
                                      return null;
                                    }
                                  })()}
                                </div>
                              )}


                              
                              {log.metadata && (
                                <div className="text-sm text-gray-600">
                                  <details className="cursor-pointer">
                                    <summary>Technical Details</summary>
                                    <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto">
                                      {JSON.stringify(log.metadata, null, 2)}
                                    </pre>
                                  </details>
                                </div>
                              )}
                              
                              {log.ipAddress && (
                                <div className="text-xs text-gray-500 mt-1">
                                  IP: {log.ipAddress}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </DataTablePagination>
          </CardContent>
        </Card>
      </div>
  );
}