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
import { Download, Filter, TrendingUp, ShoppingCart, Building2, Users, DollarSign, CalendarIcon, BarChart3 } from "lucide-react";
import { format, subDays, subMonths } from "date-fns";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export default function AnalyticsReportPage() {
  const [dateRange, setDateRange] = useState({ 
    from: subMonths(new Date(), 3), 
    to: new Date() 
  });
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  
  const { formatCurrency } = useCurrency();

  // Fetch analytics data
  const { data: fastestMovingItems = [], isLoading: loadingFastest } = useQuery({
    queryKey: ['/api/analytics/fastest-moving', dateRange.from.toISOString(), dateRange.to.toISOString(), departmentFilter, warehouseFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      params.append('startDate', dateRange.from.toISOString());
      params.append('endDate', dateRange.to.toISOString());
      if (departmentFilter !== 'all') params.append('departmentId', departmentFilter);
      if (warehouseFilter !== 'all') params.append('warehouseId', warehouseFilter);
      return fetch(`/api/analytics/fastest-moving?${params}`).then(res => res.json());
    }
  });

  const { data: mostOrderedItems = [], isLoading: loadingOrdered } = useQuery({
    queryKey: ['/api/analytics/most-ordered', dateRange.from.toISOString(), dateRange.to.toISOString(), departmentFilter, warehouseFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      params.append('startDate', dateRange.from.toISOString());
      params.append('endDate', dateRange.to.toISOString());
      if (departmentFilter !== 'all') params.append('departmentId', departmentFilter);
      if (warehouseFilter !== 'all') params.append('warehouseId', warehouseFilter);
      return fetch(`/api/analytics/most-ordered?${params}`).then(res => res.json());
    }
  });

  const { data: departmentConsumption = [], isLoading: loadingDepartments } = useQuery({
    queryKey: ['/api/analytics/department-consumption', dateRange.from.toISOString(), dateRange.to.toISOString(), warehouseFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      params.append('startDate', dateRange.from.toISOString());
      params.append('endDate', dateRange.to.toISOString());
      if (warehouseFilter !== 'all') params.append('warehouseId', warehouseFilter);
      return fetch(`/api/analytics/department-consumption?${params}`).then(res => res.json());
    }
  });

  const { data: userRequestAnalysis = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['/api/analytics/user-requests', dateRange.from.toISOString(), dateRange.to.toISOString(), departmentFilter, warehouseFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      params.append('startDate', dateRange.from.toISOString());
      params.append('endDate', dateRange.to.toISOString());
      if (departmentFilter !== 'all') params.append('departmentId', departmentFilter);
      if (warehouseFilter !== 'all') params.append('warehouseId', warehouseFilter);
      return fetch(`/api/analytics/user-requests?${params}`).then(res => res.json());
    }
  });

  const { data: priceVariationAnalysis = [], isLoading: loadingPrices } = useQuery({
    queryKey: ['/api/analytics/price-variation', dateRange.from.toISOString(), dateRange.to.toISOString(), warehouseFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      params.append('startDate', dateRange.from.toISOString());
      params.append('endDate', dateRange.to.toISOString());
      if (warehouseFilter !== 'all') params.append('warehouseId', warehouseFilter);
      return fetch(`/api/analytics/price-variation?${params}`).then(res => res.json());
    }
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['/api/departments'],
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ['/api/warehouses'],
  });

  const isLoading = loadingFastest || loadingOrdered || loadingDepartments || loadingUsers || loadingPrices;

  const formatNumberWithCommas = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value)) {
      return '0';
    }
    return value.toLocaleString();
  };

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
            <h1 className="text-3xl font-bold text-gray-900">Analytics Report</h1>
            <div className="text-gray-600">
              <span>Analytics for {format(dateRange.from, 'MMM dd, yyyy')} - {format(dateRange.to, 'MMM dd, yyyy')}</span>
            </div>
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Date Range From</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn("w-full justify-start text-left font-normal")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(dateRange.from, "PPP")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateRange.from}
                      onSelect={(date) => date && setDateRange({...dateRange, from: date})}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Date Range To</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn("w-full justify-start text-left font-normal")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(dateRange.to, "PPP")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateRange.to}
                      onSelect={(date) => date && setDateRange({...dateRange, to: date})}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Department</label>
                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {Array.isArray(departments) && departments.map((dept: any) => (
                      <SelectItem key={dept.id} value={dept.id.toString()}>
                        {dept.name}
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
                      <SelectItem key={warehouse.id} value={warehouse.id.toString()}>
                        {warehouse.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Analytics Tabs */}
        <Tabs defaultValue="fastest-moving" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="fastest-moving">Fastest Moving</TabsTrigger>
            <TabsTrigger value="most-ordered">Most Ordered</TabsTrigger>
            <TabsTrigger value="department-consumption">Dept. Consumption</TabsTrigger>
            <TabsTrigger value="user-analysis">User Analysis</TabsTrigger>
            <TabsTrigger value="price-variation">Price Variation</TabsTrigger>
          </TabsList>
          
          {/* Fastest Moving Items */}
          <TabsContent value="fastest-moving" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Fastest Moving Items
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Items with highest turnover rates and movement frequency
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Movement Chart</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={fastestMovingItems.slice(0, 10)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="movementCount" fill="#8884d8" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Top Moving Items</h3>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Item</TableHead>
                            <TableHead className="text-right">Movements</TableHead>
                            <TableHead className="text-right">Turnover Rate</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {fastestMovingItems.slice(0, 10).map((item: any, index) => (
                            <TableRow key={index}>
                              <TableCell>
                                <div>
                                  <div className="font-medium">{item.name}</div>
                                  <div className="text-sm text-muted-foreground">{item.sku}</div>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">{formatNumberWithCommas(item.movementCount)}</TableCell>
                              <TableCell className="text-right">{item.turnoverRate}%</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Most Ordered Items */}
          <TabsContent value="most-ordered" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Most Ordered Items
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Items with highest order frequency and quantities
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Order Frequency</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={mostOrderedItems.slice(0, 10)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Line type="monotone" dataKey="orderCount" stroke="#82ca9d" />
                        <Line type="monotone" dataKey="totalQuantity" stroke="#8884d8" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Most Ordered Items</h3>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Item</TableHead>
                            <TableHead className="text-right">Orders</TableHead>
                            <TableHead className="text-right">Total Qty</TableHead>
                            <TableHead className="text-right">Avg Qty/Order</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {mostOrderedItems.slice(0, 10).map((item: any, index) => (
                            <TableRow key={index}>
                              <TableCell>
                                <div>
                                  <div className="font-medium">{item.name}</div>
                                  <div className="text-sm text-muted-foreground">{item.sku}</div>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">{formatNumberWithCommas(item.orderCount)}</TableCell>
                              <TableCell className="text-right">{formatNumberWithCommas(item.totalQuantity)}</TableCell>
                              <TableCell className="text-right">{item.orderCount > 0 ? Math.round(item.totalQuantity / item.orderCount) : 0}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Department Consumption */}
          <TabsContent value="department-consumption" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Department Consumption Analysis
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Request patterns and consumption by department
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Consumption by Department</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={departmentConsumption}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="totalValue"
                          label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {departmentConsumption.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Department Summary</h3>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Department</TableHead>
                            <TableHead className="text-right">Requests</TableHead>
                            <TableHead className="text-right">Total Value</TableHead>
                            <TableHead className="text-right">Avg Value</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {departmentConsumption.map((dept: any, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium">{dept.name}</TableCell>
                              <TableCell className="text-right">{formatNumberWithCommas(dept.requestCount)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(dept.totalValue)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(dept.avgValue)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* User Request Analysis */}
          <TabsContent value="user-analysis" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  User Request Analysis
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Individual user request patterns and behavior
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">User Activity</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={userRequestAnalysis.slice(0, 10)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="userName" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="requestCount" fill="#8884d8" />
                        <Bar dataKey="approvedCount" fill="#82ca9d" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Top Requesters</h3>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>User</TableHead>
                            <TableHead className="text-right">Requests</TableHead>
                            <TableHead className="text-right">Approved</TableHead>
                            <TableHead className="text-right">Approval Rate</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {userRequestAnalysis.slice(0, 10).map((user: any, index) => (
                            <TableRow key={index}>
                              <TableCell>
                                <div>
                                  <div className="font-medium">{user.userName}</div>
                                  <div className="text-sm text-muted-foreground">{user.departmentName}</div>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">{formatNumberWithCommas(user.requestCount)}</TableCell>
                              <TableCell className="text-right">{formatNumberWithCommas(user.approvedCount)}</TableCell>
                              <TableCell className="text-right">
                                <Badge variant={user.approvalRate >= 80 ? "default" : user.approvalRate >= 60 ? "secondary" : "destructive"}>
                                  {user.approvalRate}%
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Price Variation Analysis */}
          <TabsContent value="price-variation" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Item Price Variation Analysis
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Price trends and variations across time periods
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Price Changes</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={priceVariationAnalysis.slice(0, 8)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="itemName" />
                        <YAxis />
                        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                        <Bar dataKey="startPrice" fill="#8884d8" name="Start Price" />
                        <Bar dataKey="endPrice" fill="#82ca9d" name="End Price" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Price Variations</h3>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Item</TableHead>
                            <TableHead className="text-right">Start Price</TableHead>
                            <TableHead className="text-right">End Price</TableHead>
                            <TableHead className="text-right">Change</TableHead>
                            <TableHead className="text-right">Variation</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {priceVariationAnalysis.slice(0, 10).map((item: any, index) => (
                            <TableRow key={index}>
                              <TableCell>
                                <div>
                                  <div className="font-medium">{item.itemName}</div>
                                  <div className="text-sm text-muted-foreground">{item.sku}</div>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">{formatCurrency(item.startPrice)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(item.endPrice)}</TableCell>
                              <TableCell className="text-right">
                                <span className={`font-medium ${
                                  item.priceChange > 0 ? 'text-green-600' : 
                                  item.priceChange < 0 ? 'text-red-600' : 'text-gray-600'
                                }`}>
                                  {item.priceChange > 0 ? '+' : ''}{formatCurrency(item.priceChange)}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge variant={item.variationPercent > 20 ? "destructive" : item.variationPercent > 10 ? "secondary" : "default"}>
                                  {item.variationPercent}%
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}