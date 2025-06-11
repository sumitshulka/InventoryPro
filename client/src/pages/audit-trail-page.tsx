import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AppLayout from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { RefreshCw } from "lucide-react";
import { queryClient } from "@/lib/queryClient";

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
    
    const matchesAction = actionFilter === "all" || log.action === actionFilter;
    const matchesUser = userFilter === "all" || log.userId?.toString() === userFilter;
    
    return matchesSearch && matchesAction && matchesUser;
  });

  const getActionBadgeColor = (action: string) => {
    switch (action?.toLowerCase()) {
      case 'create': return 'bg-green-100 text-green-800';
      case 'update': return 'bg-blue-100 text-blue-800';
      case 'delete': return 'bg-red-100 text-red-800';
      case 'login': return 'bg-purple-100 text-purple-800';
      case 'logout': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const uniqueActions = [...new Set(auditLogs.map((log: any) => log.action))];

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
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
            {filteredLogs.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No audit logs found matching your criteria.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredLogs.map((log: any) => (
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
                        
                        {log.metadata && (
                          <div className="text-sm text-gray-600">
                            <details className="cursor-pointer">
                              <summary>Additional Details</summary>
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
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}