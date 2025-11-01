import { NextRequest, NextResponse } from "next/server";
import { auth } from "@wa/auth";
import { fineTuningService } from "@/lib/fine-tuning/service";
import { db } from "@wa/db";
import { fineTuningJob } from "@wa/db/schema";
import { eq } from "drizzle-orm";

/**
 * POST /api/fine-tuning/job/[jobId]/cancel
 * Cancel a fine-tuning job
 */
export async function POST(
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

		// Verify job belongs to organization
		const jobs = await db
			.select()
			.from(fineTuningJob)
			.where(eq(fineTuningJob.id, jobId))
			.limit(1);

		if (!jobs.length) {
			return NextResponse.json({ error: "Job not found" }, { status: 404 });
		}

		if (jobs[0].organizationId !== session.user.organizationId) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		await fineTuningService.cancelJob(jobId);

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Error canceling job:", error);
		return NextResponse.json(
			{ error: "Failed to cancel job" },
			{ status: 500 },
		);
	}
}
