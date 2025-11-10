import { useState, useEffect } from "react";
import { useQuery, useMutation,useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { apiRequest } from "@/lib/queryClient";
import { 
  Loader2, 
  Plus, 
  Eye, 
  Truck, 
  Package, 
  Clock, 
  CheckCircle,
  RefreshCw, 
  X,
  Calendar,
  User,
  MapPin,
  Phone,
  FileText,
  Warehouse
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { formatDateTime, formatDateTimeWithoutTimeZone, getStatusColor } from "@/lib/utils";
import { DataTablePagination } from "@/components/ui/data-table-pagination";

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
  items: z.array(transferItemSchema).min(1, { message: "At least one item is required" })
  .superRefine((items, ctx) => {
      const ids = items.map(i => i.itemId);
      const dupes = ids.filter((v, i, a) => a.indexOf(v) !== i);
      if (dupes.length > 0) {
        // add an error on the items array
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Each item can only be selected once",
        });
        // also add an error on individual duplicate indices if possible
        ids.forEach((id, idx) => {
          if (dupes.includes(id)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Duplicate item",
              path: ["items", idx, "itemId"],
            });
          }
        });
        }
    }),
});

type FormValues = z.infer<typeof formSchema>;

const receiptSchema = z.object({
  receiptNumber: z.string().min(1, "Receipt number is required"),
  handoverDate: z.string().min(1, "Handover date is required"),
  notes: z.string().optional(),
});
const returnShippedSchema = z.object({
  returnCourierName: z.string().min(1, "Return Courier Name is required"),
  returnTrackingNumber: z.string().min(1, "Return Tracking Number is required"),
  returnShippedDate: z.string().min(1, "Return Shipped Date is required"),
});

const acceptanceSchema = z.object({
  receivedDate: z.string().min(1, "Received date is required"),
  overallCondition: z.string().optional(),
  receiverNotes: z.string().optional(),
  items: z.array(z.object({
    itemId: z.number(),
    transferItemId:z.number(),
    actualQuantity: z.number().min(0, "Quantity cannot be negative"),
    condition: z.string().min(1, "Condition is required"),
    notes: z.string().optional(),
    itemStatus: z.string().min(1,"Status is required")
  })),
});

type ReceiptFormValues = z.infer<typeof receiptSchema>;
type AcceptanceFormValues = z.infer<typeof acceptanceSchema>;
type ReturnShippedFormValues=z.infer<typeof returnShippedSchema>;

export default function EnhancedTransfersPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [returnShippedDialogOpen,setReturnShippedDialogOpen]= useState(false);
  const [acceptanceDialogOpen, setAcceptanceDialogOpen] = useState(false);
  const [auditDialogOpen, setAuditDialogOpen] = useState(false);
  const [rejectionDialogOpen, setRejectionDialogOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [refreshKey, setRefreshKey] = useState(0);
  const [rejectionReason, setRejectionReason] = useState("");
  const queryClient=useQueryClient();
  

  const { data: transfers, isLoading: transfersLoading } = useQuery({
    queryKey: ["/api/transfers", refreshKey],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: ["/api/items", refreshKey],
  });

  const { data: inventory } = useQuery({
    queryKey: ["/api/inventory", refreshKey],
  });

  const { data: warehouses, isLoading: warehousesLoading } = useQuery({
    queryKey: ["/api/warehouses", refreshKey],
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
  const return_shippmentForm = useForm<ReturnShippedFormValues>({
    resolver: zodResolver(returnShippedSchema),
    defaultValues: {
      returnCourierName:"",
      returnTrackingNumber:"",
      returnShippedDate:""
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
  const acceptanceItems = acceptanceForm.watch("items") || [];
  const acceptanceButtonLabel = (() => {
    if (!Array.isArray(acceptanceItems) || acceptanceItems.length === 0) return "Submit";
    const statuses = acceptanceItems.map((it: any) => it?.itemStatus);
    if (statuses.every(s => s === "Accept")) return "Accept Transfer";
    if (statuses.every(s => s === "Return")) return "Return Transfer";
    if (statuses.some(s => s === "Return")) return "Partial Return";
    return "Accept Transfer";
  })();

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
    onSuccess: async () => {
      // Force complete component re-render with fresh data
      setRefreshKey(prev => prev + 1);
      
      setIsDialogOpen(false);
      form.reset();
      toast({
        title: "Success",
        description: "Transfer created successfully",
      });
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
    onSuccess: async () => {
      // Force immediate cache invalidation and refetch
      await queryClient.invalidateQueries({ queryKey: ["/api/transfers"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/warehouses"] });
      await queryClient.refetchQueries({ queryKey: ["/api/transfers"], type: 'active' });
      
      toast({
        title: "Success",
        description: "Transfer updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update transfer",
        variant: "destructive",
      });
    },
  });
  const returnDeliveryMutation = useMutation({
    mutationFn: async ({id,...data}: any)=>{
      const response = await fetch(`/api/transfers/${id}`,{
        method:"PATCH",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify(data),
      });
      if(!response.ok){
        throw new Error(`Failed to update transfer: ${response.statusText}`)
      }
      return response.json();
    },
    onSuccess: async () => {
      // Force immediate cache invalidation and refetch
      await queryClient.invalidateQueries({ queryKey: ["/api/transfers"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/warehouses"] });
      await queryClient.refetchQueries({ queryKey: ["/api/transfers"], type: 'active' });
      toast({
        title: "Success",
        description: "Transfer updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update transfer",
        variant: "destructive",
      });
    },

  })
  const returnShippmentMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const response = await fetch(`/api/transfers/${id}/return-shipment`, {
        method: "Post",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`Failed to update transfer: ${response.statusText}`);
      }

      return response.json();
    },
    onSuccess: async () => {
      // Force immediate cache invalidation and refetch
      await queryClient.invalidateQueries({ queryKey: ["/api/transfers"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/warehouses"] });
      await queryClient.refetchQueries({ queryKey: ["/api/transfers"], type: 'active' });
      setReturnShippedDialogOpen(false)
      toast({
        title: "Success",
        description: "Transfer updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update transfer",
        variant: "destructive",
      });
    },
  });


  const rejectTransferMutation = useMutation({
    mutationFn: async ({ id, rejectionReason }: { id: number; rejectionReason: string }) => {
      const response = await fetch(`/api/transfers/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rejectionReason }),
      });

      if (!response.ok) {
        throw new Error(`Failed to reject transfer: ${response.statusText}`);
      }

      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/transfers"] });
      setRejectionDialogOpen(false);
      setRejectionReason("");
      setSelectedTransfer(null);
      
      toast({
        title: "Transfer Rejected",
        description: "Transfer has been rejected successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reject transfer",
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
  const handleReturnDeliver = (transferId:number) => {
    returnDeliveryMutation.mutate({
      id:transferId,
      status:'returned'
    })
  }

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
  const handleReturnShippedSubmit = (data: ReturnShippedFormValues) => {
    if (!selectedTransfer) return;
    
    returnShippmentMutation.mutate({
      id: selectedTransfer.id,
      returnCourierName: data.returnCourierName,
      returnShippedDate: new Date(data.returnShippedDate),
      returnTrackingNumber: data.returnTrackingNumber,
      status: 'returnShipment',
    });
    
    setReceiptDialogOpen(false);
    return_shippmentForm.reset();
  };

  const handleAcceptanceSubmit = (data: AcceptanceFormValues) => {
    console.log("✅ Form submitted with data:", data);

    if (!selectedTransfer) return;
    let overallCondition;
    if (data.items.every(item => item.itemStatus === "Accept")) {
      overallCondition = "completed";
    } else if (data.items.every(item => item.itemStatus === "Return")) {
      overallCondition = "return-requested";
    } else if (data.items.some(item => item.itemStatus === "Return")) {
      overallCondition = "partial-return-requested";
    } 
    
    
    updateTransferMutation.mutate({
      id: selectedTransfer.id,
      receivedBy: user?.id,
      receivedDate: new Date(data.receivedDate),
      overallCondition,
      receiverNotes: data.receiverNotes,
      status: overallCondition,
      updateType: 'receipt_confirmation',
      updateDescription: `Transfer is ${overallCondition}`,
      items: data.items
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
      case "returned":
        return transfer.status === "returned";
      case "rejected":
        return transfer.status === "rejected";
      default:
        return true;
    }
  });
  const sortedTransfers = (filteredTransfers && Array.isArray(filteredTransfers) ? [...filteredTransfers] : [])
  .sort((a: any, b: any) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // Check if there are enough warehouses for transfers
  const activeWarehouses = warehouses?.filter((w: any) => w.isActive) || [];
  const hasEnoughWarehouses = activeWarehouses.length >= 2;
  const selectedItemIds = (form.watch("items") || []).map((it: any) => it?.itemId).filter(Boolean);
  const acceptanceIsReturn = Array.isArray(acceptanceItems) && acceptanceItems.some((it: any) => it?.itemStatus === "Return");
  const acceptanceButtonVariant = acceptanceIsReturn ? "destructive" : undefined;


  return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Transfer Management</h1>
          {hasEnoughWarehouses ? (
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Transfer
            </Button>
          ) : null}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="all">All Transfers</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="in-transit">In Transit</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="returned">Returned</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    {activeTab === "all" ? "All Transfers" :
                     activeTab === "pending" ? "Pending Transfers" :
                     activeTab === "in-transit" ? "In Transit" : "Completed Transfers"}
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        // Clear all relevant query caches
                        await queryClient.invalidateQueries({ queryKey: ['/api/transfers'] });
                        await queryClient.invalidateQueries({ queryKey: ['/api/items'] });
                        await queryClient.invalidateQueries({ queryKey: ['/api/warehouses'] });
                        await queryClient.invalidateQueries({ queryKey: ['/api/users'] });
                        
                        // Force fresh data fetch
                        await Promise.all([
                          queryClient.refetchQueries({ queryKey: ['/api/transfers'], type: 'active' }),
                          queryClient.refetchQueries({ queryKey: ['/api/items'], type: 'active' }),
                          queryClient.refetchQueries({ queryKey: ['/api/warehouses'], type: 'active' }),
                          queryClient.refetchQueries({ queryKey: ['/api/users'], type: 'active' })
                        ]);
                        
                        toast({
                          title: "Refreshed",
                          description: "Transfers table has been refreshed with latest data",
                        });
                      } catch (error) {
                        console.error('Refresh error:', error);
                        toast({
                          title: "Refresh Failed",
                          description: "Unable to refresh data. Please try again.",
                          variant: "destructive",
                        });
                      }
                    }}
                    className="ml-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <DataTablePagination data={sortedTransfers}>
                  {(paginatedTransfers) => (
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
                          ) : paginatedTransfers.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                                No transfers found
                              </TableCell>
                            </TableRow>
                          ) : (
                            paginatedTransfers.map((transfer: any) => (
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
                                  title="View transfer details"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedTransfer(transfer);
                                    setAuditDialogOpen(true);
                                  }}
                                  title="View audit trail"
                                  className="text-purple-600"
                                >
                                  <FileText className="h-4 w-4" />
                                </Button>
                                {transfer.status === "pending" && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-green-600"
                                      onClick={() => handleUpdateStatus(transfer.id, "approved")}
                                      title="Approve transfer"
                                    >
                                      <CheckCircle className="h-4 w-4" />
                                    </Button>
                                    {(user?.role === 'admin' || transfer.initiatedBy === user?.id) && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-red-600"
                                        onClick={() => {
                                          setSelectedTransfer(transfer);
                                          setRejectionDialogOpen(true);
                                        }}
                                        title="Reject or cancel transfer"
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </>
                                )}
                                {transfer.status === "approved" && (transfer.sourceWarehouse?.managerId === user?.id|| user?.role === "admin") && (
              
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
                                {transfer.status === "in-transit" && (transfer.destinationWarehouse?.managerId === user?.id || user?.role==='admin')&& (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-green-600"
                                    onClick={() => {
                                      setSelectedTransfer(transfer);
                                      acceptanceForm.setValue('items', transfer.items?.map((item: any) => ({
                                        itemId: item.itemId,
                                        transferItemId: item.id,
                                        actualQuantity: item.requestedQuantity,
                                        condition: 'good',
                                        notes: '',
                                        itemStatus:'Accept'
                                      })) || []);
                                      setAcceptanceDialogOpen(true);
                                    }}
                                    title="Accept or return transfer"
                                  >
                                    <Package className="h-4 w-4" />
                                  </Button>
                                )}
                                {(transfer.status === "return-requested" || transfer.status ==='partial-return-requested'  )&& (transfer.sourceWarehouse?.managerId === user?.id || user?.role==='admin' ) && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-green-600"
                                      onClick={() => handleUpdateStatus(transfer.id, "return-approved")}
                                      title="Approve return transfer request"
                                    >
                                      <CheckCircle className="h-4 w-4" />
                                    </Button>
                                    {(user?.role === 'admin' || transfer.initiatedBy === user?.id) && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-red-600"
                                        onClick={() => {
                                          setSelectedTransfer(transfer);
                                          setRejectionDialogOpen(true);
                                        }}
                                        title="Reject or cancel transfer"
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </>
                                )}
                                {transfer.status === "return-approved" && transfer.destinationWarehouse?.managerId === user?.id && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-blue-600"
                                    onClick={() => {
                                      setSelectedTransfer(transfer);
                                      setReturnShippedDialogOpen(true);
                                    }}
                                    title="Add receipt and handover details"
                                  >
                                    <FileText className="h-4 w-4" />
                                  </Button>
                                )}
                                {transfer.status === "return_shipped" && (transfer.sourceWarehouse?.managerId === user?.id || user.role==='admin' )&& (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-blue-600"
                                    onClick={() => {

                                      handleReturnDeliver(transfer.id)
                                    }}
                                    title="Accept the returned Goods"
                                  >
                                    <FileText className="h-4 w-4" />
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
              )}
            </DataTablePagination>
          </CardContent>
            </Card>

            {/* Warehouse Requirement Message */}
            {!hasEnoughWarehouses && (
              <Card className="mt-4">
                <CardContent className="py-8 text-center">
                  <div className="space-y-4">
                    <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                      <Warehouse className="w-8 h-8 text-gray-400" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-gray-600">
                        You cannot create Transfers due to non-availability of multiple warehouses in the system
                      </p>
                      <Button 
                        onClick={() => {
                          window.location.href = '/warehouses';
                        }}
                        variant="outline"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Create More Warehouses
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Create Transfer Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Transfer</DialogTitle>
              <DialogDescription>
                {hasEnoughWarehouses 
                  ? "Create a new inventory transfer between warehouses"
                  : "Transfer functionality requires multiple warehouses"
                }
              </DialogDescription>
            </DialogHeader>

            {!hasEnoughWarehouses ? (
              <div className="py-8 text-center space-y-6">
                <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center">
                  <Warehouse className="w-12 h-12 text-gray-400" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-medium text-gray-900">
                    Multiple Warehouses Required
                  </h3>
                  <p className="text-gray-600 max-w-md mx-auto">
                    Transfers are only possible in systems with more than one warehouse. 
                    You currently have {activeWarehouses.length} active warehouse{activeWarehouses.length === 1 ? '' : 's'}.
                  </p>
                </div>
                <Button 
                  onClick={() => {
                    setIsDialogOpen(false);
                    window.location.href = '/warehouses';
                  }}
                  className="mx-auto"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create More Warehouses
                </Button>
              </div>
            ) : (
              <form onSubmit={form.handleSubmit(handleSubmit)}>
                <div className="space-y-6 py-4">
                {/* Warehouse Selection */}
                {user?.role !== 'admin' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <Warehouse className="h-5 w-5 text-blue-400" />
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-blue-800">
                          Transfer Permissions
                        </h3>
                        <div className="mt-2 text-sm text-blue-700">
                          You can only create transfers from warehouses you manage or are assigned to. Available warehouses will be shown in the source warehouse dropdown.
                        </div>
                      </div>
                    </div>
                  </div>
                )}
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
                        {(() => {
                          // Filter warehouses based on user role and permissions
                          const availableWarehouses = warehouses?.filter((w: any) => {
                            if (!w.isActive) return false;
                            
                            // Admin can select any warehouse as source
                            if (user?.role === 'admin') return true;
                            
                            // Non-admin users can only select warehouses they manage or are assigned to
                            return user?.warehouseId === w.id || w.managerId === user?.id;
                          });
                          
                          return availableWarehouses?.length > 0 ? (
                            availableWarehouses.map((warehouse: any) => (
                              <SelectItem key={warehouse.id} value={warehouse.id.toString()}>
                                {warehouse.name} - {warehouse.location}
                                {user?.role !== 'admin' && (
                                  <span className="ml-2 text-xs text-blue-600">
                                    {user?.warehouseId === warehouse.id && "(Assigned)"}
                                    {warehouse.managerId === user?.id && "(Manager)"}
                                  </span>
                                )}
                              </SelectItem>
                            ))
                          ) : (
                            <div className="p-2 text-sm text-gray-500">
                              {user?.role === 'admin' 
                                ? "No active warehouses available"
                                : "You are not assigned to manage any warehouse"
                              }
                            </div>
                          );
                        })()}
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
                        {warehouses?.filter((w: any) => w.isActive && w.id.toString() !== form.getValues("sourceWarehouseId")).length > 0 ? (
                          warehouses?.filter((w: any) => w.isActive && w.id.toString() !== form.getValues("sourceWarehouseId")).map((warehouse: any) => (
                            <SelectItem key={warehouse.id} value={warehouse.id.toString()}>
                              {warehouse.name} - {warehouse.location}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="p-2 text-sm text-gray-500">
                            No available destination warehouses
                          </div>
                        )}
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
                              {(items && Array.isArray(items) ? items : []).length > 0 ? (
                                (items && Array.isArray(items) ? items : []).map((item: any) => {
                                  const sourceWarehouseId = parseInt(form.watch("sourceWarehouseId") || "0");
                                  const availableQty = getItemQuantity(item.id, sourceWarehouseId);
                                  const valueStr = item.id.toString();
                                  const isSelectedElsewhere = selectedItemIds.includes(valueStr) && form.getValues(`items.${index}.itemId`) !== valueStr;
                                  return (
                                    <SelectItem key={item.id}  value={valueStr} disabled={isSelectedElsewhere}>
                                      <div className="flex justify-between items-center w-full">
                                        <span>{item.name} ({item.sku})</span>
                                        <span className={`ml-2 text-sm ${availableQty > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                          Available: {availableQty}
                                        </span>
                                      </div>
                                    </SelectItem>
                                  );
                                })
                              ) : (
                                <div className="p-2 text-sm text-gray-500">
                                  No items available for transfer
                                </div>
                              )}
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
            )}
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
                {/* <div>
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
                </div> */}
              </div>

              {/* Item Details */}
              <div>
                <Label>Item Details</Label>
                <div className="mt-2 space-y-3 max-h-60 overflow-y-auto border rounded-md p-3">
                  {selectedTransfer?.items?.map((item: any, index: number) => (
                    
                    <div key={item.itemId} className="grid grid-cols-5 gap-3 items-center p-2 bg-gray-50 rounded">
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
                        <Label className="text-xs">Status</Label>
                        <Select
                          defaultValue="Accept"
                          onValueChange={(value) => acceptanceForm.setValue(`items.${index}.itemStatus`, value)}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Accept">Accept</SelectItem>
                            <SelectItem value="Return">Return</SelectItem>
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
                {/* <Button 
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
                </Button> */}
                <Button 
                  type="submit" 
                  disabled={updateTransferMutation.isPending}
                  variant={acceptanceButtonVariant}
                >
                  {updateTransferMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) :
                    acceptanceButtonLabel
                 }
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Audit Trail Dialog */}
        <Dialog open={auditDialogOpen} onOpenChange={setAuditDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Transfer Audit Trail - {selectedTransfer?.transferCode}
              </DialogTitle>
            </DialogHeader>

            {selectedTransfer && (
              <div className="space-y-6">
                {/* Transfer Overview */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold mb-3">Transfer Overview</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Status:</span>
                      <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                        selectedTransfer.status === 'completed' ? 'bg-green-100 text-green-800' :
                        selectedTransfer.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        selectedTransfer.status === 'in-transit' ? 'bg-blue-100 text-blue-800' :
                        selectedTransfer.status === 'approved' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {selectedTransfer.status}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">Priority:</span>
                      <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                        selectedTransfer.priority === 'high' ? 'bg-red-100 text-red-800' :
                        selectedTransfer.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {selectedTransfer.priority}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">Transport:</span>
                      <span className="ml-2">{selectedTransfer.transportMethod}</span>
                    </div>
                    <div>
                      <span className="font-medium">From:</span>
                      <span className="ml-2">{selectedTransfer.sourceWarehouse?.name}</span>
                    </div>
                    <div>
                      <span className="font-medium">To:</span>
                      <span className="ml-2">{selectedTransfer.destinationWarehouse?.name}</span>
                    </div>
                    <div>
                      <span className="font-medium">Created:</span>
                      <span className="ml-2">{formatDateTimeWithoutTimeZone(selectedTransfer.createdAt)}</span>
                    </div>
                  </div>
                </div>

                {/* Transfer Items */}
                <div>
                  <h3 className="font-semibold mb-3">Transfer Items</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead>Requested Qty</TableHead>
                          <TableHead>Actual Qty</TableHead>
                          <TableHead>Condition</TableHead>
                          <TableHead>Notes</TableHead>
                          <TableHead>ItemStatus</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedTransfer.items?.map((item: any, index: number) => (
                          <TableRow key={index}>
                            <TableCell>{item.item?.name}</TableCell>
                            <TableCell>{item.item?.sku}</TableCell>
                            <TableCell>{item.requestedQuantity}</TableCell>
                            <TableCell>{item.actualQuantity || '-'}</TableCell>
                            <TableCell>
                              {item.condition && (
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  item.condition === 'good' ? 'bg-green-100 text-green-800' :
                                  item.condition === 'damaged' ? 'bg-red-100 text-red-800' :
                                  'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {item.condition}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm">{item.notes || '-'}</TableCell>
                            <TableCell>{item.itemStatus}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Transport Details */}
                {(selectedTransfer.receiptNumber || selectedTransfer.handoverDate || selectedTransfer.transferMode) && (
                  <div>
                    <h3 className="font-semibold mb-3">Transport Details</h3>
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        {selectedTransfer.transferMode && (
                          <div>
                            <span className="font-medium">Transport Method:</span>
                            <span className="ml-2 capitalize">
                              {selectedTransfer.transferMode === 'courier' ? 'Courier Service' : 
                               selectedTransfer.transferMode === 'handover' ? 'In-Person Handover' : 
                               selectedTransfer.transferMode === 'pickup' ? 'Pickup' : 
                               selectedTransfer.transferMode}
                            </span>
                          </div>
                        )}
                        {selectedTransfer.courierName && (
                          <div>
                            <span className="font-medium">Courier Name:</span>
                            <span className="ml-2">{selectedTransfer.courierName}</span>
                          </div>
                        )}
                        {selectedTransfer.handoverPersonName && (
                          <div>
                            <span className="font-medium">Handover Person:</span>
                            <span className="ml-2">{selectedTransfer.handoverPersonName}</span>
                          </div>
                        )}
                        {selectedTransfer.handoverPersonContact && (
                          <div>
                            <span className="font-medium">Contact Number:</span>
                            <span className="ml-2">{selectedTransfer.handoverPersonContact}</span>
                          </div>
                        )}
                        {selectedTransfer.trackingNumber && (
                          <div>
                            <span className="font-medium">Tracking Number:</span>
                            <span className="ml-2">{selectedTransfer.trackingNumber}</span>
                          </div>
                        )}
                        {selectedTransfer.receiptNumber && (
                          <div>
                            <span className="font-medium">Receipt Number:</span>
                            <span className="ml-2">{selectedTransfer.receiptNumber}</span>
                          </div>
                        )}
                        {selectedTransfer.handoverDate && (
                          <div>
                            <span className="font-medium">Handover Date:</span>
                            <span className="ml-2">{formatDateTime(selectedTransfer.handoverDate)}</span>
                          </div>
                        )}
                        {selectedTransfer.transportNotes && (
                          <div className="md:col-span-2">
                            <span className="font-medium">Transport Notes:</span>
                            <p className="mt-1 text-gray-700">{selectedTransfer.transportNotes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Reception Details */}
                {(selectedTransfer.receiverNotes || selectedTransfer.receivedDate) && (
                  <div>
                    <h3 className="font-semibold mb-3">Reception Details</h3>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        {selectedTransfer.receivedDate && (
                          <div>
                            <span className="font-medium">Received Date:</span>
                            <span className="ml-2">{formatDateTime(selectedTransfer.receivedDate)}</span>
                          </div>
                        )}
                        {selectedTransfer.receiverNotes && (
                          <div className="md:col-span-2">
                            <span className="font-medium">Receiver Notes:</span>
                            <p className="mt-1 text-gray-700">{selectedTransfer.receiverNotes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Rejection Details */}
                {selectedTransfer.status === 'rejected' && selectedTransfer.rejectionReason && (
                  <div>
                    <h3 className="font-semibold mb-3">Rejection Details</h3>
                    <div className="bg-red-50 p-4 rounded-lg">
                      <div className="text-sm">
                        <span className="font-medium">Rejection Reason:</span>
                        <p className="mt-1 text-gray-700">{selectedTransfer.rejectionReason}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Timeline */}
                <div>
                  <h3 className="font-semibold mb-3">Timeline</h3>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                      <div className="flex-1">
                        <div className="font-medium text-sm">Transfer Created</div>
                        <div className="text-xs text-gray-600">{formatDateTimeWithoutTimeZone(selectedTransfer.createdAt)}</div>
                        <div className="text-xs text-gray-700">Transfer request initiated</div>
                      </div>
                    </div>

                    {selectedTransfer.status !== 'pending' && selectedTransfer.status !== 'rejected' && (
                      <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">Transfer Approved</div>
                          <div className="text-xs text-gray-600">{formatDateTimeWithoutTimeZone(selectedTransfer.approvedAt)}</div>
                          <div className="text-xs text-gray-700">
                            {selectedTransfer.approvedByUser ? (
                              <>Transfer approved by: {selectedTransfer.approvedByUser.name}</>
                            ) : (
                              'Transfer approved for processing'
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedTransfer.handoverDate && (
                      <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">Items Dispatched</div>
                          <div className="text-xs text-gray-600">{formatDateTime(selectedTransfer.handoverDate)}</div>
                          <div className="text-xs text-gray-700">
                            {selectedTransfer.transferMode === 'courier' && selectedTransfer.courierName ? (
                              <>Items handed over to courier: {selectedTransfer.courierName}</>
                            ) : selectedTransfer.transferMode === 'handover' && selectedTransfer.handoverPersonName ? (
                              <>Items handed over to: {selectedTransfer.handoverPersonName}
                                {selectedTransfer.handoverPersonContact && ` (${selectedTransfer.handoverPersonContact})`}</>
                            ) : (
                              'Items handed over to transport'
                            )}
                          </div>
                          {selectedTransfer.trackingNumber && (
                            <div className="text-xs text-blue-600 mt-1">
                              Tracking: {selectedTransfer.trackingNumber}
                            </div>
                          )}
                          {selectedTransfer.receiptNumber && (
                            <div className="text-xs text-purple-600 mt-1">
                              Receipt: {selectedTransfer.receiptNumber}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {selectedTransfer.receivedDate && (
                      <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">Transfer Completed</div>
                          <div className="text-xs text-gray-600">{formatDateTime(selectedTransfer.receivedDate)}</div>
                          <div className="text-xs text-gray-700">
                            {selectedTransfer.receivedBy ? (
                              <>Items received and processed by: {selectedTransfer.receivedBy}</>
                            ) : (
                              'Items received and processed'
                            )}
                          </div>
                          {selectedTransfer.overallCondition && (
                            <div className="text-xs text-blue-600 mt-1">
                              Condition: {selectedTransfer.overallCondition}
                            </div>
                          )}
                          {selectedTransfer.receiverNotes && (
                            <div className="text-xs text-gray-600 mt-1">
                              Receiver Notes: {selectedTransfer.receiverNotes}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Return/Disposal Workflow States */}
                    {selectedTransfer.status === 'rejected' && (
                      <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg">
                        <div className="w-2 h-2 bg-red-500 rounded-full mt-2"></div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">Transfer Rejected</div>
                          <div className="text-xs text-gray-600">{formatDateTime(selectedTransfer.rejectedAt)}</div>
                          <div className="text-xs text-gray-700">Quality issues detected at destination warehouse</div>
                        </div>
                      </div>
                    )}

                    {(selectedTransfer.status === 'return_requested' || selectedTransfer.status === 'return_shipped' || selectedTransfer.status === 'returned') && (
                      <div className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg">
                        <div className="w-2 h-2 bg-orange-500 rounded-full mt-2"></div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">Return Approved</div>
                          <div className="text-xs text-gray-600">{formatDateTimeWithoutTimeZone(selectedTransfer.returnApproved.createdAt)}</div>
                          <div className="text-xs text-gray-700">{selectedTransfer.returnApproved.description}</div>
                          {selectedTransfer.returnReason && (
                            <div className="text-xs text-gray-600 mt-1">
                              Return Reason: {selectedTransfer.returnReason}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {(selectedTransfer.status === 'return_shipped' || selectedTransfer.status === 'returned') && (
                      <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">Return Shipment Initiated</div>
                          <div className="text-xs text-gray-600">{formatDateTimeWithoutTimeZone(selectedTransfer.returnShipped.createdAt)}</div>
                          <div className="text-xs text-gray-700">{selectedTransfer.returnShipped.description}</div>
                          {selectedTransfer.returnCourierName && (
                            <div className="text-xs text-blue-600 mt-1">
                              Courier: {selectedTransfer.returnCourierName}
                            </div>
                          )}
                          {selectedTransfer.returnTrackingNumber && (
                            <div className="text-xs text-blue-600 mt-1">
                              Tracking: {selectedTransfer.returnTrackingNumber}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {selectedTransfer.status === 'returned' && (
                      <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                        <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">Return Completed</div>
                          <div className="text-xs text-gray-600">{formatDateTimeWithoutTimeZone(selectedTransfer.returned.createdAt)}</div>
                          <div className="text-xs text-gray-700">{selectedTransfer.returned.description}</div>
                          {selectedTransfer.returnDeliveredDate && (
                            <div className="text-xs text-gray-600 mt-1">
                              Delivered: {formatDateTime(selectedTransfer.returnDeliveredDate)}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {selectedTransfer.status === 'disposed' && (
                      <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="w-2 h-2 bg-gray-500 rounded-full mt-2"></div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">Items Disposed</div>
                          <div className="text-xs text-gray-600">{selectedTransfer.disposalDate && formatDateTimeWithoutTimeZone(selectedTransfer.disposalDate)}</div>
                          <div className="text-xs text-gray-700">Items marked as disposed</div>
                          {selectedTransfer.disposalReason && (
                            <div className="text-xs text-gray-600 mt-1">
                              Disposal Reason: {selectedTransfer.disposalReason}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setAuditDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Rejection Dialog */}
        <Dialog open={rejectionDialogOpen} onOpenChange={setRejectionDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Reject Transfer</DialogTitle>
              <DialogDescription>
                Are you sure you want to reject transfer {selectedTransfer?.transferCode}? Please provide a reason for rejection.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="rejectionReason">Rejection Reason</Label>
                <Textarea
                  id="rejectionReason"
                  placeholder="Enter reason for rejecting this transfer..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="mt-1"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setRejectionDialogOpen(false);
                  setRejectionReason("");
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (selectedTransfer && rejectionReason.trim()) {
                    rejectTransferMutation.mutate({
                      id: selectedTransfer.id,
                      rejectionReason: rejectionReason.trim()
                    });
                  }
                }}
                disabled={!rejectionReason.trim() || rejectTransferMutation.isPending}
              >
                {rejectTransferMutation.isPending ? "Rejecting..." : "Reject Transfer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/*Rejecturn Shipped Dialog*/}
              <Dialog open={returnShippedDialogOpen} onOpenChange={setReturnShippedDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Shipping Details</DialogTitle>
              <DialogDescription>
                Enter return courier name, return tracking number, and return shipped date for this transfer.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={return_shippmentForm.handleSubmit(handleReturnShippedSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="returnCourierName">Return Courier Name</Label>
                <Input
                  id="returnCourierName"
                  {...return_shippmentForm.register("returnCourierName")}
                  placeholder="Enter return courier name"
                />
                {return_shippmentForm.formState.errors.returnCourierName && (
                  <p className="text-sm text-red-600 mt-1">
                    {return_shippmentForm.formState.errors.returnCourierName.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="returnShippedDate">Return Shipped Date</Label>
                <Input
                  id="returnShippedDate"
                  type="datetime-local"
                  {...return_shippmentForm.register("returnShippedDate")}
                />
                {return_shippmentForm.formState.errors.returnShippedDate && (
                  <p className="text-sm text-red-600 mt-1">
                    {return_shippmentForm.formState.errors.returnShippedDate.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="returnTrackingNumber">Return Tracking Number</Label>
                <Input
                  id="returnTrackingNumber"
                  {...return_shippmentForm.register("returnTrackingNumber")}
                  placeholder="Enter tracking number"
                />
                {return_shippmentForm.formState.errors.returnTrackingNumber && (
                  <p className="text-sm text-red-600 mt-1">
                    {return_shippmentForm.formState.errors.returnTrackingNumber.message}
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setReturnShippedDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={returnShippmentMutation.isPending}>
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
      </div>
  );
}