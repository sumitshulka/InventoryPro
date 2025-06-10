import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { useForm, useFieldArray } from "react-hook-form";
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, CalendarIcon, Plus, Trash2, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { formatDateTime, getStatusColor, cn } from "@/lib/utils";

const itemSchema = z.object({
  itemId: z.string().min(1, { message: "Item is required" }),
  quantity: z.string().min(1, { message: "Quantity is required" }).refine(val => !isNaN(Number(val)) && Number(val) > 0, {
    message: "Quantity must be a positive number"
  }),
  cost: z.string().optional().refine(val => !val || (!isNaN(Number(val)) && Number(val) >= 0), {
    message: "Cost must be a valid number"
  }),
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

type FormValues = z.infer<typeof multiCheckInSchema>;

export default function CheckInPage() {
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: ["/api/items"],
  });

  const { data: warehouses, isLoading: warehousesLoading } = useQuery({
    queryKey: ["/api/warehouses"],
  });

  const { data: checkInTransactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ["/api/transactions/type/check-in"],
    refetchInterval: 5000,
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
          itemId: parseInt(item.itemId),
          quantity: parseInt(item.quantity),
          destinationWarehouseId: parseInt(values.destinationWarehouseId),
          requesterId: user?.id,
          notes: values.notes || null,
          cost: item.cost ? parseFloat(item.cost) : null,
          transactionDate: values.checkInDate.toISOString(),
          purchaseOrderNumber: values.purchaseOrderNumber || null,
          deliveryChallanNumber: values.deliveryChallanNumber || null,
          supplierName: values.supplierName || null,
        };

        const result = await apiRequest("/api/transactions", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        
        results.push(result);
      }
      return results;
    },
    onSuccess: () => {
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
        description: `Successfully checked in ${values.items.length} item(s)`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to check in items: ${error.message}`,
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

  if (itemsLoading || warehousesLoading || transactionsLoading || usersLoading) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
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
                                {warehouses?.map((warehouse) => (
                                  <SelectItem key={warehouse.id} value={warehouse.id.toString()}>
                                    {warehouse.name}
                                  </SelectItem>
                                ))}
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
                                      {items?.map((item) => (
                                        <SelectItem key={item.id} value={item.id.toString()}>
                                          {item.name} ({item.sku})
                                        </SelectItem>
                                      ))}
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
                                  <FormLabel>Cost ({organizationSettings?.currencySymbol || "$"})</FormLabel>
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
                        <TableHead>Price ({organizationSettings?.currencySymbol || "$"})</TableHead>
                        <TableHead>Warehouse</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>PO Number</TableHead>
                        <TableHead>Supplier</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {checkInTransactions && checkInTransactions.length > 0 ? (
                        checkInTransactions.map((transaction) => {
                          const item = items?.find(i => i.id === transaction.itemId);
                          const warehouse = warehouses?.find(w => w.id === transaction.destinationWarehouseId);
                          const requester = users?.find(u => u.id === transaction.requesterId);
                          
                          // Fix date formatting - use simple date formatting
                          const formatTransactionDate = (dateString: string) => {
                            try {
                              const date = new Date(dateString);
                              if (isNaN(date.getTime())) {
                                return "Invalid Date";
                              }
                              return date.toLocaleDateString() + " " + date.toLocaleTimeString();
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
                                {transaction.cost ? 
                                  `${organizationSettings?.currencySymbol || "$"}${Number(transaction.cost).toFixed(2)}` : 
                                  "-"
                                }
                              </TableCell>
                              <TableCell>{warehouse?.name || "Unknown Warehouse"}</TableCell>
                              <TableCell>{formatTransactionDate(transaction.transactionDate)}</TableCell>
                              <TableCell>
                                <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(transaction.status)}`}>
                                  {transaction.status}
                                </span>
                              </TableCell>
                              <TableCell>{transaction.purchaseOrderNumber || "-"}</TableCell>
                              <TableCell>{transaction.supplierName || "-"}</TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
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
    </AppLayout>
  );
}