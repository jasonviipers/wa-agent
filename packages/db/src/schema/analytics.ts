import { createId } from "@paralleldrive/cuid2";
import {
    index,
    jsonb,
    pgTable,
    text,
    timestamp,
} from "drizzle-orm/pg-core";
import { organization } from "./auth";
import { agent } from "./agent";
import { conversation } from "./conversation";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================
// ANALYTICS & REPORTING
// ============================================

export const analyticsEvent = pgTable("analytics_event", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => createId()),
    organizationId: text("organization_id")
        .notNull()
        .references(() => organization.id, { onDelete: "cascade" }),
    agentId: text("agent_id").references(() => agent.id, { onDelete: "cascade" }),
    conversationId: text("conversation_id").references(() => conversation.id),
    eventType: text("event_type").notNull(), // 'conversation_started', 'message_sent', 'order_created', etc.
    eventData: jsonb("event_data"),
    timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => ({
    orgIdx: index("analytics_org_idx").on(table.organizationId),
    typeIdx: index("analytics_type_idx").on(table.eventType),
    timeIdx: index("analytics_time_idx").on(table.timestamp),
}));

export const analyticsEventSchema = createSelectSchema(analyticsEvent).omit({
    id: true,
    organizationId: true,
    agentId: true,
    conversationId: true,
    timestamp: true,
});

export type AnalyticsEvent = z.infer<typeof analyticsEventSchema>;