import { NextRequest, NextResponse } from "next/server";
import { auth } from "@wa/auth";
import { analyticsService } from "@/lib/analytics/service";

/**
 * GET /api/analytics/realtime
 * Get real-time analytics metrics (last 24 hours)
 */
export async function GET(request: NextRequest) {
	try {
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session?.user || !session.user.organizationId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const metrics = await analyticsService.getRealtimeMetrics(
			session.user.organizationId,
		);

		return NextResponse.json(metrics);
	} catch (error) {
		console.error("Error fetching realtime metrics:", error);
		return NextResponse.json(
			{ error: "Failed to fetch realtime metrics" },
			{ status: 500 },
		);
	}
}
