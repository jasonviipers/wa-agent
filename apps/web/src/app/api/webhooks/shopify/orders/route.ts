/**
 * Shopify Order Webhooks Handler
 * Handles real-time order updates from Shopify
 *
 * Webhook Topics:
 * - orders/create
 * - orders/updated
 * - orders/cancelled
 * - orders/fulfilled
 */

import { NextRequest, NextResponse } from "next/server";
import { db, eq, and } from "@wagents/db";
import { integration, orders, orderItems, product, syncLog } from "@wagents/db/schema";
import { ShopifyService } from "@/lib/integrations/shopify";

/**
 * POST /api/webhooks/shopify/orders
 * Handle Shopify order webhooks
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
      case "orders/create":
      case "orders/updated":
      case "orders/fulfilled":
      case "orders/cancelled":
        await handleOrderCreateOrUpdate(
          payload,
          matchingIntegration.organizationId,
          matchingIntegration.id,
          topic
        );
        break;

      default:
        console.log(`Unhandled webhook topic: ${topic}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error processing Shopify order webhook:", error);
    return NextResponse.json(
      { error: "Failed to process webhook" },
      { status: 500 }
    );
  }
}

/**
 * Handle order create/update webhook
 */
async function handleOrderCreateOrUpdate(
  payload: any,
  organizationId: string,
  integrationId: string,
  topic: string
) {
  try {
    const shopifyOrderId = `gid://shopify/Order/${payload.id}`;

    // Check if order exists
    const existingOrdersList = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.organizationId, organizationId),
          eq(orders.platformOrderId, shopifyOrderId)
        )
      );

    const existingOrder = existingOrdersList[0];

    // Map Shopify status to platform status
    let orderStatus: "pending" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded" = "pending";
    if (topic === "orders/cancelled") {
      orderStatus = "cancelled";
    } else if (topic === "orders/fulfilled" || payload.fulfillment_status === "fulfilled") {
      orderStatus = "delivered";
    } else if (payload.fulfillment_status === "partial") {
      orderStatus = "processing";
    }

    // Map payment status
    let paymentStatus: "pending" | "paid" | "failed" | "refunded" = "pending";
    if (payload.financial_status === "paid") {
      paymentStatus = "paid";
    } else if (payload.financial_status === "refunded" || payload.financial_status === "partially_refunded") {
      paymentStatus = "refunded";
    } else if (payload.financial_status === "voided") {
      paymentStatus = "failed";
    }

    const orderData = {
      platform: "shopify" as const,
      platformOrderId: shopifyOrderId,
      platformOrderNumber: payload.name,
      customerEmail: payload.email,
      customerName: payload.customer
        ? `${payload.customer.first_name || ""} ${payload.customer.last_name || ""}`.trim()
        : undefined,
      customerPhone: payload.customer?.phone,
      status: orderStatus,
      paymentStatus,
      paymentMethod: payload.payment_gateway_names?.[0],
      subtotal: payload.subtotal_price,
      tax: payload.total_tax,
      shipping: payload.total_shipping_price_set?.shop_money?.amount || "0",
      totalAmount: payload.total_price,
      currency: payload.currency,
      shippingAddress: payload.shipping_address
        ? {
            name: payload.shipping_address.name,
            address1: payload.shipping_address.address1,
            address2: payload.shipping_address.address2,
            city: payload.shipping_address.city,
            state: payload.shipping_address.province,
            postalCode: payload.shipping_address.zip,
            country: payload.shipping_address.country,
            phone: payload.shipping_address.phone,
          }
        : undefined,
      fulfillmentStatus: payload.fulfillment_status,
      metadata: {
        shopifyOrderNumber: payload.order_number,
        tags: payload.tags,
        note: payload.note,
      },
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

      console.log(`Updated order ${existingOrder.id} from Shopify webhook`);
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
      for (const lineItem of payload.line_items || []) {
        // Try to find matching product by variant ID
        const shopifyVariantId = `gid://shopify/ProductVariant/${lineItem.variant_id}`;
        const matchingProducts = await db
          .select()
          .from(product)
          .where(eq(product.organizationId, organizationId));

        const matchingProduct = matchingProducts.find((p) => {
          const variant = p.variants?.find((v: any) => v.id === shopifyVariantId);
          return !!variant;
        });

        const subtotal = parseFloat(lineItem.price) * lineItem.quantity;

        await db.insert(orderItems).values({
          orderId: newOrder.id,
          productId: matchingProduct?.id || "",
          variantId: shopifyVariantId,
          productName: lineItem.title,
          productSku: lineItem.sku || "",
          quantity: lineItem.quantity,
          unitPrice: lineItem.price,
          subtotal: String(subtotal),
          tax: lineItem.total_tax || "0",
          discount: lineItem.total_discount || "0",
        });
      }

      console.log(`Created order from Shopify webhook: ${payload.id}`);
    }

    // Log sync
    await db.insert(syncLog).values({
      integrationId,
      entityType: "order",
      entityId: shopifyOrderId,
      action: "webhook_update",
      status: "success",
      metadata: { topic, shopifyId: payload.id },
    });
  } catch (error) {
    console.error("Error handling order create/update:", error);

    // Log failure
    await db.insert(syncLog).values({
      integrationId,
      entityType: "order",
      entityId: `gid://shopify/Order/${payload.id}`,
      action: "webhook_update",
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });

    throw error;
  }
}
