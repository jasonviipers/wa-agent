/**
 * Product Categories API Route
 * Handles CRUD operations for product categories
 *
 * Routes:
 * - GET /api/products/categories - List all categories
 * - POST /api/products/categories - Create a new category
 */

import { NextRequest, NextResponse } from "next/server";
import { db, eq, and, like, desc, isNull } from "@wagents/db";
import { productCategory } from "@wagents/db/schema";
import { auth } from "@/lib/auth";
import { z } from "zod";

// Schema for creating/updating categories
const CreateCategorySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  parentId: z.string().optional(),
  slug: z.string().min(1),
  imageUrl: z.string().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().default(0),
});

/**
 * GET /api/products/categories
 * List all product categories
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
    const search = searchParams.get("search");
    const parentId = searchParams.get("parentId");
    const isActive = searchParams.get("isActive");
    const includeChildren = searchParams.get("includeChildren") === "true";

    // Build query conditions
    const conditions = [eq(productCategory.organizationId, session.user.organizationId)];

    if (search) {
      conditions.push(like(productCategory.name, `%${search}%`));
    }

    if (parentId === "null" || parentId === "") {
      // Get root categories (no parent)
      conditions.push(isNull(productCategory.parentId));
    } else if (parentId) {
      conditions.push(eq(productCategory.parentId, parentId));
    }

    if (isActive !== null && isActive !== undefined) {
      conditions.push(eq(productCategory.isActive, isActive === "true"));
    }

    // Fetch categories
    const categories = await db
      .select()
      .from(productCategory)
      .where(and(...conditions))
      .orderBy(desc(productCategory.sortOrder));

    // If includeChildren is true, fetch all categories and build a tree
    if (includeChildren) {
      const allCategories = await db
        .select()
        .from(productCategory)
        .where(eq(productCategory.organizationId, session.user.organizationId))
        .orderBy(desc(productCategory.sortOrder));

      // Build category tree
      const categoryMap = new Map();
      allCategories.forEach(cat => {
        categoryMap.set(cat.id, { ...cat, children: [] });
      });

      const tree: any[] = [];
      allCategories.forEach(cat => {
        if (cat.parentId) {
          const parent = categoryMap.get(cat.parentId);
          if (parent) {
            parent.children.push(categoryMap.get(cat.id));
          }
        } else {
          tree.push(categoryMap.get(cat.id));
        }
      });

      return NextResponse.json({ data: tree });
    }

    return NextResponse.json({ data: categories });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/products/categories
 * Create a new category
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
    const validatedData = CreateCategorySchema.parse(body);

    // Check if slug is unique within organization
    const existingCategory = await db.query.productCategory.findFirst({
      where: and(
        eq(productCategory.organizationId, session.user.organizationId),
        eq(productCategory.slug, validatedData.slug)
      ),
    });

    if (existingCategory) {
      return NextResponse.json(
        { error: "Category with this slug already exists" },
        { status: 409 }
      );
    }

    // Create category
    const [newCategory] = await db
      .insert(productCategory)
      .values({
        organizationId: session.user.organizationId,
        ...validatedData,
      })
      .returning();

    return NextResponse.json(
      { data: newCategory },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error creating category:", error);
    return NextResponse.json(
      { error: "Failed to create category" },
      { status: 500 }
    );
  }
}
