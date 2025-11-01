import { createId } from "@paralleldrive/cuid2";
import {
	integer,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	decimal,
	boolean,
} from "drizzle-orm/pg-core";
import { organization, user } from "./auth";
import { agent } from "./agent";

export const fineTuningJobStatusEnum = pgEnum("fine_tuning_job_status", [
	"pending",
	"running",
	"succeeded",
	"failed",
	"cancelled",
]);

export const fineTuningDatasetTypeEnum = pgEnum("fine_tuning_dataset_type", [
	"conversations",
	"custom",
	"knowledge_base",
]);

/**
 * Fine-Tuning Jobs - tracks model fine-tuning operations
 */
export const fineTuningJob = pgTable("fine_tuning_job", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => createId()),
	organizationId: text("organization_id")
		.notNull()
		.references(() => organization.id, { onDelete: "cascade" }),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	agentId: text("agent_id").references(() => agent.id, {
		onDelete: "set null",
	}),

	// Job details
	name: text("name").notNull(),
	description: text("description"),
	status: fineTuningJobStatusEnum("status").default("pending").notNull(),

	// Model configuration
	baseModel: text("base_model").notNull(), // e.g., "gpt-4o-mini", "gpt-3.5-turbo"
	fineTunedModel: text("fine_tuned_model"), // Provider's fine-tuned model ID
	customModelName: text("custom_model_name"), // User-friendly name

	// Training configuration
	trainingConfig: jsonb("training_config").$type<{
		epochs?: number;
		batchSize?: number;
		learningRate?: number;
		validationSplit?: number;
		earlyStoppingPatience?: number;
		[key: string]: unknown;
	}>(),

	// Dataset information
	datasetId: text("dataset_id").references(() => fineTuningDataset.id),
	trainingFileId: text("training_file_id"), // Provider's file ID
	validationFileId: text("validation_file_id"),

	// Metrics
	trainingMetrics: jsonb("training_metrics").$type<{
		trainLoss?: number;
		validLoss?: number;
		trainAccuracy?: number;
		validAccuracy?: number;
		finalLoss?: number;
		steps?: number;
		[key: string]: unknown;
	}>(),

	// Provider information
	providerId: text("provider_id"), // Provider's job ID (e.g., OpenAI fine-tune job ID)
	provider: text("provider").default("openai"), // openai, anthropic, etc.

	// Cost tracking
	estimatedCost: decimal("estimated_cost", { precision: 10, scale: 4 }),
	actualCost: decimal("actual_cost", { precision: 10, scale: 4 }),

	// Error handling
	error: text("error"),
	errorDetails: jsonb("error_details"),

	// Timestamps
	startedAt: timestamp("started_at"),
	completedAt: timestamp("completed_at"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.notNull()
		.$onUpdate(() => new Date()),
});

/**
 * Fine-Tuning Datasets - training data for fine-tuning
 */
export const fineTuningDataset = pgTable("fine_tuning_dataset", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => createId()),
	organizationId: text("organization_id")
		.notNull()
		.references(() => organization.id, { onDelete: "cascade" }),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),

	// Dataset details
	name: text("name").notNull(),
	description: text("description"),
	type: fineTuningDatasetTypeEnum("type").notNull(),

	// Data source
	sourceConfig: jsonb("source_config").$type<{
		conversationIds?: string[];
		dateRange?: { start: string; end: string };
		agentIds?: string[];
		filters?: Record<string, unknown>;
		[key: string]: unknown;
	}>(),

	// Dataset statistics
	stats: jsonb("stats").$type<{
		totalExamples?: number;
		trainingExamples?: number;
		validationExamples?: number;
		avgTokensPerExample?: number;
		maxTokens?: number;
		minTokens?: number;
		[key: string]: unknown;
	}>(),

	// File storage
	fileUrl: text("file_url"), // S3 URL or similar
	fileSize: integer("file_size"), // bytes
	fileFormat: text("file_format").default("jsonl"),

	// Validation
	isValidated: boolean("is_validated").default(false),
	validationErrors: jsonb("validation_errors").$type<
		Array<{ line: number; error: string }>
	>(),

	// Version tracking
	version: integer("version").default(1),
	parentDatasetId: text("parent_dataset_id").references(
		() => fineTuningDataset.id,
		{ onDelete: "set null" },
	),

	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.notNull()
		.$onUpdate(() => new Date()),
});

/**
 * Training Examples - individual examples in a dataset
 */
export const trainingExample = pgTable("training_example", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => createId()),
	datasetId: text("dataset_id")
		.notNull()
		.references(() => fineTuningDataset.id, { onDelete: "cascade" }),

	// Example data
	messages: jsonb("messages")
		.notNull()
		.$type<
			Array<{ role: "system" | "user" | "assistant"; content: string }>
		>(),

	// Metadata
	metadata: jsonb("metadata").$type<{
		conversationId?: string;
		messageId?: string;
		source?: string;
		tags?: string[];
		quality?: number;
		[key: string]: unknown;
	}>(),

	// Quality metrics
	tokenCount: integer("token_count"),
	qualityScore: decimal("quality_score", { precision: 3, scale: 2 }),

	// Flags
	isValidated: boolean("is_validated").default(false),
	isUsedInTraining: boolean("is_used_in_training").default(true),

	createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Model Versions - tracks different versions of fine-tuned models
 */
export const modelVersion = pgTable("model_version", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => createId()),
	organizationId: text("organization_id")
		.notNull()
		.references(() => organization.id, { onDelete: "cascade" }),
	fineTuningJobId: text("fine_tuning_job_id")
		.notNull()
		.references(() => fineTuningJob.id, { onDelete: "cascade" }),

	// Version details
	version: text("version").notNull(), // e.g., "v1.0.0"
	name: text("name").notNull(),
	description: text("description"),

	// Model information
	modelId: text("model_id").notNull(), // Provider's model ID
	baseModel: text("base_model").notNull(),

	// Performance metrics
	benchmarkMetrics: jsonb("benchmark_metrics").$type<{
		accuracy?: number;
		precision?: number;
		recall?: number;
		f1Score?: number;
		perplexity?: number;
		customMetrics?: Record<string, number>;
	}>(),

	// Deployment
	isActive: boolean("is_active").default(false),
	deployedAt: timestamp("deployed_at"),
	deprecatedAt: timestamp("deprecated_at"),

	// Usage tracking
	totalRequests: integer("total_requests").default(0),
	totalTokens: integer("total_tokens").default(0),
	totalCost: decimal("total_cost", { precision: 10, scale: 4 }).default("0"),

	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.notNull()
		.$onUpdate(() => new Date()),
});

/**
 * Fine-Tuning Evaluations - evaluation results for models
 */
export const fineTuningEvaluation = pgTable("fine_tuning_evaluation", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => createId()),
	modelVersionId: text("model_version_id")
		.notNull()
		.references(() => modelVersion.id, { onDelete: "cascade" }),
	organizationId: text("organization_id")
		.notNull()
		.references(() => organization.id, { onDelete: "cascade" }),

	// Evaluation details
	name: text("name").notNull(),
	description: text("description"),

	// Test dataset
	testDatasetId: text("test_dataset_id").references(() => fineTuningDataset.id),
	testExamples: integer("test_examples"),

	// Results
	results: jsonb("results").$type<{
		overallScore?: number;
		accuracy?: number;
		responseQuality?: number;
		coherence?: number;
		relevance?: number;
		detailedResults?: Array<{
			exampleId: string;
			score: number;
			feedback: string;
		}>;
		[key: string]: unknown;
	}>(),

	// Comparison with baseline
	baselineModelId: text("baseline_model_id"),
	improvementOverBaseline: decimal("improvement_over_baseline", {
		precision: 5,
		scale: 2,
	}),

	createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type FineTuningJob = typeof fineTuningJob.$inferSelect;
export type NewFineTuningJob = typeof fineTuningJob.$inferInsert;
export type FineTuningDataset = typeof fineTuningDataset.$inferSelect;
export type NewFineTuningDataset = typeof fineTuningDataset.$inferInsert;
export type TrainingExample = typeof trainingExample.$inferSelect;
export type NewTrainingExample = typeof trainingExample.$inferInsert;
export type ModelVersion = typeof modelVersion.$inferSelect;
export type NewModelVersion = typeof modelVersion.$inferInsert;
export type FineTuningEvaluation = typeof fineTuningEvaluation.$inferSelect;
export type NewFineTuningEvaluation = typeof fineTuningEvaluation.$inferInsert;
