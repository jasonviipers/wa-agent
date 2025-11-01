"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAnalyticsMetrics, useRealtimeMetrics, exportAnalytics, type DateRange } from "@/hooks/use-analytics";
import { ArrowDownIcon, ArrowUpIcon, TrendingUpIcon, MessageSquareIcon, UsersIcon, DollarSignIcon } from "lucide-react";

export function AnalyticsDashboard() {
	const [dateRange, setDateRange] = useState<DateRange>({
		startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
		endDate: new Date(),
	});

	const { data: metrics, isLoading } = useAnalyticsMetrics(dateRange);
	const { data: realtimeMetrics } = useRealtimeMetrics();

	const handleExport = async (type: "conversations" | "messages" | "events") => {
		try {
			await exportAnalytics(dateRange, type);
		} catch (error) {
			console.error("Export failed:", error);
		}
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-64">
				<div className="text-muted-foreground">Loading analytics...</div>
			</div>
		);
	}

	if (!metrics) {
		return (
			<div className="flex items-center justify-center h-64">
				<div className="text-muted-foreground">No data available</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex justify-between items-center">
				<div>
					<h1 className="text-3xl font-bold">Analytics Dashboard</h1>
					<p className="text-muted-foreground mt-1">
						Overview of your agent performance and metrics
					</p>
				</div>
				<div className="flex gap-2">
					<Button variant="outline" onClick={() => handleExport("conversations")}>
						Export Conversations
					</Button>
					<Button variant="outline" onClick={() => handleExport("messages")}>
						Export Messages
					</Button>
					<Button variant="outline" onClick={() => handleExport("events")}>
						Export Events
					</Button>
				</div>
			</div>

			{/* Real-time Metrics */}
			{realtimeMetrics && (
				<div className="grid gap-4 md:grid-cols-4">
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">Active Conversations</CardTitle>
							<MessageSquareIcon className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">{realtimeMetrics.activeConversations}</div>
							<p className="text-xs text-muted-foreground">Real-time</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">Messages (24h)</CardTitle>
							<TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">{realtimeMetrics.messagesLast24h}</div>
							<p className="text-xs text-muted-foreground">Last 24 hours</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
							<ArrowDownIcon className="h-4 w-4 text-green-600" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">
								{realtimeMetrics.averageResponseTime.toFixed(1)}s
							</div>
							<p className="text-xs text-muted-foreground">Last 24 hours</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">Events (24h)</CardTitle>
							<UsersIcon className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">{realtimeMetrics.eventsLast24h}</div>
							<p className="text-xs text-muted-foreground">Last 24 hours</p>
						</CardContent>
					</Card>
				</div>
			)}

			{/* Overview Metrics */}
			<div className="grid gap-4 md:grid-cols-3">
				<Card>
					<CardHeader>
						<CardTitle>Total Conversations</CardTitle>
						<CardDescription>All time conversations</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="text-3xl font-bold">{metrics.totalConversations}</div>
						<div className="mt-2 text-sm">
							<span className="text-green-600">
								{metrics.activeConversations} active
							</span>
							{" • "}
							<span className="text-gray-600">
								{metrics.completedConversations} completed
							</span>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Customer Satisfaction</CardTitle>
						<CardDescription>Average rating</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="text-3xl font-bold">
							{metrics.customerSatisfaction.toFixed(1)}
						</div>
						<div className="mt-2 text-sm text-muted-foreground">
							Out of 5.0
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Total Sales</CardTitle>
						<CardDescription>Revenue generated</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="flex items-center text-3xl font-bold">
							<DollarSignIcon className="h-6 w-6" />
							{metrics.totalSales.toLocaleString()}
						</div>
						<div className="mt-2 text-sm">
							<span className="text-green-600">
								{metrics.conversionRate.toFixed(1)}% conversion
							</span>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Top Performing Agents */}
			<Card>
				<CardHeader>
					<CardTitle>Top Performing Agents</CardTitle>
					<CardDescription>Best performing agents by conversation count</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						{metrics.topPerformingAgents.slice(0, 5).map((agent, index) => (
							<div key={agent.agentId} className="flex items-center justify-between">
								<div className="flex items-center gap-3">
									<div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold">
										{index + 1}
									</div>
									<div>
										<div className="font-medium">{agent.agentName}</div>
										<div className="text-xs text-muted-foreground">
											{agent.conversationCount} conversations
										</div>
									</div>
								</div>
								<div className="text-right">
									<div className="text-sm font-medium">
										{agent.successRate.toFixed(1)}% success
									</div>
									<div className="text-xs text-muted-foreground">
										{agent.averageResponseTime.toFixed(1)}s avg
									</div>
								</div>
							</div>
						))}
					</div>
				</CardContent>
			</Card>

			{/* Platform Distribution */}
			<Card>
				<CardHeader>
					<CardTitle>Platform Distribution</CardTitle>
					<CardDescription>Conversations by platform</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="space-y-2">
						{Object.entries(metrics.platformDistribution).map(([platform, count]) => (
							<div key={platform} className="flex items-center justify-between">
								<span className="capitalize">{platform}</span>
								<div className="flex items-center gap-2">
									<div className="h-2 w-32 bg-secondary rounded-full overflow-hidden">
										<div
											className="h-full bg-primary"
											style={{
												width: `${(count / metrics.totalConversations) * 100}%`,
											}}
										/>
									</div>
									<span className="text-sm font-medium w-12 text-right">{count}</span>
								</div>
							</div>
						))}
					</div>
				</CardContent>
			</Card>

			{/* Sentiment Analysis */}
			<Card>
				<CardHeader>
					<CardTitle>Sentiment Analysis</CardTitle>
					<CardDescription>Customer sentiment distribution</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="space-y-3">
						<div className="flex items-center justify-between">
							<span className="text-green-600">Positive</span>
							<span className="font-medium">{metrics.sentimentAnalysis.positive}</span>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-gray-600">Neutral</span>
							<span className="font-medium">{metrics.sentimentAnalysis.neutral}</span>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-red-600">Negative</span>
							<span className="font-medium">{metrics.sentimentAnalysis.negative}</span>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
