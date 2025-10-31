/**
 * Single Product Category API Route
 * Handles operations for a specific category
 *
 * Routes:
 * - GET /api/products/categories/[id] - Get a specific category
 * - PUT /api/products/categories/[id] - Update a specific category
 * - DELETE /api/products/categories/[id] - Delete a specific category
 */

import { NextRequest, NextResponse } from "next/server";
import { db, eq, and } from "@wagents/db";
import { productCategory } from "@wagents/db/schema";
import { auth } from "@/lib/auth";
import { z } from "zod";

// Schema for updating categories
const UpdateCategorySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  parentId: z.string().optional(),
  slug: z.string().min(1).optional(),
  imageUrl: z.string().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().optional(),
});

/**
 * GET /api/products/categories/[id]
 * Get a specific category
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

    const category = await db.query.productCategory.findFirst({
      where: and(
        eq(productCategory.id, params.id),
        eq(productCategory.organizationId, session.user.organizationId)
      ),
    });

    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: category });
  } catch (error) {
    console.error("Error fetching category:", error);
    return NextResponse.json(
      { error: "Failed to fetch category" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/products/categories/[id]
 * Update a specific category
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
    const validatedData = UpdateCategorySchema.parse(body);

    // Check if category exists and belongs to organization
    const existingCategory = await db.query.productCategory.findFirst({
      where: and(
        eq(productCategory.id, params.id),
        eq(productCategory.organizationId, session.user.organizationId)
      ),
    });

    if (!existingCategory) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    // If slug is being updated, check uniqueness
    if (validatedData.slug && validatedData.slug !== existingCategory.slug) {
      const slugExists = await db.query.productCategory.findFirst({
        where: and(
          eq(productCategory.organizationId, session.user.organizationId),
          eq(productCategory.slug, validatedData.slug)
        ),
      });

      if (slugExists) {
        return NextResponse.json(
          { error: "Category with this slug already exists" },
          { status: 409 }
        );
      }
    }

    // Update category
    const [updatedCategory] = await db
      .update(productCategory)
      .set({
        ...validatedData,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(productCategory.id, params.id),
          eq(productCategory.organizationId, session.user.organizationId)
        )
      )
      .returning();

    return NextResponse.json({ data: updatedCategory });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error updating category:", error);
    return NextResponse.json(
      { error: "Failed to update category" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/products/categories/[id]
 * Delete a specific category
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

    // Check if category exists and belongs to organization
    const existingCategory = await db.query.productCategory.findFirst({
      where: and(
        eq(productCategory.id, params.id),
        eq(productCategory.organizationId, session.user.organizationId)
      ),
    });

    if (!existingCategory) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    // Delete category
    await db
      .delete(productCategory)
      .where(
        and(
          eq(productCategory.id, params.id),
          eq(productCategory.organizationId, session.user.organizationId)
        )
      );

    return NextResponse.json(
      { message: "Category deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting category:", error);
    return NextResponse.json(
      { error: "Failed to delete category" },
      { status: 500 }
    );
  }
}
