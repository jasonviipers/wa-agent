import { NextRequest, NextResponse } from "next/server";
import { auth } from "@wa/auth";
import { analyticsService } from "@/lib/analytics/service";

/**
 * GET /api/analytics/metrics
 * Get comprehensive analytics metrics for an organization
 */
export async function GET(request: NextRequest) {
	try {
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session?.user || !session.user.organizationId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

		const metrics = await analyticsService.getOrganizationMetrics(
			session.user.organizationId,
			dateRange,
		);

		return NextResponse.json(metrics);
	} catch (error) {
		console.error("Error fetching analytics metrics:", error);
		return NextResponse.json(
			{ error: "Failed to fetch analytics metrics" },
			{ status: 500 },
		);
	}
}
