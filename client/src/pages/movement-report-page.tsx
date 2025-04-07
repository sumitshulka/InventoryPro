import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import AppLayout from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { Loader2, Download, RefreshCw, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getTransactionTypeColor, getStatusColor, formatDateTime } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function MovementReportPage() {
  const { toast } = useToast();
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dateRange, setDateRange] = useState("all");

  const { data: transactions, isLoading: transactionsLoading, refetch } = useQuery({
    queryKey: ["/api/reports/inventory-movement"],
  });

  const { data: warehouses, isLoading: warehousesLoading } = useQuery({
    queryKey: ["/api/warehouses"],
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/export/transactions");
      if (!res.ok) {
        throw new Error("Failed to export transaction data");
      }
      return res.text();
    },
    onSuccess: (data) => {
      // Create a blob and download it
      const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'inventory-movements.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Export successful",
        description: "Inventory movement report has been exported to CSV.",
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

  // Handle date range selection
  const handleDateRangeChange = (range: string) => {
    setDateRange(range);
    
    const today = new Date();
    let startDateVal = "";
    const endDateVal = today.toISOString().split('T')[0];
    
    switch (range) {
      case "today":
        startDateVal = today.toISOString().split('T')[0];
        break;
      case "last7days":
        const last7Days = new Date();
        last7Days.setDate(today.getDate() - 7);
        startDateVal = last7Days.toISOString().split('T')[0];
        break;
      case "last30days":
        const last30Days = new Date();
        last30Days.setDate(today.getDate() - 30);
        startDateVal = last30Days.toISOString().split('T')[0];
        break;
      case "last90days":
        const last90Days = new Date();
        last90Days.setDate(today.getDate() - 90);
        startDateVal = last90Days.toISOString().split('T')[0];
        break;
      default:
        // For "all" or other values, reset dates
        startDateVal = "";
        break;
    }
    
    setStartDate(startDateVal);
    setEndDate(range === "all" ? "" : endDateVal);
  };

  // Apply filters to transaction data
  const filteredTransactions = transactions
    ? transactions.filter((transaction: any) => {
        // Warehouse filter
        const matchesWarehouse = 
          warehouseFilter === "all" || 
          transaction.sourceWarehouseId?.toString() === warehouseFilter ||
          transaction.destinationWarehouseId?.toString() === warehouseFilter;
        
        // Transaction type filter
        const matchesType = 
          typeFilter === "all" || 
          transaction.transactionType === typeFilter;
        
        // Date filter
        let matchesDate = true;
        if (startDate) {
          const transactionDate = new Date(transaction.createdAt);
          const filterStartDate = new Date(startDate);
          matchesDate = transactionDate >= filterStartDate;
        }
        
        if (endDate && matchesDate) {
          const transactionDate = new Date(transaction.createdAt);
          const filterEndDate = new Date(endDate);
          // Set end date to end of day
          filterEndDate.setHours(23, 59, 59, 999);
          matchesDate = transactionDate <= filterEndDate;
        }
        
        return matchesWarehouse && matchesType && matchesDate;
      })
    : [];

  // Group transactions by type for summary
  const getTransactionCounts = () => {
    if (!transactions) return { checkIn: 0, issue: 0, transfer: 0, total: 0 };
    
    const counts = {
      checkIn: 0,
      issue: 0,
      transfer: 0,
      total: 0
    };
    
    filteredTransactions.forEach((transaction: any) => {
      counts.total++;
      
      switch (transaction.transactionType) {
        case "check-in":
          counts.checkIn++;
          break;
        case "issue":
          counts.issue++;
          break;
        case "transfer":
          counts.transfer++;
          break;
      }
    });
    
    return counts;
  };
  
  const transactionCounts = getTransactionCounts();

  if (transactionsLoading || warehousesLoading) {
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
          <h1 className="text-2xl font-medium text-gray-800">Inventory Movement Report</h1>
          <p className="text-gray-600">Track and analyze inventory movements over time</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button 
            onClick={() => exportMutation.mutate()}
            disabled={exportMutation.isPending}
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Movements</p>
                <h2 className="text-3xl font-bold">{transactionCounts.total}</h2>
              </div>
              <div className="bg-primary bg-opacity-10 p-3 rounded-full">
                <span className="material-icons text-primary">swap_horiz</span>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Check-ins</p>
                <h2 className="text-3xl font-bold">{transactionCounts.checkIn}</h2>
              </div>
              <div className="bg-green-100 p-3 rounded-full">
                <span className="material-icons text-green-600">login</span>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Issues</p>
                <h2 className="text-3xl font-bold">{transactionCounts.issue}</h2>
              </div>
              <div className="bg-red-100 p-3 rounded-full">
                <span className="material-icons text-red-600">logout</span>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Transfers</p>
                <h2 className="text-3xl font-bold">{transactionCounts.transfer}</h2>
              </div>
              <div className="bg-blue-100 p-3 rounded-full">
                <span className="material-icons text-blue-600">sync_alt</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Controls */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Select
                value={warehouseFilter}
                onValueChange={setWarehouseFilter}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Warehouse Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Warehouses</SelectItem>
                  {warehouses?.map((warehouse: any) => (
                    <SelectItem key={warehouse.id} value={warehouse.id.toString()}>
                      {warehouse.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Select
                value={typeFilter}
                onValueChange={setTypeFilter}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Transaction Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="check-in">Check-ins</SelectItem>
                  <SelectItem value="issue">Issues</SelectItem>
                  <SelectItem value="transfer">Transfers</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <Input
                  type="date"
                  placeholder="Start Date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setDateRange("custom");
                  }}
                />
              </div>
            </div>
            
            <div>
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <Input
                  type="date"
                  placeholder="End Date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setDateRange("custom");
                  }}
                />
              </div>
            </div>
          </div>
          
          <div className="mt-4">
            <Tabs value={dateRange} onValueChange={handleDateRangeChange}>
              <TabsList>
                <TabsTrigger value="all">All Time</TabsTrigger>
                <TabsTrigger value="today">Today</TabsTrigger>
                <TabsTrigger value="last7days">Last 7 Days</TabsTrigger>
                <TabsTrigger value="last30days">Last 30 Days</TabsTrigger>
                <TabsTrigger value="last90days">Last 90 Days</TabsTrigger>
                <TabsTrigger value="custom">Custom Range</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Inventory Movements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Transaction Code</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      No transactions found matching the filters
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransactions.map((transaction: any) => (
                    <TableRow key={transaction.id}>
                      <TableCell className="font-medium">{transaction.transactionCode}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 text-xs rounded-full ${getTransactionTypeColor(transaction.transactionType)}`}>
                          {transaction.transactionType === "check-in" ? "Check-in" : 
                           transaction.transactionType === "issue" ? "Issue" : "Transfer"}
                        </span>
                      </TableCell>
                      <TableCell>{transaction.item?.name || `Item #${transaction.itemId}`}</TableCell>
                      <TableCell>{transaction.quantity}</TableCell>
                      <TableCell>
                        {transaction.sourceWarehouse?.name || 
                          (transaction.sourceWarehouseId ? `Warehouse #${transaction.sourceWarehouseId}` : "—")}
                      </TableCell>
                      <TableCell>
                        {transaction.destinationWarehouse?.name || 
                          (transaction.destinationWarehouseId ? `Warehouse #${transaction.destinationWarehouseId}` : "—")}
                      </TableCell>
                      <TableCell>{formatDateTime(transaction.createdAt)}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(transaction.status)}`}>
                          {transaction.status === "in-transit" ? "In Transit" : 
                           transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
