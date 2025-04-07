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
  });

  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: ["/api/items"],
  });

  const { data: warehouses, isLoading: warehousesLoading } = useQuery({
    queryKey: ["/api/warehouses"],
  });

  const { data: inventory, isLoading: inventoryLoading } = useQuery({
    queryKey: ["/api/reports/inventory-stock"],
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions/type/transfer"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/inventory-stock"] });
      toast({
        title: "Transfer initiated",
        description: "The inventory transfer has been initiated successfully.",
      });
      form.reset({
        itemId: "",
        quantity: "",
        sourceWarehouseId: "",
        destinationWarehouseId: "",
      });
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
    mutationFn: async (id: number) => {
      const res = await apiRequest("PUT", `/api/transactions/${id}/status`, { status: "completed" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions/type/transfer"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/inventory-stock"] });
      toast({
        title: "Transfer completed",
        description: "The inventory transfer has been completed successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (values: FormValues) => {
    // Check if source warehouse has enough inventory
    if (inventory) {
      const sourceInventory = inventory.find((inv: any) => 
        inv.itemId === parseInt(values.itemId) && 
        inv.warehouseId === parseInt(values.sourceWarehouseId)
      );
      
      if (!sourceInventory || sourceInventory.quantity < parseInt(values.quantity)) {
        toast({
          title: "Insufficient inventory",
          description: "The source warehouse does not have enough items to transfer.",
          variant: "destructive",
        });
        return;
      }
    }
    
    transferMutation.mutate(values);
  };

  const handleCompleteTransfer = (id: number) => {
    completeTransferMutation.mutate(id);
  };

  // Filter transfers based on active tab
  const filteredTransfers = transfers
    ? transfers.filter((transfer: any) => {
        if (activeTab === "all") return true;
        return transfer.status === activeTab;
      })
    : [];

  const isManager = user?.role === "admin" || user?.role === "manager";
  
  // Only managers and admins can initiate transfers
  if (!isManager) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <Card className="w-full max-w-md">
            <CardContent className="p-6">
              <div className="text-center">
                <span className="material-icons text-error text-4xl">error</span>
                <h2 className="text-xl font-semibold mt-4">Access Denied</h2>
                <p className="text-gray-600 mt-2">
                  You don't have permission to access this page. Only managers and administrators can manage inventory transfers.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (transfersLoading || itemsLoading || warehousesLoading || inventoryLoading) {
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
          <h1 className="text-2xl font-medium text-gray-800">Warehouse Transfers</h1>
          <p className="text-gray-600">Move inventory between warehouses</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Transfer Form */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Create Transfer</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="itemId">Select Item</Label>
                <Select
                  onValueChange={(value) => form.setValue("itemId", value)}
                  defaultValue={form.getValues("itemId")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an item" />
                  </SelectTrigger>
                  <SelectContent>
                    {items?.map((item: any) => (
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="sourceWarehouseId">Source Warehouse</Label>
                <Select
                  onValueChange={(value) => form.setValue("sourceWarehouseId", value)}
                  defaultValue={form.getValues("sourceWarehouseId")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select source warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses?.filter((w: any) => w.isActive).map((warehouse: any) => (
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
                <Label htmlFor="destinationWarehouseId">Destination Warehouse</Label>
                <Select
                  onValueChange={(value) => form.setValue("destinationWarehouseId", value)}
                  defaultValue={form.getValues("destinationWarehouseId")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select destination warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses?.filter((w: any) => w.isActive).map((warehouse: any) => (
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

              <Button
                type="submit"
                className="w-full"
                disabled={transferMutation.isPending}
              >
                {transferMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Initiate Transfer"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Transfers Table */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle>Transfer Transactions</CardTitle>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="in-transit">In Transit</TabsTrigger>
                <TabsTrigger value="completed">Completed</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transaction ID</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Source → Destination</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransfers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                        No transfers found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTransfers.map((transfer: any) => {
                      // Find associated item and warehouses
                      const item = items?.find((i: any) => i.id === transfer.itemId);
                      const sourceWarehouse = warehouses?.find((w: any) => w.id === transfer.sourceWarehouseId);
                      const destWarehouse = warehouses?.find((w: any) => w.id === transfer.destinationWarehouseId);
                      
                      return (
                        <TableRow key={transfer.id}>
                          <TableCell className="font-medium">{transfer.transactionCode}</TableCell>
                          <TableCell>{item ? item.name : `Item #${transfer.itemId}`}</TableCell>
                          <TableCell>{transfer.quantity}</TableCell>
                          <TableCell>
                            {sourceWarehouse ? sourceWarehouse.name : `Warehouse #${transfer.sourceWarehouseId}`} → {destWarehouse ? destWarehouse.name : `Warehouse #${transfer.destinationWarehouseId}`}
                          </TableCell>
                          <TableCell>{formatDateTime(transfer.createdAt)}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(transfer.status)}`}>
                              {transfer.status === "in-transit" ? "In Transit" : transfer.status.charAt(0).toUpperCase() + transfer.status.slice(1)}
                            </span>
                          </TableCell>
                          <TableCell>
                            {transfer.status === "in-transit" && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-green-600"
                                onClick={() => handleCompleteTransfer(transfer.id)}
                                disabled={completeTransferMutation.isPending}
                              >
                                {completeTransferMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    Complete
                                  </>
                                )}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

// Add missing import
import { useState } from "react";
