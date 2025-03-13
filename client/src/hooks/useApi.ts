import { useQuery, useMutation, UseMutationResult, UseQueryResult } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

type ApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface UseApiOptions<TData = unknown, TError = Error> {
  url: string;
  method?: ApiMethod;
  queryKey?: string[];
  data?: unknown;
  onSuccess?: (data: TData) => void;
  onError?: (error: TError) => void;
}

export function useApi<TData = unknown, TError = Error>({
  url,
  method = "GET",
  queryKey = [url],
  data,
  onSuccess,
  onError,
}: UseApiOptions<TData, TError>): UseQueryResult<TData, TError> | UseMutationResult<TData, TError, unknown> {
  // For GET requests, use useQuery
  if (method === "GET") {
    return useQuery<TData, TError>({
      queryKey,
      queryFn: async () => {
        const response = await apiRequest(method, url);
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || `API call failed: ${response.statusText}`);
        }
        return response.json();
      },
    });
  }

  // For other methods, use useMutation
  return useMutation<TData, TError, unknown>({
    mutationFn: async (mutationData = data) => {
      const response = await apiRequest(method, url, mutationData);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `API call failed: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: (responseData) => {
      // Invalidate queries that might be affected by this mutation
      queryClient.invalidateQueries({ queryKey });
      onSuccess?.(responseData);
    },
    onError: (err) => {
      onError?.(err as TError);
    },
  });
}
