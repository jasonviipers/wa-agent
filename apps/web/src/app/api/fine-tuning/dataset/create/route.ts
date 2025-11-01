import { NextRequest, NextResponse } from "next/server";
import { auth } from "@wa/auth";
import { fineTuningService } from "@/lib/fine-tuning/service";
import { z } from "zod";

const createDatasetSchema = z.object({
	name: z.string(),
	description: z.string().optional(),
	conversationIds: z.array(z.string()).optional(),
	agentIds: z.array(z.string()).optional(),
	dateRange: z
		.object({
			start: z.string(),
			end: z.string(),
		})
		.optional(),
});

/**
 * POST /api/fine-tuning/dataset/create
 * Create a training dataset from conversations
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
		const result = createDatasetSchema.safeParse(body);

		if (!result.success) {
			return NextResponse.json(
				{ error: "Invalid request", details: result.error.errors },
				{ status: 400 },
			);
		}

		const { name, description, conversationIds, agentIds, dateRange } =
			result.data;

		const dataset =
			await fineTuningService.createDatasetFromConversations({
				organizationId: session.user.organizationId,
				userId: session.user.id,
				name,
				description,
				conversationIds,
				agentIds,
				dateRange: dateRange
					? {
							start: new Date(dateRange.start),
							end: new Date(dateRange.end),
						}
					: undefined,
			});

		return NextResponse.json(dataset);
	} catch (error) {
		console.error("Error creating dataset:", error);
		return NextResponse.json(
			{ error: "Failed to create dataset" },
			{ status: 500 },
		);
	}
}
