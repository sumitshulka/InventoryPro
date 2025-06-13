import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../hooks/use-auth";
import AppLayout from "../components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { CalendarIcon, Download, Filter, RefreshCw, Trash2 } from "lucide-react";
import { formatCurrencyFull } from "../lib/currency-utils";
import { DataTablePagination } from "../components/ui/data-table-pagination";
import { useToast } from "../hooks/use-toast";
import { queryClient } from "../lib/queryClient";

export default function DisposedInventoryReportPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("summary");
  const [filters, setFilters] = useState({
    warehouseId: "all",
    itemId: "all",
    dateFrom: "",
    dateTo: "",
    disposalReason: ""
  });

  // Fetch disposed inventory data
  const { data: disposedItems, isLoading: disposedLoading, refetch: refetchDisposed } = useQuery({
    queryKey: ["/api/disposed-inventory", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== "all") params.append(key, value);
      });
      
      const response = await fetch(`/api/disposed-inventory?${params}`);
      if (!response.ok) throw new Error("Failed to fetch disposed inventory");
      return response.json();
    }
  });

  const { data: warehouses } = useQuery({
    queryKey: ["/api/warehouses"]
  });

  const { data: items } = useQuery({
    queryKey: ["/api/items"]
  });

  // Calculate summary statistics
  const summaryStats = disposedItems?.reduce((acc: any, item: any) => {
    acc.totalItems += item.quantity;
    acc.totalValue += (item.quantity * (item.item?.rate || 0));
    acc.uniqueItems = new Set([...acc.uniqueItems, item.itemId]).size;
    
    if (!acc.warehouseBreakdown[item.warehouseId]) {
      acc.warehouseBreakdown[item.warehouseId] = {
        name: item.warehouse?.name || 'Unknown',
        quantity: 0,
        value: 0
      };
    }
    acc.warehouseBreakdown[item.warehouseId].quantity += item.quantity;
    acc.warehouseBreakdown[item.warehouseId].value += (item.quantity * (item.item?.rate || 0));
    
    if (!acc.reasonBreakdown[item.disposalReason || 'Not specified']) {
      acc.reasonBreakdown[item.disposalReason || 'Not specified'] = {
        quantity: 0,
        value: 0
      };
    }
    acc.reasonBreakdown[item.disposalReason || 'Not specified'].quantity += item.quantity;
    acc.reasonBreakdown[item.disposalReason || 'Not specified'].value += (item.quantity * (item.item?.rate || 0));
    
    return acc;
  }, {
    totalItems: 0,
    totalValue: 0,
    uniqueItems: new Set(),
    warehouseBreakdown: {},
    reasonBreakdown: {}
  });

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      warehouseId: "all",
      itemId: "all",
      dateFrom: "",
      dateTo: "",
      disposalReason: ""
    });
  };

  const handleRefresh = async () => {
    try {
      await queryClient.invalidateQueries({ queryKey: ["/api/disposed-inventory"] });
      await refetchDisposed();
      toast({
        title: "Refreshed",
        description: "Disposed inventory data has been refreshed",
      });
    } catch (error) {
      toast({
        title: "Refresh Failed",
        description: "Unable to refresh data. Please try again.",
        variant: "destructive",
      });
    }
  };

  const exportToCsv = () => {
    if (!disposedItems?.length) return;

    const headers = ["Transfer Code", "Item Name", "SKU", "Warehouse", "Quantity", "Unit Value", "Total Value", "Disposal Date", "Disposal Reason"];
    const csvData = [
      headers.join(","),
      ...disposedItems.map((item: any) => [
        item.transferCode || "",
        `"${item.item?.name || ''}"`,
        item.item?.sku || "",
        `"${item.warehouse?.name || ''}"`,
        item.quantity,
        item.item?.rate || 0,
        (item.quantity * (item.item?.rate || 0)),
        item.disposalDate ? new Date(item.disposalDate).toLocaleDateString() : "",
        `"${item.disposalReason || ''}"`
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvData], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `disposed-inventory-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Disposed Inventory Report</h1>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={disposedLoading}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportToCsv}
              disabled={!disposedItems?.length}
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              <div>
                <Label htmlFor="warehouse">Warehouse</Label>
                <Select value={filters.warehouseId} onValueChange={(value) => handleFilterChange("warehouseId", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All warehouses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All warehouses</SelectItem>
                    {warehouses?.map((warehouse: any) => (
                      <SelectItem key={warehouse.id} value={warehouse.id.toString()}>
                        {warehouse.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="item">Item</Label>
                <Select value={filters.itemId} onValueChange={(value) => handleFilterChange("itemId", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All items" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All items</SelectItem>
                    {items?.map((item: any) => (
                      <SelectItem key={item.id} value={item.id.toString()}>
                        {item.name} ({item.sku})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="dateFrom">From Date</Label>
                <Input
                  id="dateFrom"
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => handleFilterChange("dateFrom", e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="dateTo">To Date</Label>
                <Input
                  id="dateTo"
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => handleFilterChange("dateTo", e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="disposalReason">Disposal Reason</Label>
                <Input
                  id="disposalReason"
                  placeholder="Enter disposal reason"
                  value={filters.disposalReason}
                  onChange={(e) => handleFilterChange("disposalReason", e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <Button variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="details">Detailed View</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-4">
            {summaryStats && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Items Disposed</CardTitle>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{summaryStats.totalItems}</div>
                    <p className="text-xs text-muted-foreground">
                      {summaryStats.uniqueItems} unique items
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Value Disposed</CardTitle>
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrencyFull(summaryStats.totalValue, "USD")}</div>
                    <p className="text-xs text-muted-foreground">
                      Estimated market value
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Average Value per Item</CardTitle>
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatCurrencyFull(summaryStats.totalItems > 0 ? summaryStats.totalValue / summaryStats.totalItems : 0, "USD")}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Per disposed item
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Warehouses Affected</CardTitle>
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{Object.keys(summaryStats.warehouseBreakdown).length}</div>
                    <p className="text-xs text-muted-foreground">
                      Active warehouses
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Warehouse Breakdown */}
            {summaryStats && Object.keys(summaryStats.warehouseBreakdown).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Warehouse Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Warehouse</TableHead>
                        <TableHead>Items Disposed</TableHead>
                        <TableHead>Total Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(summaryStats.warehouseBreakdown).map(([warehouseId, data]: [string, any]) => (
                        <TableRow key={warehouseId}>
                          <TableCell className="font-medium">{data.name}</TableCell>
                          <TableCell>{data.quantity}</TableCell>
                          <TableCell>{formatCurrencyFull(data.value, "USD")}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="details" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Disposed Items Details</CardTitle>
              </CardHeader>
              <CardContent>
                <DataTablePagination data={disposedItems || []}>
                  {(paginatedItems) => (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Transfer Code</TableHead>
                            <TableHead>Item</TableHead>
                            <TableHead>Warehouse</TableHead>
                            <TableHead>Quantity</TableHead>
                            <TableHead>Unit Value</TableHead>
                            <TableHead>Total Value</TableHead>
                            <TableHead>Disposal Date</TableHead>
                            <TableHead>Reason</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {disposedLoading ? (
                            <TableRow>
                              <TableCell colSpan={8} className="text-center py-8">
                                Loading disposed inventory data...
                              </TableCell>
                            </TableRow>
                          ) : paginatedItems.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                                No disposed items found
                              </TableCell>
                            </TableRow>
                          ) : (
                            paginatedItems.map((item: any) => (
                              <TableRow key={`${item.transferId}-${item.itemId}`}>
                                <TableCell className="font-medium">
                                  {item.transferCode || 'N/A'}
                                </TableCell>
                                <TableCell>
                                  <div>
                                    <div className="font-medium">{item.item?.name}</div>
                                    <div className="text-sm text-gray-500">{item.item?.sku}</div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div>
                                    <div className="font-medium">{item.warehouse?.name}</div>
                                    <div className="text-sm text-gray-500">{item.warehouse?.location}</div>
                                  </div>
                                </TableCell>
                                <TableCell>{item.quantity}</TableCell>
                                <TableCell>{formatCurrencyFull(item.item?.rate || 0, "USD")}</TableCell>
                                <TableCell>{formatCurrencyFull((item.quantity * (item.item?.rate || 0)), "USD")}</TableCell>
                                <TableCell>
                                  {item.disposalDate ? new Date(item.disposalDate).toLocaleDateString() : 'N/A'}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="secondary">
                                    {item.disposalReason || 'Not specified'}
                                  </Badge>
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
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            {/* Disposal Reasons Breakdown */}
            {summaryStats && Object.keys(summaryStats.reasonBreakdown).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Disposal Reasons Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Disposal Reason</TableHead>
                        <TableHead>Items Count</TableHead>
                        <TableHead>Total Value</TableHead>
                        <TableHead>Percentage</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(summaryStats.reasonBreakdown)
                        .sort(([, a]: [string, any], [, b]: [string, any]) => b.value - a.value)
                        .map(([reason, data]: [string, any]) => (
                        <TableRow key={reason}>
                          <TableCell className="font-medium">{reason}</TableCell>
                          <TableCell>{data.quantity}</TableCell>
                          <TableCell>{formatCurrencyFull(data.value, "USD")}</TableCell>
                          <TableCell>
                            {((data.value / summaryStats.totalValue) * 100).toFixed(1)}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}