import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import AppLayout from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, CalendarIcon, Plus, Trash2, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { formatDateTime, getStatusColor, cn } from "@/lib/utils";

const itemSchema = z.object({
  itemId: z.string().min(1, { message: "Item is required" }),
  quantity: z.string().min(1, { message: "Quantity is required" }),
  cost: z.string().optional(),
});

const multiCheckInSchema = z.object({
  destinationWarehouseId: z.string().min(1, { message: "Destination warehouse is required" }),
  purchaseOrderNumber: z.string().optional(),
  deliveryChallanNumber: z.string().optional(),
  supplierName: z.string().optional(),
  notes: z.string().optional(),
  checkInDate: z.date(),
  items: z.array(itemSchema).min(1, { message: "At least one item is required" }),
});

type ItemFormValues = z.infer<typeof itemSchema>;
type MultiCheckInFormValues = z.infer<typeof multiCheckInSchema>;

export default function CheckInPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isTransactionSuccess, setIsTransactionSuccess] = useState(false);
  const [itemsToCheckIn, setItemsToCheckIn] = useState<ItemFormValues[]>([
    { itemId: "", quantity: "", cost: "" }
  ]);

  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: ["/api/items"],
  });

  const { data: warehouses, isLoading: warehousesLoading } = useQuery({
    queryKey: ["/api/warehouses"],
  });

  const { data: checkInTransactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ["/api/transactions/type/check-in"],
    refetchInterval: 5000, // Refresh every 5 seconds
    refetchIntervalInBackground: true,
  });

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["/api/users"],
  });

  const { data: organizationSettings } = useQuery<{
    id: number;
    organizationName: string;
    currency: string;
    currencySymbol: string;
    timezone: string;
  }>({
    queryKey: ["/api/organization-settings"],
  });

  const form = useForm<MultiCheckInFormValues>({
    resolver: zodResolver(multiCheckInSchema),
    defaultValues: {
      destinationWarehouseId: "",
      purchaseOrderNumber: "",
      deliveryChallanNumber: "",
      supplierName: "",
      notes: "",
      checkInDate: new Date(),
      items: [{ itemId: "", quantity: "", cost: "" }],
    },
  });

  const checkInMutation = useMutation({
    mutationFn: async (values: MultiCheckInFormValues) => {
      // Process each item in the multi-item check-in
      const results = [];
      
      for (const item of values.items) {
        const payload = {
          itemId: parseInt(item.itemId),
          quantity: parseInt(item.quantity),
          destinationWarehouseId: parseInt(values.destinationWarehouseId),
          transactionType: "check-in" as const,
          status: "completed" as const,
          cost: item.cost ? parseFloat(item.cost) : null,
          requesterId: null, // Multi-item check-ins don't have individual requesters
          sourceWarehouseId: null,
          checkInDate: values.checkInDate ? new Date(values.checkInDate) : undefined,
          purchaseOrderNumber: values.purchaseOrderNumber || null,
          deliveryChallanNumber: values.deliveryChallanNumber || null,
          supplierName: values.supplierName || null,
          notes: values.notes || null,
        };

        const response = await apiRequest("POST", "/api/transactions", payload);
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message);
        }
        results.push(await response.json());
      }
      
      return results;
    },
    onSuccess: (newTransaction) => {
      // Immediately update cache with new transaction
      queryClient.setQueryData(["/api/transactions/type/check-in"], (oldData: any) => {
        if (!oldData || !Array.isArray(oldData)) return [newTransaction];
        return [newTransaction, ...oldData];
      });

      // Force refetch without waiting
      queryClient.refetchQueries({ queryKey: ["/api/transactions/type/check-in"] });
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
        cost: "",
        requesterId: "",
        checkInDate: new Date(),
      });

      setIsTransactionSuccess(true);
      setTimeout(() => setIsTransactionSuccess(false), 3000);
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
    if (!values.itemId || !values.quantity || !values.destinationWarehouseId) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
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
                    {(items as any[])?.map((item: any) => (
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
                    {(warehouses as any[])?.filter((w: any) => w.isActive).map((warehouse: any) => (
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
                <Label htmlFor="cost">Procurement Cost (Optional)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {organizationSettings?.currencySymbol || '$'}
                  </span>
                  <Input
                    id="cost"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="pl-8"
                    {...form.register("cost")}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="checkInDate">Check-In Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !form.watch("checkInDate") && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.watch("checkInDate") ? format(form.watch("checkInDate"), "dd/MM/yyyy") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={form.watch("checkInDate")}
                      onSelect={(date) => form.setValue("checkInDate", date || new Date())}
                      disabled={(date) => date > new Date()}
                      initialFocus
                      fromDate={new Date(2020, 0, 1)}
                      toDate={new Date()}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="requesterId">Requested By (Optional)</Label>
                <Select
                  onValueChange={(value) => form.setValue("requesterId", value)}
                  defaultValue={form.getValues("requesterId")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a requester" />
                  </SelectTrigger>
                  <SelectContent>
                    {(users as any[])?.map((u: any) => (
                      <SelectItem key={u.id} value={u.id.toString()}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                    <TableHead>Cost</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Check-In Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(checkInTransactions as any[])?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                        No check-in transactions found
                      </TableCell>
                    </TableRow>
                  ) : (
                    (checkInTransactions as any[])?.slice(0, 10).map((transaction: any) => {
                      const item = (items as any[])?.find((i: any) => i.id === transaction.itemId);
                      const warehouse = (warehouses as any[])?.find((w: any) => w.id === transaction.destinationWarehouseId);

                      return (
                        <TableRow key={transaction.id}>
                          <TableCell className="font-medium">{transaction.transactionCode}</TableCell>
                          <TableCell>{item ? item.name : `Item #${transaction.itemId}`}</TableCell>
                          <TableCell>{transaction.quantity}</TableCell>
                          <TableCell>
                            {transaction.cost ? `${organizationSettings?.currencySymbol || '$'}${parseFloat(transaction.cost).toFixed(2)}` : '-'}
                          </TableCell>
                          <TableCell>{warehouse ? warehouse.name : `Warehouse #${transaction.destinationWarehouseId}`}</TableCell>
                          <TableCell>{formatDateTime(transaction.createdAt)}</TableCell>
                          <TableCell>
                            {transaction.checkInDate ? formatDateTime(transaction.checkInDate) : '-'}
                          </TableCell>
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