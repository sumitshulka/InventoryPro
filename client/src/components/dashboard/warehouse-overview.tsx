import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getPercentageColor } from "@/lib/utils";
import { Archive, CheckCircle, XCircle } from "lucide-react";

type WarehouseProps = {
  warehouses: any[];
};

export default function WarehouseOverview({ warehouses }: WarehouseProps) {
  const [selectedWarehouse, setSelectedWarehouse] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [_, navigate] = useLocation();

  // Fetch warehouses with archived option when needed
  const { data: allWarehouses } = useQuery({
    queryKey: ["/api/warehouses/stats", { includeArchived: showArchived }],
    enabled: showArchived,
  });

  // Use appropriate warehouse data
  const warehouseData = showArchived ? (allWarehouses || warehouses) : warehouses;
  const warehousesArray = Array.isArray(warehouseData) ? warehouseData : [];
  
  const filteredWarehouses = selectedWarehouse === "all" 
    ? warehousesArray 
    : warehousesArray.filter((w: any) => w.id.toString() === selectedWarehouse);

  const getStatusBadge = (warehouse: any) => {
    if (!warehouse.isActive || warehouse.status !== 'active') {
      return (
        <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full flex items-center gap-1">
          <Archive className="h-3 w-3" />
          Archived
        </span>
      );
    }
    return (
      <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full flex items-center gap-1">
        <CheckCircle className="h-3 w-3" />
        Active
      </span>
    );
  };

  return (
    <Card>
      <CardHeader className="p-6 border-b">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-800">Warehouse Overview</h3>
          <div className="flex items-center space-x-2">
            <Button
              variant={showArchived ? "default" : "outline"}
              size="sm"
              onClick={() => setShowArchived(!showArchived)}
              className="text-xs"
            >
              <Archive className="h-3 w-3 mr-1" />
              {showArchived ? "Hide Archived" : "Show Archived"}
            </Button>
            <Select
              value={selectedWarehouse}
              onValueChange={setSelectedWarehouse}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Warehouses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Warehouses</SelectItem>
                {warehousesArray.map((warehouse: any) => (
                  <SelectItem key={warehouse.id} value={warehouse.id.toString()}>
                    {warehouse.name}
                    {(!warehouse.isActive || warehouse.status !== 'active') && " (Archived)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredWarehouses.length === 0 ? (
            <div className="col-span-2 text-center py-8 text-gray-500">
              No warehouses found
            </div>
          ) : (
            filteredWarehouses.map((warehouse: any) => (
              <div 
                key={warehouse.id} 
                className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate("/warehouses")}
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-800">{warehouse.name}</h4>
                  {getStatusBadge(warehouse)}
                </div>
                <div className="flex items-center text-sm text-gray-600 mb-2">
                  <span className="material-icons text-gray-500 text-sm mr-1">location_on</span>
                  {warehouse.location}
                </div>
                <div className="flex items-center text-sm text-gray-600 mb-4">
                  <span className="material-icons text-gray-500 text-sm mr-1">person</span>
                  Manager: {warehouse.manager ? warehouse.manager.name : "Not assigned"}
                </div>
                <div className="mb-3">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600">Capacity Used</span>
                    <span className={`font-medium ${getPercentageColor(warehouse.capacityUsed)}`}>
                      {warehouse.capacityUsed}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full">
                    <div 
                      className={`h-2 rounded-full ${warehouse.capacityUsed > 90 ? 'bg-red-500' : warehouse.capacityUsed > 75 ? 'bg-amber-500' : 'bg-primary'}`}
                      style={{ width: `${warehouse.capacityUsed}%` }}
                    ></div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="bg-gray-50 rounded p-2">
                    <p className="text-xs text-gray-500">Total Items</p>
                    <p className="font-medium">{warehouse.totalItems || 0}</p>
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <p className="text-xs text-gray-500">Low Stock</p>
                    <p className="font-medium">{warehouse.lowStockItems || 0}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
