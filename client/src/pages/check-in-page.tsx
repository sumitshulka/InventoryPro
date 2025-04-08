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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { Loader2, CalendarIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { formatDateTime, getStatusColor, cn } from "@/lib/utils";

const formSchema = z.object({
  itemId: z.string().min(1, { message: "Item is required" }),
  quantity: z.string().min(1, { message: "Quantity is required" }).transform(val => parseInt(val)),
  destinationWarehouseId: z.string().min(1, { message: "Destination warehouse is required" }),
  cost: z.string().optional().transform(val => val ? parseFloat(val) : undefined),
  requesterId: z.string().optional(),
  checkInDate: z.date().optional(),
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

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["/api/users"],
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      itemId: "",
      quantity: "",
      destinationWarehouseId: "",
      cost: "",
      requesterId: "",
      checkInDate: new Date(),
    },
  });

  const checkInMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      if (!data.itemId || !data.quantity || !data.destinationWarehouseId) {
        throw new Error("Please fill in all required fields");
      }

      const payload = {
        itemId: parseInt(data.itemId),
        quantity: parseInt(data.quantity),
        transactionType: "check-in" as const,
        destinationWarehouseId: parseInt(data.destinationWarehouseId),
        status: "completed" as const,
        cost: data.cost && data.cost !== "" ? parseFloat(data.cost) : undefined,
        requesterId: data.requesterId && data.requesterId !== "" ? parseInt(data.requesterId) : undefined,
        checkInDate: data.checkInDate instanceof Date ? data.checkInDate.toISOString() : new Date().toISOString(),
        sourceWarehouseId: undefined
      };

      try {
        const res = await apiRequest("POST", "/api/transactions", payload);
        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.message || "Failed to create check-in transaction");
        }
        return res.json();
      } catch (error: any) {
        throw new Error(error.message || "Failed to create check-in transaction");
      }
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
        cost: "",
        requesterId: "",
        checkInDate: new Date(),
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

              <div className="space-y-2">
                <Label htmlFor="cost">Procurement Cost (Optional)</Label>
                <Input
                  id="cost"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Enter cost"
                  {...form.register("cost")}
                />
                {form.formState.errors.cost && (
                  <p className="text-sm text-red-500">{form.formState.errors.cost.message}</p>
                )}
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
                        !form.getValues("checkInDate") && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.getValues("checkInDate") ? format(new Date(form.getValues("checkInDate")), "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={form.getValues("checkInDate")}
                      onSelect={(date) => {
                        form.setValue("checkInDate", date || undefined);
                      }}
                      disabled={(date) => date > new Date()}
                      initialFocus
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
                    {users?.map((u: any) => (
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
                    <TableHead>Cost</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Check-In Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {checkInTransactions?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                        No check-in transactions found
                      </TableCell>
                    </TableRow>
                  ) : (
                    checkInTransactions?.slice(0, 10).map((transaction: any) => {
                      // Find associated item and warehouse
                      const item = items?.find((i: any) => i.id === transaction.itemId);
                      const warehouse = warehouses?.find((w: any) => w.id === transaction.destinationWarehouseId);
                      const requester = users?.find((u: any) => u.id === transaction.requesterId);

                      return (
                        <TableRow key={transaction.id}>
                          <TableCell className="font-medium">{transaction.transactionCode}</TableCell>
                          <TableCell>{item ? item.name : `Item #${transaction.itemId}`}</TableCell>
                          <TableCell>{transaction.quantity}</TableCell>
                          <TableCell>
                            {transaction.cost ? `$${parseFloat(transaction.cost).toFixed(2)}` : '-'}
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