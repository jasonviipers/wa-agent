import { useQuery } from "@tanstack/react-query";
import type { AnalyticsMetrics, AgentPerformanceMetrics } from "@/lib/analytics/service";

export type DateRange = {
	startDate: Date;
	endDate: Date;
};

/**
 * Hook to fetch organization analytics metrics
 */
export function useAnalyticsMetrics(dateRange: DateRange) {
	return useQuery({
		queryKey: ["analytics", "metrics", dateRange],
		queryFn: async () => {
			const params = new URLSearchParams({
				startDate: dateRange.startDate.toISOString(),
				endDate: dateRange.endDate.toISOString(),
			});

			const response = await fetch(`/api/analytics/metrics?${params}`);
			if (!response.ok) {
				throw new Error("Failed to fetch analytics metrics");
			}
			return response.json() as Promise<AnalyticsMetrics>;
		},
	});
}

/**
 * Hook to fetch agent performance metrics
 */
export function useAgentMetrics(agentId: string, dateRange: DateRange) {
	return useQuery({
		queryKey: ["analytics", "agent", agentId, dateRange],
		queryFn: async () => {
			const params = new URLSearchParams({
				startDate: dateRange.startDate.toISOString(),
				endDate: dateRange.endDate.toISOString(),
			});

			const response = await fetch(
				`/api/analytics/agent/${agentId}?${params}`,
			);
			if (!response.ok) {
				throw new Error("Failed to fetch agent metrics");
			}
			return response.json() as Promise<AgentPerformanceMetrics>;
		},
		enabled: !!agentId,
	});
}

/**
 * Hook to fetch real-time metrics
 */
export function useRealtimeMetrics() {
	return useQuery({
		queryKey: ["analytics", "realtime"],
		queryFn: async () => {
			const response = await fetch("/api/analytics/realtime");
			if (!response.ok) {
				throw new Error("Failed to fetch realtime metrics");
			}
			return response.json() as Promise<{
				activeConversations: number;
				messagesLast24h: number;
				averageResponseTime: number;
				eventsLast24h: number;
			}>;
		},
		refetchInterval: 30000, // Refetch every 30 seconds
	});
}

/**
 * Hook to fetch conversation trends
 */
export function useConversationTrends(dateRange: DateRange) {
	return useQuery({
		queryKey: ["analytics", "trends", dateRange],
		queryFn: async () => {
			const params = new URLSearchParams({
				startDate: dateRange.startDate.toISOString(),
				endDate: dateRange.endDate.toISOString(),
			});

			const response = await fetch(`/api/analytics/trends?${params}`);
			if (!response.ok) {
				throw new Error("Failed to fetch trends");
			}
			return response.json() as Promise<
				Array<{ date: string; count: number }>
			>;
		},
	});
}

/**
 * Function to export analytics data
 */
export async function exportAnalytics(
	dateRange: DateRange,
	type: "conversations" | "messages" | "events",
): Promise<void> {
	const params = new URLSearchParams({
		startDate: dateRange.startDate.toISOString(),
		endDate: dateRange.endDate.toISOString(),
		type,
	});

	const response = await fetch(`/api/analytics/export?${params}`);
	if (!response.ok) {
		throw new Error("Failed to export analytics");
	}

	const blob = await response.blob();
	const url = window.URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `analytics-${type}-${dateRange.startDate.toISOString().split("T")[0]}-${dateRange.endDate.toISOString().split("T")[0]}.csv`;
	document.body.appendChild(a);
	a.click();
	window.URL.revokeObjectURL(url);
	document.body.removeChild(a);
}
