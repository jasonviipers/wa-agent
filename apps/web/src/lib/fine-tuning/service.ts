import { db } from "@wa/db";
import {
	fineTuningJob,
	fineTuningDataset,
	trainingExample,
	modelVersion,
	fineTuningEvaluation,
	conversation,
	message,
	type NewFineTuningJob,
	type FineTuningJob,
	type NewFineTuningDataset,
	type FineTuningDataset,
} from "@wa/db/schema";
import { eq, and, gte, lte, inArray } from "drizzle-orm";

/**
 * Fine-Tuning Service
 * Manages model fine-tuning operations
 */
export class FineTuningService {
	private apiKey: string;
	private baseUrl: string;

	constructor() {
		this.apiKey = process.env.OPENAI_API_KEY || "";
		this.baseUrl = "https://api.openai.com/v1";
	}

	/**
	 * Create a training dataset from conversations
	 */
	async createDatasetFromConversations(params: {
		organizationId: string;
		userId: string;
		name: string;
		description?: string;
		conversationIds?: string[];
		agentIds?: string[];
		dateRange?: { start: Date; end: Date };
	}): Promise<FineTuningDataset> {
		// Create dataset record
		const [dataset] = await db
			.insert(fineTuningDataset)
			.values({
				organizationId: params.organizationId,
				userId: params.userId,
				name: params.name,
				description: params.description,
				type: "conversations",
				sourceConfig: {
					conversationIds: params.conversationIds,
					agentIds: params.agentIds,
					dateRange: params.dateRange
						? {
								start: params.dateRange.start.toISOString(),
								end: params.dateRange.end.toISOString(),
							}
						: undefined,
				},
			})
			.returning();

		// Fetch conversations
		let conversationQuery = db
			.select()
			.from(conversation)
			.where(eq(conversation.organizationId, params.organizationId));

		// Add filters
		const conditions = [eq(conversation.organizationId, params.organizationId)];

		if (params.conversationIds && params.conversationIds.length > 0) {
			conditions.push(inArray(conversation.id, params.conversationIds));
		}

		if (params.agentIds && params.agentIds.length > 0) {
			conditions.push(inArray(conversation.agentId, params.agentIds));
		}

		if (params.dateRange) {
			conditions.push(
				gte(conversation.createdAt, params.dateRange.start),
				lte(conversation.createdAt, params.dateRange.end),
			);
		}

		const conversations = await db
			.select()
			.from(conversation)
			.where(and(...conditions));

		// Process conversations into training examples
		let totalExamples = 0;
		let totalTokens = 0;

		for (const conv of conversations) {
			// Get messages for this conversation
			const messages = await db
				.select()
				.from(message)
				.where(eq(message.conversationId, conv.id))
				.orderBy(message.createdAt);

			if (messages.length < 2) continue; // Skip if not enough messages

			// Format messages for training
			const formattedMessages = messages.map((msg) => ({
				role: msg.role as "system" | "user" | "assistant",
				content: msg.content || "",
			}));

			// Estimate token count (rough estimate: 1 token ≈ 4 characters)
			const tokenCount = Math.ceil(
				formattedMessages.reduce((sum, msg) => sum + msg.content.length, 0) / 4,
			);

			// Insert training example
			await db.insert(trainingExample).values({
				datasetId: dataset.id,
				messages: formattedMessages,
				metadata: {
					conversationId: conv.id,
					source: "conversation",
				},
				tokenCount,
			});

			totalExamples++;
			totalTokens += tokenCount;
		}

		// Update dataset stats
		const [updatedDataset] = await db
			.update(fineTuningDataset)
			.set({
				stats: {
					totalExamples,
					avgTokensPerExample: Math.floor(totalTokens / totalExamples),
					maxTokens: 0,
					minTokens: 0,
				},
			})
			.where(eq(fineTuningDataset.id, dataset.id))
			.returning();

		return updatedDataset;
	}

	/**
	 * Generate JSONL file for fine-tuning
	 */
	async generateTrainingFile(datasetId: string): Promise<string> {
		const examples = await db
			.select()
			.from(trainingExample)
			.where(
				and(
					eq(trainingExample.datasetId, datasetId),
					eq(trainingExample.isUsedInTraining, true),
				),
			);

		const jsonlLines = examples.map((example) =>
			JSON.stringify({ messages: example.messages }),
		);

		return jsonlLines.join("\n");
	}

	/**
	 * Upload training file to OpenAI
	 */
	async uploadTrainingFile(params: {
		datasetId: string;
		purpose?: "fine-tune";
	}): Promise<string> {
		if (!this.apiKey) {
			throw new Error("OpenAI API key not configured");
		}

		const jsonlContent = await this.generateTrainingFile(params.datasetId);
		const blob = new Blob([jsonlContent], { type: "application/jsonl" });

		const formData = new FormData();
		formData.append("file", blob, "training.jsonl");
		formData.append("purpose", params.purpose || "fine-tune");

		const response = await fetch(`${this.baseUrl}/files`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${this.apiKey}`,
			},
			body: formData,
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(`Failed to upload file: ${error.error?.message || response.statusText}`);
		}

		const result = await response.json();
		return result.id;
	}

	/**
	 * Create a fine-tuning job
	 */
	async createFineTuningJob(params: {
		organizationId: string;
		userId: string;
		agentId?: string;
		name: string;
		description?: string;
		baseModel: string;
		datasetId: string;
		config?: {
			epochs?: number;
			batchSize?: number;
			learningRate?: number;
		};
	}): Promise<FineTuningJob> {
		if (!this.apiKey) {
			throw new Error("OpenAI API key not configured");
		}

		// Upload training file
		const trainingFileId = await this.uploadTrainingFile({
			datasetId: params.datasetId,
		});

		// Create fine-tuning job in database
		const [job] = await db
			.insert(fineTuningJob)
			.values({
				organizationId: params.organizationId,
				userId: params.userId,
				agentId: params.agentId,
				name: params.name,
				description: params.description,
				baseModel: params.baseModel,
				datasetId: params.datasetId,
				trainingFileId,
				status: "pending",
				trainingConfig: params.config || {},
			})
			.returning();

		// Start fine-tuning with OpenAI
		try {
			const response = await fetch(`${this.baseUrl}/fine_tuning/jobs`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${this.apiKey}`,
				},
				body: JSON.stringify({
					training_file: trainingFileId,
					model: params.baseModel,
					hyperparameters: {
						n_epochs: params.config?.epochs || "auto",
						batch_size: params.config?.batchSize || "auto",
						learning_rate_multiplier: params.config?.learningRate || "auto",
					},
				}),
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(
					`Failed to create fine-tuning job: ${error.error?.message || response.statusText}`,
				);
			}

			const result = await response.json();

			// Update job with provider ID
			const [updatedJob] = await db
				.update(fineTuningJob)
				.set({
					providerId: result.id,
					status: "running",
					startedAt: new Date(),
				})
				.where(eq(fineTuningJob.id, job.id))
				.returning();

			return updatedJob;
		} catch (error) {
			// Update job with error
			await db
				.update(fineTuningJob)
				.set({
					status: "failed",
					error: error instanceof Error ? error.message : "Unknown error",
				})
				.where(eq(fineTuningJob.id, job.id));

			throw error;
		}
	}

	/**
	 * Check status of a fine-tuning job
	 */
	async checkJobStatus(jobId: string): Promise<FineTuningJob> {
		const jobs = await db
			.select()
			.from(fineTuningJob)
			.where(eq(fineTuningJob.id, jobId))
			.limit(1);

		if (!jobs.length) {
			throw new Error("Job not found");
		}

		const job = jobs[0];

		if (!job.providerId) {
			return job;
		}

		try {
			const response = await fetch(
				`${this.baseUrl}/fine_tuning/jobs/${job.providerId}`,
				{
					headers: {
						Authorization: `Bearer ${this.apiKey}`,
					},
				},
			);

			if (!response.ok) {
				throw new Error(`Failed to fetch job status: ${response.statusText}`);
			}

			const result = await response.json();

			// Map OpenAI status to our status
			const statusMap: Record<string, FineTuningJob["status"]> = {
				validating_files: "running",
				queued: "pending",
				running: "running",
				succeeded: "succeeded",
				failed: "failed",
				cancelled: "cancelled",
			};

			const status = statusMap[result.status] || job.status;

			// Update job
			const updateData: any = { status };

			if (result.fine_tuned_model) {
				updateData.fineTunedModel = result.fine_tuned_model;
			}

			if (result.trained_tokens) {
				updateData.trainingMetrics = {
					...(job.trainingMetrics as any),
					steps: result.trained_tokens,
				};
			}

			if (status === "succeeded") {
				updateData.completedAt = new Date();
			}

			if (result.error) {
				updateData.error = result.error.message;
				updateData.errorDetails = result.error;
			}

			const [updatedJob] = await db
				.update(fineTuningJob)
				.set(updateData)
				.where(eq(fineTuningJob.id, jobId))
				.returning();

			return updatedJob;
		} catch (error) {
			console.error("Error checking job status:", error);
			return job;
		}
	}

	/**
	 * Cancel a fine-tuning job
	 */
	async cancelJob(jobId: string): Promise<void> {
		const jobs = await db
			.select()
			.from(fineTuningJob)
			.where(eq(fineTuningJob.id, jobId))
			.limit(1);

		if (!jobs.length) {
			throw new Error("Job not found");
		}

		const job = jobs[0];

		if (!job.providerId) {
			throw new Error("Cannot cancel job without provider ID");
		}

		try {
			const response = await fetch(
				`${this.baseUrl}/fine_tuning/jobs/${job.providerId}/cancel`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${this.apiKey}`,
					},
				},
			);

			if (!response.ok) {
				throw new Error(`Failed to cancel job: ${response.statusText}`);
			}

			await db
				.update(fineTuningJob)
				.set({
					status: "cancelled",
					completedAt: new Date(),
				})
				.where(eq(fineTuningJob.id, jobId));
		} catch (error) {
			console.error("Error canceling job:", error);
			throw error;
		}
	}

	/**
	 * Create a model version from completed job
	 */
	async createModelVersion(params: {
		jobId: string;
		version: string;
		name: string;
		description?: string;
	}): Promise<any> {
		const jobs = await db
			.select()
			.from(fineTuningJob)
			.where(eq(fineTuningJob.id, params.jobId))
			.limit(1);

		if (!jobs.length) {
			throw new Error("Job not found");
		}

		const job = jobs[0];

		if (job.status !== "succeeded" || !job.fineTunedModel) {
			throw new Error("Job must be completed with a fine-tuned model");
		}

		const [version] = await db
			.insert(modelVersion)
			.values({
				organizationId: job.organizationId,
				fineTuningJobId: job.id,
				version: params.version,
				name: params.name,
				description: params.description,
				modelId: job.fineTunedModel,
				baseModel: job.baseModel,
			})
			.returning();

		return version;
	}

	/**
	 * List all fine-tuning jobs for an organization
	 */
	async listJobs(organizationId: string): Promise<FineTuningJob[]> {
		return db
			.select()
			.from(fineTuningJob)
			.where(eq(fineTuningJob.organizationId, organizationId))
			.orderBy(fineTuningJob.createdAt);
	}

	/**
	 * List all datasets for an organization
	 */
	async listDatasets(organizationId: string): Promise<FineTuningDataset[]> {
		return db
			.select()
			.from(fineTuningDataset)
			.where(eq(fineTuningDataset.organizationId, organizationId))
			.orderBy(fineTuningDataset.createdAt);
	}
}

export const fineTuningService = new FineTuningService();
