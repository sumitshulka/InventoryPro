import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { getTransactionTypeColor, formatDateTime } from "@/lib/utils";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import AppLayout from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Search, Plus, Download, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { downloadCSV } from "@/lib/utils";

const formSchema = z.object({
  itemId: z.string().min(1, { message: "Item is required" }),
  warehouseId: z.string().min(1, { message: "Warehouse is required" }),
  quantity: z.string().min(1, { message: "Quantity is required" }),
});

type FormValues = z.infer<typeof formSchema>;

export default function InventoryPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const { data: inventory, isLoading: inventoryLoading } = useQuery({
    queryKey: ["/api/reports/inventory-stock"],
  });

  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: ["/api/items"],
  });

  const { data: warehouses, isLoading: warehousesLoading } = useQuery({
    queryKey: ["/api/warehouses"],
  });

  // Fetch movement history for selected item
  const { data: movementHistory, isLoading: movementLoading } = useQuery({
    queryKey: ["/api/reports/inventory-movement"],
    enabled: isSheetOpen,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      itemId: "",
      warehouseId: "",
      quantity: "0",
    },
  });

  const updateInventoryMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const res = await apiRequest("POST", "/api/inventory", {
        itemId: parseInt(data.itemId),
        warehouseId: parseInt(data.warehouseId),
        quantity: parseInt(data.quantity),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports/inventory-stock"] });
      toast({
        title: "Inventory updated",
        description: "The inventory has been updated successfully.",
      });
      form.reset();
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const exportInventoryMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/export/inventory-stock");
      if (!res.ok) {
        throw new Error("Failed to export inventory data");
      }
      return res.text();
    },
    onSuccess: (data) => {
      downloadCSV(data, "inventory-stock.csv");
      toast({
        title: "Export successful",
        description: "Inventory stock data has been exported to CSV.",
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

  const handleSubmit = (values: FormValues) => {
    updateInventoryMutation.mutate(values);
  };

  const filteredInventory = inventory && Array.isArray(inventory)
    ? inventory.filter((item: any) => {
        const matchesSearch = 
          item.item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.item.sku.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesWarehouse = 
          warehouseFilter === "all" || 
          item.warehouseId.toString() === warehouseFilter;
        
        return matchesSearch && matchesWarehouse;
      })
    : [];

  const isManager = user?.role === "admin" || user?.role === "manager";

  if (inventoryLoading || itemsLoading || warehousesLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-medium text-gray-800">Inventory</h1>
          <p className="text-gray-600">Manage your inventory across all warehouses</p>
        </div>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={() => exportInventoryMutation.mutate()}
            disabled={exportInventoryMutation.isPending}
          >
            {exportInventoryMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Export
          </Button>
          {isManager && (
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Update Inventory
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle>Inventory Items</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ['/api/reports/inventory-stock'] });
                queryClient.invalidateQueries({ queryKey: ['/api/items'] });
                queryClient.invalidateQueries({ queryKey: ['/api/warehouses'] });
              }}
              className="ml-2"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-col md:flex-row justify-between gap-4 mt-4">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-2 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by item name or SKU..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="w-full md:w-64">
              <Select
                value={warehouseFilter}
                onValueChange={setWarehouseFilter}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter by warehouse" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Warehouses</SelectItem>
                  {warehouses && Array.isArray(warehouses) ? warehouses.map((warehouse: any) => (
                    <SelectItem key={warehouse.id} value={warehouse.id.toString()}>
                      {warehouse.name}
                    </SelectItem>
                  )) : (
                    <div className="p-2 text-sm text-gray-500">
                      No warehouses available
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Item Name</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Min Stock</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInventory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      No inventory items found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInventory.map((inv: any) => (
                    <TableRow 
                      key={inv.id} 
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => {
                        setSelectedSku(inv.item.sku);
                        setSelectedItemId(inv.item.id);
                        setIsSheetOpen(true);
                      }}
                    >
                      <TableCell className="font-medium">{inv.item.sku}</TableCell>
                      <TableCell>{inv.item.name}</TableCell>
                      <TableCell>{inv.warehouse.name}</TableCell>
                      <TableCell>{inv.quantity}</TableCell>
                      <TableCell>{inv.item.minStockLevel}</TableCell>
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
                      <TableCell>{new Date(inv.lastUpdated).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Inventory</DialogTitle>
            <DialogDescription>
              Add or update item quantity in a warehouse
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="itemId">Item</Label>
                <Select
                  onValueChange={(value) => form.setValue("itemId", value)}
                  defaultValue={form.getValues("itemId")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an item" />
                  </SelectTrigger>
                  <SelectContent>
                    {items && Array.isArray(items) ? items.map((item: any) => (
                      <SelectItem key={item.id} value={item.id.toString()}>
                        {item.name} ({item.sku})
                      </SelectItem>
                    )) : null}
                  </SelectContent>
                </Select>
                {form.formState.errors.itemId && (
                  <p className="text-sm text-red-500">{form.formState.errors.itemId.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="warehouseId">Warehouse</Label>
                <Select
                  onValueChange={(value) => form.setValue("warehouseId", value)}
                  defaultValue={form.getValues("warehouseId")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses && Array.isArray(warehouses) ? warehouses.map((warehouse: any) => (
                      <SelectItem key={warehouse.id} value={warehouse.id.toString()}>
                        {warehouse.name}
                      </SelectItem>
                    )) : null}
                  </SelectContent>
                </Select>
                {form.formState.errors.warehouseId && (
                  <p className="text-sm text-red-500">{form.formState.errors.warehouseId.message}</p>
                )}
                {(!warehouses || warehouses.length === 0) && (
                  <p className="text-sm text-amber-600">
                    No warehouses available. Create warehouses first to manage inventory.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="0"
                  placeholder="Enter quantity"
                  {...form.register("quantity")}
                />
                {form.formState.errors.quantity && (
                  <p className="text-sm text-red-500">{form.formState.errors.quantity.message}</p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateInventoryMutation.isPending}
              >
                {updateInventoryMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Inventory"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-full sm:w-[800px] sm:max-w-[90vw]">
          <SheetHeader>
            <SheetTitle>Movement History - {selectedSku}</SheetTitle>
          </SheetHeader>
          
          <div className="mt-6 h-full max-h-[80vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Source/Destination</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movementLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : (
                  movementHistory && Array.isArray(movementHistory) 
                    ? movementHistory
                        .filter((transaction: any) => transaction.itemId === selectedItemId)
                        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                        .map((transaction: any) => (
                          <TableRow key={transaction.id}>
                            <TableCell>{formatDateTime(transaction.createdAt)}</TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTransactionTypeColor(transaction.transactionType)}`}>
                                {transaction.transactionType === "check-in" ? "Check-in" : 
                                 transaction.transactionType === "issue" ? "Issue" : "Transfer"}
                              </span>
                            </TableCell>
                            <TableCell className={
                              transaction.transactionType === "issue" ? 'text-red-600' : 'text-green-600'
                            }>
                              {transaction.transactionType === "issue" ? '-' : '+'}
                              {transaction.quantity}
                            </TableCell>
                            <TableCell>
                              {transaction.transactionType === "check-in" 
                                ? transaction.destinationWarehouse?.name 
                                : transaction.sourceWarehouse?.name || 'Unknown'}
                            </TableCell>
                          </TableRow>
                        ))
                    : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                          No movement history found for this item
                        </TableCell>
                      </TableRow>
                    )
                )}
              </TableBody>
            </Table>
          </div>
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
