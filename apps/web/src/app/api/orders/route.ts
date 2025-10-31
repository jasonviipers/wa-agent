/**
 * Orders API Route
 * Handles CRUD operations for orders
 *
 * Routes:
 * - GET /api/orders - List all orders
 * - POST /api/orders - Create a new order
 */

import { NextRequest, NextResponse } from "next/server";
import { db, eq, and, desc, gte, lte } from "@wagents/db";
import { orders, orderItems, product } from "@wagents/db/schema";
import { auth } from "@/lib/auth";
import { z } from "zod";

// Schema for creating orders
const CreateOrderSchema = z.object({
  conversationId: z.string().optional(),
  customerId: z.string().optional(),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().optional(),
  customerName: z.string().optional(),
  status: z.enum(["pending", "processing", "shipped", "delivered", "cancelled", "refunded"]).default("pending"),
  platform: z.enum(["shopify", "facebook_marketplace", "tiktok_shop", "amazon", "whatsapp", "internal"]).default("internal"),
  platformOrderId: z.string().optional(),
  platformOrderNumber: z.string().optional(),
  paymentStatus: z.enum(["pending", "paid", "failed", "refunded"]).default("pending"),
  paymentMethod: z.string().optional(),
  subtotal: z.string().or(z.number()).transform(val => String(val)),
  tax: z.string().or(z.number()).transform(val => String(val)).default("0"),
  shipping: z.string().or(z.number()).transform(val => String(val)).default("0"),
  discount: z.string().or(z.number()).transform(val => String(val)).default("0"),
  totalAmount: z.string().or(z.number()).transform(val => String(val)),
  currency: z.string().default("USD"),
  shippingAddress: z.object({
    name: z.string().optional(),
    address1: z.string(),
    address2: z.string().optional(),
    city: z.string(),
    state: z.string(),
    postalCode: z.string(),
    country: z.string(),
    phone: z.string().optional(),
  }).optional(),
  billingAddress: z.any().optional(),
  fulfillmentStatus: z.string().optional(),
  trackingNumber: z.string().optional(),
  carrier: z.string().optional(),
  deliveryNotes: z.string().optional(),
  metadata: z.any().optional(),
  items: z.array(z.object({
    productId: z.string(),
    variantId: z.string().optional(),
    quantity: z.number().min(1),
    unitPrice: z.string().or(z.number()).transform(val => String(val)),
    tax: z.string().or(z.number()).transform(val => String(val)).default("0"),
    discount: z.string().or(z.number()).transform(val => String(val)).default("0"),
  })),
});

/**
 * GET /api/orders
 * List all orders with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const paymentStatus = searchParams.get("paymentStatus");
    const platform = searchParams.get("platform");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build query conditions
    const conditions = [eq(orders.organizationId, session.user.organizationId)];

    if (status) {
      conditions.push(eq(orders.status, status as any));
    }

    if (paymentStatus) {
      conditions.push(eq(orders.paymentStatus, paymentStatus as any));
    }

    if (platform) {
      conditions.push(eq(orders.platform, platform as any));
    }

    if (startDate) {
      conditions.push(gte(orders.createdAt, new Date(startDate)));
    }

    if (endDate) {
      conditions.push(lte(orders.createdAt, new Date(endDate)));
    }

    // Fetch orders with items
    const ordersList = await db.query.orders.findMany({
      where: and(...conditions),
      orderBy: [desc(orders.createdAt)],
      limit,
      offset,
      with: {
        orderItems: true,
      },
    });

    // Get total count
    const totalResult = await db
      .select()
      .from(orders)
      .where(and(...conditions));

    return NextResponse.json({
      data: ordersList,
      pagination: {
        total: totalResult.length,
        limit,
        offset,
        hasMore: totalResult.length > offset + limit,
      },
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/orders
 * Create a new order
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = CreateOrderSchema.parse(body);

    // Extract items
    const { items, ...orderData } = validatedData;

    // Start transaction to create order and items
    const [newOrder] = await db
      .insert(orders)
      .values({
        organizationId: session.user.organizationId,
        ...orderData,
      })
      .returning();

    // Create order items
    const orderItemsData = await Promise.all(
      items.map(async (item) => {
        // Get product details
        const productData = await db.query.product.findFirst({
          where: eq(product.id, item.productId),
        });

        if (!productData) {
          throw new Error(`Product not found: ${item.productId}`);
        }

        const subtotal = parseFloat(item.unitPrice) * item.quantity;

        return {
          orderId: newOrder.id,
          productId: item.productId,
          variantId: item.variantId,
          productName: productData.name,
          productSku: productData.sku,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: String(subtotal),
          tax: item.tax,
          discount: item.discount,
        };
      })
    );

    const createdItems = await db
      .insert(orderItems)
      .values(orderItemsData)
      .returning();

    return NextResponse.json(
      {
        data: {
          ...newOrder,
          items: createdItems,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error creating order:", error);
    return NextResponse.json(
      { error: "Failed to create order", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
