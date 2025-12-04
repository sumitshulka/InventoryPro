import { useState } from "react";
import { useQuery, useMutation,useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { getTransactionTypeColor, formatDateTime } from "@/lib/utils";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Search, Plus, Download, RefreshCw, Trash2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { downloadCSV } from "@/lib/utils";
import { DataTablePagination } from "@/components/ui/data-table-pagination";

const formSchema = z.object({
  itemId: z.string().min(1, { message: "Item is required" }),
  warehouseId: z.string().min(1, { message: "Warehouse is required" }),
  quantity: z.string().min(1, { message: "Quantity is required" }),
});

const disposalFormSchema = z.object({
  quantity: z.string().min(1, { message: "Quantity is required" }),
  disposalReason: z.string().min(1, { message: "Disposal reason is required" }),
});

type FormValues = z.infer<typeof formSchema>;
type DisposalFormValues = z.infer<typeof disposalFormSchema>;

export default function InventoryPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isDisposalDialogOpen, setIsDisposalDialogOpen] = useState(false);
  const [disposalItem, setDisposalItem] = useState<any>(null);
  const queryClient=useQueryClient();

  const { data: inventory, isLoading: inventoryLoading } = useQuery({
    queryKey: ["/api/reports/inventory-stock", refreshKey],
    refetchInterval: 30000,
  });

  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: ["/api/items", refreshKey],
  });

  const { data: warehouses, isLoading: warehousesLoading } = useQuery({
    queryKey: ["/api/warehouses/stats", refreshKey],
  });

  // Fetch movement history for selected item
  const { data: movementHistory, isLoading: movementLoading } = useQuery({
    queryKey: ["/api/reports/inventory-movement", refreshKey],
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

  const disposalForm = useForm<DisposalFormValues>({
    resolver: zodResolver(disposalFormSchema),
    defaultValues: {
      quantity: "",
      disposalReason: "",
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
      queryClient.invalidateQueries({ queryKey: ["/api/warehouses/stats"] });

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

  const disposeInventoryMutation = useMutation({
    mutationFn: async (data: DisposalFormValues) => {
      const res = await apiRequest("POST", "/api/inventory/dispose", {
        inventoryId: disposalItem?.id,
        quantity: parseInt(data.quantity),
        disposalReason: data.disposalReason,
      });
      return res.json();
    },
    onSuccess: () => {
      // Comprehensive refresh pattern like warehouse movements
      queryClient.invalidateQueries({ queryKey: ["/api/reports/inventory-stock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/disposed-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/inventory-movement"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouses/stats"] });
      
      toast({
        title: "Success",
        description: "Inventory disposed successfully",
      });
      disposalForm.reset();
      setIsDisposalDialogOpen(false);
      setDisposalItem(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to dispose inventory",
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
  const sortedInventory = (inventory ?? []).slice().sort(
    (a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
  );



  const filteredInventory = sortedInventory && Array.isArray(sortedInventory)
    ? sortedInventory.filter((item: any) => {
        const matchesSearch = 
          item.item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.item.sku.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesWarehouse = 
          warehouseFilter === "all" || 
          item.warehouseId.toString() === warehouseFilter;
        
        return matchesSearch && matchesWarehouse;
      })
    : [];
  // Filter warehouses for the Update Inventory dropdown
  const filteredWarehouses =
    warehouses && Array.isArray(warehouses)
      ? warehouses.filter((w: any) => {
          if (user?.role === "admin") {
            // 🟢 Admin: see all warehouses
            return true;
          }

          if (user?.role === "manager") {
            // 🟠 Manager: only their own warehouses
            return w.managerId === user.id;
          }

          // 🔵 Manager of managers: warehouses managed by their sub-managers
          const isSubManagerWarehouse =
            w.manager?.managerId && w.manager.managerId === user.id;

          return isSubManagerWarehouse;
        })
      : [];


  const isManager = user?.role === "admin" || user?.role === "manager";

  if (inventoryLoading || itemsLoading || warehousesLoading) {
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
                setRefreshKey(prev => prev + 1);
                toast({
                  title: "Data refreshed",
                  description: "Inventory data has been updated successfully.",
                });
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
          <DataTablePagination data={filteredInventory}>
            {(paginatedInventory) => (
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
                      {user?.role === "admin" && <TableHead>Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedInventory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                          No inventory items found
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedInventory.map((inv: any) => (
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
                          {user?.role === "admin" && (
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDisposalItem(inv);
                                  disposalForm.setValue("quantity", inv.quantity.toString());
                                  setIsDisposalDialogOpen(true);
                                }}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Dispose
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </DataTablePagination>
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
                    {filteredWarehouses.length > 0 ? (
                      filteredWarehouses.map((warehouse: any) => (
                        <SelectItem key={warehouse.id} value={warehouse.id.toString()}>
                          {warehouse.name}
                          <span
                            className={
                              warehouse.capacity - warehouse.totalItems > 0
                                ? "text-green-600 text-xs ml-1"
                                : "text-red-600 text-xs ml-1"
                            }
                          >
                            (Available Space: {warehouse.capacity - warehouse.totalItems})
                          </span>
                        </SelectItem>
                      ))
                    ) : (
                      <div className="p-2 text-sm text-gray-500">
                        No accessible warehouses available
                      </div>
                    )}
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
                    .sort((a: any, b: any) => {
                      const dateA = a.checkInDate || a.createdAt;
                      const dateB = b.checkInDate || b.createdAt;
                      return new Date(dateB).getTime() - new Date(dateA).getTime();
                    })
                    .map((transaction: any) => (
                      <TableRow key={transaction.id}>
                        <TableCell>
                          {transaction.checkInDate ? formatDateTime(transaction.checkInDate) : formatDateTime(transaction.createdAt)}
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTransactionTypeColor(transaction.transactionType)}`}>
                            {transaction.transactionType === "check-in" ? "Check-in" : 
                            transaction.transactionType === "issue" ? "Issue" : "Transfer"}
                          </span>
                        </TableCell>
                        <TableCell className=
                           {transaction.transactionType === "issue" ? 'text-red-600' : transaction.transactionType === 'check-in' ? 'text-green-600': transaction.transactionType==='transfer' && transaction.status==='completed' ? 'text-black-500' : transaction.status==='restocked'?' text-black-500':'text-red-600'}
                      >
                          {transaction.transactionType === "issue" ? '-' : transaction.transactionType === 'check-in' ? '+': transaction.transactionType==='transfer' && transaction.status==='completed' ? '' : transaction.status==='restocked'?'':'-'}
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

      {/* Disposal Dialog */}
      <Dialog open={isDisposalDialogOpen} onOpenChange={setIsDisposalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Dispose Inventory
            </DialogTitle>
            <DialogDescription>
              {disposalItem && (
                <div className="space-y-2">
                  <p>You are about to dispose inventory for:</p>
                  <div className="bg-gray-50 p-3 rounded">
                    <p><strong>Item:</strong> {disposalItem.item?.name} ({disposalItem.item?.sku})</p>
                    <p><strong>Warehouse:</strong> {disposalItem.warehouse?.name}</p>
                    <p><strong>Available Quantity:</strong> {disposalItem.quantity}</p>
                  </div>
                  <p className="text-sm text-red-600">
                    This action cannot be undone. The disposed items will be recorded in the disposal report.
                  </p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={disposalForm.handleSubmit((data) => disposeInventoryMutation.mutate(data))}>
            <div className="space-y-4">
              <div>
                <Label htmlFor="disposalQuantity">Quantity to Dispose</Label>
                <Input
                  id="disposalQuantity"
                  type="number"
                  min="1"
                  max={disposalItem?.quantity || 0}
                  {...disposalForm.register("quantity")}
                  placeholder="Enter quantity"
                />
                {disposalForm.formState.errors.quantity && (
                  <p className="text-sm text-red-500 mt-1">
                    {disposalForm.formState.errors.quantity.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="disposalReason">Disposal Reason</Label>
                <Input
                  id="disposalReason"
                  {...disposalForm.register("disposalReason")}
                  placeholder="Enter reason for disposal (e.g., damaged, expired, obsolete)"
                />
                {disposalForm.formState.errors.disposalReason && (
                  <p className="text-sm text-red-500 mt-1">
                    {disposalForm.formState.errors.disposalReason.message}
                  </p>
                )}
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsDisposalDialogOpen(false);
                  setDisposalItem(null);
                  disposalForm.reset();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={disposeInventoryMutation.isPending}
              >
                {disposeInventoryMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Disposing...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Dispose Inventory
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
