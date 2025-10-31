import { createId } from "@paralleldrive/cuid2";
import {
  decimal,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { organization } from "./auth";
import { product } from "./product";
import { platformEnum } from "./integration";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";


/* ---------- ENUMS ---------- */
export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "paid",
  "failed",
  "refunded",
]);

// ============================================
// ORDERS
// ============================================

export const orders = pgTable("orders", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  conversationId: text("conversation_id"),
  customerId: text("customer_id"),
  customerEmail: text("customer_email"),
  customerPhone: text("customer_phone"),
  customerName: text("customer_name"),

  status: orderStatusEnum("status").default("pending").notNull(),
  platform: platformEnum("platform").default("internal").notNull(),
  platformOrderId: text("platform_order_id"),
  platformOrderNumber: text("platform_order_number"),

  // Payment
  paymentStatus: paymentStatusEnum("payment_status").default("pending").notNull(),
  paymentMethod: text("payment_method"),

  // Amounts
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  tax: decimal("tax", { precision: 10, scale: 2 }).default("0"),
  shipping: decimal("shipping", { precision: 10, scale: 2 }).default("0"),
  discount: decimal("discount", { precision: 10, scale: 2 }).default("0"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("USD").notNull(),

  // Shipping
  shippingAddress: jsonb("shipping_address").$type<{
    name?: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone?: string;
  }>(),
  billingAddress: jsonb("billing_address"),
  fulfillmentStatus: text("fulfillment_status"),
  trackingNumber: text("tracking_number"),
  carrier: text("carrier"),

  deliveryNotes: text("delivery_notes"),
  metadata: jsonb("metadata"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => ({
  orgIdx: index("order_org_idx").on(table.organizationId),
  statusIdx: index("order_status_idx").on(table.status),
}));

export const orderItems = pgTable("order_items", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  orderId: text("order_id")
    .references(() => orders.id, { onDelete: "cascade" })
    .notNull(),
  productId: text("product_id")
    .references(() => product.id, { onDelete: "cascade" })
    .notNull(),
  variantId: text("variant_id"),
  productName: text("product_name").notNull(),
  productSku: text("product_sku").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  tax: decimal("tax", { precision: 10, scale: 2 }).default("0"),
  discount: decimal("discount", { precision: 10, scale: 2 }).default("0"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const insertOrderSchema = createSelectSchema(orders).omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
});
export const insertOrderItemSchema = createSelectSchema(orderItems).omit({
  id: true,
  orderId: true,
  productId: true,
  createdAt: true,
  updatedAt: true,
});

export type newOrder = z.infer<typeof insertOrderSchema>;
export type newOrderItem = z.infer<typeof insertOrderItemSchema>;
