import { NextRequest, NextResponse } from "next/server";
import { auth } from "@wa/auth";
import { fineTuningService } from "@/lib/fine-tuning/service";

/**
 * GET /api/fine-tuning/job/list
 * List all fine-tuning jobs for the organization
 */
export async function GET(request: NextRequest) {
	try {
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session?.user || !session.user.organizationId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const jobs = await fineTuningService.listJobs(
			session.user.organizationId,
		);

		return NextResponse.json(jobs);
	} catch (error) {
		console.error("Error listing jobs:", error);
		return NextResponse.json(
			{ error: "Failed to list jobs" },
			{ status: 500 },
		);
	}
}
