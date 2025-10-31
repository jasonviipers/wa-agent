/**
 * Shopify Product Webhooks Handler
 * Handles real-time product updates from Shopify
 *
 * Webhook Topics:
 * - products/create
 * - products/update
 * - products/delete
 */

import { NextRequest, NextResponse } from "next/server";
import { db, eq, and } from "@wagents/db";
import { integration, product, syncLog } from "@wagents/db/schema";
import { ShopifyService } from "@/lib/integrations/shopify";

/**
 * POST /api/webhooks/shopify/products
 * Handle Shopify product webhooks
 */
export async function POST(request: NextRequest) {
  try {
    // Get webhook headers
    const shopDomain = request.headers.get("X-Shopify-Shop-Domain");
    const topic = request.headers.get("X-Shopify-Topic");
    const hmacHeader = request.headers.get("X-Shopify-Hmac-SHA256");

    if (!shopDomain || !topic || !hmacHeader) {
      return NextResponse.json(
        { error: "Missing required webhook headers" },
        { status: 400 }
      );
    }

    // Get request body
    const body = await request.text();

    // Find integration by shop domain
    const integrations = await db
      .select()
      .from(integration)
      .where(eq(integration.platform, "shopify"));

    const matchingIntegration = integrations.find((int) => {
      const config = int.config as any;
      return config.config?.shopDomain === shopDomain;
    });

    if (!matchingIntegration) {
      return NextResponse.json(
        { error: "Integration not found for this shop" },
        { status: 404 }
      );
    }

    // Verify webhook signature
    const webhookSecret = (matchingIntegration.config as any).config
      ?.webhookSecret;

    if (webhookSecret) {
      const isValid = ShopifyService.verifyWebhook(
        body,
        hmacHeader,
        webhookSecret
      );

      if (!isValid) {
        console.error("Invalid webhook signature");
        return NextResponse.json(
          { error: "Invalid webhook signature" },
          { status: 401 }
        );
      }
    }

    // Parse webhook payload
    const payload = JSON.parse(body);

    // Handle different webhook topics
    switch (topic) {
      case "products/create":
      case "products/update":
        await handleProductCreateOrUpdate(
          payload,
          matchingIntegration.organizationId,
          matchingIntegration.id
        );
        break;

      case "products/delete":
        await handleProductDelete(
          payload,
          matchingIntegration.organizationId,
          matchingIntegration.id
        );
        break;

      default:
        console.log(`Unhandled webhook topic: ${topic}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error processing Shopify product webhook:", error);
    return NextResponse.json(
      { error: "Failed to process webhook" },
      { status: 500 }
    );
  }
}

/**
 * Handle product create/update webhook
 */
async function handleProductCreateOrUpdate(
  payload: any,
  organizationId: string,
  integrationId: string
) {
  try {
    const shopifyProductId = `gid://shopify/Product/${payload.id}`;

    // Check if product exists
    const existingProducts = await db
      .select()
      .from(product)
      .where(eq(product.organizationId, organizationId));

    const existingProduct = existingProducts.find(
      (p) => p.platformSync?.shopify?.productId === shopifyProductId
    );

    // Extract first variant for pricing
    const firstVariant = payload.variants?.[0];

    const productData = {
      sku: payload.handle || `shopify-${payload.id}`,
      name: payload.title,
      description: payload.body_html,
      price: firstVariant?.price || "0",
      currency: "USD", // Shopify doesn't include currency in webhook
      stock: payload.variants?.reduce(
        (sum: number, v: any) => sum + (v.inventory_quantity || 0),
        0
      ) || 0,
      images: payload.images?.map((img: any) => img.src) || [],
      variants: payload.variants?.map((v: any) => ({
        id: `gid://shopify/ProductVariant/${v.id}`,
        name: v.title,
        sku: v.sku || "",
        price: parseFloat(v.price || "0"),
        stock: v.inventory_quantity || 0,
        attributes: {},
      })),
      attributes: {
        vendor: payload.vendor,
        productType: payload.product_type,
        tags: payload.tags?.split(",").map((t: string) => t.trim()) || [],
      },
      isActive: payload.status === "active",
      platformSync: {
        shopify: {
          synced: true,
          productId: shopifyProductId,
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

      console.log(`Updated product ${existingProduct.id} from Shopify webhook`);
    } else {
      // Create new product
      await db.insert(product).values({
        organizationId,
        ...productData,
      });

      console.log(`Created product from Shopify webhook: ${payload.id}`);
    }

    // Log sync
    await db.insert(syncLog).values({
      integrationId,
      entityType: "product",
      entityId: shopifyProductId,
      action: "webhook_update",
      status: "success",
      metadata: { topic: "products/update", shopifyId: payload.id },
    });
  } catch (error) {
    console.error("Error handling product create/update:", error);

    // Log failure
    await db.insert(syncLog).values({
      integrationId,
      entityType: "product",
      entityId: `gid://shopify/Product/${payload.id}`,
      action: "webhook_update",
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });

    throw error;
  }
}

/**
 * Handle product delete webhook
 */
async function handleProductDelete(
  payload: any,
  organizationId: string,
  integrationId: string
) {
  try {
    const shopifyProductId = `gid://shopify/Product/${payload.id}`;

    // Find and delete product
    const existingProducts = await db
      .select()
      .from(product)
      .where(eq(product.organizationId, organizationId));

    const existingProduct = existingProducts.find(
      (p) => p.platformSync?.shopify?.productId === shopifyProductId
    );

    if (existingProduct) {
      await db.delete(product).where(eq(product.id, existingProduct.id));

      console.log(`Deleted product ${existingProduct.id} from Shopify webhook`);
    }

    // Log sync
    await db.insert(syncLog).values({
      integrationId,
      entityType: "product",
      entityId: shopifyProductId,
      action: "webhook_delete",
      status: "success",
      metadata: { topic: "products/delete", shopifyId: payload.id },
    });
  } catch (error) {
    console.error("Error handling product delete:", error);

    // Log failure
    await db.insert(syncLog).values({
      integrationId,
      entityType: "product",
      entityId: `gid://shopify/Product/${payload.id}`,
      action: "webhook_delete",
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });

    throw error;
  }
}
