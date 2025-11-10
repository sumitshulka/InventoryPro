import { useState } from "react";
import { useQuery, useMutation,useQueryClient } from "@tanstack/react-query";
import AppLayout from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Search, Download, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function StockReportPage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
    const queryClient=useQueryClient();
  

  const { data: inventoryReport, isLoading: inventoryLoading, refetch } = useQuery({
    queryKey: ["/api/reports/inventory-stock"],
  });

  const { data: warehouses, isLoading: warehousesLoading } = useQuery({
    queryKey: ["/api/warehouses"],
  });

  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ["/api/categories"],
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/export/inventory-stock");
      if (!res.ok) {
        throw new Error("Failed to export inventory data");
      }
      return res.text();
    },
    onSuccess: (data) => {
      // Create a blob and download it
      const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'inventory-stock-report.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Export successful",
        description: "Inventory stock report has been exported to CSV.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Export failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Apply filters to inventory data
  const filteredInventory = inventoryReport
    ? inventoryReport.filter((item: any) => {
        const matchesSearch = 
          item.item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.item.sku.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesWarehouse = 
          warehouseFilter === "all" || 
          item.warehouseId.toString() === warehouseFilter;
        
        const matchesCategory = 
          categoryFilter === "all" || 
          item.item.categoryId?.toString() === categoryFilter;
        
        const matchesStock = 
          stockFilter === "all" || 
          (stockFilter === "low" && item.isLowStock) || 
          (stockFilter === "instock" && !item.isLowStock);
        
        return matchesSearch && matchesWarehouse && matchesCategory && matchesStock;
      })
    : [];

  // Calculate totals for each item across all warehouses
  const calculateTotals = () => {
    if (!inventoryReport) return [];
    
    const totals = new Map();
    
    inventoryReport.forEach((item: any) => {
      const itemId = item.itemId;
      if (!totals.has(itemId)) {
        totals.set(itemId, {
          item: item.item,
          totalQuantity: 0,
          warehouses: [],
          isLowStock: false
        });
      }
      
      const itemTotal = totals.get(itemId);
      itemTotal.totalQuantity += item.quantity;
      itemTotal.warehouses.push({
        warehouse: item.warehouse,
        quantity: item.quantity
      });
      
      // If any warehouse is low on stock, mark the item as low stock
      if (item.isLowStock) {
        itemTotal.isLowStock = true;
      }
    });
    
    return Array.from(totals.values());
  };
  
  const itemTotals = calculateTotals();
  console.log('itemTotalsribhu',itemTotals)

  if (inventoryLoading || warehousesLoading || categoriesLoading) {
    return (
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-medium text-gray-800">Inventory Stock Report</h1>
          <p className="text-gray-600">View and analyze current inventory levels</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={async () => {
                      try {
                        // Clear all relevant query caches
                        await queryClient.invalidateQueries({ queryKey: ["/api/reports/inventory-stock"] });
                        await queryClient.invalidateQueries({ queryKey: ["/api/warehouses"] });
                        await queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
                        
                        // Force fresh data fetch
                        // await Promise.all([
                        //   queryClient.refetchQueries({ queryKey: ["/api/reports/inventory-stock"], type: 'active' }),
                        //   queryClient.refetchQueries({ queryKey: ["/api/warehouses"], type: 'active' }),
                        //   queryClient.refetchQueries({ queryKey: ["/api/categories"], type: 'active' }),
                        // ]);
                        
                        toast({
                          title: "Refreshed",
                          description: "Stock Report has been refreshed with latest data",
                        });
                      } catch (error) {
                        console.error('Refresh error:', error);
                        toast({
                          title: "Refresh Failed",
                          description: "Unable to refresh data. Please try again.",
                          variant: "destructive",
                        });
                      }
                    }}>
            <RefreshCw className={`h-4 w-4 `} />
          </Button>
          <Button 
            onClick={() => exportMutation.mutate()}
            disabled={exportMutation.isPending}
          >
            {exportMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Items</p>
                <h2 className="text-3xl font-bold">{itemTotals.length}</h2>
              </div>
              <div className="bg-primary bg-opacity-10 p-3 rounded-full">
                <span className="material-icons text-primary">inventory_2</span>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Low Stock Items</p>
                <h2 className="text-3xl font-bold">{itemTotals.filter(item => item.isLowStock).length}</h2>
              </div>
              <div className="bg-warning bg-opacity-10 p-3 rounded-full">
                <span className="material-icons text-warning">warning</span>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Warehouses</p>
                <h2 className="text-3xl font-bold">{warehouses?.length || 0}</h2>
              </div>
              <div className="bg-info bg-opacity-10 p-3 rounded-full">
                <span className="material-icons text-info">store</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Controls */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-2 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by name or SKU..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div>
              <Select
                value={warehouseFilter}
                onValueChange={setWarehouseFilter}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Warehouse Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Warehouses</SelectItem>
                  {warehouses?.map((warehouse: any) => (
                    <SelectItem key={warehouse.id} value={warehouse.id.toString()}>
                      {warehouse.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Select
                value={categoryFilter}
                onValueChange={setCategoryFilter}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Category Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories?.map((category: any) => (
                    <SelectItem key={category.id} value={category.id.toString()}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Select
                value={stockFilter}
                onValueChange={setStockFilter}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Stock Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stock Levels</SelectItem>
                  <SelectItem value="low">Low Stock</SelectItem>
                  <SelectItem value="instock">In Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Inventory Table */}
      <Card>
        <CardHeader>
          <CardTitle>Inventory Stock Levels</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Item Name</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Min Stock</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInventory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      No inventory items found matching the filters
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInventory.map((inv: any) => (
                    <TableRow key={`${inv.itemId}-${inv.warehouseId}`}>
                      <TableCell className="font-medium">{inv.item.sku}</TableCell>
                      <TableCell>{inv.item.name}</TableCell>
                      <TableCell>{inv.warehouse.name}</TableCell>
                      <TableCell className="text-right">{inv.quantity}</TableCell>
                      <TableCell className="text-right">{inv.item.minStockLevel}</TableCell>
                      <TableCell>
                        {inv.isLowStock ? (
                          <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                            Low Stock
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                            In Stock
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
