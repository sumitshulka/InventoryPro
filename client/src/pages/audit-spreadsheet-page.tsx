import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { format } from "date-fns";
import AppLayout from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { ArrowLeft, CheckCircle, Clock, Lock, Edit, ShieldCheck, FileText, User } from "lucide-react";

interface Verification {
  id: number;
  serialNumber: number;
  itemId: number;
  itemCode: string;
  itemName: string;
  batchNumber: string | null;
  systemQuantity: number;
  physicalQuantity: number | null;
  discrepancy: number | null;
  status: string;
  confirmedBy: number | null;
  confirmerName: string | null;
  confirmedAt: string | null;
  lockedBy: number | null;
  overrideBy: number | null;
  overriderName: string | null;
  overrideAt: string | null;
  overrideNotes: string | null;
  canEdit: boolean;
  isLocked: boolean;
  notes: string | null;
}

export default function AuditSpreadsheetPage() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [editingItem, setEditingItem] = useState<Verification | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isOverrideDialogOpen, setIsOverrideDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    batchNumber: "",
    physicalQuantity: "",
    notes: "",
    overrideNotes: ""
  });

  const sessionId = id ? parseInt(id) : 0;

  const { data: session, isLoading: sessionLoading } = useQuery<any>({
    queryKey: ["/api/audit/sessions", sessionId],
    enabled: sessionId > 0
  });

  const { data: verifications = [], refetch: refetchVerifications, isLoading: verificationsLoading } = useQuery<Verification[]>({
    queryKey: ["/api/audit/sessions", sessionId, "verifications"],
    queryFn: async () => {
      const response = await fetch(`/api/audit/sessions/${sessionId}/verifications`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch verifications');
      return response.json();
    },
    enabled: sessionId > 0
  });

  const { data: actionLogs = [] } = useQuery<any[]>({
    queryKey: ["/api/audit/sessions", sessionId, "logs"],
    queryFn: async () => {
      const response = await fetch(`/api/audit/sessions/${sessionId}/logs`, {
        credentials: 'include'
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: sessionId > 0 && user?.role === 'audit_manager'
  });

  const confirmMutation = useMutation({
    mutationFn: async (data: { verificationId: number; batchNumber: string; physicalQuantity: number; notes: string }) => {
      return await apiRequest("POST", `/api/audit/verifications/${data.verificationId}/confirm`, {
        batchNumber: data.batchNumber || null,
        physicalQuantity: data.physicalQuantity,
        notes: data.notes || null
      });
    },
    onSuccess: () => {
      toast({
        title: "Item Confirmed",
        description: "The verification has been confirmed and locked."
      });
      setIsConfirmDialogOpen(false);
      setEditingItem(null);
      setFormData({ batchNumber: "", physicalQuantity: "", notes: "", overrideNotes: "" });
      refetchVerifications();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to confirm item",
        variant: "destructive"
      });
    }
  });

  const overrideMutation = useMutation({
    mutationFn: async (data: { verificationId: number; batchNumber: string; physicalQuantity: number; notes: string; overrideNotes: string }) => {
      return await apiRequest("POST", `/api/audit/verifications/${data.verificationId}/override`, {
        batchNumber: data.batchNumber || null,
        physicalQuantity: data.physicalQuantity,
        notes: data.notes || null,
        overrideNotes: data.overrideNotes
      });
    },
    onSuccess: () => {
      toast({
        title: "Override Applied",
        description: "The verification has been overridden. This action has been logged."
      });
      setIsOverrideDialogOpen(false);
      setEditingItem(null);
      setFormData({ batchNumber: "", physicalQuantity: "", notes: "", overrideNotes: "" });
      refetchVerifications();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to override item",
        variant: "destructive"
      });
    }
  });

  const handleConfirmClick = (verification: Verification) => {
    setEditingItem(verification);
    setFormData({
      batchNumber: verification.batchNumber || "",
      physicalQuantity: verification.physicalQuantity?.toString() || "",
      notes: verification.notes || "",
      overrideNotes: ""
    });
    setIsConfirmDialogOpen(true);
  };

  const handleOverrideClick = (verification: Verification) => {
    setEditingItem(verification);
    setFormData({
      batchNumber: verification.batchNumber || "",
      physicalQuantity: verification.physicalQuantity?.toString() || "",
      notes: verification.notes || "",
      overrideNotes: ""
    });
    setIsOverrideDialogOpen(true);
  };

  const handleConfirmSubmit = () => {
    if (!editingItem) return;
    confirmMutation.mutate({
      verificationId: editingItem.id,
      batchNumber: formData.batchNumber,
      physicalQuantity: parseInt(formData.physicalQuantity) || 0,
      notes: formData.notes
    });
  };

  const handleOverrideSubmit = () => {
    if (!editingItem || !formData.overrideNotes) {
      toast({
        title: "Override Notes Required",
        description: "Please provide a reason for the override.",
        variant: "destructive"
      });
      return;
    }
    overrideMutation.mutate({
      verificationId: editingItem.id,
      batchNumber: formData.batchNumber,
      physicalQuantity: parseInt(formData.physicalQuantity) || 0,
      notes: formData.notes,
      overrideNotes: formData.overrideNotes
    });
  };

  if (!['audit_manager', 'audit_user'].includes(user?.role || '')) {
    return (
      <AppLayout>
        <div className="p-8">
          <Card>
            <CardContent className="p-8 text-center">
              <ShieldCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
              <p className="text-muted-foreground">Only audit managers and audit users can access audit spreadsheets.</p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (sessionLoading || verificationsLoading) {
    return (
      <AppLayout>
        <div className="p-8">
          <div className="text-center py-8 text-muted-foreground">Loading audit data...</div>
        </div>
      </AppLayout>
    );
  }

  const confirmedCount = verifications.filter(v => v.status === 'confirmed').length;
  const pendingCount = verifications.filter(v => v.status === 'pending').length;
  
  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setLocation('/audit-dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>

        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">{session?.title || 'Audit Verification'}</h1>
            <div className="flex items-center gap-4 mt-2 text-muted-foreground">
              <span className="flex items-center gap-1">
                <FileText className="w-4 h-4" />
                {session?.auditCode}
              </span>
              <span>|</span>
              <span>{session?.warehouseName}</span>
              <span>|</span>
              <span>
                {session?.startDate && format(new Date(session.startDate), 'MMM dd')} - {session?.endDate && format(new Date(session.endDate), 'MMM dd, yyyy')}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Items</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{verifications.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Confirmed</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{confirmedCount}</div>
            </CardContent>
          </Card>
          </div>

        <Card>
          <CardHeader>
            <CardTitle>Inventory Verification</CardTitle>
            <CardDescription>
              Verify each item's physical quantity against system records. Click "Confirm" to lock your verification.
              {user?.role === 'audit_manager' && " As an Audit Manager, you can override locked records."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-16">S.No</TableHead>
                    <TableHead>Item Code</TableHead>
                    <TableHead>Item Name</TableHead>
                    <TableHead>Batch Number</TableHead>
                    <TableHead className="text-right">Physical Qty</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Confirmed By</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {verifications.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No items to verify in this audit.
                      </TableCell>
                    </TableRow>
                  ) : (
                    verifications.map((verification) => (
                      <TableRow key={verification.id} className={verification.status === 'confirmed' ? 'bg-green-50' : ''}>
                        <TableCell className="font-medium">{verification.serialNumber}</TableCell>
                        <TableCell className="font-mono text-sm">{verification.itemCode}</TableCell>
                        <TableCell>{verification.itemName}</TableCell>
                        <TableCell>{verification.batchNumber || '-'}</TableCell>
                        <TableCell className="text-right">
                          {verification.physicalQuantity !== null ? verification.physicalQuantity : '-'}
                        </TableCell>
                        <TableCell>
                          {verification.status === 'confirmed' ? (
                            <Badge className="bg-green-100 text-green-800">
                              <CheckCircle className="w-3 h-3 mr-1" /> Confirmed
                            </Badge>
                          ) : (
                            <Badge className="bg-yellow-100 text-yellow-800">
                              <Clock className="w-3 h-3 mr-1" /> Pending
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {verification.confirmerName ? (
                            <div className="flex items-center gap-1 text-sm">
                              <User className="w-3 h-3" />
                              <span>{verification.confirmerName}</span>
                              {verification.isLocked && <Lock className="w-3 h-3 text-amber-500" />}
                            </div>
                          ) : '-'}
                          {verification.overriderName && (
                            <div className="text-xs text-amber-600 mt-1">
                              Overridden by {verification.overriderName}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {verification.status === 'pending' ? (
                            <Button size="sm" onClick={() => handleConfirmClick(verification)}>
                              <CheckCircle className="w-3 h-3 mr-1" /> Confirm
                            </Button>
                          ) : verification.canEdit ? (
                            <Button size="sm" variant="outline" onClick={() => handleConfirmClick(verification)}>
                              <Edit className="w-3 h-3 mr-1" /> Edit
                            </Button>
                          ) : user?.role === 'audit_manager' ? (
                            <Button size="sm" variant="outline" className="text-amber-600 border-amber-600" onClick={() => handleOverrideClick(verification)}>
                              <Lock className="w-3 h-3 mr-1" /> Override
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Lock className="w-3 h-3" /> Locked
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {user?.role === 'audit_manager' && actionLogs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Audit Action Logs</CardTitle>
              <CardDescription>Complete audit trail of all actions taken</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {actionLogs.map((log: any) => (
                  <div key={log.id} className="flex items-start gap-3 p-2 border rounded text-sm">
                    <div className="flex-1">
                      <span className="font-medium">{log.performerName}</span>
                      <span className="text-muted-foreground"> - {log.actionType}</span>
                      {log.notes && <p className="text-muted-foreground mt-1">{log.notes}</p>}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(log.performedAt), 'MMM dd, HH:mm')}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Verification</DialogTitle>
              <DialogDescription>
                Enter the physical count and batch number for {editingItem?.itemName}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Item Code</Label>
                <Input value={editingItem?.itemCode || ''} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="batchNumber">Batch Number</Label>
                <Input
                  id="batchNumber"
                  placeholder="Enter batch number"
                  value={formData.batchNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, batchNumber: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="physicalQuantity">Physical Quantity *</Label>
                <Input
                  id="physicalQuantity"
                  type="number"
                  placeholder="Enter counted quantity"
                  value={formData.physicalQuantity}
                  onChange={(e) => setFormData(prev => ({ ...prev, physicalQuantity: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Any additional notes..."
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsConfirmDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleConfirmSubmit} disabled={confirmMutation.isPending}>
                {confirmMutation.isPending ? "Confirming..." : "Confirm & Lock"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isOverrideDialogOpen} onOpenChange={setIsOverrideDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-amber-600">Override Verification</DialogTitle>
              <DialogDescription>
                You are about to override a locked record. This action will be logged for audit purposes.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm">
                <p className="font-medium text-amber-800">Original Confirmation</p>
                <p className="text-amber-700">
                  Confirmed by: {editingItem?.confirmerName} | 
                  Quantity: {editingItem?.physicalQuantity} | 
                  Batch: {editingItem?.batchNumber || 'N/A'}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Item Code</Label>
                <Input value={editingItem?.itemCode || ''} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="batchNumberOverride">Batch Number</Label>
                <Input
                  id="batchNumberOverride"
                  placeholder="Enter batch number"
                  value={formData.batchNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, batchNumber: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="physicalQuantityOverride">Physical Quantity *</Label>
                <Input
                  id="physicalQuantityOverride"
                  type="number"
                  placeholder="Enter corrected quantity"
                  value={formData.physicalQuantity}
                  onChange={(e) => setFormData(prev => ({ ...prev, physicalQuantity: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="overrideNotes" className="text-amber-700">Override Reason *</Label>
                <Textarea
                  id="overrideNotes"
                  placeholder="Explain why you are overriding this record..."
                  value={formData.overrideNotes}
                  onChange={(e) => setFormData(prev => ({ ...prev, overrideNotes: e.target.value }))}
                  className="border-amber-300"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsOverrideDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleOverrideSubmit} 
                disabled={overrideMutation.isPending || !formData.overrideNotes}
                className="bg-amber-600 hover:bg-amber-700"
              >
                {overrideMutation.isPending ? "Overriding..." : "Override Record"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
