import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { z } from "zod";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import AppLayout from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Loader2,
  ArrowLeft,
  Save,
  Send,
  Check,
  X,
  Truck,
  Package,
  Building2,
  Calendar,
  User,
  Clock,
  Plus,
  Trash,
  FileText,
  History,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useCurrency } from "@/hooks/use-currency";
import { format } from "date-fns";
import { Client, Warehouse, Item } from "@shared/schema";

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  INR: "₹",
  JPY: "¥",
  CAD: "C$",
  AUD: "A$",
  CHF: "CHF",
  CNY: "¥",
  SGD: "S$",
  AED: "د.إ",
  SAR: "﷼",
};

const getCurrencySymbol = (currencyCode: string | undefined | null): string => {
  if (!currencyCode) return "$";
  return CURRENCY_SYMBOLS[currencyCode] || currencyCode + " ";
};

interface EnrichedInventory {
  id: number;
  itemId: number;
  warehouseId: number;
  quantity: number;
  item?: Item;
}

interface OrderItem {
  id?: number;
  itemId: number;
  quantity: number;
  unitPrice: string;
  taxPercent: string;
  taxAmount: string;
  lineTotal: string;
  dispatchedQuantity?: number;
  notes?: string;
  item?: Item;
}

interface Dispatch {
  id: number;
  dispatchCode: string;
  dispatchedBy: number;
  dispatchDate: string;
  courierName: string;
  trackingNumber?: string;
  vehicleNumber?: string;
  driverName?: string;
  driverContact?: string;
  status: string;
  deliveredAt?: string;
  notes?: string;
  items: any[];
  dispatcher?: { id: number; name: string };
}

interface Approval {
  id: number;
  approverId: number;
  approvalLevel: string;
  status: string;
  comments?: string;
  approvedAt?: string;
  approver?: { id: number; name: string };
}

interface SalesOrderDetail {
  id: number;
  orderCode: string;
  clientId: number;
  warehouseId: number;
  status: string;
  orderDate: string;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  currencyCode?: string;
  conversionRate?: string;
  subtotalBase?: string;
  totalTaxBase?: string;
  totalAmountBase?: string;
  shippingAddress?: string;
  notes?: string;
  createdBy: number;
  createdAt: string;
  client?: Client;
  warehouse?: Warehouse;
  creator?: { id: number; name: string };
  items: OrderItem[];
  approvals: Approval[];
  dispatches: Dispatch[];
}

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  waiting_approval: "bg-yellow-100 text-yellow-800",
  approved: "bg-blue-100 text-blue-800",
  partial_shipped: "bg-purple-100 text-purple-800",
  closed: "bg-green-100 text-green-800",
};

const statusLabels: Record<string, string> = {
  draft: "Draft",
  waiting_approval: "Waiting Approval",
  approved: "Approved",
  partial_shipped: "Partially Shipped",
  closed: "Closed",
};

const orderFormSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  warehouseId: z.string().min(1, "Warehouse is required"),
  orderDate: z.string(),
  shippingAddress: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    itemId: z.number(),
    quantity: z.number().min(1, "Quantity must be at least 1"),
    unitPrice: z.string(),
    taxPercent: z.string(),
    taxAmount: z.string(),
    lineTotal: z.string(),
    notes: z.string().optional(),
  })).min(1, "At least one item is required"),
});

type OrderFormValues = z.infer<typeof orderFormSchema>;

const dispatchFormSchema = z.object({
  courierName: z.string().min(1, "Courier name is required"),
  trackingNumber: z.string().optional(),
  vehicleNumber: z.string().optional(),
  driverName: z.string().optional(),
  driverContact: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    salesOrderItemId: z.number(),
    quantity: z.number().min(1),
    notes: z.string().optional(),
  })),
});

type DispatchFormValues = z.infer<typeof dispatchFormSchema>;

export default function SalesOrderDetailPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { currency: orgCurrency, currencySymbol: orgCurrencySymbol } = useCurrency();
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/sales-orders/:id");
  const isNew = params?.id === "new";
  const orderId = isNew ? null : parseInt(params?.id || "0");

  const [showDispatchDialog, setShowDispatchDialog] = useState(false);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [approvalAction, setApprovalAction] = useState<"approve" | "reject">("approve");
  const [approvalComments, setApprovalComments] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(null);

  const canEdit = user?.role === "admin" || user?.role === "manager";
  const canApprove = user?.role === "admin" || user?.role === "manager";

  const { data: order, isLoading: orderLoading } = useQuery<SalesOrderDetail>({
    queryKey: ["/api/sales-orders", orderId],
    enabled: !!orderId,
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients/active"],
  });

  const { data: warehouses = [] } = useQuery<Warehouse[]>({
    queryKey: ["/api/warehouses"],
  });

  const { data: availableInventory = [] } = useQuery<EnrichedInventory[]>({
    queryKey: ["/api/warehouses", selectedWarehouseId, "available-inventory"],
    enabled: !!selectedWarehouseId,
  });

  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      clientId: "",
      warehouseId: "",
      orderDate: format(new Date(), "yyyy-MM-dd"),
      shippingAddress: "",
      notes: "",
      items: [],
    },
  });

  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const dispatchForm = useForm<DispatchFormValues>({
    resolver: zodResolver(dispatchFormSchema),
    defaultValues: {
      courierName: "",
      trackingNumber: "",
      vehicleNumber: "",
      driverName: "",
      driverContact: "",
      notes: "",
      items: [],
    },
  });

  useEffect(() => {
    if (order) {
      const clientId = order.clientId?.toString() || "";
      const warehouseId = order.warehouseId?.toString() || "";
      
      form.reset({
        clientId,
        warehouseId,
        orderDate: order.orderDate ? format(new Date(order.orderDate), "yyyy-MM-dd") : "",
        shippingAddress: order.shippingAddress || "",
        notes: order.notes || "",
        items: order.items.map(item => ({
          itemId: item.itemId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxPercent: item.taxPercent,
          taxAmount: item.taxAmount,
          lineTotal: item.lineTotal,
          notes: item.notes,
        })),
      });
      
      if (warehouseId) {
        setSelectedWarehouseId(parseInt(warehouseId));
      }
    }
  }, [order, form]);

  const watchWarehouseId = form.watch("warehouseId");
  useEffect(() => {
    if (watchWarehouseId) {
      setSelectedWarehouseId(parseInt(watchWarehouseId));
    }
  }, [watchWarehouseId]);

  const watchItems = form.watch("items");
  const calculateTotals = () => {
    const subtotal = watchItems.reduce((sum, item) => sum + parseFloat(item.lineTotal || "0"), 0);
    const taxAmount = watchItems.reduce((sum, item) => sum + parseFloat(item.taxAmount || "0"), 0);
    return {
      subtotal: subtotal.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      totalAmount: (subtotal + taxAmount).toFixed(2),
    };
  };

  const updateLineItemCalculations = (index: number, quantity: number, unitPrice: string, taxPercent: string) => {
    const price = parseFloat(unitPrice) || 0;
    const tax = parseFloat(taxPercent) || 0;
    const lineSubtotal = quantity * price;
    const taxAmount = (lineSubtotal * tax) / 100;
    
    update(index, {
      ...watchItems[index],
      quantity,
      unitPrice,
      taxPercent,
      taxAmount: taxAmount.toFixed(2),
      lineTotal: lineSubtotal.toFixed(2),
    });
  };

  const saveMutation = useMutation({
    mutationFn: async (data: OrderFormValues) => {
      const totals = calculateTotals();
      const payload = {
        clientId: parseInt(data.clientId),
        warehouseId: parseInt(data.warehouseId),
        orderDate: data.orderDate,
        shippingAddress: data.shippingAddress,
        notes: data.notes,
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        totalAmount: totals.totalAmount,
        items: data.items,
      };
      
      if (isNew) {
        const res = await apiRequest("POST", "/api/sales-orders", payload);
        return res.json();
      } else {
        const res = await apiRequest("PATCH", `/api/sales-orders/${orderId}`, payload);
        return res.json();
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-orders"] });
      toast({
        title: isNew ? "Order created" : "Order saved",
        description: isNew ? "Sales order created successfully." : "Sales order saved successfully.",
      });
      if (isNew && data.id) {
        setLocation(`/sales-orders/${data.id}`);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error saving order",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/sales-orders/${orderId}/submit`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-orders", orderId] });
      toast({
        title: "Order submitted",
        description: "Sales order submitted for approval.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error submitting order",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ action, comments }: { action: "approve" | "reject"; comments: string }) => {
      const endpoint = action === "approve" ? "approve" : "reject";
      const res = await apiRequest("POST", `/api/sales-orders/${orderId}/${endpoint}`, { comments });
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-orders", orderId] });
      toast({
        title: variables.action === "approve" ? "Order approved" : "Order rejected",
        description: variables.action === "approve" 
          ? "Sales order has been approved." 
          : "Sales order has been rejected and returned to draft.",
      });
      setShowApprovalDialog(false);
      setApprovalComments("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error processing approval",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const dispatchMutation = useMutation({
    mutationFn: async (data: DispatchFormValues) => {
      const res = await apiRequest("POST", `/api/sales-orders/${orderId}/dispatch`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-orders", orderId] });
      toast({
        title: "Dispatch created",
        description: "Items have been dispatched successfully.",
      });
      setShowDispatchDialog(false);
      dispatchForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error creating dispatch",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/sales-orders/${orderId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-orders"] });
      toast({
        title: "Order deleted",
        description: "Sales order has been deleted.",
      });
      setLocation("/sales-orders");
    },
    onError: (error: Error) => {
      toast({
        title: "Error deleting order",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const openDispatchDialog = () => {
    if (order) {
      dispatchForm.reset({
        courierName: "",
        trackingNumber: "",
        vehicleNumber: "",
        driverName: "",
        driverContact: "",
        notes: "",
        items: order.items
          .filter(item => (item.quantity - (item.dispatchedQuantity || 0)) > 0)
          .map(item => ({
            salesOrderItemId: item.id!,
            quantity: item.quantity - (item.dispatchedQuantity || 0),
            notes: "",
          })),
      });
      setShowDispatchDialog(true);
    }
  };

  const handleApprovalClick = (action: "approve" | "reject") => {
    setApprovalAction(action);
    setShowApprovalDialog(true);
  };

  const onSubmit = (data: OrderFormValues) => {
    saveMutation.mutate(data);
  };

  const onDispatchSubmit = (data: DispatchFormValues) => {
    dispatchMutation.mutate(data);
  };

  const addLineItem = (inventoryItem: EnrichedInventory) => {
    const existingIndex = watchItems.findIndex(item => item.itemId === inventoryItem.itemId);
    if (existingIndex >= 0) {
      toast({
        title: "Item already added",
        description: "This item is already in the order.",
        variant: "destructive",
      });
      return;
    }

    append({
      itemId: inventoryItem.itemId,
      quantity: 1,
      unitPrice: "0",
      taxPercent: "0",
      taxAmount: "0",
      lineTotal: "0",
      notes: "",
    });
  };

  if (orderLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  const totals = calculateTotals();
  const isDraft = !order || order.status === "draft";
  const isWaitingApproval = order?.status === "waiting_approval";
  const canDispatch = order?.status === "approved" || order?.status === "partial_shipped";
  const hasRemainingItems = order?.items.some(item => (item.quantity - (item.dispatchedQuantity || 0)) > 0);

  return (
    <AppLayout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => setLocation("/sales-orders")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {isNew ? "New Sales Order" : order?.orderCode || "Sales Order"}
              </h1>
              {order && (
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={statusColors[order.status] || "bg-gray-100"}>
                    {statusLabels[order.status] || order.status}
                  </Badge>
                  {order.client && (
                    <span className="text-sm text-gray-500">
                      <Building2 className="h-3 w-3 inline mr-1" />
                      {order.client.companyName}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {isDraft && (
              <>
                <Button
                  variant="outline"
                  onClick={form.handleSubmit(onSubmit)}
                  disabled={saveMutation.isPending}
                  data-testid="button-save-order"
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Draft
                </Button>
                {!isNew && (
                  <Button
                    onClick={() => submitMutation.mutate()}
                    disabled={submitMutation.isPending || watchItems.length === 0}
                    data-testid="button-submit-order"
                  >
                    {submitMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Submit for Approval
                  </Button>
                )}
                {!isNew && canEdit && (
                  <Button
                    variant="destructive"
                    onClick={() => setDeleteDialogOpen(true)}
                    data-testid="button-delete-order"
                  >
                    <Trash className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                )}
              </>
            )}
            {isWaitingApproval && canApprove && (
              <>
                <Button
                  onClick={() => handleApprovalClick("approve")}
                  className="bg-green-600 hover:bg-green-700"
                  data-testid="button-approve-order"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Approve
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleApprovalClick("reject")}
                  data-testid="button-reject-order"
                >
                  <X className="h-4 w-4 mr-2" />
                  Reject
                </Button>
              </>
            )}
            {canDispatch && hasRemainingItems && (
              <Button onClick={openDispatchDialog} data-testid="button-dispatch">
                <Truck className="h-4 w-4 mr-2" />
                Create Dispatch
              </Button>
            )}
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <Tabs defaultValue="details" className="w-full">
              <TabsList>
                <TabsTrigger value="details">Order Details</TabsTrigger>
                <TabsTrigger value="items">Line Items ({watchItems.length})</TabsTrigger>
                {!isNew && <TabsTrigger value="history">History & Dispatches</TabsTrigger>}
              </TabsList>

              <TabsContent value="details" className="space-y-4 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Order Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField
                        control={form.control}
                        name="clientId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Client *</FormLabel>
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                              disabled={!isDraft}
                            >
                              <FormControl>
                                <SelectTrigger data-testid="select-client">
                                  <SelectValue placeholder="Select client" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {clients.map((client) => (
                                  <SelectItem key={client.id} value={client.id.toString()}>
                                    {client.companyName} ({client.clientCode})
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
                        name="warehouseId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Warehouse *</FormLabel>
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                              disabled={!isDraft}
                            >
                              <FormControl>
                                <SelectTrigger data-testid="select-warehouse">
                                  <SelectValue placeholder="Select warehouse" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {warehouses.map((wh) => (
                                  <SelectItem key={wh.id} value={wh.id.toString()}>
                                    {wh.name}
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
                        name="orderDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Order Date</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} disabled={!isDraft} data-testid="input-order-date" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Shipping & Notes</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField
                        control={form.control}
                        name="shippingAddress"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Shipping Address</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Enter shipping address (defaults from client if empty)"
                                {...field}
                                disabled={!isDraft}
                                data-testid="input-shipping-address"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Notes</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Additional notes"
                                {...field}
                                disabled={!isDraft}
                                data-testid="input-notes"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Order Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const selectedClientId = form.watch("clientId");
                      const selectedClient = clients.find(c => c.id.toString() === selectedClientId);
                      const clientCurrency = selectedClient?.currencyCode;
                      const orderCurrency = order?.currencyCode || clientCurrency || orgCurrency;
                      const orderCurrencySymbol = getCurrencySymbol(orderCurrency);
                      const showConversion = order?.currencyCode && order.currencyCode !== orgCurrency && order.conversionRate;
                      const conversionRate = parseFloat(order?.conversionRate || "1");
                      
                      const showClientCurrencyBanner = !order && clientCurrency && clientCurrency !== orgCurrency;
                      
                      return (
                        <>
                          {order?.currencyCode && order.currencyCode !== orgCurrency && (
                            <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-blue-700 font-medium">
                                  Order Currency: {order.currencyCode}
                                </span>
                                <span className="text-blue-600">
                                  Conversion Rate: 1 {order.currencyCode} = {conversionRate.toFixed(4)} {orgCurrency}
                                </span>
                              </div>
                            </div>
                          )}
                          {showClientCurrencyBanner && (
                            <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                              <div className="text-sm text-blue-700 font-medium">
                                Client Currency: {clientCurrency} ({orderCurrencySymbol})
                              </div>
                              <div className="text-xs text-blue-600 mt-1">
                                Conversion rate will be set when order is saved
                              </div>
                            </div>
                          )}
                          <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                              <div className="text-2xl font-bold">{orderCurrencySymbol}{totals.subtotal}</div>
                              <div className="text-sm text-gray-500">Subtotal</div>
                              {showConversion && order.subtotalBase && (
                                <div className="text-xs text-gray-400 mt-1">
                                  ({orgCurrencySymbol}{parseFloat(order.subtotalBase).toFixed(2)} {orgCurrency})
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="text-2xl font-bold">{orderCurrencySymbol}{totals.taxAmount}</div>
                              <div className="text-sm text-gray-500">Tax</div>
                              {showConversion && order.totalTaxBase && (
                                <div className="text-xs text-gray-400 mt-1">
                                  ({orgCurrencySymbol}{parseFloat(order.totalTaxBase).toFixed(2)} {orgCurrency})
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="text-2xl font-bold text-primary">{orderCurrencySymbol}{totals.totalAmount}</div>
                              <div className="text-sm text-gray-500">Total</div>
                              {showConversion && order.totalAmountBase && (
                                <div className="text-xs text-gray-400 mt-1">
                                  ({orgCurrencySymbol}{parseFloat(order.totalAmountBase).toFixed(2)} {orgCurrency})
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="items" className="space-y-4 mt-4">
                {isDraft && selectedWarehouseId && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        Available Inventory
                      </CardTitle>
                      <CardDescription>
                        Click on an item to add it to the order
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                        {availableInventory.map((inv) => (
                          <Button
                            key={inv.id}
                            type="button"
                            variant="outline"
                            className="flex flex-col h-auto p-3 text-left"
                            onClick={() => addLineItem(inv)}
                            data-testid={`button-add-item-${inv.itemId}`}
                          >
                            <span className="font-medium text-sm truncate w-full">
                              {inv.item?.name || `Item #${inv.itemId}`}
                            </span>
                            <span className="text-xs text-gray-500">
                              Qty: {inv.quantity}
                            </span>
                          </Button>
                        ))}
                        {availableInventory.length === 0 && (
                          <div className="col-span-full text-center text-gray-500 py-4">
                            No inventory available in selected warehouse
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Order Line Items</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {fields.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        No items added yet. Select a warehouse and add items from available inventory.
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Item</TableHead>
                            <TableHead className="w-24">Quantity</TableHead>
                            <TableHead className="w-32">Unit Price</TableHead>
                            <TableHead className="w-24">Tax %</TableHead>
                            <TableHead className="w-28">Tax Amount</TableHead>
                            <TableHead className="w-32">Line Total</TableHead>
                            {!isNew && <TableHead className="w-24">Dispatched</TableHead>}
                            {isDraft && <TableHead className="w-16"></TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {fields.map((field, index) => {
                            const inventoryItem = availableInventory.find(i => i.itemId === field.itemId);
                            const orderItem = order?.items.find(i => i.itemId === field.itemId);
                            return (
                              <TableRow key={field.id}>
                                <TableCell>
                                  <div className="font-medium">
                                    {inventoryItem?.item?.name || orderItem?.item?.name || `Item #${field.itemId}`}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {inventoryItem?.item?.sku || orderItem?.item?.sku}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    min={1}
                                    {...form.register(`items.${index}.quantity`, { valueAsNumber: true })}
                                    onChange={(e) => {
                                      const qty = parseInt(e.target.value) || 1;
                                      updateLineItemCalculations(
                                        index,
                                        qty,
                                        watchItems[index].unitPrice,
                                        watchItems[index].taxPercent
                                      );
                                    }}
                                    disabled={!isDraft}
                                    className="w-20"
                                    data-testid={`input-quantity-${index}`}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    {...form.register(`items.${index}.unitPrice`)}
                                    onChange={(e) => {
                                      updateLineItemCalculations(
                                        index,
                                        watchItems[index].quantity,
                                        e.target.value,
                                        watchItems[index].taxPercent
                                      );
                                    }}
                                    disabled={!isDraft}
                                    className="w-28"
                                    data-testid={`input-price-${index}`}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    {...form.register(`items.${index}.taxPercent`)}
                                    onChange={(e) => {
                                      updateLineItemCalculations(
                                        index,
                                        watchItems[index].quantity,
                                        watchItems[index].unitPrice,
                                        e.target.value
                                      );
                                    }}
                                    disabled={!isDraft}
                                    className="w-20"
                                    data-testid={`input-tax-${index}`}
                                  />
                                </TableCell>
                                <TableCell className="font-medium">
                                  ${watchItems[index]?.taxAmount || "0.00"}
                                </TableCell>
                                <TableCell className="font-medium">
                                  ${watchItems[index]?.lineTotal || "0.00"}
                                </TableCell>
                                {!isNew && (
                                  <TableCell>
                                    {orderItem?.dispatchedQuantity || 0} / {orderItem?.quantity || watchItems[index]?.quantity}
                                  </TableCell>
                                )}
                                {isDraft && (
                                  <TableCell>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => remove(index)}
                                      className="text-red-600 hover:text-red-700"
                                      data-testid={`button-remove-item-${index}`}
                                    >
                                      <Trash className="h-4 w-4" />
                                    </Button>
                                  </TableCell>
                                )}
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {!isNew && (
                <TabsContent value="history" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <History className="h-5 w-5" />
                        Approval History
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {order?.approvals && order.approvals.length > 0 ? (
                        <div className="space-y-3">
                          {order.approvals.map((approval) => (
                            <div
                              key={approval.id}
                              className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                            >
                              {approval.status === "approved" ? (
                                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                              ) : approval.status === "rejected" ? (
                                <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                              ) : (
                                <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                              )}
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{approval.approver?.name}</span>
                                  <Badge
                                    className={
                                      approval.status === "approved"
                                        ? "bg-green-100 text-green-800"
                                        : approval.status === "rejected"
                                        ? "bg-red-100 text-red-800"
                                        : "bg-yellow-100 text-yellow-800"
                                    }
                                  >
                                    {approval.status}
                                  </Badge>
                                </div>
                                {approval.comments && (
                                  <p className="text-sm text-gray-600 mt-1">{approval.comments}</p>
                                )}
                                {approval.approvedAt && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    {format(new Date(approval.approvedAt), "MMM dd, yyyy HH:mm")}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-center py-4">No approval history yet</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Truck className="h-5 w-5" />
                        Dispatch History
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {order?.dispatches && order.dispatches.length > 0 ? (
                        <div className="space-y-4">
                          {order.dispatches.map((dispatch) => (
                            <div key={dispatch.id} className="border rounded-lg p-4">
                              <div className="flex items-center justify-between mb-3">
                                <div>
                                  <span className="font-mono font-medium">{dispatch.dispatchCode}</span>
                                  <Badge
                                    className={
                                      dispatch.status === "delivered"
                                        ? "bg-green-100 text-green-800 ml-2"
                                        : "bg-blue-100 text-blue-800 ml-2"
                                    }
                                  >
                                    {dispatch.status}
                                  </Badge>
                                </div>
                                <span className="text-sm text-gray-500">
                                  {format(new Date(dispatch.dispatchDate), "MMM dd, yyyy HH:mm")}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm mb-3">
                                <div>
                                  <span className="text-gray-500">Courier:</span>{" "}
                                  <span className="font-medium">{dispatch.courierName}</span>
                                </div>
                                {dispatch.trackingNumber && (
                                  <div>
                                    <span className="text-gray-500">Tracking:</span>{" "}
                                    <span className="font-medium">{dispatch.trackingNumber}</span>
                                  </div>
                                )}
                                {dispatch.vehicleNumber && (
                                  <div>
                                    <span className="text-gray-500">Vehicle:</span>{" "}
                                    <span className="font-medium">{dispatch.vehicleNumber}</span>
                                  </div>
                                )}
                                <div>
                                  <span className="text-gray-500">By:</span>{" "}
                                  <span className="font-medium">{dispatch.dispatcher?.name}</span>
                                </div>
                              </div>
                              <div className="bg-gray-50 rounded p-2">
                                <p className="text-xs text-gray-500 mb-1">Dispatched Items:</p>
                                <div className="flex flex-wrap gap-2">
                                  {dispatch.items.map((di: any, idx: number) => (
                                    <span key={idx} className="text-xs bg-white px-2 py-1 rounded border">
                                      {di.item?.name || `Item #${di.itemId}`} x {di.quantity}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-center py-4">No dispatches yet</p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              )}
            </Tabs>
          </form>
        </Form>

        <Dialog open={showDispatchDialog} onOpenChange={setShowDispatchDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Dispatch</DialogTitle>
              <DialogDescription>
                Enter dispatch details and specify quantities to ship
              </DialogDescription>
            </DialogHeader>
            <Form {...dispatchForm}>
              <form onSubmit={dispatchForm.handleSubmit(onDispatchSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={dispatchForm.control}
                    name="courierName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Courier Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter courier name" {...field} data-testid="input-courier" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={dispatchForm.control}
                    name="trackingNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tracking Number</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter tracking number" {...field} data-testid="input-tracking" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={dispatchForm.control}
                    name="vehicleNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vehicle Number</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter vehicle number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={dispatchForm.control}
                    name="driverName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Driver Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter driver name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={dispatchForm.control}
                    name="driverContact"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Driver Contact</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter driver contact" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={dispatchForm.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Input placeholder="Additional notes" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="border-t pt-4">
                  <Label className="mb-2 block">Items to Dispatch</Label>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Remaining</TableHead>
                        <TableHead>Quantity to Dispatch</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dispatchForm.watch("items")?.map((di, index) => {
                        const orderItem = order?.items.find(i => i.id === di.salesOrderItemId);
                        const remaining = orderItem ? orderItem.quantity - (orderItem.dispatchedQuantity || 0) : 0;
                        return (
                          <TableRow key={index}>
                            <TableCell>
                              <div className="font-medium">{orderItem?.item?.name}</div>
                              <div className="text-xs text-gray-500">{orderItem?.item?.sku}</div>
                            </TableCell>
                            <TableCell>{remaining}</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={0}
                                max={remaining}
                                {...dispatchForm.register(`items.${index}.quantity`, { valueAsNumber: true })}
                                className="w-24"
                                data-testid={`input-dispatch-qty-${index}`}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setShowDispatchDialog(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={dispatchMutation.isPending} data-testid="button-confirm-dispatch">
                    {dispatchMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Create Dispatch
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {approvalAction === "approve" ? "Approve Order" : "Reject Order"}
              </DialogTitle>
              <DialogDescription>
                {approvalAction === "approve"
                  ? "This will approve the order and allow dispatching."
                  : "This will reject the order and return it to draft status."}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label>Comments</Label>
              <Textarea
                placeholder="Enter comments (optional for approval, recommended for rejection)"
                value={approvalComments}
                onChange={(e) => setApprovalComments(e.target.value)}
                className="mt-2"
                data-testid="input-approval-comments"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowApprovalDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => approveMutation.mutate({ action: approvalAction, comments: approvalComments })}
                disabled={approveMutation.isPending}
                className={approvalAction === "approve" ? "bg-green-600 hover:bg-green-700" : ""}
                variant={approvalAction === "reject" ? "destructive" : "default"}
                data-testid="button-confirm-approval"
              >
                {approveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {approvalAction === "approve" ? "Approve" : "Reject"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Sales Order</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this sales order? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteMutation.mutate()}
                className="bg-red-600 hover:bg-red-700"
                data-testid="button-confirm-delete"
              >
                {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
