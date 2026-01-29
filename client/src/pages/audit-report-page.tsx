import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import AppLayout from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { 
  Download, 
  FileText, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Calendar,
  Warehouse,
  ClipboardCheck,
  TrendingUp,
  TrendingDown,
  Package
} from "lucide-react";

interface AuditSession {
  id: number;
  auditCode: string;
  title: string;
  warehouseId: number;
  warehouseName: string;
  startDate: string;
  endDate: string;
  status: string;
  notes: string | null;
  createdAt: string;
  totalItems: number;
  confirmedItems: number;
  pendingItems: number;
  shortItems?: number;
  excessItems?: number;
  completeItems?: number;
}

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
  notes: string | null;
}

export default function AuditReportPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<AuditSession[]>({
    queryKey: ['/api/audit/sessions/history'],
    enabled: user?.role === 'audit_manager' || user?.role === 'audit_user'
  });

  const selectedSession = sessions.find(s => s.id.toString() === selectedSessionId);

  const { data: verifications = [], isLoading: verificationsLoading } = useQuery<Verification[]>({
    queryKey: ['/api/audit/sessions', selectedSessionId, 'verifications'],
    queryFn: async () => {
      const response = await fetch(`/api/audit/sessions/${selectedSessionId}/verifications`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch verifications');
      return response.json();
    },
    enabled: !!selectedSessionId
  });

  const reportableSessions = sessions.filter(session => 
    session.status === 'reconciliation' || session.status === 'completed'
  );

  const filteredSessions = reportableSessions.filter(session => {
    if (statusFilter === "all") return true;
    return session.status === statusFilter;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <Badge className="bg-blue-100 text-blue-800"><Clock className="w-3 h-3 mr-1" /> Open</Badge>;
      case 'in_progress':
        return <Badge className="bg-yellow-100 text-yellow-800"><ClipboardCheck className="w-3 h-3 mr-1" /> In Progress</Badge>;
      case 'reconciliation':
        return <Badge className="bg-purple-100 text-purple-800"><AlertTriangle className="w-3 h-3 mr-1" /> Reconciliation</Badge>;
      case 'completed':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" /> Completed</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" /> Cancelled</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">{status}</Badge>;
    }
  };

  const getItemStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-gray-600"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
      case 'confirmed':
        return <Badge className="bg-blue-100 text-blue-800"><CheckCircle className="w-3 h-3 mr-1" /> Verified</Badge>;
      case 'complete':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" /> Complete</Badge>;
      case 'short':
        return <Badge className="bg-red-100 text-red-800"><TrendingDown className="w-3 h-3 mr-1" /> Short</Badge>;
      case 'excess':
        return <Badge className="bg-orange-100 text-orange-800"><TrendingUp className="w-3 h-3 mr-1" /> Excess</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleDownloadReport = async (format: 'csv' | 'pdf') => {
    if (!selectedSessionId) return;
    
    try {
      const response = await fetch(`/api/audit/sessions/${selectedSessionId}/report?format=${format}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate report');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-report-${selectedSession?.auditCode}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Report Downloaded",
        description: `Audit report has been downloaded successfully.`
      });
    } catch (error: any) {
      toast({
        title: "Download Failed",
        description: error.message || "Failed to download report",
        variant: "destructive"
      });
    }
  };

  if (!['audit_manager', 'audit_user'].includes(user?.role || '')) {
    return (
      <AppLayout>
        <div className="p-8">
          <Card>
            <CardContent className="p-8 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
              <p className="text-muted-foreground">Only audit managers and audit users can access audit reports.</p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Audit Report</h1>
          <p className="text-muted-foreground mt-1">
            View and download detailed audit session reports
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Select Audit Session
            </CardTitle>
            <CardDescription>Choose an audit session to view its report</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="reconciliation">Reconciliation</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-[2]">
                <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an audit session..." />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredSessions.map((session) => (
                      <SelectItem key={session.id} value={session.id.toString()}>
                        <div className="flex items-center gap-2">
                          <span className="font-mono">{session.auditCode}</span>
                          <span className="text-muted-foreground">-</span>
                          <span>{session.title}</span>
                          <span className="text-muted-foreground">({session.warehouseName})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {sessionsLoading && (
              <div className="text-center py-4 text-muted-foreground">Loading sessions...</div>
            )}
            
            {!sessionsLoading && reportableSessions.length === 0 && (
              <div className="text-center py-4 text-muted-foreground">No audit sessions with Reconciliation or Completed status found. Reports are only available for audits that have reached reconciliation or completion.</div>
            )}
          </CardContent>
        </Card>

        {selectedSession && (
          <>
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <ClipboardCheck className="h-5 w-5" />
                      {selectedSession.auditCode} - {selectedSession.title}
                    </CardTitle>
                    <CardDescription className="mt-2 flex flex-wrap items-center gap-4">
                      <span className="flex items-center gap-1">
                        <Warehouse className="h-4 w-4" />
                        {selectedSession.warehouseName}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {format(new Date(selectedSession.startDate), 'MMM dd')} - {format(new Date(selectedSession.endDate), 'MMM dd, yyyy')}
                      </span>
                      {getStatusBadge(selectedSession.status)}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => handleDownloadReport('csv')}>
                      <Download className="w-4 h-4 mr-2" />
                      Download CSV
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-muted/50 rounded-lg p-4 text-center">
                    <Package className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                    <div className="text-2xl font-bold">{selectedSession.totalItems}</div>
                    <div className="text-sm text-muted-foreground">Total Items</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4 text-center">
                    <CheckCircle className="h-6 w-6 mx-auto mb-2 text-green-600" />
                    <div className="text-2xl font-bold text-green-600">{selectedSession.completeItems || selectedSession.confirmedItems || 0}</div>
                    <div className="text-sm text-muted-foreground">Matched/Verified</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-4 text-center">
                    <TrendingDown className="h-6 w-6 mx-auto mb-2 text-red-600" />
                    <div className="text-2xl font-bold text-red-600">{selectedSession.shortItems || 0}</div>
                    <div className="text-sm text-muted-foreground">Short Items</div>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-4 text-center">
                    <TrendingUp className="h-6 w-6 mx-auto mb-2 text-orange-600" />
                    <div className="text-2xl font-bold text-orange-600">{selectedSession.excessItems || 0}</div>
                    <div className="text-sm text-muted-foreground">Excess Items</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Detailed Item Report</CardTitle>
                <CardDescription>Complete list of all items in this audit session</CardDescription>
              </CardHeader>
              <CardContent>
                {verificationsLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading verification data...</div>
                ) : verifications.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No verification data available.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="w-16">S.No</TableHead>
                          <TableHead>Item Code</TableHead>
                          <TableHead>Item Name</TableHead>
                          <TableHead>Batch Number</TableHead>
                          <TableHead className="text-right">System Qty</TableHead>
                          <TableHead className="text-right">Physical Qty</TableHead>
                          <TableHead className="text-right">Discrepancy</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Verified By</TableHead>
                          <TableHead>Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {verifications.map((v, index) => (
                          <TableRow key={v.id}>
                            <TableCell className="font-medium">{index + 1}</TableCell>
                            <TableCell className="font-mono">{v.itemCode}</TableCell>
                            <TableCell>{v.itemName}</TableCell>
                            <TableCell>{v.batchNumber || '-'}</TableCell>
                            <TableCell className="text-right">{v.systemQuantity}</TableCell>
                            <TableCell className="text-right">
                              {v.physicalQuantity !== null ? v.physicalQuantity : '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              {v.discrepancy !== null ? (
                                <span className={
                                  v.discrepancy === 0 ? 'text-green-600' :
                                  v.discrepancy < 0 ? 'text-red-600' :
                                  'text-orange-600'
                                }>
                                  {v.discrepancy > 0 ? '+' : ''}{v.discrepancy}
                                </span>
                              ) : '-'}
                            </TableCell>
                            <TableCell>{getItemStatusBadge(v.status)}</TableCell>
                            <TableCell>{v.confirmerName || '-'}</TableCell>
                            <TableCell className="max-w-[200px] truncate" title={v.notes || ''}>
                              {v.notes || '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {!selectedSessionId && !sessionsLoading && sessions.length > 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Select an Audit Session</h2>
              <p className="text-muted-foreground">Choose an audit session from the dropdown above to view its detailed report.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
