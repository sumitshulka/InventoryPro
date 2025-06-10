import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Package, Warehouse, Calendar, User, RefreshCw, CheckCircle, XCircle } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { formatDateTime } from "@/lib/utils";
import { formatNumber } from "@/lib/formatters";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface RejectedGoods {
  id: number;
  transferId: number;
  itemId: number;
  quantity: number;
  rejectionReason: string;
  rejectedBy: number;
  rejectedAt: string;
  warehouseId: number;
  status: string;
  notes?: string;
  item?: {
    id: number;
    name: string;
    sku: string;
  };
  warehouse?: {
    id: number;
    name: string;
    location: string;
  };
  rejectedByUser?: {
    id: number;
    name: string;
    email: string;
  };
}

export default function RejectedGoodsPage() {
  const [selectedItem, setSelectedItem] = useState<RejectedGoods | null>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'dispose' | 'return' | 'restock'>('dispose');
  const [actionNotes, setActionNotes] = useState('');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: rejectedGoods = [], isLoading } = useQuery({
    queryKey: ['/api/rejected-goods'],
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: number; status: string; notes?: string }) => {
      return apiRequest(`/api/rejected-goods/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, notes }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rejected-goods'] });
      toast({
        title: "Status Updated",
        description: "Rejected goods status has been updated successfully.",
      });
      setActionDialogOpen(false);
      setSelectedItem(null);
      setActionNotes('');
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update rejected goods status.",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'rejected':
        return <Badge variant="destructive" className="flex items-center gap-1"><XCircle className="w-3 h-3" />Rejected</Badge>;
      case 'disposed':
        return <Badge variant="secondary" className="flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Disposed</Badge>;
      case 'returned':
        return <Badge variant="outline" className="flex items-center gap-1"><RefreshCw className="w-3 h-3" />Returned</Badge>;
      case 'restocked':
        return <Badge variant="default" className="flex items-center gap-1"><CheckCircle className="w-3 h-3" />Restocked</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleAction = (item: RejectedGoods, action: 'dispose' | 'return' | 'restock') => {
    setSelectedItem(item);
    setActionType(action);
    setActionDialogOpen(true);
  };

  const handleStatusUpdate = () => {
    if (!selectedItem) return;

    let newStatus = actionType;
    if (actionType === 'dispose') newStatus = 'disposed';
    if (actionType === 'return') newStatus = 'returned';
    if (actionType === 'restock') newStatus = 'restocked';

    updateStatusMutation.mutate({
      id: selectedItem.id,
      status: newStatus,
      notes: actionNotes,
    });
  };

  const filteredGoods = (rejectedGoods as RejectedGoods[]).filter(item => item.status === 'rejected');
  const processedGoods = (rejectedGoods as RejectedGoods[]).filter(item => item.status !== 'rejected');

  const getActionTitle = (action: string) => {
    switch (action) {
      case 'dispose': return 'Dispose Item';
      case 'return': return 'Return to Source';
      case 'restock': return 'Restock Item';
      default: return 'Update Status';
    }
  };

  const getActionDescription = (action: string) => {
    switch (action) {
      case 'dispose': return 'Mark this item as disposed. This action cannot be undone.';
      case 'return': return 'Return this item to the source warehouse for further processing.';
      case 'restock': return 'Restock this item back into warehouse inventory if condition allows.';
      default: return 'Update the status of this rejected item.';
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Rejected Goods Management</h1>
        </div>

        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pending">Pending Action ({filteredGoods.length})</TabsTrigger>
            <TabsTrigger value="processed">Processed ({processedGoods.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  Items Requiring Action
                </CardTitle>
              </CardHeader>
              <CardContent>
                {filteredGoods.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No rejected goods requiring action
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead>Quantity</TableHead>
                          <TableHead>Warehouse</TableHead>
                          <TableHead>Rejection Reason</TableHead>
                          <TableHead>Rejected By</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredGoods.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{item.item?.name}</div>
                                <div className="text-sm text-gray-500">SKU: {item.item?.sku}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="font-medium">{formatNumber(item.quantity)}</span>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <div className="font-medium">{item.warehouse?.name}</div>
                                <div className="text-gray-500">{item.warehouse?.location}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="max-w-xs truncate" title={item.rejectionReason}>
                                {item.rejectionReason}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <div className="font-medium">{item.rejectedByUser?.name}</div>
                                <div className="text-gray-500">{item.rejectedByUser?.email}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-sm">
                                <Calendar className="w-3 h-3" />
                                {formatDateTime(item.rejectedAt)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleAction(item, 'restock')}
                                  className="text-green-600"
                                >
                                  <Package className="h-3 w-3 mr-1" />
                                  Restock
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleAction(item, 'return')}
                                  className="text-blue-600"
                                >
                                  <RefreshCw className="h-3 w-3 mr-1" />
                                  Return
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleAction(item, 'dispose')}
                                  className="text-red-600"
                                >
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Dispose
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="processed" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Processed Items
                </CardTitle>
              </CardHeader>
              <CardContent>
                {processedGoods.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No processed rejected goods
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead>Quantity</TableHead>
                          <TableHead>Warehouse</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Rejected Date</TableHead>
                          <TableHead>Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {processedGoods.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{item.item?.name}</div>
                                <div className="text-sm text-gray-500">SKU: {item.item?.sku}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="font-medium">{formatNumber(item.quantity)}</span>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <div className="font-medium">{item.warehouse?.name}</div>
                                <div className="text-gray-500">{item.warehouse?.location}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(item.status)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-sm">
                                <Calendar className="w-3 h-3" />
                                {formatDateTime(item.rejectedAt)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="max-w-xs truncate" title={item.notes || ''}>
                                {item.notes || '—'}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Action Dialog */}
        <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{getActionTitle(actionType)}</DialogTitle>
              <DialogDescription>
                {getActionDescription(actionType)}
              </DialogDescription>
            </DialogHeader>
            
            {selectedItem && (
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-md">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <Label className="text-gray-500">Item</Label>
                      <p className="font-medium">{selectedItem.item?.name}</p>
                    </div>
                    <div>
                      <Label className="text-gray-500">Quantity</Label>
                      <p className="font-medium">{formatNumber(selectedItem.quantity)}</p>
                    </div>
                    <div>
                      <Label className="text-gray-500">Warehouse</Label>
                      <p className="font-medium">{selectedItem.warehouse?.name}</p>
                    </div>
                    <div>
                      <Label className="text-gray-500">Rejection Reason</Label>
                      <p className="font-medium">{selectedItem.rejectionReason}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="actionNotes">Action Notes</Label>
                  <Textarea
                    id="actionNotes"
                    value={actionNotes}
                    onChange={(e) => setActionNotes(e.target.value)}
                    placeholder="Add notes about this action..."
                    rows={3}
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setActionDialogOpen(false);
                  setSelectedItem(null);
                  setActionNotes('');
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleStatusUpdate}
                disabled={updateStatusMutation.isPending}
                variant={actionType === 'dispose' ? 'destructive' : 'default'}
              >
                {updateStatusMutation.isPending ? 'Processing...' : `Confirm ${getActionTitle(actionType)}`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}