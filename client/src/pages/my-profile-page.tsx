import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { User, Building, Mail, UserCheck, MapPin, Building2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";

export default function MyProfilePage() {
  const { user } = useAuth();

  const { data: warehouses } = useQuery({
    queryKey: ["/api/warehouses"],
    enabled: user?.role === "admin" || user?.role === "manager" || user?.isWarehouseOperator,
  });

  const { data: departments } = useQuery({
    queryKey: ["/api/departments"],
    enabled: user?.role === "admin" || user?.role === "manager",
  });

  const { data: managers } = useQuery({
    queryKey: ["/api/users"],
    enabled: user?.role === "admin" || user?.role === "manager",
  });

  const getWarehouseName = (warehouseId: number | null) => {
    if (!warehouseId) return "Not assigned";
    if (!warehouses) return "Warehouse information restricted";
    const warehouse = (warehouses as any[])?.find(w => w.id === warehouseId);
    return warehouse?.name || "Unknown Warehouse";
  };

  const getDepartmentName = (departmentId: number | null) => {
    if (!departmentId) return "Not assigned";
    if (!departments) return "Department information restricted";
    const department = (departments as any[])?.find(d => d.id === departmentId);
    return department?.name || "Unknown Department";
  };

  const getManagerName = (managerId: number | null) => {
    if (!managerId) return "No manager assigned";
    if (!managers) return "Manager information restricted";
    const manager = (managers as any[])?.find(m => m.id === managerId);
    return manager?.name || "Unknown Manager";
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'manager':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (!user) {
    return (
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500">Loading profile...</p>
        </div>
    );
  }

  return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>
          <p className="text-muted-foreground">View your account information and role details</p>
        </div>
        


        <div className="grid gap-6 md:grid-cols-2">
          {/* Personal Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-500">Full Name</label>
                <p className="text-sm">{user.name}</p>
              </div>

              <Separator />

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-500">Username</label>
                <p className="text-sm">{user.username}</p>
              </div>

              <Separator />

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-500">Email Address</label>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <p className="text-sm">{user.email}</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-500">Account Created</label>
                <p className="text-sm">
                  {new Date(user.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Role & Permissions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5" />
                Role & Permissions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-500">Role</label>
                <Badge className={getRoleBadgeColor(user.role)}>
                  {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                </Badge>
              </div>

              <Separator />

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-500">Warehouse Operator</label>
                <Badge className={user.isWarehouseOperator ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                  {user.isWarehouseOperator ? 'Yes' : 'No'}
                </Badge>
              </div>

              <Separator />

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-500">Assigned Manager</label>
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-gray-400" />
                  <p className="text-sm">{getManagerName(user.managerId)}</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-500">Assigned Warehouse</label>
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-gray-400" />
                  <p className="text-sm">{getWarehouseName(user.warehouseId)}</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-500">Department</label>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  <p className="text-sm">{getDepartmentName(user.departmentId)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Permissions Summary */}
        <Card>
          <CardHeader>
            <CardTitle>System Access Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <h4 className="font-medium">Available Features</h4>
                <ul className="text-sm space-y-1 text-gray-600">
                  <li>• View Dashboard</li>
                  <li>• Browse Items Catalog</li>
                  <li>• Submit Inventory Requests</li>
                  <li>• View My Requests</li>
                  <li>• Communication Center</li>
                </ul>
              </div>

              {user.isWarehouseOperator && (
                <div className="space-y-2">
                  <h4 className="font-medium">Warehouse Operator Access</h4>
                  <ul className="text-sm space-y-1 text-gray-600">
                    <li>• Check In Items</li>
                    <li>• Process Requests</li>
                    <li>• Manage Inventory</li>
                    <li>• View Transfers</li>
                    <li>• Handle Rejected Goods</li>
                  </ul>
                </div>
              )}

              {(user.role === 'manager' || user.role === 'admin') && (
                <div className="space-y-2">
                  <h4 className="font-medium">Management Access</h4>
                  <ul className="text-sm space-y-1 text-gray-600">
                    <li>• View Reports</li>
                    <li>• Manage Users</li>
                    <li>• Approve Requests</li>
                    <li>• System Settings</li>
                    <li>• Audit Logs</li>
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
  );
}