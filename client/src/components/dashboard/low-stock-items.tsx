import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";

type LowStockItemsProps = {
  items: any[];
};

export default function LowStockItems({ items }: LowStockItemsProps) {
  const [_, navigate] = useLocation();
  
  const { data: warehouses } = useQuery({
    queryKey: ["/api/warehouses"],
  });

  const getWarehouseName = (warehouseId: number) => {
    if (!warehouses) return "";
    const warehouse = warehouses.find((w: any) => w.id === warehouseId);
    return warehouse ? warehouse.name : "";
  };

  // Determine the appropriate icon for each item type
  const getItemIcon = (item: any) => {
    const name = item.item.name.toLowerCase();
    
    if (name.includes("laptop")) return "laptop";
    if (name.includes("monitor")) return "monitor";
    if (name.includes("keyboard")) return "keyboard";
    if (name.includes("mouse")) return "mouse";
    if (name.includes("headphone")) return "headset";
    if (name.includes("phone")) return "smartphone";
    if (name.includes("tablet")) return "tablet";
    if (name.includes("printer")) return "print";
    if (name.includes("scanner")) return "scanner";
    if (name.includes("cable")) return "cable";
    if (name.includes("paper")) return "description";
    
    // Default icon
    return "inventory_2";
  };

  return (
    <Card>
      <CardHeader className="p-6 border-b flex flex-row items-center justify-between">
        <h3 className="text-lg font-medium text-gray-800">Low Stock Items</h3>
        <Button 
          variant="ghost" 
          className="text-primary text-sm hover:bg-primary/5"
          onClick={() => navigate("/stock-report")}
        >
          View All
          <span className="material-icons text-sm ml-1">chevron_right</span>
        </Button>
      </CardHeader>
      
      <CardContent className="p-2">
        {items.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No low stock items
          </div>
        ) : (
          items.map(item => (
            <div key={`${item.itemId}-${item.warehouseId}`} className="border-b last:border-b-0 p-4 hover:bg-gray-50">
              <div className="flex items-center">
                <div className="bg-gray-100 rounded-md w-10 h-10 flex items-center justify-center mr-3">
                  <span className="material-icons text-gray-600">{getItemIcon(item)}</span>
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-800">{item.item.name}</h4>
                  <p className="text-xs text-gray-500">
                    SKU: {item.item.sku} • {getWarehouseName(item.warehouseId)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-error">{item.quantity} left</p>
                  <p className="text-xs text-gray-500">Min: {item.item.minStockLevel}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
      
      <CardFooter className="p-4 border-t">
        <Button
          className="w-full bg-gray-100 text-gray-700 hover:bg-gray-200"
          variant="outline"
          onClick={() => navigate("/check-in")}
        >
          <span className="material-icons text-sm mr-1">add_shopping_cart</span>
          Create Purchase Order
        </Button>
      </CardFooter>
    </Card>
  );
}
