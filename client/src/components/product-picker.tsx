import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Package, Plus, Loader2, AlertCircle } from "lucide-react";
import { Item, Category } from "@shared/schema";

interface InventoryItem {
  id: number;
  itemId: number;
  warehouseId: number;
  quantity: number;
  item?: Item;
  category?: Category;
}

interface InventorySearchResponse {
  data: InventoryItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

interface ProductPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouseId: number | null;
  onSelectItem: (item: InventoryItem) => void;
  selectedItemIds?: number[];
}

export function ProductPicker({
  open,
  onOpenChange,
  warehouseId,
  onSelectItem,
  selectedItemIds = [],
}: ProductPickerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [categoryFilter]);

  useEffect(() => {
    if (open) {
      setSearchTerm("");
      setDebouncedSearch("");
      setCategoryFilter("all");
      setPage(1);
    }
  }, [open]);

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: inventoryResult, isLoading } = useQuery<InventorySearchResponse>({
    queryKey: [
      "/api/warehouses",
      warehouseId,
      "inventory-search",
      debouncedSearch,
      categoryFilter,
      page,
    ],
    queryFn: async () => {
      if (!warehouseId) return { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasMore: false } };
      const params = new URLSearchParams({
        search: debouncedSearch,
        page: page.toString(),
        limit: "20",
      });
      if (categoryFilter && categoryFilter !== "all") {
        params.append("categoryId", categoryFilter);
      }
      const res = await fetch(`/api/warehouses/${warehouseId}/inventory-search?${params}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch inventory");
      return res.json();
    },
    enabled: !!warehouseId && open,
  });

  const inventory = inventoryResult?.data || [];
  const pagination = inventoryResult?.pagination;

  const handleSelectItem = useCallback((item: InventoryItem) => {
    onSelectItem(item);
  }, [onSelectItem]);

  const isItemSelected = (itemId: number) => selectedItemIds.includes(itemId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Select Products
          </DialogTitle>
          <DialogDescription>
            Search and add products to your order. Click on a product to add it.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col sm:flex-row gap-3 py-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by name, SKU, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
              data-testid="input-product-search"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-48" data-testid="select-category-filter">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id.toString()}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!warehouseId ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <AlertCircle className="h-8 w-8 mb-2" />
            <p>Please select a warehouse first</p>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : inventory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <Package className="h-8 w-8 mb-2" />
            <p>No products found</p>
            {debouncedSearch && (
              <p className="text-sm mt-1">Try adjusting your search terms</p>
            )}
          </div>
        ) : (
          <>
            <div className="text-sm text-gray-500 mb-2">
              Showing {inventory.length} of {pagination?.total || 0} products
            </div>
            <ScrollArea className="flex-1 pr-4" style={{ maxHeight: "400px" }}>
              <div className="space-y-2">
                {inventory.map((inv) => {
                  const selected = isItemSelected(inv.itemId);
                  return (
                    <div
                      key={inv.id}
                      className={`flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer
                        ${selected 
                          ? "bg-primary/5 border-primary/30" 
                          : "bg-white hover:bg-gray-50 border-gray-200"
                        }`}
                      onClick={() => handleSelectItem(inv)}
                      data-testid={`product-item-${inv.itemId}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">
                            {inv.item?.name || `Item #${inv.itemId}`}
                          </span>
                          {selected && (
                            <Badge variant="secondary" className="text-xs">
                              Added
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                          <span className="font-mono">{inv.item?.sku}</span>
                          {inv.category && (
                            <Badge variant="outline" className="text-xs">
                              {inv.category.name}
                            </Badge>
                          )}
                          {inv.item?.unit && (
                            <span>Unit: {inv.item.unit}</span>
                          )}
                        </div>
                        {inv.item?.description && (
                          <p className="text-xs text-gray-400 mt-1 truncate">
                            {inv.item.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-4 ml-4">
                        <div className="text-right">
                          <div className="font-semibold text-lg">
                            {inv.quantity}
                          </div>
                          <div className="text-xs text-gray-500">Available</div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant={selected ? "secondary" : "default"}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectItem(inv);
                          }}
                          data-testid={`button-add-product-${inv.itemId}`}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  data-testid="button-prev-page"
                >
                  Previous
                </Button>
                <span className="text-sm text-gray-500">
                  Page {page} of {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!pagination.hasMore}
                  onClick={() => setPage((p) => p + 1)}
                  data-testid="button-next-page"
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}

        <div className="flex justify-end pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-close-picker"
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
