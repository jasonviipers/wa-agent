import { createId } from "@paralleldrive/cuid2";
import {
	integer,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	decimal,
} from "drizzle-orm/pg-core";
import { organization } from "./auth";
import { agent } from "./agent";
import { conversation } from "./conversation";

export const voiceCallStatusEnum = pgEnum("voice_call_status", [
	"initiated",
	"ringing",
	"in_progress",
	"completed",
	"failed",
	"no_answer",
	"busy",
	"canceled",
]);

export const voiceCallDirectionEnum = pgEnum("voice_call_direction", [
	"inbound",
	"outbound",
]);

/**
 * Voice Call table - tracks voice/phone calls
 */
export const voiceCall = pgTable("voice_call", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => createId()),
	organizationId: text("organization_id")
		.notNull()
		.references(() => organization.id, { onDelete: "cascade" }),
	agentId: text("agent_id").references(() => agent.id, {
		onDelete: "set null",
	}),
	conversationId: text("conversation_id").references(() => conversation.id, {
		onDelete: "set null",
	}),

	// Call details
	callSid: text("call_sid"), // Twilio call SID or provider identifier
	direction: voiceCallDirectionEnum("direction").notNull(),
	status: voiceCallStatusEnum("status").default("initiated").notNull(),

	// Phone numbers
	fromNumber: text("from_number").notNull(),
	toNumber: text("to_number").notNull(),

	// Call metadata
	duration: integer("duration").default(0), // Duration in seconds
	recordingUrl: text("recording_url"),
	transcriptionUrl: text("transcription_url"),
	transcription: text("transcription"), // Full text transcription

	// Language & Translation
	detectedLanguage: text("detected_language"),
	targetLanguage: text("target_language"),

	// Call analytics
	sentiment: text("sentiment"), // positive, neutral, negative
	intent: text("intent"),
	confidence: decimal("confidence", { precision: 3, scale: 2 }),
	outcome: text("outcome"), // resolved, escalated, callback_requested, etc.

	// Costs
	callCost: decimal("call_cost", { precision: 10, scale: 4 }),
	transcriptionCost: decimal("transcription_cost", { precision: 10, scale: 4 }),
	aiCost: decimal("ai_cost", { precision: 10, scale: 4 }),

	// Provider metadata
	providerData: jsonb("provider_data").$type<{
		provider?: "twilio" | "vonage" | "plivo";
		errorCode?: string;
		errorMessage?: string;
		callerName?: string;
		callerLocation?: string;
		[key: string]: unknown;
	}>(),

	// Timestamps
	startedAt: timestamp("started_at"),
	answeredAt: timestamp("answered_at"),
	endedAt: timestamp("ended_at"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.notNull()
		.$onUpdate(() => new Date()),
});

export const voiceTranscriptSegmentRoleEnum = pgEnum(
	"voice_transcript_segment_role",
	["user", "agent", "system"],
);

/**
 * Voice Transcript Segments - individual turns in a voice conversation
 */
export const voiceTranscriptSegment = pgTable("voice_transcript_segment", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => createId()),
	voiceCallId: text("voice_call_id")
		.notNull()
		.references(() => voiceCall.id, { onDelete: "cascade" }),

	// Segment details
	role: voiceTranscriptSegmentRoleEnum("role").notNull(),
	text: text("text").notNull(),
	translatedText: text("translated_text"),
	language: text("language"),

	// Audio details
	audioUrl: text("audio_url"),
	duration: integer("duration"), // Duration in milliseconds
	confidence: decimal("confidence", { precision: 3, scale: 2 }),

	// Timing
	startTime: integer("start_time"), // Offset from call start in milliseconds
	endTime: integer("end_time"),

	// Metadata
	metadata: jsonb("metadata").$type<{
		intent?: string;
		sentiment?: string;
		entities?: Array<{ type: string; value: string }>;
		[key: string]: unknown;
	}>(),

	createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Voice Call Analytics - aggregated analytics for voice calls
 */
export const voiceCallAnalytics = pgTable("voice_call_analytics", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => createId()),
	organizationId: text("organization_id")
		.notNull()
		.references(() => organization.id, { onDelete: "cascade" }),
	agentId: text("agent_id").references(() => agent.id, {
		onDelete: "cascade",
	}),

	// Date range for aggregation
	date: timestamp("date").notNull(),

	// Call metrics
	totalCalls: integer("total_calls").default(0),
	answeredCalls: integer("answered_calls").default(0),
	missedCalls: integer("missed_calls").default(0),
	averageDuration: integer("average_duration").default(0), // seconds
	totalDuration: integer("total_duration").default(0), // seconds

	// Quality metrics
	averageSentiment: decimal("average_sentiment", { precision: 3, scale: 2 }),
	resolutionRate: decimal("resolution_rate", { precision: 5, scale: 2 }),
	escalationRate: decimal("escalation_rate", { precision: 5, scale: 2 }),

	// Cost metrics
	totalCost: decimal("total_cost", { precision: 10, scale: 2 }),

	// Language distribution
	languageDistribution: jsonb("language_distribution").$type<
		Record<string, number>
	>(),

	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.notNull()
		.$onUpdate(() => new Date()),
});

export type VoiceCall = typeof voiceCall.$inferSelect;
export type NewVoiceCall = typeof voiceCall.$inferInsert;
export type VoiceTranscriptSegment = typeof voiceTranscriptSegment.$inferSelect;
export type NewVoiceTranscriptSegment =
	typeof voiceTranscriptSegment.$inferInsert;
export type VoiceCallAnalytics = typeof voiceCallAnalytics.$inferSelect;
export type NewVoiceCallAnalytics = typeof voiceCallAnalytics.$inferInsert;
