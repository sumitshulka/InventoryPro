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
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { formatDateTime, getStatusColor } from "@/lib/utils";

const formSchema = z.object({
  itemId: z.string().min(1, { message: "Item is required" }),
  quantity: z.string().min(1, { message: "Quantity is required" }).transform(val => parseInt(val)),
  destinationWarehouseId: z.string().min(1, { message: "Destination warehouse is required" }),
});

type FormValues = z.infer<typeof formSchema>;

export default function CheckInPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isTransactionSuccess, setIsTransactionSuccess] = useState(false);

  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: ["/api/items"],
  });

  const { data: warehouses, isLoading: warehousesLoading } = useQuery({
    queryKey: ["/api/warehouses"],
  });

  const { data: checkInTransactions, isLoading: transactionsLoading, refetch: refetchTransactions } = useQuery({
    queryKey: ["/api/transactions/type/check-in"],
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      itemId: "",
      quantity: "",
      destinationWarehouseId: "",
    },
  });

  const checkInMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const payload = {
        itemId: parseInt(data.itemId),
        quantity: parseInt(data.quantity),
        transactionType: "check-in",
        destinationWarehouseId: parseInt(data.destinationWarehouseId),
        status: "completed"
      };
      
      const res = await apiRequest("POST", "/api/transactions", payload);
      return res.json();
    },
    onSuccess: () => {
      // Invalidate all relevant queries to update the UI
      queryClient.invalidateQueries({ queryKey: ["/api/transactions/type/check-in"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/inventory-stock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      
      toast({
        title: "Check-in successful",
        description: "The items have been checked into inventory successfully.",
      });
      form.reset({
        itemId: "",
        quantity: "",
        destinationWarehouseId: "",
      });
      setIsTransactionSuccess(true);
      setTimeout(() => setIsTransactionSuccess(false), 3000);
      refetchTransactions();
    },
    onError: (error: Error) => {
      toast({
        title: "Check-in failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (values: FormValues) => {
    checkInMutation.mutate(values);
  };

  const isManager = user?.role === "admin" || user?.role === "manager";

  if (itemsLoading || warehousesLoading || transactionsLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  // Only managers and admins can check-in items
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
                  You don't have permission to access this page. Only managers and administrators can check in inventory.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-medium text-gray-800">Inventory Check-In</h1>
          <p className="text-gray-600">Record new items arriving to your warehouses</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Card */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Check-In Form</CardTitle>
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
                <Label htmlFor="destinationWarehouseId">Destination Warehouse</Label>
                <Select
                  onValueChange={(value) => form.setValue("destinationWarehouseId", value)}
                  defaultValue={form.getValues("destinationWarehouseId")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a warehouse" />
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
                disabled={checkInMutation.isPending}
              >
                {checkInMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Check-In Items"
                )}
              </Button>
              
              {isTransactionSuccess && (
                <div className="bg-green-100 text-green-800 p-3 rounded-md text-sm">
                  Check-in completed successfully!
                </div>
              )}
            </form>
          </CardContent>
        </Card>

        {/* Recent Check-Ins Table */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Check-Ins</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transaction ID</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {checkInTransactions?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                        No check-in transactions found
                      </TableCell>
                    </TableRow>
                  ) : (
                    checkInTransactions?.slice(0, 10).map((transaction: any) => {
                      // Find associated item and warehouse
                      const item = items?.find((i: any) => i.id === transaction.itemId);
                      const warehouse = warehouses?.find((w: any) => w.id === transaction.destinationWarehouseId);
                      
                      return (
                        <TableRow key={transaction.id}>
                          <TableCell className="font-medium">{transaction.transactionCode}</TableCell>
                          <TableCell>{item ? item.name : `Item #${transaction.itemId}`}</TableCell>
                          <TableCell>{transaction.quantity}</TableCell>
                          <TableCell>{warehouse ? warehouse.name : `Warehouse #${transaction.destinationWarehouseId}`}</TableCell>
                          <TableCell>{formatDateTime(transaction.createdAt)}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(transaction.status)}`}>
                              {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                            </span>
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
