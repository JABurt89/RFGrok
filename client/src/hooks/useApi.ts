import { useState, useEffect } from "react";
import { useQuery, useMutation, UseMutationResult, UseQueryResult } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { WorkoutLog } from "@/types";

type ApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface UseApiOptions<TData = unknown, TError = Error> {
  url: string;
  method?: ApiMethod;
  queryKey?: string[];
  data?: unknown;
  onSuccess?: (data: TData) => void;
  onError?: (error: TError) => void;
}

interface PendingSync {
  method: ApiMethod;
  url: string;
  data: unknown;
  timestamp: number;
}

const SYNC_QUEUE_KEY = 'workout_sync_queue';

export function useApi<TData = unknown, TError = Error>({
  url,
  method = "GET",
  queryKey = [url],
  data,
  onSuccess,
  onError,
}: UseApiOptions<TData, TError>): UseQueryResult<TData, TError> | UseMutationResult<TData, TError, unknown> {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [conflict, setConflict] = useState<{ local: WorkoutLog; cloud: WorkoutLog } | null>(null);

  // Handle online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      processSyncQueue();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Queue management functions
  const addToSyncQueue = (operation: PendingSync) => {
    const queue = JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY) || '[]');
    queue.push(operation);
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  };

  const processSyncQueue = async () => {
    const queue: PendingSync[] = JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY) || '[]');
    if (queue.length === 0) return;

    const sortedQueue = queue.sort((a, b) => a.timestamp - b.timestamp);

    for (const operation of sortedQueue) {
      try {
        const cloudResponse = await apiRequest("GET", operation.url);
        const cloudData = await cloudResponse.json();

        if (operation.method === "POST" || operation.method === "PATCH") {
          const localData = operation.data as WorkoutLog;
          const cloudLog = cloudData as WorkoutLog;

          if (new Date(localData.date) > new Date(cloudLog.date)) {
            setConflict({ local: localData, cloud: cloudLog });
            return;
          }
        }

        await apiRequest(operation.method, operation.url, operation.data);
      } catch (error) {
        console.error('Error processing sync queue:', error);
        return;
      }
    }

    localStorage.setItem(SYNC_QUEUE_KEY, '[]');
    queryClient.invalidateQueries();
  };

  const handleOfflineOperation = (operation: PendingSync) => {
    addToSyncQueue(operation);
    const offlineData = operation.data as TData;
    queryClient.setQueryData(queryKey, offlineData);
    onSuccess?.(offlineData);
  };

  // For GET requests, use useQuery
  if (method === "GET") {
    return useQuery<TData, TError>({
      queryKey,
      queryFn: async () => {
        try {
          const response = await apiRequest(method, url);
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || `API call failed: ${response.statusText}`);
          }
          return response.json();
        } catch (error) {
          if (!isOnline) {
            // Return cached data if available
            const cachedData = queryClient.getQueryData<TData>(queryKey);
            if (cachedData) return cachedData;
          }
          throw error;
        }
      },
    });
  }

  // For other methods, use useMutation
  return useMutation<TData, TError, unknown>({
    mutationFn: async (mutationData = data) => {
      if (!isOnline) {
        handleOfflineOperation({
          method,
          url,
          data: mutationData,
          timestamp: Date.now(),
        });
        return mutationData as TData;
      }

      const response = await apiRequest(method, url, mutationData);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `API call failed: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: (responseData) => {
      queryClient.invalidateQueries({ queryKey });
      onSuccess?.(responseData);
    },
    onError: (err) => {
      onError?.(err as TError);
    },
  });
}

export type { UseApiOptions };