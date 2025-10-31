/**
 * Single Product Sync API Route
 * Sync a specific product to Shopify or other platforms
 *
 * Routes:
 * - POST /api/sync/product - Sync a single product to platform
 */

import { NextRequest, NextResponse } from "next/server";
import { db, eq, and } from "@wagents/db";
import { integration, product } from "@wagents/db/schema";
import { auth } from "@/lib/auth";
import { SyncOrchestrator } from "@/lib/sync/orchestrator";
import { z } from "zod";

// Schema for single product sync
const ProductSyncSchema = z.object({
  productId: z.string(),
  integrationId: z.string(),
  platform: z.enum(["shopify", "whatsapp", "facebook"]).default("shopify"),
});

/**
 * POST /api/sync/product
 * Sync a single product to a platform
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
    const validatedData = ProductSyncSchema.parse(body);

    // Verify product belongs to organization
    const productData = await db.query.product.findFirst({
      where: and(
        eq(product.id, validatedData.productId),
        eq(product.organizationId, session.user.organizationId)
      ),
    });

    if (!productData) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    // Verify integration belongs to organization
    const integrationData = await db.query.integration.findFirst({
      where: and(
        eq(integration.id, validatedData.integrationId),
        eq(integration.organizationId, session.user.organizationId)
      ),
    });

    if (!integrationData) {
      return NextResponse.json(
        { error: "Integration not found" },
        { status: 404 }
      );
    }

    // Verify platform matches
    if (integrationData.platform !== validatedData.platform) {
      return NextResponse.json(
        { error: "Integration platform mismatch" },
        { status: 400 }
      );
    }

    // Sync product based on platform
    let result;

    switch (validatedData.platform) {
      case "shopify":
        result = await SyncOrchestrator.syncProductToShopify(
          validatedData.productId,
          validatedData.integrationId,
          session.user.organizationId
        );
        break;

      case "whatsapp":
      case "facebook":
        return NextResponse.json(
          { error: `${validatedData.platform} sync not yet implemented` },
          { status: 501 }
        );

      default:
        return NextResponse.json(
          { error: "Unsupported platform" },
          { status: 400 }
        );
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Sync failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Product synced successfully",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error syncing product:", error);
    return NextResponse.json(
      { error: "Failed to sync product" },
      { status: 500 }
    );
  }
}
