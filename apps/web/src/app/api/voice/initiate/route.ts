import { NextRequest, NextResponse } from "next/server";
import { auth } from "@wa/auth";
import { twilioVoiceService } from "@/lib/voice/twilio-service";
import { z } from "zod";

const initiateCallSchema = z.object({
	toNumber: z.string(),
	agentId: z.string().optional(),
	conversationId: z.string().optional(),
});

/**
 * POST /api/voice/initiate
 * Initiate an outbound voice call
 */
export async function POST(request: NextRequest) {
	try {
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session?.user || !session.user.organizationId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const body = await request.json();
		const result = initiateCallSchema.safeParse(body);

		if (!result.success) {
			return NextResponse.json(
				{ error: "Invalid request", details: result.error.errors },
				{ status: 400 },
			);
		}

		const { toNumber, agentId, conversationId } = result.data;

		const call = await twilioVoiceService.initiateCall({
			to: toNumber,
			organizationId: session.user.organizationId,
			agentId,
			conversationId,
		});

		return NextResponse.json(call);
	} catch (error) {
		console.error("Error initiating call:", error);
		return NextResponse.json(
			{ error: "Failed to initiate call" },
			{ status: 500 },
		);
	}
}
