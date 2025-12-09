import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import AppLayout from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Loader2,
  Plus,
  Eye,
  FileText,
  Building2,
  Warehouse,
  Calendar,
  Search,
  Package,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useCurrency } from "@/hooks/use-currency";
import { format } from "date-fns";

interface EnrichedSalesOrder {
  id: number;
  orderCode: string;
  clientPoReference?: string;
  clientId: number;
  warehouseId: number;
  status: string;
  orderDate: string;
  subtotal: string;
  totalTax: string;
  grandTotal: string;
  currencyCode?: string;
  conversionRate?: string;
  grandTotalBase?: string;
  shippingAddress: string | null;
  notes: string | null;
  createdBy: number;
  createdAt: string;
  client?: {
    id: number;
    companyName: string;
    clientCode: string;
  };
  warehouse?: {
    id: number;
    name: string;
  };
  creator?: {
    id: number;
    name: string;
  };
  itemCount: number;
}

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

export default function SalesOrdersListPage() {
  const { user } = useAuth();
  const { currency: orgCurrency, currencySymbol: orgCurrencySymbol } = useCurrency();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const canCreate = user?.role === "admin" || user?.role === "manager" || user?.role === "employee";

  const { data: salesOrders = [], isLoading } = useQuery<EnrichedSalesOrder[]>({
    queryKey: ["/api/sales-orders"],
  });

  const filteredOrders = salesOrders.filter((order) => {
    const matchesSearch =
      searchQuery === "" ||
      order.orderCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.client?.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.warehouse?.name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || order.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: salesOrders.length,
    draft: salesOrders.filter((o) => o.status === "draft").length,
    waitingApproval: salesOrders.filter((o) => o.status === "waiting_approval").length,
    approved: salesOrders.filter((o) => o.status === "approved").length,
    partialShipped: salesOrders.filter((o) => o.status === "partial_shipped").length,
    closed: salesOrders.filter((o) => o.status === "closed").length,
  };

  return (
    <AppLayout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sales Orders</h1>
            <p className="text-gray-500">Manage sales orders, dispatch, and delivery tracking</p>
          </div>
          {canCreate && (
            <Button
              onClick={() => setLocation("/sales-orders/new")}
              data-testid="button-new-sales-order"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Sales Order
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Card className="cursor-pointer hover:bg-gray-50" onClick={() => setStatusFilter("all")}>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
              <div className="text-sm text-gray-500">Total</div>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:bg-gray-50"
            onClick={() => setStatusFilter("draft")}
          >
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-gray-600">{stats.draft}</div>
              <div className="text-sm text-gray-500">Draft</div>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:bg-yellow-50"
            onClick={() => setStatusFilter("waiting_approval")}
          >
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-yellow-600">{stats.waitingApproval}</div>
              <div className="text-sm text-gray-500">Pending</div>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:bg-blue-50"
            onClick={() => setStatusFilter("approved")}
          >
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.approved}</div>
              <div className="text-sm text-gray-500">Approved</div>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:bg-purple-50"
            onClick={() => setStatusFilter("partial_shipped")}
          >
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">{stats.partialShipped}</div>
              <div className="text-sm text-gray-500">Partial</div>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:bg-green-50"
            onClick={() => setStatusFilter("closed")}
          >
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{stats.closed}</div>
              <div className="text-sm text-gray-500">Closed</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Orders ({filteredOrders.length})
              </CardTitle>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search orders..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 w-full sm:w-64"
                    data-testid="input-search-orders"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-48" data-testid="select-status-filter">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="waiting_approval">Waiting Approval</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="partial_shipped">Partially Shipped</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {searchQuery || statusFilter !== "all"
                  ? "No orders match your search criteria"
                  : "No sales orders yet. Create your first order to get started."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order Code</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Warehouse</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created By</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => (
                      <TableRow key={order.id} data-testid={`row-order-${order.id}`}>
                        <TableCell>
                          <div className="font-mono text-sm font-medium">
                            {order.orderCode}
                          </div>
                          {order.clientPoReference && (
                            <div className="text-xs text-gray-500" data-testid={`text-po-ref-${order.id}`}>
                              PO: {order.clientPoReference}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-gray-400" />
                            <div>
                              <div className="font-medium">
                                {order.client?.companyName || "Unknown"}
                              </div>
                              <div className="text-xs text-gray-500">
                                {order.client?.clientCode}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Warehouse className="h-4 w-4 text-gray-400" />
                            {order.warehouse?.name || "Unknown"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            {format(new Date(order.orderDate), "MMM dd, yyyy")}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Package className="h-4 w-4 text-gray-400" />
                            {order.itemCount}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {(() => {
                            const orderCurrency = order.currencyCode || orgCurrency;
                            const orderCurrencySymbol = getCurrencySymbol(orderCurrency);
                            const grandTotal = parseFloat(order.grandTotal || "0") || 0;
                            const grandTotalBase = parseFloat(order.grandTotalBase || "0") || 0;
                            const showBase = order.currencyCode && order.currencyCode !== orgCurrency && order.grandTotalBase;
                            return (
                              <div>
                                <div className="font-medium">
                                  {orderCurrencySymbol}{grandTotal.toLocaleString("en-US", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </div>
                                {showBase && (
                                  <div className="text-xs text-gray-400">
                                    ({orgCurrencySymbol}{grandTotalBase.toLocaleString("en-US", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })} {orgCurrency})
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={statusColors[order.status] || "bg-gray-100 text-gray-800"}
                          >
                            {statusLabels[order.status] || order.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {order.creator?.name || "Unknown"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={`/sales-orders/${order.id}`}>
                            <Button variant="ghost" size="sm" data-testid={`button-view-order-${order.id}`}>
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          </Link>
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
