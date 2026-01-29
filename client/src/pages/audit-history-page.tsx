import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import AppLayout from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { 
  Search, 
  Filter, 
  Download, 
  FileText, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Calendar,
  Warehouse,
  ArrowRight,
  RefreshCw
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

export default function AuditHistoryPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [warehouseFilter, setWarehouseFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: sessions = [], isLoading, refetch } = useQuery<AuditSession[]>({
    queryKey: ['/api/audit/sessions/history'],
    queryFn: async () => {
      const response = await fetch('/api/audit/sessions/history', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch audit sessions');
      return response.json();
    },
    enabled: user?.role === 'audit_manager' || user?.role === 'audit_user'
  });

  const { data: warehouses = [] } = useQuery<any[]>({
    queryKey: ['/api/warehouses']
  });

  const filteredSessions = sessions.filter(session => {
    const matchesSearch = searchQuery === "" || 
      session.auditCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      session.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      session.warehouseName.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || session.status === statusFilter;
    
    const matchesWarehouse = warehouseFilter === "all" || 
      session.warehouseId.toString() === warehouseFilter;
    
    const sessionDate = new Date(session.startDate);
    const matchesDateFrom = !dateFrom || sessionDate >= new Date(dateFrom);
    const matchesDateTo = !dateTo || sessionDate <= new Date(dateTo);
    
    return matchesSearch && matchesStatus && matchesWarehouse && matchesDateFrom && matchesDateTo;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <Badge className="bg-blue-100 text-blue-800"><Clock className="w-3 h-3 mr-1" /> Open</Badge>;
      case 'in_progress':
        return <Badge className="bg-yellow-100 text-yellow-800"><RefreshCw className="w-3 h-3 mr-1" /> In Progress</Badge>;
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

  const handleDownloadReport = async (session: AuditSession, format: 'pdf' | 'csv') => {
    try {
      const response = await fetch(`/api/audit/sessions/${session.id}/report?format=${format}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate report');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-report-${session.auditCode}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Report Downloaded",
        description: `Audit report for ${session.auditCode} has been downloaded.`
      });
    } catch (error: any) {
      toast({
        title: "Download Failed",
        description: error.message || "Failed to download report",
        variant: "destructive"
      });
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setWarehouseFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  if (!['audit_manager', 'audit_user'].includes(user?.role || '')) {
    return (
      <AppLayout>
        <div className="p-8">
          <Card>
            <CardContent className="p-8 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
              <p className="text-muted-foreground">Only audit managers and audit users can access audit history.</p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">Audit Sessions History</h1>
            <p className="text-muted-foreground mt-1">
              View all audit sessions you and your team have participated in
            </p>
          </div>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
            <CardDescription>Search and filter audit sessions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search code, title, warehouse..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="reconciliation">Reconciliation</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Warehouse" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Warehouses</SelectItem>
                  {warehouses.map((wh: any) => (
                    <SelectItem key={wh.id} value={wh.id.toString()}>{wh.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  placeholder="From"
                />
              </div>
              
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  placeholder="To"
                />
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear
                </Button>
              </div>
            </div>
            
            {(searchQuery || statusFilter !== "all" || warehouseFilter !== "all" || dateFrom || dateTo) && (
              <div className="mt-3 text-sm text-muted-foreground">
                Showing {filteredSessions.length} of {sessions.length} sessions
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Audit Sessions</CardTitle>
            <CardDescription>
              {sessions.length} total audit sessions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading audit sessions...</div>
            ) : filteredSessions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {sessions.length === 0 
                  ? "No audit sessions found for your team."
                  : "No sessions match your filter criteria."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Audit Code</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Warehouse</TableHead>
                      <TableHead>Date Range</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSessions.map((session) => (
                      <TableRow key={session.id}>
                        <TableCell className="font-mono font-medium">
                          {session.auditCode}
                        </TableCell>
                        <TableCell>{session.title}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Warehouse className="w-4 h-4 text-muted-foreground" />
                            {session.warehouseName}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            {format(new Date(session.startDate), 'MMM dd')} - {format(new Date(session.endDate), 'MMM dd, yyyy')}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <div className="text-sm">
                              {session.status === 'reconciliation' || session.status === 'completed' ? (
                                <>
                                  <span className="text-green-600">{session.completeItems || 0}</span> matched, 
                                  <span className="text-red-600 ml-1">{session.shortItems || 0}</span> short, 
                                  <span className="text-orange-600 ml-1">{session.excessItems || 0}</span> excess
                                </>
                              ) : (
                                <>
                                  <span className="text-green-600">{session.confirmedItems}</span>/{session.totalItems} verified
                                </>
                              )}
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5">
                              <div 
                                className="bg-primary h-1.5 rounded-full" 
                                style={{ width: `${session.totalItems > 0 ? (session.confirmedItems / session.totalItems) * 100 : 0}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(session.status)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {(session.status === 'open' || session.status === 'in_progress' || session.status === 'reconciliation') && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => setLocation(`/audit-spreadsheet/${session.id}`)}
                              >
                                <ArrowRight className="w-4 h-4 mr-1" />
                                Open
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDownloadReport(session, 'csv')}
                              title="Download CSV Report"
                            >
                              <Download className="w-4 h-4" />
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
      </div>
    </AppLayout>
  );
}
