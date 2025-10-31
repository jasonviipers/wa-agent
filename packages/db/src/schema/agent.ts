import { createId } from "@paralleldrive/cuid2";
import {
  boolean,
  decimal,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  vector,
} from "drizzle-orm/pg-core";
import { organization, user } from "./auth";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const agentStatusEnum = pgEnum("agent_status", [
  "active",
  "inactive",
  "training",
  "error",
]);

export const agent = pgTable("agent", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .references(() => user.id, { onDelete: "cascade" })
    .notNull(),
  templateId: text("template_id").references(() => agentTemplate.id),
  name: text("name").notNull(),
  description: text("description"),
  systemPrompt: text("system_prompt").notNull(),
  status: agentStatusEnum("status").default("inactive").notNull(),
  model: text("model").default("gpt-4o-mini").notNull(),
  temperature: decimal("temperature", { precision: 2, scale: 1 }).default("0.7"),
  maxTokens: integer("max_tokens").default(1000),
  promptScore: integer("prompt_score").default(0), // Score from 1-10

  // Communication style
  communicationStyle: text("communication_style").default("normal"), // 'normal', 'formal', 'casual', 'empathetic'

  // Platform configurations
  platforms: jsonb("platforms").$type<{
    whatsapp?: {
      enabled: boolean;
      phoneNumberId?: string;
      accessToken?: string;
    };
    facebook?: {
      enabled: boolean;
      pageId?: string;
      accessToken?: string;
    };
    shopify?: {
      enabled: boolean;
      shopDomain?: string;
    };
    tiktok?: {
      enabled: boolean;
      shopId?: string;
    };
    instagram?: {
      enabled: boolean;
      accountId?: string;
    };
  }>(),

  // Agent behavior settings
  settings: jsonb("settings").$type<{
    greeting?: string;
    fallbackMessage?: string;
    handoffToHuman?: boolean;
    handoffConditions?: string[];
    maxDiscount?: number;
    businessHours?: {
      enabled: boolean;
      timezone?: string;
      schedule?: {
        [key: string]: { open: string; close: string };
      };
    };
    language?: string;
    responseDelay?: number; // in seconds
    responseTime?: string; // Target response time (15s, 20s, 30s, etc.)
    enabledFeatures?: string[];
    maxMessagesPerConversation?: number;
    autoCloseConversationAfter?: number; // hours
    sendEmailAlerts?: boolean;
    sendWhatsAppAlerts?: boolean;
    disableOnHumanIntervention?: boolean;
  }>(),

  // Performance metrics
  metrics: jsonb("metrics").$type<{
    totalConversations?: number;
    activeConversations?: number;
    closedConversations?: number;
    averageResponseTime?: number;
    successRate?: number;
    customerSatisfaction?: number;
    totalSales?: number;
    conversionRate?: number;
  }>(),

  createdBy: text("created_by")
    .notNull()
    .references(() => user.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// ============================================
// AGENT TEMPLATES
// ============================================

export const agentTemplate = pgTable("agent_template", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon"), // Icon identifier
  category: text("category").notNull(), // 'sales', 'support', 'scheduling', 'custom'
  systemPrompt: text("system_prompt").notNull(),
  defaultSettings: jsonb("default_settings").$type<{
    greeting?: string;
    fallbackMessage?: string;
    handoffToHuman?: boolean;
    temperature?: number;
    maxTokens?: number;
    model?: string;
  }>(),
  isPublic: boolean("is_public").default(true).notNull(),
  createdBy: text("created_by").references(() => user.id),
  usageCount: integer("usage_count").default(0),
  rating: decimal("rating", { precision: 3, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// ============================================
// KNOWLEDGE BASE
// ============================================
export const knowledgeBase = pgTable("knowledge_base", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .references(() => user.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull(), // 'faq', 'documentation', 'policies', 'product_info', 'custom'
  isPremium: boolean("is_premium").default(false).notNull(), // Premium feature flag
  isActive: boolean("is_active").default(true).notNull(),
  entriesCount: integer("entries_count").default(0).notNull(),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const knowledgeBaseEntry = pgTable("knowledge_base_entry", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  knowledgeBaseId: text("knowledge_base_id")
    .notNull()
    .references(() => knowledgeBase.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  sourceType: text("source_type"), // 'manual', 'pdf', 'word', 'excel', 'url', 'database'
  sourceUrl: text("source_url"),
  tags: jsonb("tags").$type<string[]>(),
  embedding: vector("embedding", { dimensions: 1536 }).notNull(), // Vector embedding for semantic search
  metadata: jsonb("metadata"),
  isActive: boolean("is_active").default(true).notNull(),
  viewCount: integer("view_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const agentKnowledgeBase = pgTable("agent_knowledge_base", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  agentId: text("agent_id")
    .notNull()
    .references(() => agent.id, { onDelete: "cascade" }),
  knowledgeBaseId: text("knowledge_base_id")
    .notNull()
    .references(() => knowledgeBase.id, { onDelete: "cascade" }),
  priority: integer("priority").default(0).notNull(),
  isEnabled: boolean("is_enabled").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAgentSchema = createSelectSchema(agent)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  });

export const insertAgentTemplateSchema = createSelectSchema(agentTemplate).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAgentKnowledgeBaseSchema = createSelectSchema(agentKnowledgeBase).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertKnowledgeBaseEntrySchema = createSelectSchema(knowledgeBaseEntry).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})

export const insertKnowledgeBaseSchema = createSelectSchema(knowledgeBase).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type newAgent = z.infer<typeof insertAgentSchema>;
export type newAgentTemplate = z.infer<typeof insertAgentTemplateSchema>;
export type newAgentKnowledgeBase = z.infer<typeof insertAgentKnowledgeBaseSchema>;
export type newKnowledgeBaseEntry = z.infer<typeof insertKnowledgeBaseEntrySchema>;
export type newKnowledgeBase = z.infer<typeof insertKnowledgeBaseSchema>;