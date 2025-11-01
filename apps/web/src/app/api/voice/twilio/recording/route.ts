import { NextRequest, NextResponse } from "next/server";
import { db } from "@wa/db";
import { voiceCall } from "@wa/db/schema";
import { eq } from "drizzle-orm";
import { speechToTextService } from "@/lib/voice/twilio-service";

/**
 * POST /api/voice/twilio/recording
 * Twilio webhook for call recording completion
 */
export async function POST(request: NextRequest) {
	try {
		const formData = await request.formData();
		const callSid = formData.get("CallSid") as string;
		const recordingUrl = formData.get("RecordingUrl") as string;
		const recordingSid = formData.get("RecordingSid") as string;
		const duration = formData.get("RecordingDuration") as string;

		// Find call
		const calls = await db
			.select()
			.from(voiceCall)
			.where(eq(voiceCall.callSid, callSid))
			.limit(1);

		if (calls.length > 0) {
			const call = calls[0];

			// Update call with recording URL
			await db
				.update(voiceCall)
				.set({
					recordingUrl: `${recordingUrl}.mp3`,
					duration: parseInt(duration, 10),
				})
				.where(eq(voiceCall.callSid, callSid));

			// Transcribe recording asynchronously
			speechToTextService
				.transcribeAndSave({
					voiceCallId: call.id,
					audioUrl: `${recordingUrl}.mp3`,
					language: call.detectedLanguage || undefined,
				})
				.catch((error) => {
					console.error("Failed to transcribe recording:", error);
				});
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Error in Twilio recording webhook:", error);
		return NextResponse.json(
			{ error: "Failed to process recording" },
			{ status: 500 },
		);
	}
}
