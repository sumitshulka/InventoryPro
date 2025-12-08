import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: true,
      staleTime: 0, // Always consider data stale for immediate updates
      gcTime: 5 * 60 * 1000, // Keep cache for 5 minutes (TanStack Query v5)
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

// Utility function to invalidate related queries after mutations
export async function invalidateRelatedQueries(entityType: string, action: 'create' | 'update' | 'delete' = 'create') {
  const queryKeysToInvalidate: string[] = [];
  
  switch (entityType) {
    case 'user':
      queryKeysToInvalidate.push('/api/users');
      break;
    case 'client':
      queryKeysToInvalidate.push('/api/clients', '/api/sales-orders');
      break;
    case 'warehouse':
      queryKeysToInvalidate.push('/api/warehouses', '/api/warehouses/stats', '/api/dashboard/summary');
      break;
    case 'location':
      queryKeysToInvalidate.push('/api/locations');
      break;
    case 'item':
      queryKeysToInvalidate.push('/api/items', '/api/inventory', '/api/reports/inventory-stock');
      break;
    case 'inventory':
      queryKeysToInvalidate.push('/api/inventory', '/api/warehouses/stats', '/api/dashboard/summary', '/api/reports/inventory-stock');
      break;
    case 'transaction':
      queryKeysToInvalidate.push('/api/transactions', '/api/inventory', '/api/warehouses/stats', '/api/dashboard/summary', '/api/reports/inventory-stock');
      break;
    case 'request':
      queryKeysToInvalidate.push('/api/requests', '/api/dashboard/summary');
      break;
    case 'category':
      queryKeysToInvalidate.push('/api/categories');
      break;
    case 'department':
      queryKeysToInvalidate.push('/api/departments');
      break;
    case 'approval-settings':
      queryKeysToInvalidate.push('/api/approval-settings');
      break;
    case 'organization-settings':
      queryKeysToInvalidate.push('/api/organization-settings');
      break;
    case 'rejected-goods':
      queryKeysToInvalidate.push('/api/rejected-goods', '/api/dashboard/summary');
      break;
  }

  // Invalidate all related queries
  for (const queryKey of queryKeysToInvalidate) {
    await queryClient.invalidateQueries({ 
      queryKey: [queryKey],
      exact: false,
      refetchType: 'active'
    });
  }
  
  // Force refetch active queries
  await queryClient.refetchQueries({ 
    type: 'active',
    stale: true
  });
}
