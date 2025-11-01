import { db } from "@wa/db";
import {
	analyticsEvent,
	agent,
	conversation,
	message,
	orders,
	type AnalyticsEvent,
} from "@wa/db/schema";
import { and, eq, gte, lte, sql, desc, count } from "drizzle-orm";

export type DateRange = {
	startDate: Date;
	endDate: Date;
};

export type AnalyticsMetrics = {
	totalConversations: number;
	activeConversations: number;
	completedConversations: number;
	totalMessages: number;
	averageResponseTime: number;
	customerSatisfaction: number;
	totalSales: number;
	conversionRate: number;
	topPerformingAgents: Array<{
		agentId: string;
		agentName: string;
		conversationCount: number;
		successRate: number;
		averageResponseTime: number;
	}>;
	eventsByType: Record<string, number>;
	conversationTrends: Array<{
		date: string;
		count: number;
	}>;
	platformDistribution: Record<string, number>;
	sentimentAnalysis: {
		positive: number;
		neutral: number;
		negative: number;
	};
};

export type AgentPerformanceMetrics = {
	agentId: string;
	totalConversations: number;
	activeConversations: number;
	closedConversations: number;
	averageResponseTime: number;
	successRate: number;
	customerSatisfaction: number;
	totalSales: number;
	conversionRate: number;
	messageCount: number;
	topIntents: Array<{ intent: string; count: number }>;
	averageConfidence: number;
};

export type ConversationAnalytics = {
	conversationId: string;
	platform: string;
	messageCount: number;
	duration: number;
	sentiment: string | null;
	escalated: boolean;
	resolved: boolean;
	customerSatisfaction: number | null;
	totalCredits: number;
};

/**
 * Analytics Service - Provides comprehensive analytics and reporting capabilities
 */
export class AnalyticsService {
	/**
	 * Get comprehensive analytics metrics for an organization
	 */
	async getOrganizationMetrics(
		organizationId: string,
		dateRange: DateRange,
	): Promise<AnalyticsMetrics> {
		const { startDate, endDate } = dateRange;

		// Fetch all conversations in date range
		const conversations = await db
			.select()
			.from(conversation)
			.where(
				and(
					eq(conversation.organizationId, organizationId),
					gte(conversation.createdAt, startDate),
					lte(conversation.createdAt, endDate),
				),
			);

		// Count total messages
		const messagesResult = await db
			.select({ count: count() })
			.from(message)
			.innerJoin(conversation, eq(message.conversationId, conversation.id))
			.where(
				and(
					eq(conversation.organizationId, organizationId),
					gte(message.createdAt, startDate),
					lte(message.createdAt, endDate),
				),
			);

		// Get events by type
		const eventsResult = await db
			.select({
				eventType: analyticsEvent.eventType,
				count: count(),
			})
			.from(analyticsEvent)
			.where(
				and(
					eq(analyticsEvent.organizationId, organizationId),
					gte(analyticsEvent.createdAt, startDate),
					lte(analyticsEvent.createdAt, endDate),
				),
			)
			.groupBy(analyticsEvent.eventType);

		// Get platform distribution
		const platformDist = await db
			.select({
				platform: conversation.platform,
				count: count(),
			})
			.from(conversation)
			.where(
				and(
					eq(conversation.organizationId, organizationId),
					gte(conversation.createdAt, startDate),
					lte(conversation.createdAt, endDate),
				),
			)
			.groupBy(conversation.platform);

		// Get top performing agents
		const topAgents = await db
			.select({
				agentId: agent.id,
				agentName: agent.name,
				totalConversations: agent.totalConversations,
				successRate: agent.successRate,
				averageResponseTime: agent.averageResponseTime,
			})
			.from(agent)
			.where(eq(agent.organizationId, organizationId))
			.orderBy(desc(agent.totalConversations))
			.limit(10);

		// Calculate conversation trends (daily)
		const trends = await this.getConversationTrends(
			organizationId,
			dateRange,
		);

		// Get sentiment analysis
		const sentimentData = await db
			.select({
				sentiment: conversation.sentiment,
				count: count(),
			})
			.from(conversation)
			.where(
				and(
					eq(conversation.organizationId, organizationId),
					gte(conversation.createdAt, startDate),
					lte(conversation.createdAt, endDate),
				),
			)
			.groupBy(conversation.sentiment);

		// Get total sales
		const salesResult = await db
			.select({
				totalSales: sql<number>`SUM(CAST(${orders.totalAmount} AS DECIMAL))`,
			})
			.from(orders)
			.where(
				and(
					eq(orders.organizationId, organizationId),
					gte(orders.createdAt, startDate),
					lte(orders.createdAt, endDate),
				),
			);

		// Calculate metrics
		const totalConversations = conversations.length;
		const activeConversations = conversations.filter(
			(c) => c.status === "active",
		).length;
		const completedConversations = conversations.filter(
			(c) => c.status === "closed",
		).length;

		const totalMessages = messagesResult[0]?.count || 0;
		const averageResponseTime =
			conversations.reduce((sum, c) => sum + (c.averageResponseTime || 0), 0) /
				totalConversations || 0;

		const customerSatisfaction =
			conversations.reduce((sum, c) => sum + (c.customerSatisfaction || 0), 0) /
				conversations.filter((c) => c.customerSatisfaction).length || 0;

		const totalSales = Number(salesResult[0]?.totalSales || 0);
		const conversionRate =
			totalConversations > 0
				? (completedConversations / totalConversations) * 100
				: 0;

		// Format events by type
		const eventsByType: Record<string, number> = {};
		for (const event of eventsResult) {
			eventsByType[event.eventType] = event.count;
		}

		// Format platform distribution
		const platformDistribution: Record<string, number> = {};
		for (const platform of platformDist) {
			platformDistribution[platform.platform] = platform.count;
		}

		// Format sentiment analysis
		const sentimentAnalysis = {
			positive: 0,
			neutral: 0,
			negative: 0,
		};
		for (const sentiment of sentimentData) {
			if (sentiment.sentiment === "positive") {
				sentimentAnalysis.positive = sentiment.count;
			} else if (sentiment.sentiment === "neutral") {
				sentimentAnalysis.neutral = sentiment.count;
			} else if (sentiment.sentiment === "negative") {
				sentimentAnalysis.negative = sentiment.count;
			}
		}

		return {
			totalConversations,
			activeConversations,
			completedConversations,
			totalMessages,
			averageResponseTime,
			customerSatisfaction,
			totalSales,
			conversionRate,
			topPerformingAgents: topAgents.map((a) => ({
				agentId: a.agentId,
				agentName: a.agentName,
				conversationCount: a.totalConversations,
				successRate: a.successRate,
				averageResponseTime: a.averageResponseTime,
			})),
			eventsByType,
			conversationTrends: trends,
			platformDistribution,
			sentimentAnalysis,
		};
	}

	/**
	 * Get detailed performance metrics for a specific agent
	 */
	async getAgentPerformanceMetrics(
		agentId: string,
		dateRange: DateRange,
	): Promise<AgentPerformanceMetrics> {
		const { startDate, endDate } = dateRange;

		// Get agent data
		const agentData = await db
			.select()
			.from(agent)
			.where(eq(agent.id, agentId))
			.limit(1);

		if (!agentData.length) {
			throw new Error("Agent not found");
		}

		const agentInfo = agentData[0];

		// Get conversations for this agent
		const conversations = await db
			.select()
			.from(conversation)
			.where(
				and(
					eq(conversation.agentId, agentId),
					gte(conversation.createdAt, startDate),
					lte(conversation.createdAt, endDate),
				),
			);

		// Get message count and intents
		const messages = await db
			.select({
				id: message.id,
				metadata: message.metadata,
			})
			.from(message)
			.innerJoin(conversation, eq(message.conversationId, conversation.id))
			.where(
				and(
					eq(conversation.agentId, agentId),
					gte(message.createdAt, startDate),
					lte(message.createdAt, endDate),
				),
			);

		// Get sales for this agent
		const salesResult = await db
			.select({
				totalSales: sql<number>`SUM(CAST(${orders.totalAmount} AS DECIMAL))`,
			})
			.from(orders)
			.innerJoin(conversation, eq(orders.conversationId, conversation.id))
			.where(
				and(
					eq(conversation.agentId, agentId),
					gte(orders.createdAt, startDate),
					lte(orders.createdAt, endDate),
				),
			);

		// Process intents
		const intentCounts = new Map<string, number>();
		let totalConfidence = 0;
		let confidenceCount = 0;

		for (const msg of messages) {
			const metadata = msg.metadata as any;
			if (metadata?.intent) {
				intentCounts.set(
					metadata.intent,
					(intentCounts.get(metadata.intent) || 0) + 1,
				);
			}
			if (metadata?.confidence) {
				totalConfidence += metadata.confidence;
				confidenceCount++;
			}
		}

		const topIntents = Array.from(intentCounts.entries())
			.map(([intent, count]) => ({ intent, count }))
			.sort((a, b) => b.count - a.count)
			.slice(0, 10);

		const averageConfidence =
			confidenceCount > 0 ? totalConfidence / confidenceCount : 0;

		const totalConversations = conversations.length;
		const activeConversations = conversations.filter(
			(c) => c.status === "active",
		).length;
		const closedConversations = conversations.filter(
			(c) => c.status === "closed",
		).length;

		const totalSales = Number(salesResult[0]?.totalSales || 0);
		const conversionRate =
			totalConversations > 0
				? (closedConversations / totalConversations) * 100
				: 0;

		return {
			agentId,
			totalConversations,
			activeConversations,
			closedConversations,
			averageResponseTime: agentInfo.averageResponseTime,
			successRate: agentInfo.successRate,
			customerSatisfaction: agentInfo.customerSatisfaction,
			totalSales,
			conversionRate,
			messageCount: messages.length,
			topIntents,
			averageConfidence,
		};
	}

	/**
	 * Get conversation trends over time (daily aggregation)
	 */
	async getConversationTrends(
		organizationId: string,
		dateRange: DateRange,
	): Promise<Array<{ date: string; count: number }>> {
		const { startDate, endDate } = dateRange;

		const trends = await db
			.select({
				date: sql<string>`DATE(${conversation.createdAt})`,
				count: count(),
			})
			.from(conversation)
			.where(
				and(
					eq(conversation.organizationId, organizationId),
					gte(conversation.createdAt, startDate),
					lte(conversation.createdAt, endDate),
				),
			)
			.groupBy(sql`DATE(${conversation.createdAt})`)
			.orderBy(sql`DATE(${conversation.createdAt})`);

		return trends;
	}

	/**
	 * Get detailed analytics for a specific conversation
	 */
	async getConversationAnalytics(
		conversationId: string,
	): Promise<ConversationAnalytics> {
		const conversationData = await db
			.select()
			.from(conversation)
			.where(eq(conversation.id, conversationId))
			.limit(1);

		if (!conversationData.length) {
			throw new Error("Conversation not found");
		}

		const conv = conversationData[0];

		// Calculate duration
		const duration = conv.lastMessageAt
			? Math.floor(
					(conv.lastMessageAt.getTime() - conv.createdAt.getTime()) / 1000,
				)
			: 0;

		return {
			conversationId: conv.id,
			platform: conv.platform,
			messageCount: conv.messageCount,
			duration,
			sentiment: conv.sentiment,
			escalated: conv.escalated,
			resolved: conv.status === "closed",
			customerSatisfaction: conv.customerSatisfaction,
			totalCredits: conv.creditsUsed,
		};
	}

	/**
	 * Track an analytics event
	 */
	async trackEvent(
		organizationId: string,
		eventType: string,
		eventData: Record<string, unknown>,
		agentId?: string,
		conversationId?: string,
	): Promise<void> {
		await db.insert(analyticsEvent).values({
			organizationId,
			eventType,
			eventData,
			agentId,
			conversationId,
		});
	}

	/**
	 * Get real-time metrics (last 24 hours)
	 */
	async getRealtimeMetrics(organizationId: string): Promise<{
		activeConversations: number;
		messagesLast24h: number;
		averageResponseTime: number;
		eventsLast24h: number;
	}> {
		const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

		const activeConvs = await db
			.select({ count: count() })
			.from(conversation)
			.where(
				and(
					eq(conversation.organizationId, organizationId),
					eq(conversation.status, "active"),
				),
			);

		const recentMessages = await db
			.select({ count: count() })
			.from(message)
			.innerJoin(conversation, eq(message.conversationId, conversation.id))
			.where(
				and(
					eq(conversation.organizationId, organizationId),
					gte(message.createdAt, last24h),
				),
			);

		const recentConversations = await db
			.select({ averageResponseTime: conversation.averageResponseTime })
			.from(conversation)
			.where(
				and(
					eq(conversation.organizationId, organizationId),
					gte(conversation.createdAt, last24h),
				),
			);

		const recentEvents = await db
			.select({ count: count() })
			.from(analyticsEvent)
			.where(
				and(
					eq(analyticsEvent.organizationId, organizationId),
					gte(analyticsEvent.createdAt, last24h),
				),
			);

		const avgResponseTime =
			recentConversations.reduce(
				(sum, c) => sum + (c.averageResponseTime || 0),
				0,
			) / recentConversations.length || 0;

		return {
			activeConversations: activeConvs[0]?.count || 0,
			messagesLast24h: recentMessages[0]?.count || 0,
			averageResponseTime: avgResponseTime,
			eventsLast24h: recentEvents[0]?.count || 0,
		};
	}

	/**
	 * Export analytics data to CSV format
	 */
	async exportToCSV(
		organizationId: string,
		dateRange: DateRange,
		type: "conversations" | "messages" | "events",
	): Promise<string> {
		const { startDate, endDate } = dateRange;

		switch (type) {
			case "conversations": {
				const conversations = await db
					.select()
					.from(conversation)
					.where(
						and(
							eq(conversation.organizationId, organizationId),
							gte(conversation.createdAt, startDate),
							lte(conversation.createdAt, endDate),
						),
					);

				const headers = [
					"ID",
					"Platform",
					"Status",
					"Created At",
					"Message Count",
					"Sentiment",
					"Credits Used",
				];
				const rows = conversations.map((c) => [
					c.id,
					c.platform,
					c.status,
					c.createdAt.toISOString(),
					c.messageCount.toString(),
					c.sentiment || "",
					c.creditsUsed.toString(),
				]);

				return this.formatCSV(headers, rows);
			}

			case "messages": {
				const messages = await db
					.select()
					.from(message)
					.innerJoin(conversation, eq(message.conversationId, conversation.id))
					.where(
						and(
							eq(conversation.organizationId, organizationId),
							gte(message.createdAt, startDate),
							lte(message.createdAt, endDate),
						),
					);

				const headers = [
					"ID",
					"Conversation ID",
					"Role",
					"Type",
					"Status",
					"Created At",
					"Credits",
				];
				const rows = messages.map((m) => [
					m.message.id,
					m.message.conversationId,
					m.message.role,
					m.message.type,
					m.message.status,
					m.message.createdAt.toISOString(),
					m.message.credits?.toString() || "0",
				]);

				return this.formatCSV(headers, rows);
			}

			case "events": {
				const events = await db
					.select()
					.from(analyticsEvent)
					.where(
						and(
							eq(analyticsEvent.organizationId, organizationId),
							gte(analyticsEvent.createdAt, startDate),
							lte(analyticsEvent.createdAt, endDate),
						),
					);

				const headers = ["ID", "Event Type", "Agent ID", "Created At"];
				const rows = events.map((e) => [
					e.id,
					e.eventType,
					e.agentId || "",
					e.createdAt.toISOString(),
				]);

				return this.formatCSV(headers, rows);
			}
		}
	}

	private formatCSV(headers: string[], rows: string[][]): string {
		const escapeCsvValue = (value: string) => {
			if (value.includes(",") || value.includes('"') || value.includes("\n")) {
				return `"${value.replace(/"/g, '""')}"`;
			}
			return value;
		};

		const csvLines = [
			headers.map(escapeCsvValue).join(","),
			...rows.map((row) => row.map(escapeCsvValue).join(",")),
		];

		return csvLines.join("\n");
	}
}

export const analyticsService = new AnalyticsService();
