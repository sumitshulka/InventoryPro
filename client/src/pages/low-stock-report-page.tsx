import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AppLayout from "@/components/layout/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, FileText, AlertTriangle, Package, MapPin } from "lucide-react";
import { format } from "date-fns";

interface LowStockItem {
  id: number;
  itemId: number;
  itemName: string;
  itemSku: string;
  warehouseId: number;
  warehouseName: string;
  currentQuantity: number;
  minStockLevel: number;
  unit: string;
  categoryName?: string;
  stockDifference: number;
  stockPercentage: number;
  lastRestockDate?: string;
  status: 'critical' | 'low' | 'warning';
}

export default function LowStockReportPage() {
  const [filters, setFilters] = useState({
    asOfDate: format(new Date(), 'yyyy-MM-dd'),
    warehouseId: '',
    itemId: '',
    status: '',
    categoryId: ''
  });

  // Fetch warehouses for filter
  const { data: warehouses = [] } = useQuery({
    queryKey: ["/api/warehouses"],
  });

  // Fetch items for filter
  const { data: items = [] } = useQuery({
    queryKey: ["/api/items"],
  });

  // Fetch categories for filter
  const { data: categories = [] } = useQuery({
    queryKey: ["/api/categories"],
  });

  // Fetch low stock report data
  const { data: lowStockData = [], isLoading, refetch } = useQuery<LowStockItem[]>({
    queryKey: ["/api/reports/low-stock", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.asOfDate) params.append('asOfDate', filters.asOfDate);
      if (filters.warehouseId) params.append('warehouseId', filters.warehouseId);
      if (filters.itemId) params.append('itemId', filters.itemId);
      if (filters.status) params.append('status', filters.status);
      if (filters.categoryId) params.append('categoryId', filters.categoryId);
      
      const response = await fetch(`/api/reports/low-stock?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch low stock report');
      return response.json();
    }
  });

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      asOfDate: format(new Date(), 'yyyy-MM-dd'),
      warehouseId: '',
      itemId: '',
      status: '',
      categoryId: ''
    });
  };

  const exportToCSV = () => {
    const headers = [
      'Item SKU',
      'Item Name',
      'Warehouse',
      'Current Quantity',
      'Min Stock Level',
      'Stock Difference',
      'Stock %',
      'Unit',
      'Category',
      'Status',
      'Last Restock Date'
    ];

    const csvData = lowStockData.map(item => [
      item.itemSku,
      item.itemName,
      item.warehouseName,
      item.currentQuantity,
      item.minStockLevel,
      item.stockDifference,
      `${item.stockPercentage}%`,
      item.unit,
      item.categoryName || 'N/A',
      item.status,
      item.lastRestockDate ? format(new Date(item.lastRestockDate), 'yyyy-MM-dd') : 'N/A'
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `low-stock-report-${filters.asOfDate}.csv`;
    link.click();
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      critical: { variant: 'destructive' as const, icon: AlertTriangle, text: 'Critical' },
      low: { variant: 'secondary' as const, icon: Package, text: 'Low' },
      warning: { variant: 'outline' as const, icon: AlertTriangle, text: 'Warning' }
    };

    const config = statusConfig[status as keyof typeof statusConfig];
    if (!config) return null;

    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.text}
      </Badge>
    );
  };

  const getTotalStats = () => {
    const total = lowStockData.length;
    const critical = lowStockData.filter(item => item.status === 'critical').length;
    const low = lowStockData.filter(item => item.status === 'low').length;
    const warning = lowStockData.filter(item => item.status === 'warning').length;

    return { total, critical, low, warning };
  };

  const stats = getTotalStats();

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Low Stock Report</h1>
            <p className="text-muted-foreground">
              Monitor inventory levels and identify items requiring restocking
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={exportToCSV} 
              variant="outline"
              disabled={lowStockData.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button onClick={() => refetch()}>
              <FileText className="mr-2 h-4 w-4" />
              Refresh Report
            </Button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Items</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <Package className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Critical</p>
                  <p className="text-2xl font-bold text-red-600">{stats.critical}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Low Stock</p>
                  <p className="text-2xl font-bold text-orange-600">{stats.low}</p>
                </div>
                <Package className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Warning</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.warning}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>
              Filter the low stock report by date, warehouse, items, and status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              <div className="space-y-2">
                <Label htmlFor="asOfDate">As of Date</Label>
                <Input
                  id="asOfDate"
                  type="date"
                  value={filters.asOfDate}
                  onChange={(e) => handleFilterChange('asOfDate', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="warehouse">Warehouse</Label>
                <Select value={filters.warehouseId} onValueChange={(value) => handleFilterChange('warehouseId', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Warehouses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Warehouses</SelectItem>
                    {warehouses.map((warehouse: any) => (
                      <SelectItem key={warehouse.id} value={warehouse.id.toString()}>
                        {warehouse.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="item">Item</Label>
                <Select value={filters.itemId} onValueChange={(value) => handleFilterChange('itemId', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Items" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Items</SelectItem>
                    {items.map((item: any) => (
                      <SelectItem key={item.id} value={item.id.toString()}>
                        {item.name} ({item.sku})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={filters.categoryId} onValueChange={(value) => handleFilterChange('categoryId', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Categories</SelectItem>
                    {categories.map((category: any) => (
                      <SelectItem key={category.id} value={category.id.toString()}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Status</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button variant="outline" onClick={clearFilters} className="w-full">
                  Clear Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Report Data */}
        <Card>
          <CardHeader>
            <CardTitle>Low Stock Items</CardTitle>
            <CardDescription>
              Items with current stock below minimum threshold as of {format(new Date(filters.asOfDate), 'PPP')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="ml-2">Loading report data...</span>
              </div>
            ) : lowStockData.length === 0 ? (
              <div className="text-center py-8">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold">No Low Stock Items</h3>
                <p className="text-muted-foreground">
                  All items are above their minimum stock levels for the selected criteria.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Warehouse</TableHead>
                      <TableHead className="text-right">Current Qty</TableHead>
                      <TableHead className="text-right">Min Level</TableHead>
                      <TableHead className="text-right">Difference</TableHead>
                      <TableHead className="text-right">Stock %</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Last Restock</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lowStockData.map((item) => (
                      <TableRow key={`${item.itemId}-${item.warehouseId}`}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{item.itemName}</div>
                            <div className="text-sm text-muted-foreground">{item.itemSku}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <MapPin className="h-4 w-4 mr-1 text-muted-foreground" />
                            {item.warehouseName}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={item.currentQuantity <= 0 ? 'text-red-600 font-semibold' : ''}>
                            {item.currentQuantity} {item.unit}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {item.minStockLevel} {item.unit}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-red-600 font-medium">
                            {item.stockDifference} {item.unit}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`font-medium ${
                            item.stockPercentage <= 25 ? 'text-red-600' :
                            item.stockPercentage <= 50 ? 'text-orange-600' : 'text-yellow-600'
                          }`}>
                            {item.stockPercentage}%
                          </span>
                        </TableCell>
                        <TableCell>{getStatusBadge(item.status)}</TableCell>
                        <TableCell>{item.categoryName || 'Uncategorized'}</TableCell>
                        <TableCell>
                          {item.lastRestockDate ? 
                            format(new Date(item.lastRestockDate), 'MMM dd, yyyy') : 
                            'N/A'
                          }
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