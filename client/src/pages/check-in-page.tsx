import { useState,useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, CalendarIcon, Plus, Trash2, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useCurrency } from "@/hooks/use-currency";
import { formatDateTime, cn } from "@/lib/utils";

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case "completed":
      return "bg-green-100 text-green-800";
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    case "in-transit":
    case "in transit":
      return "bg-blue-100 text-blue-800";
    case "cancelled":
      return "bg-gray-100 text-gray-800";
    case "rejected":
      return "bg-red-100 text-red-800";
    case "approved":
      return "bg-emerald-100 text-emerald-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

const itemSchema = z.object({
  itemId: z.string().min(1, { message: "Item is required" }),
  quantity: z.string().min(1, { message: "Quantity is required" }).refine(val => !isNaN(Number(val)) && Number(val) > 0, {
    message: "Quantity must be a positive number"
  }),
  cost: z.string().min(1,{message:"Cost is required"}).refine(val => !val || (!isNaN(Number(val)) && Number(val) >= 0), {
    message: "Cost must be a valid number"
  }),
});

const multiCheckInSchema = z.object({
  destinationWarehouseId: z.string().min(1, { message: "Destination warehouse is required" }),
  purchaseOrderNumber: z.string().min(1,{message:'Purchase Order Number is required'}),
  deliveryChallanNumber: z.string().optional(),
  supplierName: z.string().min(1,{message:'Supplier name is required'}),
  notes: z.string().optional(),
  checkInDate: z.date(),
  items: z.array(itemSchema).min(1, { message: "At least one item is required" }),
});

type FormValues = z.infer<typeof multiCheckInSchema>;

export default function CheckInPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { currencySymbol, formatCurrencyFull } = useCurrency();

  const { data: items = [], isLoading: itemsLoading } = useQuery<Array<{
    id: number;
    name: string;
    sku: string;
    description?: string;
    unitOfMeasure: string;
    categoryId: number;
  }>>({
    queryKey: ["/api/items"],
  });

  const { data: warehouses = [], isLoading: warehousesLoading } = useQuery<Array<{
    id: number;
    name: string;
    location: string;
    managerId?: number;
    isActive:boolean;
    capacity:number;
    totalItems:number
  }>>({
    queryKey: ["/api/warehouses/stats"],
  });

  const { data: userOperatedWarehouses = [], isLoading: operatedWarehousesLoading } = useQuery<number[]>({
    queryKey: ["/api/users", user?.id, "operated-warehouses"],
    enabled: !!user?.id,
  });

  const { data: checkInTransactions = [], isLoading: transactionsLoading } = useQuery<Array<{
    id: number;
    transactionCode: string;
    itemId: number;
    quantity: number;
    cost?: string;
    rate?: string;
    status?: string;
    poNumber?: string;
    deliveryChallanNumber?: string;
    supplierName?: string;
    destinationWarehouseId?: number;
    requesterId?: number;
    checkInDate?: string;
    createdAt: string;
    item?: any;
    user?: any;
    destinationWarehouse?: any;
  }>>({
    queryKey: ["/api/transactions/type/check-in"],
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  });
    const sortedCheckInTransactions = useMemo(() => {
    return [...(checkInTransactions || [])].sort((a, b) => {
      const da = new Date(a.checkInDate || a.createdAt).getTime();
      const db = new Date(b.checkInDate || b.createdAt).getTime();
      return db - da;
    });
  }, [checkInTransactions]);
   warehouses.filter(id=>id.isActive===true);

  const { data: users = [], isLoading: usersLoading } = useQuery<Array<{
    id: number;
    name: string;
    username: string;
    role: string;
  }>>({
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

  const form = useForm<FormValues>({
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

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items"
  });

  const checkInMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const results = [];
      
      for (const item of values.items) {
        const payload = {
          transactionType: "check-in",
          itemId: parseInt(item.itemId),
          quantity: parseInt(item.quantity),
          destinationWarehouseId: parseInt(values.destinationWarehouseId),
          requesterId: user?.id,
          cost: item.cost ? parseFloat(item.cost) : null,
          rate: item.cost ? parseFloat(item.cost) : null,
          poNumber: values.purchaseOrderNumber || null,
          deliveryChallanNumber: values.deliveryChallanNumber || null,
          supplierName: values.supplierName || null,
          checkInDate: values.checkInDate.toISOString(),
          status: "completed"
        };

        const result = await apiRequest("POST", "/api/transactions", payload);
        
        results.push(result);
      }
      return results;
    },
    onSuccess: (data, variables) => {
      form.reset({
        destinationWarehouseId: "",
        purchaseOrderNumber: "",
        deliveryChallanNumber: "",
        supplierName: "",
        notes: "",
        checkInDate: new Date(),
        items: [{ itemId: "", quantity: "", cost: "" }],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions/type/check-in"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/inventory-stock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouses/stats"] });
      toast({
        title: "Success",
        description: `Successfully checked in ${variables.items.length} item(s)`,
      });
    },
    onError: (error: Error) => {
      
      toast({
        title: "Error",
        description: `${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (values: FormValues) => {
    if (!user) {
      toast({
        title: "Error",
        description: "User not authenticated",
        variant: "destructive",
      });
      return;
    }
    checkInMutation.mutate(values);
  };

  // Filter warehouses based on user permissions
  const availableWarehouses = user?.role === 'admin' || user?.role === 'manager' 
    ? warehouses 
    : warehouses.filter(warehouse => userOperatedWarehouses.includes(warehouse.id));

  // Check if user has permission to access check-in functionality
  const hasCheckInPermission = user?.role === 'admin' || user?.role === 'manager' || userOperatedWarehouses.length > 0;

  if (itemsLoading || warehousesLoading || transactionsLoading || usersLoading || operatedWarehousesLoading) {
    return (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
    );
  }

  if (!hasCheckInPermission) {
    return (
        <div className="flex justify-center items-center h-64">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-center">Access Restricted</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-center text-muted-foreground">
                You don't have permission to access the check-in functionality. 
                Only warehouse managers, admins, and warehouse operators can perform check-in operations.
              </p>
            </CardContent>
          </Card>
        </div>
    );
  }

  return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Check In Items</h1>
          <Package className="h-8 w-8 text-primary" />
        </div>

        <Tabs defaultValue="check-in" className="space-y-6">
          <TabsList>
            <TabsTrigger value="check-in">Check In Items</TabsTrigger>
            <TabsTrigger value="history">Check In History</TabsTrigger>
          </TabsList>

          <TabsContent value="check-in" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Multi-Item Check In</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="destinationWarehouseId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Destination Warehouse *</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select warehouse" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {availableWarehouses.length > 0 ? (
                                  availableWarehouses.map((warehouse) => (
                                    <SelectItem key={warehouse.id} value={warehouse.id.toString()}>
                                      {warehouse.name}  <span  className={warehouse.capacity-warehouse.totalItems>0?"text-green-600":"text-red-600"}>  Available space: {warehouse.capacity-warehouse.totalItems}</span>
                                    </SelectItem>
                                  ))
                                ) : (
                                  <div className="p-2 text-sm text-gray-500">
                                    No warehouses available for check-in
                                  </div>
                                )}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="checkInDate"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>Check In Date *</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    className={cn(
                                      "w-full pl-3 text-left font-normal",
                                      !field.value && "text-muted-foreground"
                                    )}
                                  >
                                    {field.value ? (
                                      format(field.value, "PPP")
                                    ) : (
                                      <span>Pick a date</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  disabled={(date) =>
                                    date > new Date() || date < new Date("1900-01-01")
                                  }
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="purchaseOrderNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Purchase Order Number</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter PO number" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="deliveryChallanNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Delivery Challan Number</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter delivery challan number" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="supplierName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Supplier Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter supplier name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label>Items to Check In *</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => append({ itemId: "", quantity: "", cost: "" })}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Item
                        </Button>
                      </div>

                      <div className="space-y-3">
                        {fields.map((field, index) => (
                          <div key={field.id} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border rounded-lg">
                            <FormField
                              control={form.control}
                              name={`items.${index}.itemId`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Item *</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select item" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {items.length > 0 ? (
                                        items.map((item) => (
                                          <SelectItem key={item.id} value={item.id.toString()}>
                                            {item.name} ({item.sku})
                                          </SelectItem>
                                        ))
                                      ) : (
                                        <div className="p-2 text-sm text-gray-500">
                                          No items available. Create items in Item Master first.
                                        </div>
                                      )}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`items.${index}.quantity`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Quantity *</FormLabel>
                                  <FormControl>
                                    <Input type="number" placeholder="Enter quantity" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`items.${index}.cost`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Unit Cost ({currencySymbol})</FormLabel>
                                  <FormControl>
                                    <Input type="number" step="0.01" placeholder="Enter cost" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <div className="flex items-end">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => remove(index)}
                                disabled={fields.length === 1}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Add any additional notes" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Requester</Label>
                        <Input
                          value={user?.name || ""}
                          readOnly
                          className="bg-gray-100"
                        />
                      </div>

                      <Button 
                        type="submit" 
                        className="w-full"
                        disabled={checkInMutation.isPending}
                      >
                        {checkInMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing Check In...
                          </>
                        ) : (
                          "Check In Items"
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Check-In Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                {transactionsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Transaction Code</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Unit Price ({currencySymbol})</TableHead>
                        <TableHead>Warehouse</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>PO Number</TableHead>
                        <TableHead>DC Number</TableHead>
                        <TableHead>Supplier</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedCheckInTransactions && sortedCheckInTransactions.length > 0 ? (
                        sortedCheckInTransactions.map((transaction) => {
                          const item = items?.find(i => i.id === transaction.itemId);
                          const warehouse = warehouses?.find(w => w.id === transaction.destinationWarehouseId);
                          const requester = users?.find(u => u.id === transaction.requesterId);
                          
                          // Fix date formatting - use checkInDate or fallback to createdAt
                          const formatTransactionDate = (transaction: any) => {
                            try {
                              const dateToUse = transaction.checkInDate || transaction.createdAt;
                              if (!dateToUse) return "No Date";
                              
                              const date = new Date(dateToUse);
                              if (isNaN(date.getTime())) {
                                return "Invalid Date";
                              }
                              return format(date, "PPp");
                            } catch (error) {
                              return "Invalid Date";
                            }
                          };
                          
                          return (
                            <TableRow key={transaction.id}>
                              <TableCell className="font-medium">{transaction.transactionCode}</TableCell>
                              <TableCell>{item?.name || "Unknown Item"}</TableCell>
                              <TableCell>{transaction.quantity}</TableCell>
                              <TableCell>
                                {transaction.rate ? 
                                  formatCurrencyFull(Number(transaction.rate)) : 
                                  (transaction.cost ? formatCurrencyFull(Number(transaction.cost)) : "-")
                                }
                              </TableCell>
                              <TableCell>{warehouse?.name || "Unknown Warehouse"}</TableCell>
                              <TableCell>{formatTransactionDate(transaction)}</TableCell>
                              <TableCell>
                                <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(transaction.status || "completed")}`}>
                                  {transaction.status || "completed"}
                                </span>
                              </TableCell>
                              <TableCell>{transaction.poNumber || "-"}</TableCell>
                              <TableCell>{transaction.deliveryChallanNumber || "-"}</TableCell>
                              <TableCell>{transaction.supplierName || "-"}</TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                            No check-in transactions found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
  );
}