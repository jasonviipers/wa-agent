import { NextRequest, NextResponse } from "next/server";
import { auth } from "@wa/auth";
import { analyticsService } from "@/lib/analytics/service";
import { db } from "@wa/db";
import { agent } from "@wa/db/schema";
import { eq } from "drizzle-orm";

/**
 * GET /api/analytics/agent/[agentId]
 * Get performance metrics for a specific agent
 */
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ agentId: string }> },
) {
	try {
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session?.user || !session.user.organizationId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { agentId } = await params;

		// Verify agent belongs to organization
		const agentData = await db
			.select()
			.from(agent)
			.where(eq(agent.id, agentId))
			.limit(1);

		if (!agentData.length) {
			return NextResponse.json({ error: "Agent not found" }, { status: 404 });
		}

		if (agentData[0].organizationId !== session.user.organizationId) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		const searchParams = request.nextUrl.searchParams;
		const startDate = searchParams.get("startDate");
		const endDate = searchParams.get("endDate");

		if (!startDate || !endDate) {
			return NextResponse.json(
				{ error: "Missing startDate or endDate" },
				{ status: 400 },
			);
		}

		const dateRange = {
			startDate: new Date(startDate),
			endDate: new Date(endDate),
		};

		const metrics = await analyticsService.getAgentPerformanceMetrics(
			agentId,
			dateRange,
		);

		return NextResponse.json(metrics);
	} catch (error) {
		console.error("Error fetching agent metrics:", error);
		return NextResponse.json(
			{ error: "Failed to fetch agent metrics" },
			{ status: 500 },
		);
	}
}
