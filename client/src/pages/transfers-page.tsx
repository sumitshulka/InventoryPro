import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { formatDateTime, getStatusColor, getTransactionTypeColor } from "@/lib/utils";

const formSchema = z.object({
  itemId: z.string().min(1, { message: "Item is required" }),
  quantity: z.string().min(1, { message: "Quantity is required" }).transform(val => parseInt(val)),
  sourceWarehouseId: z.string().min(1, { message: "Source warehouse is required" }),
  destinationWarehouseId: z.string().min(1, { message: "Destination warehouse is required" }),
}).refine(data => data.sourceWarehouseId !== data.destinationWarehouseId, {
  message: "Source and destination warehouses cannot be the same",
  path: ["destinationWarehouseId"],
});

type FormValues = z.infer<typeof formSchema>;

export default function TransfersPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("all");

  const { data: transfers, isLoading: transfersLoading } = useQuery({
    queryKey: ["/api/transactions/type/transfer"],
    refetchInterval: 5000, // Refresh every 5 seconds
    refetchIntervalInBackground: true,
  });

  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: ["/api/items"],
  });

  const { data: warehouses, isLoading: warehousesLoading } = useQuery({
    queryKey: ["/api/warehouses"],
  });

  const { data: userOperatedWarehouses = [], isLoading: operatedWarehousesLoading } = useQuery<number[]>({
    queryKey: ["/api/users", user?.id, "operated-warehouses"],
    enabled: !!user?.id,
  });

  const { data: inventory, isLoading: inventoryLoading } = useQuery({
    queryKey: ["/api/reports/inventory-stock"],
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      itemId: "",
      quantity: "",
      sourceWarehouseId: "",
      destinationWarehouseId: "",
    },
  });

  const transferMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const payload = {
        itemId: parseInt(data.itemId),
        quantity: data.quantity,
        transactionType: "transfer",
        sourceWarehouseId: parseInt(data.sourceWarehouseId),
        destinationWarehouseId: parseInt(data.destinationWarehouseId),
        status: "in-transit"
      };
      
      const res = await apiRequest("POST", "/api/transactions", payload);
      return res.json();
    },
    onSuccess: (newTransfer) => {
      // Immediately update cache with new transfer
      queryClient.setQueryData(["/api/transactions/type/transfer"], (oldData: any) => {
        if (!oldData || !Array.isArray(oldData)) return [newTransfer];
        return [newTransfer, ...oldData];
      });
      
      // Force refetch without waiting
      queryClient.refetchQueries({ queryKey: ["/api/transactions/type/transfer"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/inventory-stock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      
      toast({
        title: "Transfer initiated",
        description: "The inventory transfer has been initiated successfully.",
      });
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Transfer failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const completeTransferMutation = useMutation({
    mutationFn: async (transferId: number) => {
      const res = await apiRequest("PUT", `/api/transactions/${transferId}/status`, {
        status: "completed"
      });
      return res.json();
    },
    onSuccess: (updatedTransfer, transferId) => {
      // Immediately update the transfer status in cache
      queryClient.setQueryData(["/api/transactions/type/transfer"], (oldData: any) => {
        if (!oldData || !Array.isArray(oldData)) return oldData;
        return oldData.map((transfer: any) => 
          transfer.id === transferId 
            ? { ...transfer, status: "completed" }
            : transfer
        );
      });
      
      // Force refetch without waiting
      queryClient.refetchQueries({ queryKey: ["/api/transactions/type/transfer"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/inventory-stock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      
      toast({
        title: "Transfer completed",
        description: "The inventory transfer has been completed successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to complete transfer",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormValues) => {
    transferMutation.mutate(data);
  };

  const handleCompleteTransfer = (transferId: number) => {
    completeTransferMutation.mutate(transferId);
  };

  const getItemName = (itemId: number) => {
    const item = items && Array.isArray(items) ? items.find((item: any) => item.id === itemId) : null;
    return item ? `${item.name} (${item.sku})` : "Unknown Item";
  };

  const getWarehouseName = (warehouseId: number) => {
    const warehouse = warehouses && Array.isArray(warehouses) ? warehouses.find((w: any) => w.id === warehouseId) : null;
    return warehouse ? warehouse.name : "Unknown Warehouse";
  };

  const getAvailableStock = (itemId: string, warehouseId: string) => {
    if (!inventory || !Array.isArray(inventory)) return 0;
    const stock = inventory.find((inv: any) => 
      inv.itemId === parseInt(itemId) && inv.warehouseId === parseInt(warehouseId)
    );
    return stock ? stock.quantity : 0;
  };

  const filteredTransfers = transfers && Array.isArray(transfers) ? transfers.filter((transfer: any) => {
    if (activeTab === "all") return true;
    if (activeTab === "in-transit") return transfer.status === "in-transit";
    if (activeTab === "completed") return transfer.status === "completed";
    return true;
  }) : [];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Inventory Transfers</h1>
          <p className="text-muted-foreground">
            Transfer inventory between warehouses and track shipments
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">All Transfers</TabsTrigger>
            <TabsTrigger value="in-transit">In Transit</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Create Transfer Form */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Create Transfer</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="itemId">Item</Label>
                    <Select
                      value={form.watch("itemId")}
                      onValueChange={(value) => form.setValue("itemId", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select item" />
                      </SelectTrigger>
                      <SelectContent>
                        {items && Array.isArray(items) && items.map((item: any) => (
                          <SelectItem key={item.id} value={item.id.toString()}>
                            {item.name} ({item.sku})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.formState.errors.itemId && (
                      <p className="text-sm text-red-500">{form.formState.errors.itemId.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sourceWarehouseId">From Warehouse</Label>
                    <Select
                      value={form.watch("sourceWarehouseId")}
                      onValueChange={(value) => form.setValue("sourceWarehouseId", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select source warehouse" />
                      </SelectTrigger>
                      <SelectContent>
                        {warehouses && Array.isArray(warehouses) && warehouses.map((warehouse: any) => (
                          <SelectItem key={warehouse.id} value={warehouse.id.toString()}>
                            {warehouse.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.formState.errors.sourceWarehouseId && (
                      <p className="text-sm text-red-500">{form.formState.errors.sourceWarehouseId.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="destinationWarehouseId">To Warehouse</Label>
                    <Select
                      value={form.watch("destinationWarehouseId")}
                      onValueChange={(value) => form.setValue("destinationWarehouseId", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select destination warehouse" />
                      </SelectTrigger>
                      <SelectContent>
                        {warehouses && Array.isArray(warehouses) && warehouses.map((warehouse: any) => (
                          <SelectItem key={warehouse.id} value={warehouse.id.toString()}>
                            {warehouse.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.formState.errors.destinationWarehouseId && (
                      <p className="text-sm text-red-500">{form.formState.errors.destinationWarehouseId.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="quantity">Quantity</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="1"
                      placeholder="Enter quantity"
                      {...form.register("quantity")}
                    />
                    {form.formState.errors.quantity && (
                      <p className="text-sm text-red-500">{form.formState.errors.quantity.message}</p>
                    )}
                    {form.watch("itemId") && form.watch("sourceWarehouseId") && (
                      <p className="text-sm text-gray-500">
                        Available: {getAvailableStock(form.watch("itemId"), form.watch("sourceWarehouseId"))} units
                      </p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={transferMutation.isPending}
                  >
                    {transferMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating Transfer...
                      </>
                    ) : (
                      "Create Transfer"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Transfer List */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Transfer Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                {transfersLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Transaction Code</TableHead>
                          <TableHead>Item</TableHead>
                          <TableHead>From</TableHead>
                          <TableHead>To</TableHead>
                          <TableHead>Quantity</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredTransfers.length > 0 ? (
                          filteredTransfers.map((transfer: any) => (
                            <TableRow key={transfer.id}>
                              <TableCell className="font-medium">
                                {transfer.transactionCode}
                              </TableCell>
                              <TableCell>{getItemName(transfer.itemId)}</TableCell>
                              <TableCell>{getWarehouseName(transfer.sourceWarehouseId)}</TableCell>
                              <TableCell>{getWarehouseName(transfer.destinationWarehouseId)}</TableCell>
                              <TableCell>{transfer.quantity}</TableCell>
                              <TableCell>
                                <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(transfer.status)}`}>
                                  {transfer.status.charAt(0).toUpperCase() + transfer.status.slice(1)}
                                </span>
                              </TableCell>
                              <TableCell>{formatDateTime(transfer.createdAt)}</TableCell>
                              <TableCell>
                                {transfer.status === "in-transit" && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleCompleteTransfer(transfer.id)}
                                    disabled={completeTransferMutation.isPending}
                                  >
                                    {completeTransferMutation.isPending ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <CheckCircle className="h-4 w-4" />
                                    )}
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                              No transfers found
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </Tabs>
      </div>
    </AppLayout>
  );
}