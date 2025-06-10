import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import AppLayout from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Loader2, 
  Plus, 
  Eye, 
  Truck, 
  Package, 
  Clock, 
  CheckCircle, 
  X,
  Calendar,
  User,
  MapPin,
  Phone,
  FileText
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { formatDateTime, getStatusColor } from "@/lib/utils";

const transferItemSchema = z.object({
  itemId: z.string().min(1, { message: "Item is required" }),
  requestedQuantity: z.string().min(1, { message: "Quantity is required" }),
});

const formSchema = z.object({
  sourceWarehouseId: z.string().min(1, { message: "Source warehouse is required" }),
  destinationWarehouseId: z.string().min(1, { message: "Destination warehouse is required" }),
  transferMode: z.string().min(1, { message: "Transfer mode is required" }),
  expectedShipmentDate: z.string().optional(),
  expectedArrivalDate: z.string().optional(),
  courierName: z.string().optional(),
  handoverPersonName: z.string().optional(),
  handoverPersonContact: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(transferItemSchema).min(1, { message: "At least one item is required" }),
});

type FormValues = z.infer<typeof formSchema>;

const receiptSchema = z.object({
  receiptNumber: z.string().min(1, "Receipt number is required"),
  handoverDate: z.string().min(1, "Handover date is required"),
  notes: z.string().optional(),
});

const acceptanceSchema = z.object({
  receivedDate: z.string().min(1, "Received date is required"),
  overallCondition: z.string().min(1, "Overall condition is required"),
  receiverNotes: z.string().optional(),
  items: z.array(z.object({
    itemId: z.number(),
    actualQuantity: z.number().min(0, "Quantity cannot be negative"),
    condition: z.string().min(1, "Condition is required"),
    notes: z.string().optional(),
  })),
});

type ReceiptFormValues = z.infer<typeof receiptSchema>;
type AcceptanceFormValues = z.infer<typeof acceptanceSchema>;

export default function EnhancedTransfersPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [acceptanceDialogOpen, setAcceptanceDialogOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("all");

  const { data: transfers, isLoading: transfersLoading } = useQuery({
    queryKey: ["/api/transfers"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: ["/api/items"],
  });

  const { data: inventory } = useQuery({
    queryKey: ["/api/inventory"],
  });

  const { data: warehouses, isLoading: warehousesLoading } = useQuery({
    queryKey: ["/api/warehouses"],
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      sourceWarehouseId: user?.warehouseId ? user.warehouseId.toString() : "",
      destinationWarehouseId: "",
      transferMode: "courier",
      expectedShipmentDate: "",
      expectedArrivalDate: "",
      courierName: "",
      handoverPersonName: "",
      handoverPersonContact: "",
      notes: "",
      items: [{ itemId: "", requestedQuantity: "1" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const receiptForm = useForm<ReceiptFormValues>({
    resolver: zodResolver(receiptSchema),
    defaultValues: {
      receiptNumber: "",
      handoverDate: "",
      notes: "",
    },
  });

  const acceptanceForm = useForm<AcceptanceFormValues>({
    resolver: zodResolver(acceptanceSchema),
    defaultValues: {
      receivedDate: "",
      overallCondition: "good",
      receiverNotes: "",
      items: [],
    },
  });

  const createTransferMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const transferData = {
        ...data,
        expectedShipmentDate: data.expectedShipmentDate ? new Date(data.expectedShipmentDate) : null,
        expectedArrivalDate: data.expectedArrivalDate ? new Date(data.expectedArrivalDate) : null,
        sourceWarehouseId: parseInt(data.sourceWarehouseId),
        destinationWarehouseId: parseInt(data.destinationWarehouseId),
        items: data.items.map(item => ({
          itemId: parseInt(item.itemId),
          requestedQuantity: typeof item.requestedQuantity === 'string' ? parseInt(item.requestedQuantity) : item.requestedQuantity,
        })),
      };

      const response = await fetch("/api/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(transferData),
      });

      if (!response.ok) {
        throw new Error(`Failed to create transfer: ${response.statusText}`);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transfers"] });
      setIsDialogOpen(false);
      form.reset();
      toast({
        title: "Success",
        description: "Transfer created successfully",
      });
      
      // Auto-refresh after 2 seconds to ensure table is updated
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/transfers"] });
      }, 2000);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create transfer",
        variant: "destructive",
      });
    },
  });

  const updateTransferMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const response = await fetch(`/api/transfers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`Failed to update transfer: ${response.statusText}`);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transfers"] });
      toast({
        title: "Success",
        description: "Transfer updated successfully",
      });
      
      // Auto-refresh after 2 seconds to ensure table is updated
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/transfers"] });
      }, 2000);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update transfer",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: FormValues) => {
    createTransferMutation.mutate(data);
  };

  const handleUpdateStatus = (transferId: number, newStatus: string, updateData: any = {}) => {
    updateTransferMutation.mutate({
      id: transferId,
      status: newStatus,
      updateType: 'status_change',
      updateDescription: `Status changed to ${newStatus}`,
      ...updateData,
    });
  };

  const handleReceiptSubmit = (data: ReceiptFormValues) => {
    if (!selectedTransfer) return;
    
    updateTransferMutation.mutate({
      id: selectedTransfer.id,
      receiptNumber: data.receiptNumber,
      handoverDate: new Date(data.handoverDate),
      status: 'in-transit',
      notes: data.notes,
      updateType: 'receipt_info',
      updateDescription: 'Receipt information updated',
    });
    
    setReceiptDialogOpen(false);
    receiptForm.reset();
  };

  const handleAcceptanceSubmit = (data: AcceptanceFormValues) => {
    if (!selectedTransfer) return;
    
    const isAccepted = data.overallCondition !== 'rejected';
    
    updateTransferMutation.mutate({
      id: selectedTransfer.id,
      receivedBy: user?.id,
      receivedDate: new Date(data.receivedDate),
      overallCondition: data.overallCondition,
      receiverNotes: data.receiverNotes,
      status: isAccepted ? 'completed' : 'returned',
      updateType: 'receipt_confirmation',
      updateDescription: isAccepted ? 'Transfer completed and accepted' : 'Transfer returned due to issues',
    });
    
    setAcceptanceDialogOpen(false);
    acceptanceForm.reset();
  };

  const getItemName = (itemId: number) => {
    if (!items || !Array.isArray(items)) return `Item #${itemId}`;
    const item = items.find((i: any) => i.id === itemId);
    return item ? item.name : `Item #${itemId}`;
  };

  const getWarehouseName = (warehouseId: number) => {
    if (!warehouses || !Array.isArray(warehouses)) return `Warehouse #${warehouseId}`;
    const warehouse = warehouses.find((w: any) => w.id === warehouseId);
    return warehouse ? warehouse.name : `Warehouse #${warehouseId}`;
  };

  const getItemQuantity = (itemId: number, warehouseId: number) => {
    if (!inventory || !Array.isArray(inventory)) return 0;
    const inventoryItem = inventory.find((inv: any) => 
      inv.itemId === itemId && inv.warehouseId === warehouseId
    );
    return inventoryItem ? inventoryItem.quantity : 0;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { variant: "outline", color: "text-yellow-700 bg-yellow-50 border-yellow-200", icon: Clock },
      approved: { variant: "outline", color: "text-blue-700 bg-blue-50 border-blue-200", icon: CheckCircle },
      "in-transit": { variant: "outline", color: "text-orange-700 bg-orange-50 border-orange-200", icon: Truck },
      completed: { variant: "outline", color: "text-green-700 bg-green-50 border-green-200", icon: Package },
      cancelled: { variant: "outline", color: "text-red-700 bg-red-50 border-red-200", icon: X },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const IconComponent = config.icon;

    return (
      <Badge className={config.color}>
        <IconComponent className="w-3 h-3 mr-1" />
        {status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')}
      </Badge>
    );
  };

  const getTransferModeIcon = (mode: string) => {
    switch (mode) {
      case 'courier':
        return <Truck className="w-4 h-4" />;
      case 'handover':
        return <User className="w-4 h-4" />;
      case 'pickup':
        return <MapPin className="w-4 h-4" />;
      default:
        return <Package className="w-4 h-4" />;
    }
  };

  const filteredTransfers = (transfers && Array.isArray(transfers) ? transfers : []).filter((transfer: any) => {
    switch (activeTab) {
      case "pending":
        return transfer.status === "pending" || transfer.status === "approved";
      case "in-transit":
        return transfer.status === "in-transit";
      case "completed":
        return transfer.status === "completed";
      default:
        return true;
    }
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Transfer Management</h1>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Transfer
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all">All Transfers</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="in-transit">In Transit</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  {activeTab === "all" ? "All Transfers" :
                   activeTab === "pending" ? "Pending Transfers" :
                   activeTab === "in-transit" ? "In Transit" : "Completed Transfers"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Transfer Code</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Destination</TableHead>
                        <TableHead>Mode</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Expected Shipment</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transfersLoading ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                          </TableCell>
                        </TableRow>
                      ) : filteredTransfers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                            No transfers found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredTransfers.map((transfer: any) => (
                          <TableRow key={transfer.id}>
                            <TableCell className="font-medium">
                              {transfer.transferCode}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <div className="font-medium">{transfer.sourceWarehouse?.name}</div>
                                <div className="text-gray-500">{transfer.sourceWarehouse?.location}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <div className="font-medium">{transfer.destinationWarehouse?.name}</div>
                                <div className="text-gray-500">{transfer.destinationWarehouse?.location}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {getTransferModeIcon(transfer.transferMode)}
                                <span className="capitalize">{transfer.transferMode}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm font-medium">
                                {transfer.items?.length || 0} items
                              </span>
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(transfer.status)}
                            </TableCell>
                            <TableCell>
                              {transfer.expectedShipmentDate ? (
                                <div className="flex items-center gap-1 text-sm">
                                  <Calendar className="w-3 h-3" />
                                  {formatDateTime(transfer.expectedShipmentDate)}
                                </div>
                              ) : (
                                <span className="text-gray-400">Not set</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedTransfer(transfer);
                                    setDetailsDialogOpen(true);
                                  }}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {transfer.status === "pending" && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-green-600"
                                    onClick={() => handleUpdateStatus(transfer.id, "approved")}
                                  >
                                    <CheckCircle className="h-4 w-4" />
                                  </Button>
                                )}
                                {transfer.status === "approved" && user?.warehouseId === transfer.sourceWarehouseId && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-blue-600"
                                    onClick={() => {
                                      setSelectedTransfer(transfer);
                                      setReceiptDialogOpen(true);
                                    }}
                                    title="Add receipt and handover details"
                                  >
                                    <FileText className="h-4 w-4" />
                                  </Button>
                                )}
                                {transfer.status === "in-transit" && user?.warehouseId === transfer.destinationWarehouseId && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-green-600"
                                    onClick={() => {
                                      setSelectedTransfer(transfer);
                                      acceptanceForm.setValue('items', transfer.items?.map((item: any) => ({
                                        itemId: item.itemId,
                                        actualQuantity: item.requestedQuantity,
                                        condition: 'good',
                                        notes: ''
                                      })) || []);
                                      setAcceptanceDialogOpen(true);
                                    }}
                                    title="Accept or return transfer"
                                  >
                                    <Package className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Create Transfer Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Transfer</DialogTitle>
              <DialogDescription>
                Create a new inventory transfer between warehouses
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={form.handleSubmit(handleSubmit)}>
              <div className="space-y-6 py-4">
                {/* Warehouse Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            {warehouse.name} - {warehouse.location}
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
                        {warehouses?.filter((w: any) => w.isActive && w.id.toString() !== form.getValues("sourceWarehouseId")).map((warehouse: any) => (
                          <SelectItem key={warehouse.id} value={warehouse.id.toString()}>
                            {warehouse.name} - {warehouse.location}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.formState.errors.destinationWarehouseId && (
                      <p className="text-sm text-red-500">{form.formState.errors.destinationWarehouseId.message}</p>
                    )}
                  </div>
                </div>

                {/* Transfer Mode and Dates */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="transferMode">Transfer Mode</Label>
                    <Select
                      onValueChange={(value) => form.setValue("transferMode", value)}
                      defaultValue={form.getValues("transferMode")}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select transfer mode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="courier">🚚 Ship through Courier</SelectItem>
                        <SelectItem value="handover">🤝 Handover to Person</SelectItem>
                        <SelectItem value="pickup">📍 Pickup</SelectItem>
                      </SelectContent>
                    </Select>
                    {form.formState.errors.transferMode && (
                      <p className="text-sm text-red-500">{form.formState.errors.transferMode.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="expectedShipmentDate">Expected Shipment Date</Label>
                    <Input
                      id="expectedShipmentDate"
                      type="datetime-local"
                      {...form.register("expectedShipmentDate")}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="expectedArrivalDate">Expected Arrival Date</Label>
                    <Input
                      id="expectedArrivalDate"
                      type="datetime-local"
                      {...form.register("expectedArrivalDate")}
                    />
                  </div>
                </div>

                {/* Transfer Mode Specific Fields */}
                {form.watch("transferMode") === "courier" && (
                  <div className="space-y-2">
                    <Label htmlFor="courierName">Courier Name</Label>
                    <Input
                      id="courierName"
                      placeholder="Enter courier service name"
                      {...form.register("courierName")}
                    />
                  </div>
                )}

                {form.watch("transferMode") === "handover" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="handoverPersonName">Handover Person Name</Label>
                      <Input
                        id="handoverPersonName"
                        placeholder="Enter person's name"
                        {...form.register("handoverPersonName")}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="handoverPersonContact">Contact Number</Label>
                      <Input
                        id="handoverPersonContact"
                        placeholder="Enter contact number"
                        {...form.register("handoverPersonContact")}
                      />
                    </div>
                  </div>
                )}

                {/* Transfer Items */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Transfer Items</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => append({ itemId: "", requestedQuantity: "" })}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Item
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {fields.map((field, index) => (
                      <div key={field.id} className="flex gap-4 items-end">
                        <div className="flex-1">
                          <Label htmlFor={`items.${index}.itemId`}>Item</Label>
                          <Select
                            onValueChange={(value) => form.setValue(`items.${index}.itemId`, value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select an item" />
                            </SelectTrigger>
                            <SelectContent>
                              {(items && Array.isArray(items) ? items : []).map((item: any) => {
                                const sourceWarehouseId = parseInt(form.watch("sourceWarehouseId") || "0");
                                const availableQty = getItemQuantity(item.id, sourceWarehouseId);
                                return (
                                  <SelectItem key={item.id} value={item.id.toString()}>
                                    <div className="flex justify-between items-center w-full">
                                      <span>{item.name} ({item.sku})</span>
                                      <span className={`ml-2 text-sm ${availableQty > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                        Available: {availableQty}
                                      </span>
                                    </div>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="w-32">
                          <Label htmlFor={`items.${index}.requestedQuantity`}>Quantity</Label>
                          <Input
                            id={`items.${index}.requestedQuantity`}
                            type="number"
                            min="1"
                            placeholder="Qty"
                            {...form.register(`items.${index}.requestedQuantity`)}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="mb-2"
                          onClick={() => fields.length > 1 && remove(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Enter any additional notes for this transfer"
                    {...form.register("notes")}
                  />
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
                  disabled={createTransferMutation.isPending}
                >
                  {createTransferMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Transfer"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Transfer Details Dialog */}
        {selectedTransfer && (
          <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Transfer Details</DialogTitle>
                <DialogDescription>
                  {selectedTransfer.transferCode} • {formatDateTime(selectedTransfer.createdAt)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* Transfer Overview */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Transfer Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <Label className="text-sm font-medium text-gray-500">Status</Label>
                        <div className="mt-1">{getStatusBadge(selectedTransfer.status)}</div>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-500">Transfer Mode</Label>
                        <div className="mt-1 flex items-center gap-2">
                          {getTransferModeIcon(selectedTransfer.transferMode)}
                          <span className="capitalize">{selectedTransfer.transferMode}</span>
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-500">Initiated By</Label>
                        <p className="mt-1">{selectedTransfer.initiatedByUser?.name}</p>
                      </div>
                      {selectedTransfer.approvedByUser && (
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Approved By</Label>
                          <p className="mt-1">{selectedTransfer.approvedByUser.name}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Shipment Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {selectedTransfer.expectedShipmentDate && (
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Expected Shipment</Label>
                          <p className="mt-1">{formatDateTime(selectedTransfer.expectedShipmentDate)}</p>
                        </div>
                      )}
                      {selectedTransfer.expectedArrivalDate && (
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Expected Arrival</Label>
                          <p className="mt-1">{formatDateTime(selectedTransfer.expectedArrivalDate)}</p>
                        </div>
                      )}
                      {selectedTransfer.actualShipmentDate && (
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Actual Shipment</Label>
                          <p className="mt-1">{formatDateTime(selectedTransfer.actualShipmentDate)}</p>
                        </div>
                      )}
                      {selectedTransfer.actualArrivalDate && (
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Actual Arrival</Label>
                          <p className="mt-1">{formatDateTime(selectedTransfer.actualArrivalDate)}</p>
                        </div>
                      )}
                      {selectedTransfer.courierName && (
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Courier</Label>
                          <p className="mt-1">{selectedTransfer.courierName}</p>
                        </div>
                      )}
                      {selectedTransfer.trackingNumber && (
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Tracking Number</Label>
                          <p className="mt-1">{selectedTransfer.trackingNumber}</p>
                        </div>
                      )}
                      {selectedTransfer.receiptNumber && (
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Receipt Number</Label>
                          <p className="mt-1">{selectedTransfer.receiptNumber}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Warehouse Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Source Warehouse</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <p className="font-medium">{selectedTransfer.sourceWarehouse?.name}</p>
                        <p className="text-sm text-gray-600">{selectedTransfer.sourceWarehouse?.location}</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Destination Warehouse</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <p className="font-medium">{selectedTransfer.destinationWarehouse?.name}</p>
                        <p className="text-sm text-gray-600">{selectedTransfer.destinationWarehouse?.location}</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Transfer Items */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Transfer Items</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead>Requested Qty</TableHead>
                          <TableHead>Approved Qty</TableHead>
                          <TableHead>Actual Qty</TableHead>
                          <TableHead>Condition</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedTransfer.items?.map((item: any) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.item?.name}</TableCell>
                            <TableCell>{item.item?.sku}</TableCell>
                            <TableCell>{item.requestedQuantity}</TableCell>
                            <TableCell>{item.approvedQuantity || '-'}</TableCell>
                            <TableCell>{item.actualQuantity || '-'}</TableCell>
                            <TableCell>
                              <Badge variant={item.condition === 'good' ? 'default' : 'destructive'}>
                                {item.condition || 'good'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Notes */}
                {selectedTransfer.notes && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Notes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-700">{selectedTransfer.notes}</p>
                    </CardContent>
                  </Card>
                )}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDetailsDialogOpen(false)}
                >
                  Close
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Receipt Management Dialog */}
        <Dialog open={receiptDialogOpen} onOpenChange={setReceiptDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Receipt Details</DialogTitle>
              <DialogDescription>
                Enter receipt number, handover date, and any additional notes for this transfer.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={receiptForm.handleSubmit(handleReceiptSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="receiptNumber">Receipt Number</Label>
                <Input
                  id="receiptNumber"
                  {...receiptForm.register("receiptNumber")}
                  placeholder="Enter receipt number"
                />
                {receiptForm.formState.errors.receiptNumber && (
                  <p className="text-sm text-red-600 mt-1">
                    {receiptForm.formState.errors.receiptNumber.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="handoverDate">Handover Date</Label>
                <Input
                  id="handoverDate"
                  type="datetime-local"
                  {...receiptForm.register("handoverDate")}
                />
                {receiptForm.formState.errors.handoverDate && (
                  <p className="text-sm text-red-600 mt-1">
                    {receiptForm.formState.errors.handoverDate.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="receiptNotes">Notes (Optional)</Label>
                <Textarea
                  id="receiptNotes"
                  {...receiptForm.register("notes")}
                  placeholder="Any additional notes or instructions"
                  rows={3}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setReceiptDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateTransferMutation.isPending}>
                  {updateTransferMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Submit Receipt"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Transfer Acceptance Dialog */}
        <Dialog open={acceptanceDialogOpen} onOpenChange={setAcceptanceDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Accept or Return Transfer</DialogTitle>
              <DialogDescription>
                Review the received items and specify their condition. You can accept the transfer or return it if there are issues.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={acceptanceForm.handleSubmit(handleAcceptanceSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="receivedDate">Date Received</Label>
                  <Input
                    id="receivedDate"
                    type="datetime-local"
                    {...acceptanceForm.register("receivedDate")}
                  />
                  {acceptanceForm.formState.errors.receivedDate && (
                    <p className="text-sm text-red-600 mt-1">
                      {acceptanceForm.formState.errors.receivedDate.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="overallCondition">Overall Condition</Label>
                  <Select
                    value={acceptanceForm.watch("overallCondition")}
                    onValueChange={(value) => acceptanceForm.setValue("overallCondition", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="good">Good - Accept Transfer</SelectItem>
                      <SelectItem value="damaged">Damaged - Some Issues</SelectItem>
                      <SelectItem value="mixed">Mixed - Partial Issues</SelectItem>
                      <SelectItem value="rejected">Rejected - Return Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                  {acceptanceForm.formState.errors.overallCondition && (
                    <p className="text-sm text-red-600 mt-1">
                      {acceptanceForm.formState.errors.overallCondition.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Item Details */}
              <div>
                <Label>Item Details</Label>
                <div className="mt-2 space-y-3 max-h-60 overflow-y-auto border rounded-md p-3">
                  {selectedTransfer?.items?.map((item: any, index: number) => (
                    <div key={item.itemId} className="grid grid-cols-4 gap-3 items-center p-2 bg-gray-50 rounded">
                      <div>
                        <p className="font-medium text-sm">{getItemName(item.itemId)}</p>
                        <p className="text-xs text-gray-500">Qty: {item.requestedQuantity}</p>
                      </div>
                      <div>
                        <Label className="text-xs">Actual Qty</Label>
                        <Input
                          type="number"
                          min="0"
                          defaultValue={item.requestedQuantity}
                          {...acceptanceForm.register(`items.${index}.actualQuantity`, { valueAsNumber: true })}
                          className="h-8"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Condition</Label>
                        <Select
                          defaultValue="good"
                          onValueChange={(value) => acceptanceForm.setValue(`items.${index}.condition`, value)}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="good">Good</SelectItem>
                            <SelectItem value="damaged">Damaged</SelectItem>
                            <SelectItem value="missing">Missing</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Notes</Label>
                        <Input
                          {...acceptanceForm.register(`items.${index}.notes`)}
                          placeholder="Item notes"
                          className="h-8"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="receiverNotes">Receiver Notes</Label>
                <Textarea
                  id="receiverNotes"
                  {...acceptanceForm.register("receiverNotes")}
                  placeholder="Overall notes about the received transfer"
                  rows={3}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAcceptanceDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateTransferMutation.isPending}
                  className={acceptanceForm.watch("overallCondition") === "rejected" ? "bg-red-600 hover:bg-red-700" : ""}
                >
                  {updateTransferMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : acceptanceForm.watch("overallCondition") === "rejected" ? (
                    "Return Transfer"
                  ) : (
                    "Accept Transfer"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}