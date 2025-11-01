import { NextRequest, NextResponse } from "next/server";
import { twilioVoiceService } from "@/lib/voice/twilio-service";

/**
 * POST /api/voice/twilio/callback
 * Twilio webhook for handling call flow
 */
export async function POST(request: NextRequest) {
	try {
		const formData = await request.formData();
		const callSid = formData.get("CallSid") as string;
		const from = formData.get("From") as string;
		const to = formData.get("To") as string;

		// Generate TwiML response
		const twiml = twilioVoiceService.generateTwiML({
			message: "Hello! Thank you for calling. How can I help you today?",
			gatherInput: true,
			language: "en-US",
		});

		return new NextResponse(twiml, {
			headers: {
				"Content-Type": "text/xml",
			},
		});
	} catch (error) {
		console.error("Error in Twilio callback:", error);
		const errorTwiml = twilioVoiceService.generateTwiML({
			message: "Sorry, an error occurred. Please try again later.",
			gatherInput: false,
		});
		return new NextResponse(errorTwiml, {
			headers: {
				"Content-Type": "text/xml",
			},
		});
	}
}
