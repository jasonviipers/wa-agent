/**
 * Sync API Route
 * Handles manual sync triggers and sync status queries
 *
 * Routes:
 * - GET /api/sync - Get sync status
 * - POST /api/sync - Trigger a manual sync
 */

import { NextRequest, NextResponse } from "next/server";
import { db, eq, and, desc } from "@wagents/db";
import { integration, syncLog } from "@wagents/db/schema";
import { auth } from "@/lib/auth";
import { SyncOrchestrator } from "@/lib/sync/orchestrator";
import { z } from "zod";

// Schema for sync request
const SyncRequestSchema = z.object({
  integrationId: z.string(),
  syncType: z.enum(["products", "orders", "both"]).default("both"),
  direction: z.enum(["from_platform", "to_platform", "bidirectional"]).default("from_platform"),
});

/**
 * GET /api/sync
 * Get sync status and recent sync logs
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
    const integrationId = searchParams.get("integrationId");
    const limit = parseInt(searchParams.get("limit") || "50");

    // Get integrations
    const integrations = await db
      .select()
      .from(integration)
      .where(eq(integration.organizationId, session.user.organizationId));

    // If specific integration requested
    if (integrationId) {
      const specificIntegration = integrations.find(
        (int) => int.id === integrationId
      );

      if (!specificIntegration) {
        return NextResponse.json(
          { error: "Integration not found" },
          { status: 404 }
        );
      }

      // Get recent sync logs for this integration
      const logs = await db
        .select()
        .from(syncLog)
        .where(eq(syncLog.integrationId, integrationId))
        .orderBy(desc(syncLog.createdAt))
        .limit(limit);

      return NextResponse.json({
        integration: specificIntegration,
        logs,
      });
    }

    // Return all integrations with their sync status
    const integrationsWithLogs = await Promise.all(
      integrations.map(async (int) => {
        const logs = await db
          .select()
          .from(syncLog)
          .where(eq(syncLog.integrationId, int.id))
          .orderBy(desc(syncLog.createdAt))
          .limit(10);

        return {
          integration: int,
          recentLogs: logs,
        };
      })
    );

    return NextResponse.json({
      integrations: integrationsWithLogs,
    });
  } catch (error) {
    console.error("Error fetching sync status:", error);
    return NextResponse.json(
      { error: "Failed to fetch sync status" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sync
 * Trigger a manual sync
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
    const validatedData = SyncRequestSchema.parse(body);

    // Get integration
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

    // Check if integration is already syncing
    if (integrationData.syncStatus === "in_progress") {
      return NextResponse.json(
        { error: "Sync already in progress" },
        { status: 409 }
      );
    }

    // Only support Shopify for now
    if (integrationData.platform !== "shopify") {
      return NextResponse.json(
        { error: "Only Shopify sync is supported at this time" },
        { status: 400 }
      );
    }

    // Trigger sync based on type and direction
    const results: any = {};

    if (validatedData.direction === "from_platform" || validatedData.direction === "bidirectional") {
      if (validatedData.syncType === "products" || validatedData.syncType === "both") {
        // Sync products from Shopify to platform
        const productResult = await SyncOrchestrator.syncProductsFromShopify(
          validatedData.integrationId,
          session.user.organizationId
        );
        results.productsFromShopify = productResult;
      }

      if (validatedData.syncType === "orders" || validatedData.syncType === "both") {
        // Sync orders from Shopify to platform
        const orderResult = await SyncOrchestrator.syncOrdersFromShopify(
          validatedData.integrationId,
          session.user.organizationId
        );
        results.ordersFromShopify = orderResult;
      }
    }

    if (validatedData.direction === "to_platform" || validatedData.direction === "bidirectional") {
      // For syncing TO Shopify, we would need to get all products that haven't been synced
      // and call syncProductToShopify for each
      // This can be implemented as needed
      results.toShopify = {
        message: "Sync to Shopify not yet implemented in this endpoint",
      };
    }

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error triggering sync:", error);
    return NextResponse.json(
      { error: "Failed to trigger sync" },
      { status: 500 }
    );
  }
}
