import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { formatDateTime } from "@/lib/utils";

export default function RecentActivity() {
  const { data: transactions } = useQuery({
    queryKey: ["/api/transactions"],
  });
  
  const { data: requests } = useQuery({
    queryKey: ["/api/requests"],
  });
  
  const { data: users } = useQuery({
    queryKey: ["/api/users"],
  });
  
  const { data: inventory } = useQuery({
    queryKey: ["/api/reports/inventory-stock"],
  });

  const getUserName = (userId: number) => {
    if (!users) return "";
    const user = users.find((u: any) => u.id === userId);
    return user ? user.name : "";
  };

  // Generate activity items from transactions and requests
  const generateActivities = () => {
    if (!transactions || !requests || !inventory) return [];
    
    const activities = [];
    
    // Add recent transactions
    transactions.slice(0, 3).forEach((transaction: any) => {
      const activity = {
        id: `transaction-${transaction.id}`,
        type: transaction.transactionType,
        icon: transaction.transactionType === "check-in" ? "inventory_2" : 
              transaction.transactionType === "transfer" ? "swap_horiz" : "login",
        iconColor: transaction.transactionType === "check-in" ? "text-secondary" : 
                  transaction.transactionType === "transfer" ? "text-warning" : "text-primary",
        iconBg: transaction.transactionType === "check-in" ? "bg-green-100" : 
               transaction.transactionType === "transfer" ? "bg-yellow-100" : "bg-blue-100",
        message: transaction.transactionType === "check-in" 
          ? `New inventory received (${transaction.transactionCode})`
          : transaction.transactionType === "transfer"
            ? `Transfer ${transaction.transactionCode} initiated`
            : `Items issued from inventory (${transaction.transactionCode})`,
        date: transaction.createdAt,
        user: getUserName(transaction.userId)
      };
      activities.push(activity);
    });
    
    // Add recent request status changes
    requests.slice(0, 2).forEach((request: any) => {
      const activity = {
        id: `request-${request.id}`,
        type: "request",
        icon: request.status === "approved" ? "check_circle" : 
              request.status === "rejected" ? "cancel" : "assignment",
        iconColor: request.status === "approved" ? "text-primary" : 
                   request.status === "rejected" ? "text-error" : "text-info",
        iconBg: request.status === "approved" ? "bg-blue-100" : 
                request.status === "rejected" ? "bg-red-100" : "bg-blue-100",
        message: request.status === "approved" 
          ? `Request ${request.requestCode} was approved`
          : request.status === "rejected"
            ? `Request ${request.requestCode} was rejected`
            : `New request ${request.requestCode} created`,
        date: request.updatedAt || request.createdAt,
        user: getUserName(request.userId)
      };
      activities.push(activity);
    });
    
    // Add low stock alerts if any
    const lowStockItems = inventory.filter((inv: any) => inv.isLowStock).slice(0, 2);
    lowStockItems.forEach((item: any, index: number) => {
      const activity = {
        id: `lowstock-${index}`,
        type: "alert",
        icon: "priority_high",
        iconColor: "text-error",
        iconBg: "bg-red-100",
        message: `Low stock alert: ${item.item.name} at ${item.warehouse.name}`,
        date: new Date().toISOString(), // Current date since this is an alert
        user: ""
      };
      activities.push(activity);
    });
    
    // Sort by date (newest first)
    activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    return activities.slice(0, 5); // Return top 5
  };
  
  const activities = generateActivities();

  return (
    <Card>
      <CardHeader className="p-6 border-b">
        <h3 className="text-lg font-medium text-gray-800">Recent Activity</h3>
      </CardHeader>
      
      <CardContent className="p-6 relative">
        {activities.length === 0 ? (
          <div className="text-center py-4 text-gray-500">
            No recent activity
          </div>
        ) : (
          <div className="border-l-2 border-gray-200 ml-3">
            {activities.map((activity) => (
              <div key={activity.id} className="relative mb-6 last:mb-0">
                <div className={`absolute -left-3.5 mt-1.5 w-6 h-6 rounded-full ${activity.iconBg} flex items-center justify-center`}>
                  <span className={`material-icons ${activity.iconColor} text-sm`}>{activity.icon}</span>
                </div>
                <div className="ml-6">
                  <p className="text-sm text-gray-800 font-medium">
                    {activity.user && (
                      <span className="font-medium">{activity.user} </span>
                    )}
                    {activity.message}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{formatDateTime(activity.date)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
