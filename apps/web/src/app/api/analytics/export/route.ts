import { NextRequest, NextResponse } from "next/server";
import { auth } from "@wa/auth";
import { analyticsService } from "@/lib/analytics/service";

/**
 * GET /api/analytics/export
 * Export analytics data to CSV
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
		const type = searchParams.get("type") as
			| "conversations"
			| "messages"
			| "events";

		if (!startDate || !endDate || !type) {
			return NextResponse.json(
				{ error: "Missing required parameters" },
				{ status: 400 },
			);
		}

		if (!["conversations", "messages", "events"].includes(type)) {
			return NextResponse.json({ error: "Invalid type" }, { status: 400 });
		}

		const dateRange = {
			startDate: new Date(startDate),
			endDate: new Date(endDate),
		};

		const csv = await analyticsService.exportToCSV(
			session.user.organizationId,
			dateRange,
			type,
		);

		return new NextResponse(csv, {
			headers: {
				"Content-Type": "text/csv",
				"Content-Disposition": `attachment; filename="analytics-${type}-${startDate}-${endDate}.csv"`,
			},
		});
	} catch (error) {
		console.error("Error exporting analytics:", error);
		return NextResponse.json(
			{ error: "Failed to export analytics" },
			{ status: 500 },
		);
	}
}
