import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import AppLayout from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import {
  Loader2,
  Download,
  RefreshCw,
  Building2,
  ShoppingCart,
  TrendingUp,
  DollarSign,
  Package,
  Calendar as CalendarIcon,
  FileText,
  Eye,
  ChartLine,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/hooks/use-currency";
import { useLocation } from "wouter";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  INR: "₹",
  AUD: "A$",
  CAD: "C$",
  JPY: "¥",
  CNY: "¥",
};

interface Client {
  id: number;
  clientCode: string;
  companyName: string;
  currencyCode?: string;
}

interface SalesOrder {
  id: number;
  orderCode: string;
  clientPoReference?: string;
  orderDate: string;
  status: string;
  warehouseId: number;
  warehouseName: string;
  currencyCode: string;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  totalAmountBase?: string;
  conversionRate?: string;
  itemCount: number;
  totalOrderedQty: number;
  totalDispatched: number;
  remainingQty: number;
}

interface ReportData {
  client: {
    id: number;
    clientCode: string;
    companyName: string;
    currencyCode?: string;
  };
  summary: {
    totalOrders: number;
    totalValue: number;
    totalValueBase: number;
    statusCounts: {
      draft: number;
      waiting_approval: number;
      approved: number;
      partial_shipped: number;
      closed: number;
    };
    avgOrderValue: number;
  };
  trend: Array<{
    month: string;
    orders: number;
    value: number;
  }>;
  orders: SalesOrder[];
}

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "waiting_approval", label: "Waiting Approval" },
  { value: "approved", label: "Approved" },
  { value: "partial_shipped", label: "Partial Shipped" },
  { value: "closed", label: "Closed" },
];

const getStatusBadge = (status: string) => {
  const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
    draft: { label: "Draft", variant: "outline" },
    waiting_approval: { label: "Pending", variant: "secondary" },
    approved: { label: "Approved", variant: "default" },
    partial_shipped: { label: "Partial", variant: "secondary" },
    closed: { label: "Closed", variant: "outline" },
  };
  const config = statusConfig[status] || { label: status, variant: "outline" as const };
  return <Badge variant={config.variant} data-testid={`badge-status-${status}`}>{config.label}</Badge>;
};

export default function ClientSalesOrderReportPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { formatCurrency, currencySymbol } = useCurrency();

  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [warehouseFilter, setWarehouseFilter] = useState<string>("all");

  const { data: clients = [], isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: warehouses = [], isLoading: warehousesLoading } = useQuery<any[]>({
    queryKey: ["/api/warehouses"],
  });

  const queryParams = new URLSearchParams();
  if (selectedClientId) queryParams.set("clientId", selectedClientId);
  if (startDate) queryParams.set("startDate", format(startDate, "yyyy-MM-dd"));
  if (endDate) queryParams.set("endDate", format(endDate, "yyyy-MM-dd"));
  if (statusFilter !== "all") queryParams.set("status", statusFilter);
  if (warehouseFilter !== "all") queryParams.set("warehouseId", warehouseFilter);

  const { data: reportData, isLoading: reportLoading, refetch } = useQuery<ReportData>({
    queryKey: ["/api/reports/client-sales-orders", selectedClientId, startDate, endDate, statusFilter, warehouseFilter],
    queryFn: async () => {
      if (!selectedClientId) return null;
      const res = await fetch(`/api/reports/client-sales-orders?${queryParams.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch report");
      return res.json();
    },
    enabled: !!selectedClientId,
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      if (!selectedClientId) throw new Error("Select a client first");
      const res = await fetch(`/api/export/client-sales-orders?${queryParams.toString()}`);
      if (!res.ok) throw new Error("Failed to export data");
      return res.text();
    },
    onSuccess: (data) => {
      const blob = new Blob([data], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `client-sales-orders-${selectedClientId}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({
        title: "Export successful",
        description: "Client sales order report has been exported to CSV.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Export failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const formatOrderCurrency = (value: string | number, currencyCode?: string) => {
    const numValue = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(numValue)) return "$0.00";
    const symbol = currencyCode ? CURRENCY_SYMBOLS[currencyCode] || currencyCode + " " : currencySymbol;
    return symbol + numValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleViewOrder = (orderId: number) => {
    setLocation(`/sales-orders/${orderId}`);
  };

  const activeClients = clients.filter((c) => c.id);

  if (clientsLoading || warehousesLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-medium text-gray-800" data-testid="text-page-title">
            Client Sales Order Report
          </h1>
          <p className="text-gray-600">Analyze sales orders by client with flexible filters</p>
        </div>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={!selectedClientId}
            data-testid="button-refresh"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button
            onClick={() => exportMutation.mutate()}
            disabled={exportMutation.isPending || !selectedClientId}
            data-testid="button-export"
          >
            {exportMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Export CSV
          </Button>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Filter Criteria
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label>Client *</Label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger data-testid="select-client">
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {activeClients.map((client) => (
                    <SelectItem key={client.id} value={client.id.toString()}>
                      {client.companyName} ({client.clientCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                    data-testid="button-start-date"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "MMM dd, yyyy") : "From date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                    data-testid="button-end-date"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "MMM dd, yyyy") : "To date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-testid="select-status">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Warehouse</Label>
              <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                <SelectTrigger data-testid="select-warehouse">
                  <SelectValue placeholder="All Warehouses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Warehouses</SelectItem>
                  {warehouses.map((wh: any) => (
                    <SelectItem key={wh.id} value={wh.id.toString()}>
                      {wh.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {startDate || endDate ? (
            <div className="mt-4 flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStartDate(undefined);
                  setEndDate(undefined);
                }}
                data-testid="button-clear-dates"
              >
                Clear Dates
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {!selectedClientId ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-gray-500">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Select a Client</p>
              <p className="text-sm">Choose a client from the dropdown above to view their sales order report</p>
            </div>
          </CardContent>
        </Card>
      ) : reportLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : reportData ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Total Orders</p>
                    <p className="text-2xl font-bold" data-testid="text-total-orders">
                      {reportData.summary.totalOrders}
                    </p>
                  </div>
                  <ShoppingCart className="h-8 w-8 text-primary opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Total Value</p>
                    <p className="text-2xl font-bold" data-testid="text-total-value">
                      {formatCurrency(reportData.summary.totalValue)}
                    </p>
                  </div>
                  <DollarSign className="h-8 w-8 text-green-500 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Avg Order Value</p>
                    <p className="text-2xl font-bold" data-testid="text-avg-value">
                      {formatCurrency(reportData.summary.avgOrderValue)}
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-blue-500 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Approved</p>
                    <p className="text-2xl font-bold text-green-600" data-testid="text-approved-count">
                      {reportData.summary.statusCounts.approved}
                    </p>
                  </div>
                  <Package className="h-8 w-8 text-green-500 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Pending</p>
                    <p className="text-2xl font-bold text-yellow-600" data-testid="text-pending-count">
                      {reportData.summary.statusCounts.waiting_approval + reportData.summary.statusCounts.draft}
                    </p>
                  </div>
                  <FileText className="h-8 w-8 text-yellow-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
          </div>

          {reportData.trend.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ChartLine className="h-5 w-5" />
                    Orders Trend
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={reportData.trend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="orders" fill="#3b82f6" name="Orders" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Value Trend
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={reportData.trend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip 
                        formatter={(value: number) => formatCurrency(value)}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke="#10b981" 
                        strokeWidth={2}
                        name="Value"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Sales Orders ({reportData.orders.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {reportData.orders.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No orders found for the selected criteria
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order Code</TableHead>
                        <TableHead>Client PO</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Warehouse</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-center">Qty</TableHead>
                        <TableHead className="text-center">Dispatched</TableHead>
                        <TableHead className="text-center">Remaining</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData.orders.map((order) => (
                        <TableRow key={order.id} data-testid={`row-order-${order.id}`}>
                          <TableCell className="font-mono font-medium">
                            {order.orderCode}
                          </TableCell>
                          <TableCell className="text-gray-500">
                            {order.clientPoReference || "-"}
                          </TableCell>
                          <TableCell>
                            {format(new Date(order.orderDate), "MMM dd, yyyy")}
                          </TableCell>
                          <TableCell>{getStatusBadge(order.status)}</TableCell>
                          <TableCell>{order.warehouseName}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatOrderCurrency(order.totalAmount, order.currencyCode)}
                          </TableCell>
                          <TableCell className="text-center">{order.totalOrderedQty}</TableCell>
                          <TableCell className="text-center text-green-600">
                            {order.totalDispatched}
                          </TableCell>
                          <TableCell className="text-center">
                            {order.remainingQty > 0 ? (
                              <span className="text-orange-600">{order.remainingQty}</span>
                            ) : (
                              <span className="text-gray-400">0</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewOrder(order.id)}
                              data-testid={`button-view-order-${order.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Status Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Draft</p>
                  <p className="text-xl font-bold" data-testid="text-draft-count">
                    {reportData.summary.statusCounts.draft}
                  </p>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Waiting Approval</p>
                  <p className="text-xl font-bold text-yellow-600" data-testid="text-waiting-count">
                    {reportData.summary.statusCounts.waiting_approval}
                  </p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Approved</p>
                  <p className="text-xl font-bold text-green-600">
                    {reportData.summary.statusCounts.approved}
                  </p>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Partial Shipped</p>
                  <p className="text-xl font-bold text-blue-600" data-testid="text-partial-count">
                    {reportData.summary.statusCounts.partial_shipped}
                  </p>
                </div>
                <div className="text-center p-4 bg-gray-100 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Closed</p>
                  <p className="text-xl font-bold" data-testid="text-closed-count">
                    {reportData.summary.statusCounts.closed}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </AppLayout>
  );
}
