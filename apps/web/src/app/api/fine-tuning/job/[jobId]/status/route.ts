import { NextRequest, NextResponse } from "next/server";
import { auth } from "@wa/auth";
import { fineTuningService } from "@/lib/fine-tuning/service";

/**
 * GET /api/fine-tuning/job/[jobId]/status
 * Check status of a fine-tuning job
 */
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ jobId: string }> },
) {
	try {
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session?.user || !session.user.organizationId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { jobId } = await params;

		const job = await fineTuningService.checkJobStatus(jobId);

		// Verify job belongs to organization
		if (job.organizationId !== session.user.organizationId) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		return NextResponse.json(job);
	} catch (error) {
		console.error("Error checking job status:", error);
		return NextResponse.json(
			{ error: "Failed to check job status" },
			{ status: 500 },
		);
	}
}
