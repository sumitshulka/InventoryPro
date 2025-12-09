import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import AppLayout from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import {
  Loader2,
  ArrowLeft,
  Building2,
  Phone,
  Mail,
  MapPin,
  FileText,
  ShoppingCart,
  DollarSign,
  Package,
  Clock,
  TrendingUp,
  Eye,
  Calendar,
  CreditCard,
  User,
  Edit,
  BarChart3,
} from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";
import { Client, SalesOrder } from "@shared/schema";

interface ClientDashboardData {
  client: Client;
  salesOrders: Array<{
    id: number;
    orderCode: string;
    orderDate: string;
    status: string;
    currencyCode: string;
    grandTotal: string;
    grandTotalBase?: string;
    conversionRate?: string;
    clientPoReference?: string;
    warehouseName?: string;
    itemCount: number;
    totalOrderedQty: number;
    totalDispatched: number;
  }>;
  summary: {
    totalOrders: number;
    totalValue: number;
    totalValueBase: number;
    avgOrderValue: number;
    statusCounts: Record<string, number>;
  };
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  waiting_approval: "bg-yellow-100 text-yellow-800",
  approved: "bg-blue-100 text-blue-800",
  partial_shipped: "bg-purple-100 text-purple-800",
  closed: "bg-green-100 text-green-800",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  waiting_approval: "Waiting Approval",
  approved: "Approved",
  partial_shipped: "Partially Shipped",
  closed: "Closed",
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  INR: "₹",
  AUD: "A$",
  CAD: "C$",
  JPY: "¥",
  CNY: "¥",
  AED: "د.إ",
  SAR: "﷼",
  SGD: "S$",
  CHF: "CHF",
};

function formatAmount(amount: number, currencyCode: string): string {
  const symbol = CURRENCY_SYMBOLS[currencyCode] || currencyCode;
  if (currencyCode === "INR") {
    return `${symbol}${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `${symbol}${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ClientDashboardPage() {
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/clients/:id");
  const clientId = params?.id;
  const { currency: organizationCurrency } = useCurrency();

  const { data, isLoading, error } = useQuery<ClientDashboardData>({
    queryKey: ["/api/clients", clientId, "dashboard"],
    queryFn: async () => {
      const response = await fetch(`/api/clients/${clientId}/dashboard`);
      if (!response.ok) {
        throw new Error("Failed to fetch client dashboard");
      }
      return response.json();
    },
    enabled: !!clientId,
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (error || !data) {
    return (
      <AppLayout>
        <div className="container mx-auto py-6">
          <Button variant="ghost" onClick={() => navigate("/clients")} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Clients
          </Button>
          <Card>
            <CardContent className="py-8 text-center text-gray-500">
              Failed to load client dashboard. Please try again.
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const { client, salesOrders, summary } = data;
  const clientCurrency = client.currencyCode || organizationCurrency || "USD";

  return (
    <AppLayout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate("/clients")} data-testid="button-back-clients">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Building2 className="h-6 w-6" />
                {client.companyName}
              </h1>
              <p className="text-gray-500">Client Code: {client.clientCode}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate(`/reports/client-sales-orders?clientId=${client.id}`)}
              data-testid="button-view-analytics"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              View Analytics
            </Button>
            <Button
              onClick={() => navigate(`/sales-orders/new?clientId=${client.id}`)}
              data-testid="button-new-order"
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              New Order
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                Total Orders
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalOrders}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Total Value
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatAmount(summary.totalValueBase || summary.totalValue, organizationCurrency || "USD")}
              </div>
              {summary.totalValue !== summary.totalValueBase && clientCurrency !== organizationCurrency && (
                <p className="text-sm text-gray-500">
                  {formatAmount(summary.totalValue, clientCurrency)} in client currency
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Avg Order Value
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatAmount(summary.avgOrderValue, organizationCurrency || "USD")}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                <Package className="h-4 w-4" />
                Active Orders
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(summary.statusCounts.approved || 0) + (summary.statusCounts.partial_shipped || 0)}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <User className="h-4 w-4" />
                  Client Details
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/clients?editId=${client.id}`)}
                  data-testid="button-edit-client"
                >
                  <Edit className="h-3 w-3 mr-1" />
                  Edit
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div>
                <p className="text-xs font-medium text-gray-500">Contact Person</p>
                <p className="font-medium text-sm">{client.contactPerson}</p>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-3 w-3 text-gray-400" />
                <a href={`mailto:${client.email}`} className="text-blue-600 hover:underline text-sm">
                  {client.email}
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-3 w-3 text-gray-400" />
                <span className="text-sm">{client.phone}</span>
              </div>
              {client.taxId && (
                <div>
                  <p className="text-xs font-medium text-gray-500">Tax ID / GST</p>
                  <p className="font-mono text-sm">{client.taxId}</p>
                </div>
              )}
              <div className="flex flex-wrap gap-3">
                {client.paymentTerms && (
                  <div className="flex items-center gap-1">
                    <CreditCard className="h-3 w-3 text-gray-400" />
                    <span className="text-sm">{client.paymentTerms}</span>
                  </div>
                )}
                {client.currencyCode && (
                  <div className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3 text-gray-400" />
                    <span className="text-sm">{client.currencyCode}</span>
                  </div>
                )}
              </div>
              {client.notes && (
                <div className="pt-2 border-t">
                  <p className="text-xs font-medium text-gray-500 mb-1">Notes</p>
                  <p className="text-sm text-gray-600">{client.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" />
                Order Status Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-3">
                <div className="px-4 py-2 rounded-lg bg-gray-50 flex-1 min-w-[100px]">
                  <p className="text-xs text-gray-500">Draft</p>
                  <p className="text-lg font-bold">{summary.statusCounts.draft || 0}</p>
                </div>
                <div className="px-4 py-2 rounded-lg bg-yellow-50 flex-1 min-w-[100px]">
                  <p className="text-xs text-yellow-700">Waiting Approval</p>
                  <p className="text-lg font-bold text-yellow-700">{summary.statusCounts.waiting_approval || 0}</p>
                </div>
                <div className="px-4 py-2 rounded-lg bg-blue-50 flex-1 min-w-[100px]">
                  <p className="text-xs text-blue-700">Approved</p>
                  <p className="text-lg font-bold text-blue-700">{summary.statusCounts.approved || 0}</p>
                </div>
                <div className="px-4 py-2 rounded-lg bg-purple-50 flex-1 min-w-[100px]">
                  <p className="text-xs text-purple-700">Partial Shipped</p>
                  <p className="text-lg font-bold text-purple-700">{summary.statusCounts.partial_shipped || 0}</p>
                </div>
                <div className="px-4 py-2 rounded-lg bg-green-50 flex-1 min-w-[100px]">
                  <p className="text-xs text-green-700">Closed</p>
                  <p className="text-lg font-bold text-green-700">{summary.statusCounts.closed || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <MapPin className="h-4 w-4" />
                  Billing Address
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => navigate(`/clients?editId=${client.id}`)}
                  data-testid="button-edit-billing-address"
                >
                  <Edit className="h-3 w-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm">
                {client.billingAddress}<br />
                {client.billingCity}, {client.billingState} {client.billingZipCode}<br />
                {client.billingCountry}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Package className="h-4 w-4" />
                  Shipping Address
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => navigate(`/clients?editId=${client.id}`)}
                  data-testid="button-edit-shipping-address"
                >
                  <Edit className="h-3 w-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm">
                {client.shippingAddress}<br />
                {client.shippingCity}, {client.shippingState} {client.shippingZipCode}<br />
                {client.shippingCountry}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Sales Orders
            </CardTitle>
            <CardDescription>
              All sales orders for this client
            </CardDescription>
          </CardHeader>
          <CardContent>
            {salesOrders.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <ShoppingCart className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No sales orders yet for this client.</p>
                <Button
                  className="mt-4"
                  onClick={() => navigate(`/sales-orders/new?clientId=${client.id}`)}
                  data-testid="button-create-first-order"
                >
                  Create First Order
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order Code</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Client PO Ref</TableHead>
                      <TableHead>Warehouse</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salesOrders.map((order) => {
                      const orderCurrency = order.currencyCode || clientCurrency;
                      const grandTotal = parseFloat(order.grandTotal) || 0;
                      const grandTotalBase = order.grandTotalBase ? parseFloat(order.grandTotalBase) : grandTotal;
                      const showDualCurrency = orderCurrency !== organizationCurrency && order.grandTotalBase;

                      return (
                        <TableRow key={order.id} data-testid={`row-order-${order.id}`}>
                          <TableCell className="font-mono font-medium">{order.orderCode}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-gray-400" />
                              {format(new Date(order.orderDate), "dd MMM yyyy")}
                            </div>
                          </TableCell>
                          <TableCell>{order.clientPoReference || "-"}</TableCell>
                          <TableCell>{order.warehouseName || "-"}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Package className="h-3 w-3 text-gray-400" />
                              {order.itemCount} items
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={STATUS_COLORS[order.status] || "bg-gray-100"}>
                              {STATUS_LABELS[order.status] || order.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div>
                              <div className="font-medium">
                                {formatAmount(grandTotal, orderCurrency)}
                              </div>
                              {showDualCurrency && (
                                <div className="text-xs text-gray-500">
                                  ≈ {formatAmount(grandTotalBase, organizationCurrency || "USD")}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/sales-orders/${order.id}`)}
                              data-testid={`button-view-order-${order.id}`}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
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
