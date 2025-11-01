import { NextRequest, NextResponse } from "next/server";
import { auth } from "@wa/auth";
import { fineTuningService } from "@/lib/fine-tuning/service";

/**
 * GET /api/fine-tuning/dataset/list
 * List all datasets for the organization
 */
export async function GET(request: NextRequest) {
	try {
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session?.user || !session.user.organizationId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const datasets = await fineTuningService.listDatasets(
			session.user.organizationId,
		);

		return NextResponse.json(datasets);
	} catch (error) {
		console.error("Error listing datasets:", error);
		return NextResponse.json(
			{ error: "Failed to list datasets" },
			{ status: 500 },
		);
	}
}
