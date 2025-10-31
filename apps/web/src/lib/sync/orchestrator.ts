/**
 * Sync Orchestration Service
 * Handles bi-directional sync between platform and external marketplaces (Shopify, WhatsApp, Facebook)
 */

import { db, eq, and } from "@wagents/db";
import { integration, product, orders, orderItems, syncLog } from "@wagents/db/schema";
import { ShopifyService } from "@/lib/integrations/shopify";
import type { ShopifyProduct, ShopifyOrder } from "@/lib/integrations/shopify";

export interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: string[];
}

export class SyncOrchestrator {
  /**
   * Sync products from Shopify to platform
   * Handles pagination and cursor management
   */
  static async syncProductsFromShopify(
    integrationId: string,
    organizationId: string
  ): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      synced: 0,
      failed: 0,
      errors: [],
    };

    try {
      // Get integration
      const integrationData = await db.query.integration.findFirst({
        where: and(
          eq(integration.id, integrationId),
          eq(integration.organizationId, organizationId)
        ),
      });

      if (!integrationData) {
        throw new Error("Integration not found");
      }

      if (integrationData.platform !== "shopify") {
        throw new Error("Integration is not a Shopify integration");
      }

      // Update sync status
      await db
        .update(integration)
        .set({ syncStatus: "in_progress" })
        .where(eq(integration.id, integrationId));

      // Initialize Shopify service
      const shopify = new ShopifyService(integrationData.config.config as any);

      // Get cursor from integration
      let cursor = integrationData.syncCursor as { after?: string } | null;
      let hasNextPage = true;

      while (hasNextPage) {
        try {
          const { products, pageInfo } = await shopify.getProducts(
            50,
            cursor?.after
          );

          // Process each product
          for (const shopifyProduct of products) {
            try {
              await this.upsertProductFromShopify(
                shopifyProduct,
                organizationId,
                integrationId
              );

              result.synced++;

              // Log success
              await db.insert(syncLog).values({
                integrationId,
                entityType: "product",
                entityId: shopifyProduct.id,
                action: "sync_from_shopify",
                status: "success",
              });
            } catch (error) {
              result.failed++;
              const errorMessage =
                error instanceof Error ? error.message : "Unknown error";
              result.errors.push(`Product ${shopifyProduct.id}: ${errorMessage}`);

              // Log failure
              await db.insert(syncLog).values({
                integrationId,
                entityType: "product",
                entityId: shopifyProduct.id,
                action: "sync_from_shopify",
                status: "failed",
                errorMessage,
              });
            }
          }

          // Update cursor for next batch
          hasNextPage = pageInfo.hasNextPage;
          cursor = { after: pageInfo.endCursor };

          await db
            .update(integration)
            .set({ syncCursor: cursor })
            .where(eq(integration.id, integrationId));
        } catch (error) {
          result.success = false;
          result.errors.push(
            `Batch fetch error: ${error instanceof Error ? error.message : "Unknown error"}`
          );
          hasNextPage = false;
        }
      }

      // Update integration sync status
      await db
        .update(integration)
        .set({
          syncStatus: "idle",
          lastSyncAt: new Date(),
          syncError: result.errors.length > 0 ? result.errors.join("; ") : null,
        })
        .where(eq(integration.id, integrationId));
    } catch (error) {
      result.success = false;
      result.errors.push(
        error instanceof Error ? error.message : "Unknown error"
      );

      // Update integration with error
      await db
        .update(integration)
        .set({
          syncStatus: "idle",
          syncError: error instanceof Error ? error.message : "Unknown error",
        })
        .where(eq(integration.id, integrationId));
    }

    return result;
  }

  /**
   * Sync a single product from Shopify to platform
   */
  private static async upsertProductFromShopify(
    shopifyProduct: ShopifyProduct,
    organizationId: string,
    integrationId: string
  ): Promise<void> {
    // Extract first variant for pricing (Shopify products always have at least one variant)
    const firstVariant = shopifyProduct.variants[0];

    // Check if product already exists (by Shopify product ID)
    const existingProducts = await db
      .select()
      .from(product)
      .where(eq(product.organizationId, organizationId));

    const existingProduct = existingProducts.find(
      (p) => p.platformSync?.shopify?.productId === shopifyProduct.id
    );

    const productData = {
      sku: shopifyProduct.handle,
      name: shopifyProduct.title,
      description: shopifyProduct.description,
      price: firstVariant.price,
      currency: shopifyProduct.priceRange.minVariantPrice.currencyCode,
      stock: shopifyProduct.variants.reduce(
        (sum, v) => sum + v.inventoryQuantity,
        0
      ),
      images: shopifyProduct.images.map((img) => img.url),
      variants: shopifyProduct.variants.map((v) => ({
        id: v.id,
        name: v.title,
        sku: v.sku,
        price: parseFloat(v.price),
        stock: v.inventoryQuantity,
        attributes: {},
      })),
      attributes: {
        vendor: shopifyProduct.vendor,
        productType: shopifyProduct.productType,
        tags: shopifyProduct.tags,
      },
      isActive: shopifyProduct.status === "ACTIVE",
      platformSync: {
        shopify: {
          synced: true,
          productId: shopifyProduct.id,
          lastSyncAt: new Date().toISOString(),
        },
      },
    };

    if (existingProduct) {
      // Update existing product
      await db
        .update(product)
        .set({
          ...productData,
          updatedAt: new Date(),
        })
        .where(eq(product.id, existingProduct.id));
    } else {
      // Insert new product
      await db.insert(product).values({
        organizationId,
        ...productData,
      });
    }
  }

  /**
   * Sync a product from platform to Shopify
   */
  static async syncProductToShopify(
    productId: string,
    integrationId: string,
    organizationId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get product
      const productData = await db.query.product.findFirst({
        where: and(
          eq(product.id, productId),
          eq(product.organizationId, organizationId)
        ),
      });

      if (!productData) {
        throw new Error("Product not found");
      }

      // Get integration
      const integrationData = await db.query.integration.findFirst({
        where: and(
          eq(integration.id, integrationId),
          eq(integration.organizationId, organizationId)
        ),
      });

      if (!integrationData) {
        throw new Error("Integration not found");
      }

      if (integrationData.platform !== "shopify") {
        throw new Error("Integration is not a Shopify integration");
      }

      // Initialize Shopify service
      const shopify = new ShopifyService(integrationData.config.config as any);

      // Check if product already exists on Shopify
      const shopifyProductId = productData.platformSync?.shopify?.productId;

      if (shopifyProductId) {
        // Update existing product on Shopify
        await shopify.updateProduct(shopifyProductId, {
          title: productData.name,
          descriptionHtml: productData.description || "",
          status: productData.isActive ? "ACTIVE" : "DRAFT",
          variants: productData.variants?.map((v) => ({
            id: v.id,
            price: String(v.price),
            inventoryQuantity: v.stock,
          })),
        });
      } else {
        // Create new product on Shopify
        const newShopifyProduct = await shopify.createProduct({
          title: productData.name,
          descriptionHtml: productData.description || "",
          status: productData.isActive ? "ACTIVE" : "DRAFT",
          variants: [
            {
              price: productData.price,
              inventoryQuantity: productData.stock,
              sku: productData.sku,
            },
          ],
        });

        // Update product with Shopify ID
        await db
          .update(product)
          .set({
            platformSync: {
              ...productData.platformSync,
              shopify: {
                synced: true,
                productId: newShopifyProduct.id,
                lastSyncAt: new Date().toISOString(),
              },
            },
          })
          .where(eq(product.id, productId));
      }

      // Log success
      await db.insert(syncLog).values({
        integrationId,
        entityType: "product",
        entityId: productId,
        action: "sync_to_shopify",
        status: "success",
      });

      return { success: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      // Log failure
      await db.insert(syncLog).values({
        integrationId,
        entityType: "product",
        entityId: productId,
        action: "sync_to_shopify",
        status: "failed",
        errorMessage,
      });

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Sync orders from Shopify to platform
   */
  static async syncOrdersFromShopify(
    integrationId: string,
    organizationId: string
  ): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      synced: 0,
      failed: 0,
      errors: [],
    };

    try {
      // Get integration
      const integrationData = await db.query.integration.findFirst({
        where: and(
          eq(integration.id, integrationId),
          eq(integration.organizationId, organizationId)
        ),
      });

      if (!integrationData) {
        throw new Error("Integration not found");
      }

      if (integrationData.platform !== "shopify") {
        throw new Error("Integration is not a Shopify integration");
      }

      // Initialize Shopify service
      const shopify = new ShopifyService(integrationData.config.config as any);

      // Fetch orders from Shopify
      let cursor = integrationData.syncCursor as { after?: string } | null;
      let hasNextPage = true;

      while (hasNextPage) {
        try {
          const { orders: shopifyOrders, pageInfo } = await shopify.getOrders(
            50,
            cursor?.after
          );

          // Process each order
          for (const shopifyOrder of shopifyOrders) {
            try {
              await this.upsertOrderFromShopify(
                shopifyOrder,
                organizationId,
                integrationId
              );

              result.synced++;

              // Log success
              await db.insert(syncLog).values({
                integrationId,
                entityType: "order",
                entityId: shopifyOrder.id,
                action: "sync_from_shopify",
                status: "success",
              });
            } catch (error) {
              result.failed++;
              const errorMessage =
                error instanceof Error ? error.message : "Unknown error";
              result.errors.push(`Order ${shopifyOrder.id}: ${errorMessage}`);

              // Log failure
              await db.insert(syncLog).values({
                integrationId,
                entityType: "order",
                entityId: shopifyOrder.id,
                action: "sync_from_shopify",
                status: "failed",
                errorMessage,
              });
            }
          }

          hasNextPage = pageInfo.hasNextPage;
          cursor = { after: pageInfo.endCursor };
        } catch (error) {
          result.success = false;
          result.errors.push(
            `Batch fetch error: ${error instanceof Error ? error.message : "Unknown error"}`
          );
          hasNextPage = false;
        }
      }

      // Update integration
      await db
        .update(integration)
        .set({
          lastSyncAt: new Date(),
          syncError: result.errors.length > 0 ? result.errors.join("; ") : null,
        })
        .where(eq(integration.id, integrationId));
    } catch (error) {
      result.success = false;
      result.errors.push(
        error instanceof Error ? error.message : "Unknown error"
      );
    }

    return result;
  }

  /**
   * Sync a single order from Shopify to platform
   */
  private static async upsertOrderFromShopify(
    shopifyOrder: ShopifyOrder,
    organizationId: string,
    integrationId: string
  ): Promise<void> {
    // Check if order already exists
    const existingOrders = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.organizationId, organizationId),
          eq(orders.platformOrderId, shopifyOrder.id)
        )
      );

    const existingOrder = existingOrders[0];

    const orderData = {
      platform: "shopify" as const,
      platformOrderId: shopifyOrder.id,
      platformOrderNumber: shopifyOrder.name,
      customerEmail: shopifyOrder.email,
      customerName: shopifyOrder.customer
        ? `${shopifyOrder.customer.firstName || ""} ${shopifyOrder.customer.lastName || ""}`.trim()
        : undefined,
      status: this.mapShopifyFulfillmentStatus(shopifyOrder.fulfillmentStatus),
      paymentStatus: this.mapShopifyPaymentStatus(shopifyOrder.financialStatus),
      subtotal: shopifyOrder.subtotalPrice,
      tax: shopifyOrder.totalTax,
      totalAmount: shopifyOrder.totalPrice,
      currency: shopifyOrder.currencyCode,
      shippingAddress: shopifyOrder.shippingAddress,
    };

    if (existingOrder) {
      // Update existing order
      await db
        .update(orders)
        .set({
          ...orderData,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, existingOrder.id));
    } else {
      // Create new order
      const [newOrder] = await db
        .insert(orders)
        .values({
          organizationId,
          ...orderData,
        })
        .returning();

      // Create order items
      for (const lineItem of shopifyOrder.lineItems) {
        // Try to find matching product
        const matchingProduct = await db.query.product.findFirst({
          where: and(
            eq(product.organizationId, organizationId),
            eq(product.platformSync, {
              shopify: {
                productId: lineItem.variant.id,
              },
            } as any)
          ),
        });

        const subtotal = parseFloat(lineItem.variant.price) * lineItem.quantity;

        await db.insert(orderItems).values({
          orderId: newOrder.id,
          productId: matchingProduct?.id || "",
          productName: lineItem.title,
          productSku: matchingProduct?.sku || "",
          quantity: lineItem.quantity,
          unitPrice: lineItem.variant.price,
          subtotal: String(subtotal),
        });
      }
    }
  }

  /**
   * Map Shopify fulfillment status to platform status
   */
  private static mapShopifyFulfillmentStatus(
    status: string
  ): "pending" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded" {
    switch (status?.toLowerCase()) {
      case "fulfilled":
        return "delivered";
      case "partial":
        return "processing";
      case "restocked":
        return "cancelled";
      default:
        return "pending";
    }
  }

  /**
   * Map Shopify payment status to platform payment status
   */
  private static mapShopifyPaymentStatus(
    status: string
  ): "pending" | "paid" | "failed" | "refunded" {
    switch (status?.toLowerCase()) {
      case "paid":
        return "paid";
      case "refunded":
      case "partially_refunded":
        return "refunded";
      case "voided":
        return "failed";
      default:
        return "pending";
    }
  }
}
