import { NextRequest, NextResponse } from "next/server";
import { auth } from "@wa/auth";
import { fineTuningService } from "@/lib/fine-tuning/service";
import { z } from "zod";

const createJobSchema = z.object({
	name: z.string(),
	description: z.string().optional(),
	baseModel: z.string(),
	datasetId: z.string(),
	agentId: z.string().optional(),
	config: z
		.object({
			epochs: z.number().optional(),
			batchSize: z.number().optional(),
			learningRate: z.number().optional(),
		})
		.optional(),
});

/**
 * POST /api/fine-tuning/job/create
 * Create a fine-tuning job
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
		const result = createJobSchema.safeParse(body);

		if (!result.success) {
			return NextResponse.json(
				{ error: "Invalid request", details: result.error.errors },
				{ status: 400 },
			);
		}

		const { name, description, baseModel, datasetId, agentId, config } =
			result.data;

		const job = await fineTuningService.createFineTuningJob({
			organizationId: session.user.organizationId,
			userId: session.user.id,
			name,
			description,
			baseModel,
			datasetId,
			agentId,
			config,
		});

		return NextResponse.json(job);
	} catch (error) {
		console.error("Error creating fine-tuning job:", error);
		return NextResponse.json(
			{
				error:
					error instanceof Error
						? error.message
						: "Failed to create fine-tuning job",
			},
			{ status: 500 },
		);
	}
}
