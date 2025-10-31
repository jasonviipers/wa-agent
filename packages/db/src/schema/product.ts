import { createId } from "@paralleldrive/cuid2";
import {
  boolean,
  decimal,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { organization } from "./auth";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";


// ============================================
// PRODUCTS & CATALOG
// ============================================

export const productCategory = pgTable("product_category", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  parentId: text("parent_id"),
  slug: text("slug").notNull(),
  imageUrl: text("image_url"),
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const product = pgTable("product", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  sku: text("sku").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  shortDescription: text("short_description"),
  categoryId: text("category_id").references(() => productCategory.id),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  compareAtPrice: decimal("compare_at_price", { precision: 10, scale: 2 }),
  cost: decimal("cost", { precision: 10, scale: 2 }),
  currency: text("currency").default("USD").notNull(),
  stock: integer("stock").default(0).notNull(),
  lowStockThreshold: integer("low_stock_threshold").default(10),
  trackInventory: boolean("track_inventory").default(true).notNull(),
  
  // Media
  images: jsonb("images").$type<string[]>(),
  videoUrl: text("video_url"),
  
  // Product details
  variants: jsonb("variants").$type<
    Array<{
      id: string;
      name: string;
      sku: string;
      price: number;
      stock: number;
      attributes: Record<string, string>;
      imageUrl?: string;
    }>
  >(),
  attributes: jsonb("attributes").$type<Record<string, any>>(),
  
  // SEO
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  seoKeywords: jsonb("seo_keywords").$type<string[]>(),
  
  // Platform sync status
  platformSync: jsonb("platform_sync").$type<{
    shopify?: { synced: boolean; productId?: string; lastSyncAt?: string };
    whatsapp?: { synced: boolean; catalogId?: string; lastSyncAt?: string };
    facebook?: { synced: boolean; productId?: string; lastSyncAt?: string };
    tiktok?: { synced: boolean; productId?: string; lastSyncAt?: string };
    amazon?: { synced: boolean; asin?: string; lastSyncAt?: string };
    instagram?: { synced: boolean; productId?: string; lastSyncAt?: string };
  }>(),
  
  // Status
  isActive: boolean("is_active").default(true).notNull(),
  isFeatured: boolean("is_featured").default(false).notNull(),
  publishedAt: timestamp("published_at"),
  
  // Metrics
  viewCount: integer("view_count").default(0),
  salesCount: integer("sales_count").default(0),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => ({
  skuIdx: index("product_sku_idx").on(table.sku),
  orgIdx: index("product_org_idx").on(table.organizationId),
}));

export const insertProductSchema = createSelectSchema(product).omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
});
export const insertProductCategorySchema = createSelectSchema(productCategory).omit({
  id: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
});

export type NewProduct = z.infer<typeof insertProductSchema>;
export type NewProductCategory = z.infer<typeof insertProductCategorySchema>;