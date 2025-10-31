/**
 * Single Product API Route
 * Handles operations for a specific product
 *
 * Routes:
 * - GET /api/products/[id] - Get a specific product
 * - PUT /api/products/[id] - Update a specific product
 * - DELETE /api/products/[id] - Delete a specific product
 */

import { NextRequest, NextResponse } from "next/server";
import { db, eq, and } from "@wagents/db";
import { product } from "@wagents/db/schema";
import { auth } from "@/lib/auth";
import { z } from "zod";

// Schema for updating products
const UpdateProductSchema = z.object({
  sku: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  shortDescription: z.string().optional(),
  categoryId: z.string().optional(),
  price: z.string().or(z.number()).transform(val => String(val)).optional(),
  compareAtPrice: z.string().or(z.number()).transform(val => String(val)).optional(),
  cost: z.string().or(z.number()).transform(val => String(val)).optional(),
  currency: z.string().optional(),
  stock: z.number().optional(),
  lowStockThreshold: z.number().optional(),
  trackInventory: z.boolean().optional(),
  images: z.array(z.string()).optional(),
  videoUrl: z.string().optional(),
  variants: z.array(z.object({
    id: z.string(),
    name: z.string(),
    sku: z.string(),
    price: z.number(),
    stock: z.number(),
    attributes: z.record(z.string()),
    imageUrl: z.string().optional(),
  })).optional(),
  attributes: z.record(z.any()).optional(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  seoKeywords: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  platformSync: z.object({
    shopify: z.object({
      synced: z.boolean(),
      productId: z.string().optional(),
      lastSyncAt: z.string().optional(),
    }).optional(),
    whatsapp: z.object({
      synced: z.boolean(),
      catalogId: z.string().optional(),
      lastSyncAt: z.string().optional(),
    }).optional(),
    facebook: z.object({
      synced: z.boolean(),
      productId: z.string().optional(),
      lastSyncAt: z.string().optional(),
    }).optional(),
  }).optional(),
});

/**
 * GET /api/products/[id]
 * Get a specific product
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

    const productData = await db.query.product.findFirst({
      where: and(
        eq(product.id, params.id),
        eq(product.organizationId, session.user.organizationId)
      ),
    });

    if (!productData) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: productData });
  } catch (error) {
    console.error("Error fetching product:", error);
    return NextResponse.json(
      { error: "Failed to fetch product" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/products/[id]
 * Update a specific product
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
    const validatedData = UpdateProductSchema.parse(body);

    // Check if product exists and belongs to organization
    const existingProduct = await db.query.product.findFirst({
      where: and(
        eq(product.id, params.id),
        eq(product.organizationId, session.user.organizationId)
      ),
    });

    if (!existingProduct) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    // Update product
    const [updatedProduct] = await db
      .update(product)
      .set({
        ...validatedData,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(product.id, params.id),
          eq(product.organizationId, session.user.organizationId)
        )
      )
      .returning();

    return NextResponse.json({ data: updatedProduct });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error updating product:", error);
    return NextResponse.json(
      { error: "Failed to update product" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/products/[id]
 * Delete a specific product
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

    // Check if product exists and belongs to organization
    const existingProduct = await db.query.product.findFirst({
      where: and(
        eq(product.id, params.id),
        eq(product.organizationId, session.user.organizationId)
      ),
    });

    if (!existingProduct) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    // Delete product
    await db
      .delete(product)
      .where(
        and(
          eq(product.id, params.id),
          eq(product.organizationId, session.user.organizationId)
        )
      );

    return NextResponse.json(
      { message: "Product deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting product:", error);
    return NextResponse.json(
      { error: "Failed to delete product" },
      { status: 500 }
    );
  }
}
