import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import AppLayout from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Search, Plus, Edit, MoreVertical, Eye, History, Power, PowerOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useAuth } from "@/hooks/use-auth";

// Item and Category types
interface Item {
  id: number;
  name: string;
  sku: string;
  description: string | null;
  minStockLevel: number;
  categoryId: number | null;
  unit: string;
  status: string;
  createdAt: string;
}

interface Category {
  id: number;
  name: string;
  description: string | null;
}

const formSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  sku: z.string().min(1, { message: "SKU is required" }),
  description: z.string().nullable().optional(),
  minStockLevel: z.coerce.number().min(0),
  categoryId: z.coerce.number().nullable(),
  unit: z.string().default("pcs"),
  status: z.enum(["active", "inactive"]).default("active"),
});

type FormValues = z.infer<typeof formSchema>;

export default function ItemMasterPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editItemId, setEditItemId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  
  // Actions column state
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isCheckInHistoryOpen, setIsCheckInHistoryOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [checkInHistory, setCheckInHistory] = useState<any[]>([]);

  const { data: items = [], isLoading: itemsLoading, refetch: refetchItems } = useQuery<Item[]>({
    queryKey: ["/api/items"]
  });

  // Log items when they change
  useEffect(() => {
    console.log("Items data updated:", items);
  }, [items]);

  const { data: categories = [], isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: ["/api/categories"]
  });

  // Fetch inventory data to calculate total available quantities
  const { data: inventoryData = [], isLoading: inventoryLoading } = useQuery<any[]>({
    queryKey: ["/api/reports/inventory-stock"]
  });

  // Log categories when they change
  useEffect(() => {
    console.log("Categories data updated:", categories);
  }, [categories]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      sku: "",
      description: "",
      minStockLevel: 10,
      categoryId: null,
      unit: "pcs",
      status: "active",
    },
  });

  const createItemMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      // Explicitly convert the values to match the expected types
      const payload = {
        name: data.name,
        sku: data.sku,
        description: data.description || null,
        minStockLevel: data.minStockLevel,
        categoryId: data.categoryId,
        unit: data.unit,
        status: data.status,
      };
      
      console.log("Submitting item data:", payload);
      
      if (isEditMode && editItemId) {
        const res = await apiRequest("PUT", `/api/items/${editItemId}`, payload);
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/items", payload);
        return res.json();
      }
    },
    onSuccess: (data) => {
      console.log("Item saved successfully:", data);
      // Force invalidate and refetch items
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      
      // Manually refetch the items to ensure the UI is updated
      setTimeout(() => {
        refetchItems();
      }, 500);
      
      toast({
        title: isEditMode ? "Item updated" : "Item created",
        description: isEditMode
          ? "The item has been updated successfully."
          : "The item has been created successfully.",
      });
      resetForm();
    },
    onError: (error: Error) => {
      console.error("Error saving item:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation for updating item status (activate/deactivate)
  const updateStatusMutation = useMutation({
    mutationFn: async ({ itemId, status }: { itemId: number; status: "active" | "inactive" }) => {
      const res = await apiRequest("PATCH", `/api/items/${itemId}/status`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      toast({
        title: "Status updated",
        description: "Item status has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Function to fetch check-in history
  const fetchCheckInHistory = async (itemId: number) => {
    try {
      const res = await apiRequest("GET", `/api/items/${itemId}/checkin-history`);
      const history = await res.json();
      setCheckInHistory(history);
      setIsCheckInHistoryOpen(true);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch check-in history",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    form.reset({
      name: "",
      sku: "",
      description: "",
      minStockLevel: 10,
      categoryId: null,
      unit: "pcs",
      status: "active",
    });
    setIsEditMode(false);
    setEditItemId(null);
    setIsDialogOpen(false);
  };

  const handleEditItem = (item: Item) => {
    form.reset({
      name: item.name,
      sku: item.sku,
      description: item.description || "",
      minStockLevel: item.minStockLevel,
      categoryId: item.categoryId || null,
      unit: item.unit,
      status: item.status,
    });
    setIsEditMode(true);
    setEditItemId(item.id);
    setIsDialogOpen(true);
  };

  const handleSubmit = (values: FormValues) => {
    createItemMutation.mutate(values);
  };

  const filteredItems = items
    ? items.filter((item: Item) => {
        const matchesSearch = 
          item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()));
        
        const matchesCategory = 
          categoryFilter === "all" || 
          (item.categoryId && item.categoryId.toString() === categoryFilter);
        
        return matchesSearch && matchesCategory;
      })
    : [];

  const getCategoryName = (categoryId: number | null) => {
    if (!categoryId || !categories) return "Uncategorized";
    const category = categories.find((cat: Category) => cat.id === categoryId);
    return category ? category.name : "Uncategorized";
  };

  // Calculate total available quantity for an item across all warehouses
  const getTotalAvailableQuantity = (itemId: number) => {
    if (!inventoryData || !Array.isArray(inventoryData) || inventoryData.length === 0) return 0;
    
    return inventoryData
      .filter((inventory: any) => inventory.itemId === itemId)
      .reduce((total: number, inventory: any) => total + (inventory.quantity || 0), 0);
  };

  const isManager = user?.role === "admin" || user?.role === "manager";

  if (itemsLoading || categoriesLoading || inventoryLoading) {
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
          <h1 className="text-2xl font-medium text-gray-800">Item Master</h1>
          <p className="text-gray-600">Manage your product catalog</p>
        </div>
        {isManager && (
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Item
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Product Catalog</CardTitle>
          <div className="flex flex-col md:flex-row justify-between gap-4 mt-4">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-2 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by name, SKU or description..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="w-full md:w-64">
              <Select
                value={categoryFilter}
                onValueChange={setCategoryFilter}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((category: Category) => (
                    <SelectItem key={category.id} value={category.id.toString()}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Min Stock</TableHead>
                  <TableHead>Total Available</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isManager ? 8 : 7} className="text-center py-8 text-gray-500">
                      No items found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item: Item) => {
                    const totalAvailable = getTotalAvailableQuantity(item.id);
                    const isLowStock = totalAvailable <= item.minStockLevel;
                    
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.sku}</TableCell>
                        <TableCell>{item.name}</TableCell>
                        <TableCell className="max-w-xs truncate">{item.description || "—"}</TableCell>
                        <TableCell>{getCategoryName(item.categoryId)}</TableCell>
                        <TableCell>{item.minStockLevel}</TableCell>
                        <TableCell>
                          <span className={`font-medium ${isLowStock ? 'text-red-600' : 'text-green-600'}`}>
                            {totalAvailable}
                          </span>
                        </TableCell>
                        <TableCell>{item.unit}</TableCell>
                        {isManager && (
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditItem(item)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEditMode ? "Edit Item" : "Add New Item"}</DialogTitle>
            <DialogDescription>
              {isEditMode
                ? "Update the details of an existing item"
                : "Fill in the details to add a new item to your catalog"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Item Name</Label>
                <Input
                  id="name"
                  placeholder="Enter item name"
                  {...form.register("name")}
                />
                {form.formState.errors.name && (
                  <p className="text-sm text-red-500">{form.formState.errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="sku">SKU</Label>
                <Input
                  id="sku"
                  placeholder="Enter SKU"
                  {...form.register("sku")}
                  disabled={isEditMode} // SKU cannot be changed once created
                />
                {form.formState.errors.sku && (
                  <p className="text-sm text-red-500">{form.formState.errors.sku.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Enter item description"
                  rows={3}
                  {...form.register("description")}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="categoryId">Category</Label>
                  <Select
                    onValueChange={(value) => form.setValue("categoryId", Number(value) || null)}
                    defaultValue={form.getValues("categoryId")?.toString() || "0"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Uncategorized</SelectItem>
                      {categories.map((category: Category) => (
                        <SelectItem key={category.id} value={category.id.toString()}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {(!categories || categories.length === 0) && (
                    <p className="text-sm text-amber-600">
                      No categories available. Create categories in Settings to organize items.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="unit">Unit</Label>
                  <Select
                    onValueChange={(value) => form.setValue("unit", value)}
                    defaultValue={form.getValues("unit")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pcs">Pieces (pcs)</SelectItem>
                      <SelectItem value="kg">Kilograms (kg)</SelectItem>
                      <SelectItem value="g">Grams (g)</SelectItem>
                      <SelectItem value="l">Liters (l)</SelectItem>
                      <SelectItem value="m">Meters (m)</SelectItem>
                      <SelectItem value="box">Box</SelectItem>
                      <SelectItem value="set">Set</SelectItem>
                      <SelectItem value="pack">Pack</SelectItem>
                      <SelectItem value="reams">Reams</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="minStockLevel">Minimum Stock Level</Label>
                <Input
                  id="minStockLevel"
                  type="number"
                  min="0"
                  placeholder="Enter minimum stock level"
                  {...form.register("minStockLevel")}
                />
                {form.formState.errors.minStockLevel && (
                  <p className="text-sm text-red-500">{form.formState.errors.minStockLevel.message}</p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={resetForm}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createItemMutation.isPending}
              >
                {createItemMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isEditMode ? "Updating..." : "Creating..."}
                  </>
                ) : (
                  isEditMode ? "Update Item" : "Create Item"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
