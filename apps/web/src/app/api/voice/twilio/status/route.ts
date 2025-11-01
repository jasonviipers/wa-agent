import { NextRequest, NextResponse } from "next/server";
import { db } from "@wa/db";
import { voiceCall } from "@wa/db/schema";
import { eq } from "drizzle-orm";

/**
 * POST /api/voice/twilio/status
 * Twilio webhook for call status updates
 */
export async function POST(request: NextRequest) {
	try {
		const formData = await request.formData();
		const callSid = formData.get("CallSid") as string;
		const callStatus = formData.get("CallStatus") as string;
		const duration = formData.get("CallDuration") as string;

		// Map Twilio status to our status
		const statusMap: Record<
			string,
			"initiated" | "ringing" | "in_progress" | "completed" | "failed" | "no_answer" | "busy" | "canceled"
		> = {
			queued: "initiated",
			ringing: "ringing",
			"in-progress": "in_progress",
			completed: "completed",
			busy: "busy",
			failed: "failed",
			"no-answer": "no_answer",
			canceled: "canceled",
		};

		const status = statusMap[callStatus] || "failed";

		// Find and update call
		const calls = await db
			.select()
			.from(voiceCall)
			.where(eq(voiceCall.callSid, callSid))
			.limit(1);

		if (calls.length > 0) {
			const updateData: any = { status };

			if (duration) {
				updateData.duration = parseInt(duration, 10);
			}

			if (status === "in_progress") {
				updateData.answeredAt = new Date();
			}

			if (["completed", "failed", "no_answer", "busy", "canceled"].includes(status)) {
				updateData.endedAt = new Date();
			}

			await db
				.update(voiceCall)
				.set(updateData)
				.where(eq(voiceCall.callSid, callSid));
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Error in Twilio status webhook:", error);
		return NextResponse.json(
			{ error: "Failed to process status update" },
			{ status: 500 },
		);
	}
}
