/**
 * Products API Route
 * Handles CRUD operations for products
 *
 * Routes:
 * - GET /api/products - List all products
 * - POST /api/products - Create a new product
 */

import { NextRequest, NextResponse } from "next/server";
import { db, eq, and, like, desc } from "@wagents/db";
import { product } from "@wagents/db/schema";
import { auth } from "@/lib/auth";
import { z } from "zod";

// Schema for creating/updating products
const CreateProductSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  shortDescription: z.string().optional(),
  categoryId: z.string().optional(),
  price: z.string().or(z.number()).transform(val => String(val)),
  compareAtPrice: z.string().or(z.number()).transform(val => String(val)).optional(),
  cost: z.string().or(z.number()).transform(val => String(val)).optional(),
  currency: z.string().default("USD"),
  stock: z.number().default(0),
  lowStockThreshold: z.number().default(10),
  trackInventory: z.boolean().default(true),
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
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
});

/**
 * GET /api/products
 * List all products with optional filtering
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
    const categoryId = searchParams.get("categoryId");
    const isActive = searchParams.get("isActive");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build query conditions
    const conditions = [eq(product.organizationId, session.user.organizationId)];

    if (search) {
      conditions.push(like(product.name, `%${search}%`));
    }

    if (categoryId) {
      conditions.push(eq(product.categoryId, categoryId));
    }

    if (isActive !== null && isActive !== undefined) {
      conditions.push(eq(product.isActive, isActive === "true"));
    }

    // Fetch products
    const products = await db
      .select()
      .from(product)
      .where(and(...conditions))
      .orderBy(desc(product.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const totalResult = await db
      .select()
      .from(product)
      .where(and(...conditions));

    return NextResponse.json({
      data: products,
      pagination: {
        total: totalResult.length,
        limit,
        offset,
        hasMore: totalResult.length > offset + limit,
      },
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/products
 * Create a new product
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
    const validatedData = CreateProductSchema.parse(body);

    // Create product
    const [newProduct] = await db
      .insert(product)
      .values({
        organizationId: session.user.organizationId,
        ...validatedData,
      })
      .returning();

    return NextResponse.json(
      { data: newProduct },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error creating product:", error);
    return NextResponse.json(
      { error: "Failed to create product" },
      { status: 500 }
    );
  }
}
