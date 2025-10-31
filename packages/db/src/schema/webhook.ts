import { createId } from "@paralleldrive/cuid2";
import { boolean, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { organization } from "./auth";
import { integration, platformEnum } from "./integration";

export const webhook = pgTable("webhook", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  platform: platformEnum("platform").notNull(),
  webhookUrl: text("webhook_url"),
  secret: text("secret"),
  events: jsonb("events").$type<string[]>(),
  isActive: boolean("is_active").default(true).notNull(),
  lastTriggered: timestamp("last_triggered"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const syncLog = pgTable("sync_log", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  integrationId: text("integration_id")
    .notNull()
    .references(() => integration.id, { onDelete: "cascade" }),
  entityType: text("entity_type").notNull(), // 'product', 'order', 'inventory'
  entityId: text("entity_id").notNull(),
  action: text("action").notNull(), // 'create', 'update', 'delete'
  status: text("status").notNull(), // 'success', 'failed', 'pending'
  errorMessage: text("error_message"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
