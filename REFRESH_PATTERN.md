# Refresh Key Pattern - Standard Implementation Guide

## Overview
The refresh key pattern ensures reliable data refresh across all pages by forcing React Query to treat queries as completely new when data needs to be updated.

## Implementation Pattern

### 1. State Setup
```typescript
const [refreshKey, setRefreshKey] = useState(0);
```

### 2. Query Dependencies
```typescript
const { data: items } = useQuery({
  queryKey: ["/api/items", refreshKey],
});
```

### 3. Refresh Functions
```typescript
// Manual refresh (for refresh buttons)
const performRefresh = async () => {
  setIsRefreshing(true);
  try {
    setRefreshKey(prev => prev + 1);
    await new Promise(resolve => setTimeout(resolve, 300));
  } finally {
    setIsRefreshing(false);
  }
};

// Automatic refresh (for mutations)
const mutation = useMutation({
  // ... mutation logic
  onSuccess: () => {
    setRefreshKey(prev => prev + 1);
    // ... other success handling
  }
});
```

## Benefits
- Guarantees fresh data from server
- Forces complete component re-renders
- Maintains SPA experience without page reloads
- Simple and reliable pattern

## Pages Implemented
- ✅ Warehouses Page (warehouses-page.tsx)
- ✅ Enhanced Transfers Page (enhanced-transfers-page.tsx)
- 🔄 Users Management Page (in progress)
- 🔄 Requests Page (in progress)
- 🔄 Inventory Page (in progress)

## Next Steps
Standardize this pattern across all remaining pages that handle CRUD operations.