import { createId } from "@paralleldrive/cuid2";
import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { z } from "zod";
import { agent } from "./agent";
import { organization, user } from "./auth";
import { createSelectSchema } from "drizzle-zod";

export const platformEnum = pgEnum("platform", [
  "shopify",
  "facebook_marketplace",
  "tiktok_shop",
  "amazon",
  "whatsapp",
  "internal",
]);

export const integrationStatusEnum = pgEnum("integration_status", [
  "connected",
  "disconnected",
  "error",
  "pending",
  "syncing",
  "needs_reauth",
]);

export const IntegrationConfigShopify = z.object({
  accessToken: z.string(),
  shopDomain: z.string(),
  apiVersion: z.string().default("2025-10"), // Updated to latest stable version
  apiType: z.enum(["rest", "graphql"]).default("graphql"), // Prefer GraphQL Admin API
  scopes: z
    .array(z.string())
    .default([
      "read_products",
      "write_products",
      "read_orders",
      "write_orders",
      "read_customers",
      "read_inventory",
      "read_fulfillments",
      "write_fulfillments",
    ]),
  webhookSecret: z.string().optional(),
  adminApiAccessToken: z.string().optional(),
  storefrontAccessToken: z.string().optional(), // For Storefront API
});

export const IntegrationConfigFacebook = z.object({
  accessToken: z.string(),
  pageId: z.string(),
  catalogId: z.string().optional(),
  businessId: z.string().optional(),
  appId: z.string().optional(),
  appSecret: z.string().optional(),
  expiresAt: z.number().optional(),
  apiVersion: z.string().default("v21.0"), // Current stable API version
  commerceMerchantSettingsId: z.string().optional(), // For Commerce Platform
  catalogSegmentId: z.string().optional(), // For product catalog segmentation
  permissions: z
    .array(z.string())
    .default([
      "business_management",
      "catalog_management",
      "commerce_manage_orders",
      "commerce_manage_products",
      "pages_manage_engagement",
      "pages_messaging",
      "pages_read_engagement",
    ]),
});

export const IntegrationConfigWhatsApp = z.object({
  accessToken: z.string(),
  phoneNumberId: z.string(),
  businessAccountId: z.string(),
  webhookVerifyToken: z.string(),
  wabaId: z.string().optional(), // WhatsApp Business Account ID
  apiVersion: z.string().default("v21.0"), // Current Cloud API version
  appId: z.string().optional(),
  appSecret: z.string().optional(),
  phoneNumber: z.string().optional(), // Display phone number
  displayName: z.string().optional(), // Business display name
  about: z.string().optional(), // Business description
  // Commerce/Shop specific settings
  catalogId: z.string().optional(), // Product catalog for WhatsApp Shop
  shoppingCartEnabled: z.boolean().default(false),
  // Message settings
  enableTemplateMessages: z.boolean().default(true),
  enableMediaMessages: z.boolean().default(true),
  enableInteractiveMessages: z.boolean().default(true),
});

export type integrationConfigShopify = z.infer<typeof IntegrationConfigShopify>;
export type integrationConfigFacebook = z.infer<
  typeof IntegrationConfigFacebook
>;
export type integrationConfigWhatsApp = z.infer<
  typeof IntegrationConfigWhatsApp
>;

export const IntegrationConfig = z.discriminatedUnion("type", [
  z.object({ type: z.literal("shopify"), config: IntegrationConfigShopify }),
  z.object({ type: z.literal("facebook"), config: IntegrationConfigFacebook }),
  z.object({ type: z.literal("whatsapp"), config: IntegrationConfigWhatsApp }),
]);

export type integrationConfig = z.infer<typeof IntegrationConfig>;

// ============================================
// TOOLS & INTEGRATIONS
// ============================================
export const integration = pgTable("integration", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  platform: platformEnum("platform").notNull(),
  status: integrationStatusEnum("status").notNull().default("pending"),
  userId: text("user_id")
    .references(() => user.id, { onDelete: "cascade" })
    .notNull(),
  organizationId: text("organization_id")
    .references(() => organization.id, { onDelete: "cascade" })
    .notNull(),
  agentId: text("agent_id").references(() => agent.id, { onDelete: "cascade" }),
  displayName: text("display_name"), // User-friendly name
  config: jsonb("config").notNull().$type<integrationConfig>(),

  // Sync management
  lastSyncAt: timestamp("last_sync_at"),
  syncStatus: text("sync_status").default("idle"), // 'idle', 'in_progress', 'failed'
  syncCursor: jsonb("sync_cursor"),
  syncError: text("sync_error"),

  // Rate limiting and quotas
  rateLimitRemaining: integer("rate_limit_remaining"),
  rateLimitResetAt: timestamp("rate_limit_reset_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const toolDefinition = pgTable("tool_definition", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  displayName: text("display_name").notNull(),
  description: text("description"),
  category: text("category").notNull(), // 'calendar', 'communication', 'ecommerce', 'productivity'
  icon: text("icon"),
  isPremium: boolean("is_premium").default(false).notNull(),
  requiresAuth: boolean("requires_auth").default(false).notNull(),
  configSchema: jsonb("config_schema"), // JSON Schema for tool configuration
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const agentTool = pgTable("agent_tool", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  agentId: text("agent_id")
    .notNull()
    .references(() => agent.id, { onDelete: "cascade" }),
  toolId: text("tool_id")
    .notNull()
    .references(() => toolDefinition.id, { onDelete: "cascade" }),
  isEnabled: boolean("is_enabled").default(true).notNull(),
  config: jsonb("config"), // Tool-specific configuration
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertIntegrationSchema = createSelectSchema(integration).omit({
  id: true,
  userId: true,
  organizationId: true,
  agentId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertToolDefinitionSchema = createSelectSchema(toolDefinition).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAgentToolSchema = createSelectSchema(agentTool).omit({
  id: true,
  agentId: true,
  toolId: true,
  createdAt: true,
  updatedAt: true,
});

export type newIntergration = z.infer<typeof insertIntegrationSchema>;
export type newToolDefinition = z.infer<typeof insertToolDefinitionSchema>;
export type newAgentTool = z.infer<typeof insertAgentToolSchema>;