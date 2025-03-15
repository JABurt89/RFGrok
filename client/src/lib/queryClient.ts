import { QueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = await res.text();
    const error = text ? JSON.parse(text) : { error: res.statusText };
    throw new Error(error.error || `${res.status}: ${res.statusText}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  try {
    console.log(`[API] ${method} ${url}`, data ? { data } : '');
    const res = await fetch(url, {
      method,
      headers: {
        ...(data ? { "Content-Type": "application/json" } : {}),
        "Accept": "application/json",
      },
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include", // Always include credentials
    });

    console.log(`[API] Response status:`, res.status);
    await throwIfResNotOk(res);
    return res;
  } catch (error) {
    console.error(`[API] Error in ${method} ${url}:`, error);
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn = ({ on401: unauthorizedBehavior }: { on401: UnauthorizedBehavior }) =>
  async ({ queryKey }: { queryKey: string[] }) => {
    try {
      console.log(`[Query] GET ${queryKey[0]}`);
      const res = await fetch(queryKey[0] as string, {
        credentials: "include", // Always include credentials for queries
        headers: {
          "Accept": "application/json",
        },
      });

      console.log(`[Query] Response status:`, res.status);
      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      await throwIfResNotOk(res);
      return await res.json();
    } catch (error) {
      console.error(`[Query] Error fetching ${queryKey[0]}:`, error);
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});