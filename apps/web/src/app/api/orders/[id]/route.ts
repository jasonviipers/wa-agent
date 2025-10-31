/**
 * Single Order API Route
 * Handles operations for a specific order
 *
 * Routes:
 * - GET /api/orders/[id] - Get a specific order
 * - PUT /api/orders/[id] - Update a specific order
 * - DELETE /api/orders/[id] - Delete a specific order
 */

import { NextRequest, NextResponse } from "next/server";
import { db, eq, and } from "@wagents/db";
import { orders } from "@wagents/db/schema";
import { auth } from "@/lib/auth";
import { z } from "zod";

// Schema for updating orders
const UpdateOrderSchema = z.object({
  status: z.enum(["pending", "processing", "shipped", "delivered", "cancelled", "refunded"]).optional(),
  paymentStatus: z.enum(["pending", "paid", "failed", "refunded"]).optional(),
  paymentMethod: z.string().optional(),
  fulfillmentStatus: z.string().optional(),
  trackingNumber: z.string().optional(),
  carrier: z.string().optional(),
  deliveryNotes: z.string().optional(),
  metadata: z.any().optional(),
});

/**
 * GET /api/orders/[id]
 * Get a specific order
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const order = await db.query.orders.findFirst({
      where: and(
        eq(orders.id, params.id),
        eq(orders.organizationId, session.user.organizationId)
      ),
      with: {
        orderItems: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: order });
  } catch (error) {
    console.error("Error fetching order:", error);
    return NextResponse.json(
      { error: "Failed to fetch order" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/orders/[id]
 * Update a specific order
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = UpdateOrderSchema.parse(body);

    // Check if order exists and belongs to organization
    const existingOrder = await db.query.orders.findFirst({
      where: and(
        eq(orders.id, params.id),
        eq(orders.organizationId, session.user.organizationId)
      ),
    });

    if (!existingOrder) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    // Update order
    const [updatedOrder] = await db
      .update(orders)
      .set({
        ...validatedData,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(orders.id, params.id),
          eq(orders.organizationId, session.user.organizationId)
        )
      )
      .returning();

    return NextResponse.json({ data: updatedOrder });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error updating order:", error);
    return NextResponse.json(
      { error: "Failed to update order" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/orders/[id]
 * Delete a specific order
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if order exists and belongs to organization
    const existingOrder = await db.query.orders.findFirst({
      where: and(
        eq(orders.id, params.id),
        eq(orders.organizationId, session.user.organizationId)
      ),
    });

    if (!existingOrder) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    // Delete order (order items will be deleted via cascade)
    await db
      .delete(orders)
      .where(
        and(
          eq(orders.id, params.id),
          eq(orders.organizationId, session.user.organizationId)
        )
      );

    return NextResponse.json(
      { message: "Order deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting order:", error);
    return NextResponse.json(
      { error: "Failed to delete order" },
      { status: 500 }
    );
  }
}
