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
import { ArrowLeft, CheckCircle, Clock, Lock, Edit, ShieldCheck, FileText, User, Save, X, AlertTriangle, TrendingUp, TrendingDown, PlayCircle, Package, Search, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  
  // Inline editing state for spreadsheet-like experience
  const [inlineEdits, setInlineEdits] = useState<Record<number, string>>({});
  const [editingRowId, setEditingRowId] = useState<number | null>(null);
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const sessionId = id ? parseInt(id) : 0;

  const { data: session, isLoading: sessionLoading } = useQuery<any>({
    queryKey: ["/api/audit/sessions", sessionId],
    queryFn: async () => {
      const response = await fetch(`/api/audit/sessions/${sessionId}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch session');
      return response.json();
    },
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

  // Query for pending transactions (for reconciliation)
  const { data: pendingTransactions } = useQuery<{
    checkouts: any[];
    checkins: any[];
    transfers: any[];
  }>({
    queryKey: ["/api/audit/sessions", sessionId, "pending-transactions"],
    queryFn: async () => {
      const response = await fetch(`/api/audit/sessions/${sessionId}/pending-transactions`, {
        credentials: 'include'
      });
      if (!response.ok) return { checkouts: [], checkins: [], transfers: [] };
      return response.json();
    },
    enabled: sessionId > 0 && session?.status === 'reconciliation'
  });

  // Mutation to start reconciliation
  const startReconciliationMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/audit/sessions/${sessionId}/start-reconciliation`, {});
    },
    onSuccess: () => {
      toast({
        title: "Reconciliation Started",
        description: "You can now review discrepancies and pending transactions."
      });
      refetchVerifications();
      // Refetch session to update status
      window.location.reload();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start reconciliation",
        variant: "destructive"
      });
    }
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

  // Inline save mutation for quick physical quantity updates
  const inlineSaveMutation = useMutation({
    mutationFn: async (data: { verificationId: number; physicalQuantity: number; isOverride: boolean }) => {
      const endpoint = data.isOverride 
        ? `/api/audit/verifications/${data.verificationId}/override`
        : `/api/audit/verifications/${data.verificationId}/confirm`;
      return await apiRequest("POST", endpoint, {
        physicalQuantity: data.physicalQuantity,
        notes: data.isOverride ? "Inline edit by audit manager" : null,
        overrideNotes: data.isOverride ? "Physical quantity updated via inline edit" : undefined
      });
    },
    onSuccess: () => {
      toast({
        title: "Saved",
        description: "Physical quantity has been updated."
      });
      setEditingRowId(null);
      refetchVerifications();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save",
        variant: "destructive"
      });
    }
  });

  const handleInlineEdit = (verificationId: number, currentValue: number | null) => {
    setEditingRowId(verificationId);
    setInlineEdits(prev => ({
      ...prev,
      [verificationId]: currentValue?.toString() || ""
    }));
  };

  const handleInlineSave = (verification: Verification) => {
    const value = inlineEdits[verification.id];
    if (value === undefined || value === "") {
      toast({
        title: "Error",
        description: "Please enter a physical quantity",
        variant: "destructive"
      });
      return;
    }
    
    const isOverride = verification.status === 'confirmed' && verification.confirmedBy !== user?.id;
    inlineSaveMutation.mutate({
      verificationId: verification.id,
      physicalQuantity: parseInt(value) || 0,
      isOverride
    });
  };

  const handleInlineCancel = () => {
    setEditingRowId(null);
  };

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

  // Check if in reconciliation mode
  const isReconciliationMode = session?.status === 'reconciliation';
  
  // Counts based on mode
  const confirmedCount = isReconciliationMode 
    ? verifications.filter(v => v.status === 'complete').length
    : verifications.filter(v => v.status === 'confirmed').length;
  const pendingCount = verifications.filter(v => v.status === 'pending').length;
  const shortCount = verifications.filter(v => v.status === 'short').length;
  const excessCount = verifications.filter(v => v.status === 'excess').length;
  
  // Check if ready for reconciliation (all items have physical qty)
  const allItemsVerified = verifications.length > 0 && verifications.every(v => v.physicalQuantity !== null);
  
  // Filter verifications based on search and status filter
  const filteredVerifications = verifications.filter(v => {
    const matchesSearch = searchQuery === "" || 
      v.itemCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.batchNumber && v.batchNumber.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStatus = statusFilter === "all" || v.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });
  
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
              {isReconciliationMode && (
                <>
                  <span>|</span>
                  <Badge className="bg-purple-100 text-purple-800">Reconciliation Mode</Badge>
                </>
              )}
            </div>
          </div>
          {!isReconciliationMode && allItemsVerified && user?.role === 'audit_manager' && (
            <Button 
              onClick={() => startReconciliationMutation.mutate()}
              disabled={startReconciliationMutation.isPending}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <PlayCircle className="w-4 h-4 mr-2" />
              {startReconciliationMutation.isPending ? "Starting..." : "Start Reconciliation"}
            </Button>
          )}
        </div>

        {isReconciliationMode ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Items</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{verifications.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Matched</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{confirmedCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Short</CardTitle>
                <TrendingDown className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{shortCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Excess</CardTitle>
                <TrendingUp className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{excessCount}</div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
        )}

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle>{isReconciliationMode ? 'Inventory Reconciliation' : 'Inventory Verification'}</CardTitle>
                <CardDescription>
                  {isReconciliationMode 
                    ? "Review discrepancies between system and physical quantities. Check pending transactions that may explain differences."
                    : "Verify each item's physical quantity against system records. Click on Physical Qty to enter values."
                  }
                  {user?.role === 'audit_manager' && !isReconciliationMode && " As an Audit Manager, you can override locked records."}
                </CardDescription>
              </div>
              
              {/* Search and Filter Controls */}
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search item code, name, batch..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-full sm:w-64"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-40">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    {isReconciliationMode ? (
                      <>
                        <SelectItem value="complete">Complete</SelectItem>
                        <SelectItem value="short">Short</SelectItem>
                        <SelectItem value="excess">Excess</SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Results count */}
            {(searchQuery || statusFilter !== "all") && (
              <div className="mt-2 text-sm text-muted-foreground">
                Showing {filteredVerifications.length} of {verifications.length} items
                {searchQuery && <span className="ml-1">matching "{searchQuery}"</span>}
              </div>
            )}
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
                    {isReconciliationMode && <TableHead className="text-right">System Qty</TableHead>}
                    <TableHead className="text-right">Physical Qty</TableHead>
                    {isReconciliationMode && <TableHead className="text-right">Discrepancy</TableHead>}
                    <TableHead>Status</TableHead>
                    {!isReconciliationMode && <TableHead>Confirmed By</TableHead>}
                    {!isReconciliationMode && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVerifications.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isReconciliationMode ? 8 : 8} className="text-center py-8 text-muted-foreground">
                        {verifications.length === 0 
                          ? "No items to verify in this audit."
                          : "No items match your search criteria."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredVerifications.map((verification) => (
                      <TableRow 
                        key={verification.id} 
                        className={
                          isReconciliationMode 
                            ? verification.status === 'complete' ? 'bg-green-50' 
                              : verification.status === 'short' ? 'bg-red-50' 
                              : verification.status === 'excess' ? 'bg-orange-50' 
                              : ''
                            : verification.status === 'confirmed' ? 'bg-green-50' : ''
                        }
                      >
                        <TableCell className="font-medium">{verification.serialNumber}</TableCell>
                        <TableCell className="font-mono text-sm">{verification.itemCode}</TableCell>
                        <TableCell>{verification.itemName}</TableCell>
                        <TableCell>{verification.batchNumber || '-'}</TableCell>
                        
                        {/* System Qty - only in reconciliation mode */}
                        {isReconciliationMode && (
                          <TableCell className="text-right font-medium">
                            {verification.systemQuantity}
                          </TableCell>
                        )}
                        
                        {/* Physical Qty */}
                        <TableCell className="text-right">
                          {isReconciliationMode ? (
                            <span className="font-medium">{verification.physicalQuantity}</span>
                          ) : editingRowId === verification.id ? (
                            <div className="flex items-center gap-1 justify-end">
                              <Input
                                type="number"
                                className="w-24 h-8 text-right"
                                value={inlineEdits[verification.id] || ""}
                                onChange={(e) => setInlineEdits(prev => ({
                                  ...prev,
                                  [verification.id]: e.target.value
                                }))}
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleInlineSave(verification);
                                  if (e.key === 'Escape') handleInlineCancel();
                                }}
                              />
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-8 w-8 p-0 text-green-600"
                                onClick={() => handleInlineSave(verification)}
                                disabled={inlineSaveMutation.isPending}
                              >
                                <Save className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-8 w-8 p-0 text-gray-500"
                                onClick={handleInlineCancel}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div 
                              className="flex items-center gap-2 justify-end cursor-pointer hover:bg-muted/50 rounded px-2 py-1"
                              onClick={() => {
                                const canEditInline = verification.status === 'pending' || 
                                  verification.canEdit || 
                                  user?.role === 'audit_manager';
                                if (canEditInline) {
                                  handleInlineEdit(verification.id, verification.physicalQuantity);
                                }
                              }}
                            >
                              <span>{verification.physicalQuantity !== null ? verification.physicalQuantity : '-'}</span>
                              {(verification.status === 'pending' || verification.canEdit || user?.role === 'audit_manager') && (
                                <Edit className="h-3 w-3 text-muted-foreground" />
                              )}
                            </div>
                          )}
                        </TableCell>
                        
                        {/* Discrepancy - only in reconciliation mode */}
                        {isReconciliationMode && (
                          <TableCell className="text-right">
                            <span className={
                              verification.discrepancy === 0 ? 'text-green-600 font-medium' 
                              : (verification.discrepancy || 0) < 0 ? 'text-red-600 font-bold' 
                              : 'text-orange-600 font-bold'
                            }>
                              {verification.discrepancy !== null && verification.discrepancy > 0 ? '+' : ''}
                              {verification.discrepancy}
                            </span>
                          </TableCell>
                        )}
                        
                        {/* Status */}
                        <TableCell>
                          {isReconciliationMode ? (
                            verification.status === 'complete' ? (
                              <Badge className="bg-green-100 text-green-800">
                                <CheckCircle className="w-3 h-3 mr-1" /> Complete
                              </Badge>
                            ) : verification.status === 'short' ? (
                              <Badge className="bg-red-100 text-red-800">
                                <TrendingDown className="w-3 h-3 mr-1" /> Short
                              </Badge>
                            ) : verification.status === 'excess' ? (
                              <Badge className="bg-orange-100 text-orange-800">
                                <TrendingUp className="w-3 h-3 mr-1" /> Excess
                              </Badge>
                            ) : (
                              <Badge className="bg-gray-100 text-gray-800">
                                {verification.status}
                              </Badge>
                            )
                          ) : verification.status === 'confirmed' ? (
                            <Badge className="bg-green-100 text-green-800">
                              <CheckCircle className="w-3 h-3 mr-1" /> Confirmed
                            </Badge>
                          ) : (
                            <Badge className="bg-yellow-100 text-yellow-800">
                              <Clock className="w-3 h-3 mr-1" /> Pending
                            </Badge>
                          )}
                        </TableCell>
                        
                        {/* Confirmed By - only in verification mode */}
                        {!isReconciliationMode && (
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
                        )}
                        
                        {/* Actions - only in verification mode */}
                        {!isReconciliationMode && (
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
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Pending Transactions Section - only in reconciliation mode */}
        {isReconciliationMode && (shortCount > 0 || excessCount > 0) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Pending Transactions
              </CardTitle>
              <CardDescription>
                These pending transactions may help explain discrepancies. Approving or processing them could resolve inventory differences.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {shortCount > 0 && (
                <div className="mb-6">
                  <h4 className="font-semibold text-red-700 mb-3 flex items-center gap-2">
                    <TrendingDown className="h-4 w-4" />
                    Short Items - Check for Pending Checkouts/Issues
                  </h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Physical count is less than system. There may be pending checkout requests that haven't been approved yet.
                  </p>
                  {pendingTransactions?.checkouts && pendingTransactions.checkouts.length > 0 ? (
                    <div className="space-y-2">
                      {pendingTransactions.checkouts.map((tx: any) => (
                        <div key={tx.id} className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded">
                          <div>
                            <span className="font-medium">{tx.itemName}</span>
                            <span className="text-muted-foreground ml-2">({tx.itemSku})</span>
                            <span className="ml-2 text-red-700 font-medium">Qty: {tx.quantity}</span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Requested by: {tx.requesterName || 'Unknown'}
                          </div>
                        </div>
                      ))}
                      <p className="text-sm text-amber-700 mt-2">
                        Approving these pending checkouts would reduce system quantity to match physical count.
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No pending checkout requests found for short items.</p>
                  )}
                </div>
              )}

              {excessCount > 0 && (
                <div>
                  <h4 className="font-semibold text-orange-700 mb-3 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Excess Items - Check for Pending Check-ins
                  </h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Physical count is more than system. There may be pending check-in entries that haven't been processed yet.
                  </p>
                  {pendingTransactions?.checkins && pendingTransactions.checkins.length > 0 ? (
                    <div className="space-y-2">
                      {pendingTransactions.checkins.map((tx: any) => (
                        <div key={tx.id} className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded">
                          <div>
                            <span className="font-medium">{tx.itemName}</span>
                            <span className="text-muted-foreground ml-2">({tx.itemSku})</span>
                            <span className="ml-2 text-orange-700 font-medium">Qty: {tx.quantity}</span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            By: {tx.userName || 'Unknown'}
                          </div>
                        </div>
                      ))}
                      <p className="text-sm text-amber-700 mt-2">
                        Processing these pending check-ins would increase system quantity to match physical count.
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No pending check-in entries found for excess items.</p>
                  )}
                </div>
              )}

              {pendingTransactions?.transfers && pendingTransactions.transfers.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-semibold text-blue-700 mb-3 flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Pending Transfers
                  </h4>
                  <div className="space-y-2">
                    {pendingTransactions.transfers.map((tx: any) => (
                      <div key={tx.id} className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded">
                        <div>
                          <span className="font-medium">{tx.itemName}</span>
                          <span className="text-muted-foreground ml-2">({tx.itemSku})</span>
                          <span className="ml-2 text-blue-700 font-medium">Qty: {tx.quantity}</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {tx.sourceWarehouseName} → {tx.destinationWarehouseName}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

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
