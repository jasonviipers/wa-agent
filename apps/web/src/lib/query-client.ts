import { QueryCache, QueryClient, MutationCache } from "@tanstack/react-query";
import { toast } from "sonner";

/**
 * Enhanced QueryClient with optimistic update support
 *
 * Features:
 * - Global error handling with toast notifications
 * - Optimistic update configuration
 * - Automatic retry logic
 * - Cache persistence
 */
export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      toast.error(`Error: ${error.message}`, {
        action: {
          label: "retry",
          onClick: () => {
            queryClient.invalidateQueries();
          },
        },
      });
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      toast.error(`Mutation failed: ${error.message}`);
    },
    onSuccess: (data, variables, context, mutation) => {
      // Only show success toast if mutation has meta.successMessage
      const successMessage = mutation.options.meta?.successMessage as string | undefined;
      if (successMessage) {
        toast.success(successMessage);
      }
    },
  }),
  defaultOptions: {
    queries: {
      // Stale time: How long data is considered fresh (5 minutes)
      staleTime: 5 * 60 * 1000,

      // Cache time: How long inactive data stays in cache (10 minutes)
      gcTime: 10 * 60 * 1000,

      // Retry configuration
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors (client errors)
        if (error instanceof Error && 'status' in error) {
          const status = (error as { status?: number }).status;
          if (status && status >= 400 && status < 500) {
            return false;
          }
        }
        // Retry up to 3 times for other errors
        return failureCount < 3;
      },

      // Retry delay with exponential backoff
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

      // Refetch settings
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      refetchOnMount: true,
    },
    mutations: {
      // Retry mutations once by default
      retry: 1,

      // Mutation retry delay
      retryDelay: 1000,

      // Global error handling is done via mutationCache.onError
      onError: undefined,
    },
  },
});
