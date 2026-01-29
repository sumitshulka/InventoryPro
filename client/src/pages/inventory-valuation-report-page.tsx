import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import AppLayout from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Filter, BarChart3, DollarSign, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";

interface InventoryValuationItem {
  id: number;
  name: string;
  sku: string;
  category: string;
  warehouse: string;
  currentStock: number;
  unit: string;
  unitValue: number;
  totalValue: number;
  valuationMethod: string;
  lastCheckInDate: string;
  firstCheckInDate: string;
}

export default function InventoryValuationReportPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [asOfDate, setAsOfDate] = useState<Date>(new Date());
  
  const { formatCurrency } = useCurrency();
  
  // Number formatting with commas
  const formatNumberWithCommas = (value: number): string => {
    return value.toLocaleString();
  };

  const { data: inventoryValuation = [], isLoading } = useQuery({
    queryKey: ['/api/reports/inventory-valuation', asOfDate?.toISOString()],
    queryFn: () => {
      const params = new URLSearchParams();
      if (asOfDate) {
        params.append('asOfDate', asOfDate.toISOString());
      }
      return fetch(`/api/reports/inventory-valuation?${params}`).then(res => res.json());
    }
  });

  const { data: organizationSettings = {} } = useQuery({
    queryKey: ['/api/organization-settings'],
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['/api/categories'],
  });

  const { data: warehouses = [] } = useQuery<any[]>({
    queryKey: ['/api/warehouses'],
  });

  // Fetch warehouses currently under audit (for masking values)
  const { data: warehousesUnderAudit = [] } = useQuery<number[]>({
    queryKey: ["/api/warehouses/under-audit"],
  });

  // Helper to check if a warehouse (by name) is under audit
  const isWarehouseUnderAuditByName = (warehouseName: string) => {
    const warehouse = warehouses.find((w: any) => w.name === warehouseName);
    return warehouse ? warehousesUnderAudit.includes(warehouse.id) : false;
  };

  const filteredAndSortedData = useMemo(() => {
    let filtered = (inventoryValuation as InventoryValuationItem[]).filter((item) => {
      const matchesSearch = searchTerm === "" || 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
      const matchesWarehouse = warehouseFilter === "all" || item.warehouse === warehouseFilter;
      
      return matchesSearch && matchesCategory && matchesWarehouse;
    });

    filtered.sort((a, b) => {
      let aValue: any = a[sortBy as keyof InventoryValuationItem];
      let bValue: any = b[sortBy as keyof InventoryValuationItem];
      
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }
      
      if (sortOrder === "asc") {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  }, [inventoryValuation, searchTerm, categoryFilter, warehouseFilter, sortBy, sortOrder]);

  const totalInventoryValue = useMemo(() => {
    return filteredAndSortedData.reduce((sum, item) => sum + item.totalValue, 0);
  }, [filteredAndSortedData]);

  // Summary data - group by item and sum quantities across warehouses
  const summaryData = useMemo(() => {
    const itemGroups = new Map();
    
    filteredAndSortedData.forEach(item => {
      if (!itemGroups.has(item.sku)) {
        itemGroups.set(item.sku, {
          sku: item.sku,
          name: item.name,
          category: item.category,
          unit: item.unit,
          unitValue: item.unitValue,
          totalQuantity: 0,
          totalValue: 0,
          valuationMethod: item.valuationMethod
        });
      }
      
      const group = itemGroups.get(item.sku);
      group.totalQuantity += item.currentStock;
      group.totalValue += item.totalValue;
    });
    
    return Array.from(itemGroups.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredAndSortedData]);

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
  };

  const exportToCSV = () => {
    const headers = ['Item Name', 'SKU', 'Category', 'Warehouse', 'Current Stock', 'Unit', 'Unit Value', 'Total Value', 'Valuation Method'];
    const csvData = [
      headers,
      ...filteredAndSortedData.map(item => [
        item.name,
        item.sku,
        item.category,
        item.warehouse,
        formatNumberWithCommas(item.currentStock),
        item.unit,
        formatCurrency(item.unitValue),
        formatCurrency(item.totalValue),
        item.valuationMethod
      ])
    ];
    
    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-valuation-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const currencySymbol = (organizationSettings as any)?.currencySymbol || '$';
  const valuationMethod = (organizationSettings as any)?.inventoryValuationMethod || 'Last Value';

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Inventory Valuation Report</h1>
            <div className="text-gray-600 flex items-center gap-2">
              <span>As of {format(asOfDate, 'MMMM dd, yyyy')} • Valuation method:</span>
              <Badge variant="secondary">{valuationMethod}</Badge>
            </div>
          </div>
          <Button onClick={exportToCSV} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Items</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumberWithCommas(filteredAndSortedData.length)}</div>
              <p className="text-xs text-muted-foreground">
                Items in inventory
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Inventory Value</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(totalInventoryValue)}
              </div>
              <p className="text-xs text-muted-foreground">
                Based on {valuationMethod.toLowerCase()}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Unit Value</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {filteredAndSortedData.length > 0 ? formatCurrency(totalInventoryValue / filteredAndSortedData.reduce((sum, item) => sum + item.currentStock, 0)) : formatCurrency(0)}
              </div>
              <p className="text-xs text-muted-foreground">
                Per unit across all items
              </p>
            </CardContent>
          </Card>
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
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">As of Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !asOfDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {asOfDate ? format(asOfDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={asOfDate}
                      onSelect={(date) => date && setAsOfDate(date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Search Items</label>
                <Input
                  placeholder="Search by name or SKU..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Category</label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {Array.isArray(categories) && categories.map((category: any) => (
                      <SelectItem key={category.id} value={category.name}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Warehouse</label>
                <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All warehouses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Warehouses</SelectItem>
                    {Array.isArray(warehouses) && warehouses.map((warehouse: any) => (
                      <SelectItem key={warehouse.id} value={warehouse.name}>
                        {warehouse.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Sort By</label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Item Name</SelectItem>
                    <SelectItem value="category">Category</SelectItem>
                    <SelectItem value="warehouse">Warehouse</SelectItem>
                    <SelectItem value="currentStock">Stock Quantity</SelectItem>
                    <SelectItem value="unitValue">Unit Value</SelectItem>
                    <SelectItem value="totalValue">Total Value</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs for Summary and Details */}
        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="summary">Summary View</TabsTrigger>
            <TabsTrigger value="details">Details View</TabsTrigger>
          </TabsList>
          
          <TabsContent value="summary" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Item-Level Summary</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Total quantities and values across all warehouses by item
                </p>
              </CardHeader>
              <CardContent>
                {summaryData.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No items found matching your criteria.</p>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => handleSort('sku')}
                          >
                            Item Code
                            {sortBy === 'sku' && (
                              <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => handleSort('name')}
                          >
                            Item Name
                            {sortBy === 'name' && (
                              <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50 text-right"
                            onClick={() => handleSort('totalQuantity')}
                          >
                            Total Qty
                            {sortBy === 'totalQuantity' && (
                              <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50 text-right"
                            onClick={() => handleSort('unitValue')}
                          >
                            Unit Price
                            {sortBy === 'unitValue' && (
                              <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50 text-right"
                            onClick={() => handleSort('totalValue')}
                          >
                            Total Price
                            {sortBy === 'totalValue' && (
                              <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {summaryData.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{item.sku}</TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{item.name}</div>
                                <div className="text-sm text-muted-foreground">{item.category}</div>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {formatNumberWithCommas(item.totalQuantity)} {item.unit}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(item.unitValue)}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(item.totalValue)}
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
          
          <TabsContent value="details" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Warehouse-wise Inventory Valuation</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Detailed breakdown by warehouse location
                </p>
              </CardHeader>
              <CardContent>
                {filteredAndSortedData.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No inventory items found matching your criteria.</p>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => handleSort('name')}
                          >
                            Item Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                          </TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => handleSort('category')}
                          >
                            Category {sortBy === 'category' && (sortOrder === 'asc' ? '↑' : '↓')}
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => handleSort('warehouse')}
                          >
                            Warehouse {sortBy === 'warehouse' && (sortOrder === 'asc' ? '↑' : '↓')}
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50 text-right"
                            onClick={() => handleSort('currentStock')}
                          >
                            Current Stock {sortBy === 'currentStock' && (sortOrder === 'asc' ? '↑' : '↓')}
                          </TableHead>
                          <TableHead>Unit</TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50 text-right"
                            onClick={() => handleSort('unitValue')}
                          >
                            Unit Value {sortBy === 'unitValue' && (sortOrder === 'asc' ? '↑' : '↓')}
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50 text-right"
                            onClick={() => handleSort('totalValue')}
                          >
                            Total Value {sortBy === 'totalValue' && (sortOrder === 'asc' ? '↑' : '↓')}
                          </TableHead>
                          <TableHead>Last Check-in</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAndSortedData.map((item) => {
                          const underAudit = isWarehouseUnderAuditByName(item.warehouse);
                          return (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">{item.name}</TableCell>
                              <TableCell>{item.sku}</TableCell>
                              <TableCell>{item.category}</TableCell>
                              <TableCell>
                                {item.warehouse}
                                {underAudit && (
                                  <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">
                                    Under Audit
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {underAudit ? (
                                  <span className="text-gray-400 italic">***</span>
                                ) : (
                                  formatNumberWithCommas(item.currentStock)
                                )}
                              </TableCell>
                              <TableCell>{item.unit}</TableCell>
                              <TableCell className="text-right">
                                {underAudit ? (
                                  <span className="text-gray-400 italic">***</span>
                                ) : (
                                  formatCurrency(item.unitValue)
                                )}
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {underAudit ? (
                                  <span className="text-gray-400 italic">***</span>
                                ) : (
                                  formatCurrency(item.totalValue)
                                )}
                              </TableCell>
                              <TableCell>
                                {item.lastCheckInDate ? format(new Date(item.lastCheckInDate), 'MMM dd, yyyy') : 'N/A'}
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
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}