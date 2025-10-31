import { createId } from "@paralleldrive/cuid2";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { agent } from "./agent";
import { organization, user } from "./auth";
import { platformEnum } from "./integration";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================
// CONVERSATIONS & MESSAGES
// ============================================
export const conversationStatusEnum = pgEnum("conversation_status", [
  "active",
  "closed",
  "handed_off",
]);

// ============================================
// CONVERSATIONS & MESSAGES
// ============================================

export const conversation = pgTable("conversation", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  agentId: text("agent_id")
    .notNull()
    .references(() => agent.id, { onDelete: "cascade" }),
  platform: platformEnum("platform").notNull(),
  platformConversationId: text("platform_conversation_id").notNull(),

  // Customer info
  customerName: text("customer_name"),
  customerPhone: text("customer_phone"),
  customerEmail: text("customer_email"),
  customerId: text("customer_id"),

  status: conversationStatusEnum("status").default("active").notNull(),

  // Conversation metadata
  metadata: jsonb("metadata").$type<{
    source?: string;
    referrer?: string;
    userAgent?: string;
    location?: string;
    language?: string;
    escalation?: {
      reason: string;
      priority: 'low' | 'medium' | 'high' | 'urgent';
      summary: string;
      escalatedAt: string;
      escalatedBy?: string;
      additionalInfo?: string;
    };
    assignment?: {
      assignedTo: string;
      assignedAt: string;
      assignedBy?: string;
    };
    resolution?: {
      resolvedAt: string;
      resolution: string;
      resolvedBy: string;
    };
  }>(),

  // Assignment
  assignedTo: text("assigned_to").references(() => user.id),

  // Analytics
  messageCount: integer("message_count").default(0),
  customerMessageCount: integer("customer_message_count").default(0),
  agentMessageCount: integer("agent_message_count").default(0),

  // Timing
  startedAt: timestamp("started_at").defaultNow().notNull(),
  lastMessageAt: timestamp("last_message_at").defaultNow().notNull(),
  closedAt: timestamp("closed_at"),
  firstResponseTime: integer("first_response_time"), // milliseconds
  averageResponseTime: integer("average_response_time"), // milliseconds

  // Tags and categorization
  tags: jsonb("tags").$type<string[]>(),
  sentiment: text("sentiment"), // 'positive', 'neutral', 'negative'

  // Credits
  totalCreditsUsed: integer("total_credits_used").default(0),
}, (table) => ({
  agentIdx: index("conv_agent_idx").on(table.agentId),
  statusIdx: index("conv_status_idx").on(table.status),
  platformIdx: index("conv_platform_idx").on(table.platform),
}));

export const message = pgTable("message", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversation.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // 'user', 'assistant', 'system'
  content: text("content").notNull(),
  platformMessageId: text("platform_message_id"),
  type: text("type").default("text").notNull(), // 'text', 'image', 'audio', 'video', 'file', 'product', 'order'
  mediaUrl: text("media_url"),

  metadata: jsonb("metadata").$type<{
    products?: string[];
    orderId?: string;
    sentiment?: string;
    intent?: string;
    confidence?: number;
    toolCalls?: Array<{
      toolName: string;
      input: any;
      output: any;
    }>;
    [key: string]: any;
  }>(),

  creditsUsed: integer("credits_used").default(0).notNull(),

  // Message status
  status: text("status").default("sent"), // 'sent', 'delivered', 'read', 'failed'
  errorMessage: text("error_message"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  convIdx: index("msg_conv_idx").on(table.conversationId),
  createdIdx: index("msg_created_idx").on(table.createdAt),
}));

export const insertConversationSchema = createSelectSchema(conversation).omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMessageSchema = createSelectSchema(message).omit({
  id: true,
  conversationId: true,
  createdAt: true,
});

export type NewConversation = z.infer<typeof insertConversationSchema>;
export type NewMessage = z.infer<typeof insertMessageSchema>;