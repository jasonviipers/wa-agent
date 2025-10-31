import { tool } from "ai";
import { z } from 'zod';
import type { AgentConfig } from "../types";
import { product } from "@wagents/db/schema/product";
import { and, db, eq,  sql } from "@wagents/db";
import { orderItems, orders } from "@wagents/db/schema/order";
import { conversation, message } from "@wagents/db/schema/conversation";
import { AgenticRAG } from "../../rag";

/**
 * Knowledge Base Search Tool
 * Searches the agent's knowledge bases for relevant information
 */
export function createAgenticKnowledgeSearchTool(agentConfig: AgentConfig) {
    return tool({
        name: "search_knowledge",
        description: 'Search the knowledge base using advanced agentic RAG. ' +
            'The system will intelligently decide retrieval strategy, expand queries, ' +
            'and validate results for maximum accuracy.',
        inputSchema: z.object({
            query: z.string().describe("What information do you need from the knowledge base?"),
            requireHighConfidence: z.boolean().optional().default(false)
                .describe("Set to true for critical information that must be highly accurate"),
        }),
        execute: async ({ query, requireHighConfidence }) => {
            try {
                const rag = new AgenticRAG({
                    organizationId: agentConfig.organizationId,
                    model: 'gpt-4o-mini',
                    temperature: 0.3,
                    maxTokens: 2000,
                    knowledgeBaseIds: agentConfig.knowledgeBases,
                });

                const result = await rag.execute(query, [], false);

                if (!result.context?.retrievedDocs || result.context.retrievedDocs === 0) {
                    return {
                        success: false,
                        message: 'No relevant information found in knowledge base',
                        confidence: 0,
                    };
                }

                // Check confidence for critical queries
                const confidence = result.context.decision?.confidence || 0.5;
                if (requireHighConfidence && confidence < 0.8) {
                    return {
                        success: false,
                        message: 'Information found but confidence is below required threshold',
                        confidence,
                        partialAnswer: result.text,
                    };
                }

                return {
                    success: true,
                    answer: result.text,
                    confidence,
                    sources: result.context.retrievedDocs,
                    iterations: result.context.iterations,
                    strategy: result.context.decision?.strategy,
                };
            } catch (error) {
                console.error('Agentic knowledge search failed:', error);
                return {
                    success: false,
                    message: 'Failed to search knowledge base',
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        }
    });
}

/**
 * Product Search Tool
 * Searches for products in the organization's catalog
 */
export function createProductSearchTool(organizationId: string) {
    return tool({
        name: "product_search",
        description: `Search for products in the catalog. Use this when customers ask about product availability pricing, features, or specifications.`,
        inputSchema: z.object({
            query: z.string().describe("Search query for products (name, description, or keywords)"),
            category: z.string().optional().describe("Filter by category ID if specified"),
            inStock: z.boolean().optional().describe("If true, only show products that are currently in stock"),
            limit: z.number().default(5).describe("Maximum number of products to return (default: 5)"),
            minPrice: z.number().optional().describe("Minimum price filter"),
            maxPrice: z.number().optional().describe("Maximum price filter"),
        }),
        execute: async ({ query, category, inStock, limit, minPrice, maxPrice }) => {
            try {
                const conditions = [
                    eq(product.organizationId, organizationId),
                    eq(product.isActive, true),
                ];

                if (category) {
                    conditions.push(eq(product.categoryId, category));
                }

                if (inStock) {
                    conditions.push(sql`${product.stock} > 0`);
                }

                if (minPrice !== undefined) {
                    conditions.push(sql`${product.price} >= ${minPrice}`);
                }

                if (maxPrice !== undefined) {
                    conditions.push(sql`${product.price} <= ${maxPrice}`);
                }

                const searchCondition = sql`(
                    ${product.name} ILIKE ${`%${query}%`} OR
                    ${product.description} ILIKE ${`%${query}%`} OR
                    ${product.shortDescription} ILIKE ${`%${query}%`} OR
                    ${product.sku} ILIKE ${`%${query}%`}
                )`;

                const products = await db
                    .select({
                        id: product.id,
                        name: product.name,
                        sku: product.sku,
                        description: product.description,
                        shortDescription: product.shortDescription,
                        price: product.price,
                        compareAtPrice: product.compareAtPrice,
                        currency: product.currency,
                        stock: product.stock,
                        images: product.images,
                        categoryId: product.categoryId,
                        variants: product.variants,
                    })
                    .from(product)
                    .where(and(...conditions, searchCondition))
                    .limit(limit);

                if (products.length === 0) {
                    return {
                        success: true,
                        products: [],
                        message: `No products found matching "${query}".`,
                        count: 0,
                    };
                }

                return {
                    success: true,
                    products: products.map(p => ({
                        ...p,
                        available: p.stock > 0,
                        onSale: p.compareAtPrice && Number(p.price) < Number(p.compareAtPrice),
                    })),
                    count: products.length,
                };
            } catch (error) {
                console.error(`Error searching products: ${error}`);
                return {
                    success: false,
                    error: "Failed to search products",
                    products: [],
                    count: 0,
                };
            }
        }
    })
}

/**
 * Create order tool
 */
export function CreateOrderTool(organizationId: string) {
    return tool({
        name: "order_status",
        description:
            'Check the status of customer orders. Use this when customers ask about their order status, ' +
            'tracking information, or delivery estimates.',
        inputSchema: z.object({
            items: z.array(
                z.object({
                    productId: z.string().describe("Product ID"),
                    quantity: z.number().min(1).describe("Quantity to order"),
                    variantId: z.string().optional().describe("Variant ID if applicable"),
                })
            ).describe("List of products and quantities"),
            customerInfo: z.object({
                name: z.string().describe("Customer full name"),
                email: z.email().optional().describe("Customer email"),
                phone: z.string().optional().describe("Customer phone"),
            }),
            shippingAddress: z.object({
                name: z.string().describe("Recipient name"),
                address1: z.string().describe("Street address line 1"),
                address2: z.string().optional().describe("Street address line 2"),
                city: z.string().describe("City"),
                state: z.string().describe("State/Province"),
                postalCode: z.string().describe("Postal/ZIP code"),
                country: z.string().describe("Country"),
                phone: z.string().optional().describe("Phone number"),
            }),
            platform: z.enum(["whatsapp", "facebook_marketplace", "shopify", "internal"])
                .optional()
                .describe("Platform where the order originated"),
        }),
        execute: async ({ items, customerInfo, shippingAddress, platform }) => {
            try {
                let subtotal = 0;
                const orderItemsData = [];

                for (const item of items) {
                    const productRecord = await db
                        .select({
                            id: product.id,
                            name: product.name,
                            sku: product.sku,
                            price: product.price,
                            stock: product.stock,
                            trackInventory: product.trackInventory,
                            variants: product.variants,
                        })
                        .from(product)
                        .where(
                            and(
                                eq(product.id, item.productId),
                                eq(product.organizationId, organizationId)
                            )
                        )
                        .limit(1)
                        .then(res => res[0]);

                    if (!productRecord) {
                        return {
                            success: false,
                            error: `Product not found: ${item.productId}`,
                        };
                    }

                    let availableStock = productRecord.stock;
                    let unitPrice = Number(productRecord.price);
                    let variantSku = productRecord.sku;
                    let variantName = productRecord.name;

                    // Handle variants
                    if (item.variantId && productRecord.variants) {
                        const variant = productRecord.variants.find((v: any) => v.id === item.variantId);
                        if (variant) {
                            availableStock = variant.stock;
                            unitPrice = variant.price;
                            variantSku = variant.sku;
                            variantName = `${productRecord.name} - ${variant.name}`;
                        }
                    }

                    // Check inventory
                    if (productRecord.trackInventory && availableStock < item.quantity) {
                        return {
                            success: false,
                            error: `Insufficient stock for ${variantName}. Available: ${availableStock}, Requested: ${item.quantity}`,
                        };
                    }

                    const itemSubtotal = unitPrice * item.quantity;
                    subtotal += itemSubtotal;

                    orderItemsData.push({
                        productId: item.productId,
                        productName: variantName,
                        productSku: variantSku,
                        quantity: item.quantity,
                        unitPrice: unitPrice.toString(),
                        subtotal: itemSubtotal.toString(),
                        variantId: item.variantId,
                    });
                }

                // Calculate totals (you may want to customize tax/shipping logic)
                const tax = subtotal * 0.1; // 10% tax example
                const shipping = 5.00; // Fixed shipping example
                const totalAmount = subtotal + tax + shipping;

                const order = await db.insert(orders).values({
                    organizationId,
                    customerName: customerInfo.name,
                    customerEmail: customerInfo.email,
                    customerPhone: customerInfo.phone,
                    platform: platform || 'internal',
                    status: 'pending',
                    paymentStatus: 'pending',
                    subtotal: subtotal.toString(),
                    tax: tax.toString(),
                    shipping: shipping.toString(),
                    totalAmount: totalAmount.toString(),
                    shippingAddress,
                    currency: 'USD',
                }).returning();

                if (!order) {
                    return {
                        success: false,
                        error: 'Failed to create order',
                    };
                }

                for (const item of orderItemsData) {
                    await db.insert(orderItems).values({
                        orderId: order[0].id,
                        ...item,
                    });

                    if (item.quantity > 0) {
                        await db
                            .update(product)
                            .set({
                                stock: sql`${product.stock} - ${item.quantity}`,
                                salesCount: sql`${product.salesCount} + 1`,
                            })
                            .where(eq(product.id, item.productId));
                    }
                }

                return {
                    success: true,
                    orderId: order[0].id,
                    orderNumber: `ORD-${order[0].id.slice(-8).toUpperCase()}`,
                    subtotal,
                    tax,
                    shipping,
                    totalAmount,
                    items: orderItemsData.length,
                    message: 'Order created successfully',
                };
            } catch (error) {
                console.error(`Error creating order: ${error}`);
                return {
                    success: false,
                    error: "Failed to create order",
                };
            }
        }
    })
}

/**
 * Handoff to Human Tool
 * Escalates the conversation to a human agent
 */
export function createHandoffTool(conversationId: string) {
    return tool({
        name: "handoff",
        description:
            'Escalate this conversation to a human agent. Use this when: ' +
            '1. Customer explicitly requests to speak with a human ' +
            '2. The issue is too complex for you to handle ' +
            '3. Customer is frustrated or angry ' +
            '4. You need to make an exception to policy',
        inputSchema: z.object({
            reason: z.string().describe('Reason for escalation'),
            priority: z.enum(['low', 'medium', 'high', 'urgent'])
                .describe('Priority level for human review'),
            summary: z.string().describe('Brief summary of the conversation so far'),
        }),
        execute: async ({ reason, priority, summary }) => {
            try {
                const existingConversation = await db.select().from(conversation)
                    .where(eq(conversation.id, conversationId)).limit(1).then(res => res[0]);

                if (!existingConversation) {
                    return {
                        success: false,
                        error: "Conversation not found",
                    };
                }

                const existingMetadata = existingConversation.metadata || {};

                await db.update(conversation).set({
                    status: 'handed_off',
                    lastMessageAt: new Date(),
                    metadata: {
                        ...existingMetadata,
                        escalation: {
                            reason,
                            priority,
                            summary,
                            escalatedAt: new Date().toISOString(),
                            escalatedBy: 'ai_agent'
                        }
                    },
                }).where(eq(conversation.id, conversationId));

                await db.insert(message).values({
                    conversationId,
                    role: 'system',
                    content: `Conversation escalated to human agent. Priority: ${priority}. A team member will take over shortly.`,
                    type: 'system_alert',
                    metadata: {
                        handoff: {
                            reason,
                            priority,
                            summary,
                            timestamp: new Date().toISOString()
                        }
                    },
                    creditsUsed: 0,
                    createdAt: new Date()
                });

                return {
                    success: true,
                    message: `✅ I've handed this conversation over to a human agent. \n\n**Priority:** ${priority.toUpperCase()} \n**Reason:** ${reason} \n\nA team member will assist you shortly. Thank you for your patience.`,
                    priority: priority,
                    timestamp: new Date().toISOString()
                };
            } catch (error) {
                console.error('Error handing off conversation:', error);
                return {
                    success: false,
                    message: 'I apologize, but I encountered an issue while trying to connect you with a human agent. Please contact support directly or try again in a few moments.',
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
            }
        },
    });
}

/**
 * Check inventory tool
 */
export function CheckInventoryTool(organizationId: string) {
    return tool({
        description: "Check if a product is in stock and has sufficient quantity available. Use this before creating an order or when a customer asks about availability.",
        inputSchema: z.object({
            productId: z.string().describe("The ID of the product to check"),
            quantity: z.number().optional().default(1).describe("Quantity needed (default: 1)"),
        }),
        execute: async ({ productId, quantity }) => {

            try {
                const productRecord = await db
                    .select({
                        id: product.id,
                        name: product.name,
                        stock: product.stock,
                        trackInventory: product.trackInventory,
                        lowStockThreshold: product.lowStockThreshold,
                    })
                    .from(product)
                    .where(
                        and(
                            eq(product.id, productId),
                            eq(product.organizationId, organizationId)
                        )
                    )
                    .limit(1)
                    .then(res => res[0]);

                if (!productRecord) {
                    return {
                        success: false,
                        available: false,
                        message: "Product not found",
                    };
                }

                if (!productRecord.trackInventory) {
                    return {
                        success: true,
                        available: true,
                        productId: productRecord.id,
                        productName: productRecord.name,
                        requestedQuantity: quantity,
                        message: "Product is available (inventory tracking disabled)",
                    };
                }

                const available = productRecord.stock >= quantity;
                const lowStock = productRecord.stock > 0 &&
                    productRecord.stock <= (productRecord.lowStockThreshold || 10);

                return {
                    success: true,
                    available,
                    lowStock,
                    productId: productRecord.id,
                    productName: productRecord.name,
                    requestedQuantity: quantity,
                    availableStock: productRecord.stock,
                    trackInventory: productRecord.trackInventory,
                    message: available
                        ? `Yes, we have ${productRecord.stock} units in stock${lowStock ? ' (low stock)' : ''}`
                        : `Sorry, only ${productRecord.stock} units available (requested ${quantity})`,
                };
            } catch (error) {
                console.error(`Error checking inventory: ${error}`);
                return {
                    success: false,
                    available: false,
                    error: "Failed to check inventory",
                };
            }
        }
    });
}
