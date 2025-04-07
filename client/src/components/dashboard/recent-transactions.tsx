import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { formatDateTime, getStatusColor, getTransactionTypeColor } from "@/lib/utils";

type RecentTransactionsProps = {
  transactions: any[];
};

export default function RecentTransactions({ transactions }: RecentTransactionsProps) {
  const [_, navigate] = useLocation();

  const { data: items } = useQuery({
    queryKey: ["/api/items"],
  });

  const { data: warehouses } = useQuery({
    queryKey: ["/api/warehouses"],
  });

  const getItemName = (itemId: number) => {
    if (!items) return `Item #${itemId}`;
    const item = items.find((i: any) => i.id === itemId);
    return item ? item.name : `Item #${itemId}`;
  };

  const getItemSku = (itemId: number) => {
    if (!items) return "";
    const item = items.find((i: any) => i.id === itemId);
    return item ? item.sku : "";
  };

  const getWarehouseName = (warehouseId: number | null) => {
    if (!warehouseId || !warehouses) return "";
    const warehouse = warehouses.find((w: any) => w.id === warehouseId);
    return warehouse ? warehouse.name : `Warehouse #${warehouseId}`;
  };

  const getWarehouseDisplay = (transaction: any) => {
    if (transaction.transactionType === "check-in") {
      return getWarehouseName(transaction.destinationWarehouseId);
    } else if (transaction.transactionType === "issue") {
      return getWarehouseName(transaction.sourceWarehouseId);
    } else if (transaction.transactionType === "transfer") {
      return `${getWarehouseName(transaction.sourceWarehouseId)} → ${getWarehouseName(transaction.destinationWarehouseId)}`;
    }
    return "";
  };

  return (
    <Card>
      <CardHeader className="p-6 border-b flex flex-row items-center justify-between">
        <h3 className="text-lg font-medium text-gray-800">Recent Inventory Movements</h3>
        <Button 
          variant="ghost" 
          className="text-primary text-sm hover:bg-primary/5"
          onClick={() => navigate("/movement-report")}
        >
          View All
          <span className="material-icons text-sm ml-1">chevron_right</span>
        </Button>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    No recent transactions found
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((transaction: any) => (
                  <TableRow key={transaction.id} className="hover:bg-gray-50">
                    <TableCell className="font-medium">{transaction.transactionCode}</TableCell>
                    <TableCell>
                      <div className="text-sm font-medium text-gray-900">{getItemName(transaction.itemId)}</div>
                      <div className="text-xs text-gray-500">SKU: {getItemSku(transaction.itemId)}</div>
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getTransactionTypeColor(transaction.transactionType)}`}>
                        {transaction.transactionType === "check-in" 
                          ? "Check-In" 
                          : transaction.transactionType === "issue" 
                            ? "Issue" 
                            : "Transfer"}
                      </span>
                    </TableCell>
                    <TableCell>{transaction.quantity}</TableCell>
                    <TableCell>{getWarehouseDisplay(transaction)}</TableCell>
                    <TableCell>{formatDateTime(transaction.createdAt)}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(transaction.status)}`}>
                        {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
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
  );
}
