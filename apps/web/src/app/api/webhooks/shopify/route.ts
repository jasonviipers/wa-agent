import { NextRequest, NextResponse } from "next/server";
import { db, eq, and } from "@wagents/db";
import { integration } from "@wagents/db/schema/integration";
import { product } from "@wagents/db/schema/product";
import { orders } from "@wagents/db/schema/order";
import crypto from "crypto";

/**
 * Verify Shopify webhook signature
 */
function verifyShopifyWebhook(body: string, hmacHeader: string, secret: string): boolean {
    const hash = crypto
        .createHmac('sha256', secret)
        .update(body, 'utf8')
        .digest('base64');
    return hash === hmacHeader;
}

/**
 * POST /api/webhooks/shopify
 * Shopify webhook handler for products, orders, etc.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.text();
        const hmacHeader = request.headers.get('X-Shopify-Hmac-Sha256');
        const topic = request.headers.get('X-Shopify-Topic');
        const shopDomain = request.headers.get('X-Shopify-Shop-Domain');

        if (!hmacHeader || !topic || !shopDomain) {
            return NextResponse.json({ error: 'Missing required headers' }, { status: 400 });
        }

        // Find integration for this shop
        const integrations = await db
            .select()
            .from(integration)
            .where(
                and(
                    eq(integration.platform, 'shopify'),
                    eq(integration.isActive, true)
                )
            );

        const matchingIntegration = integrations.find(
            (int: any) => int.credentials.shopDomain === shopDomain
        );

        if (!matchingIntegration) {
            console.error('No matching Shopify integration found for shop:', shopDomain);
            return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
        }

        // Verify webhook signature
        const webhookSecret = matchingIntegration.credentials.webhookSecret || process.env.SHOPIFY_WEBHOOK_SECRET;
        if (!verifyShopifyWebhook(body, hmacHeader, webhookSecret)) {
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }

        const data = JSON.parse(body);

        // Handle different webhook topics
        switch (topic) {
            case 'products/create':
            case 'products/update': {
                // Sync product to database
                await db.insert(product).values({
                    organizationId: matchingIntegration.organizationId,
                    name: data.title,
                    description: data.body_html,
                    sku: data.variants[0]?.sku || `SHOPIFY-${data.id}`,
                    price: parseFloat(data.variants[0]?.price || '0'),
                    compareAtPrice: data.variants[0]?.compare_at_price
                        ? parseFloat(data.variants[0].compare_at_price)
                        : null,
                    currency: 'USD',
                    inventoryQuantity: data.variants[0]?.inventory_quantity || 0,
                    inventoryTracking: data.variants[0]?.inventory_management === 'shopify',
                    images: data.images?.map((img: any) => img.src) || [],
                    status: data.status === 'active' ? 'active' : 'draft',
                    platformSyncStatus: {
                        shopify: 'synced',
                    },
                    platformIds: {
                        shopify: data.id.toString(),
                    },
                    metadata: {
                        shopifyData: data,
                    },
                }).onConflictDoUpdate({
                    target: [product.organizationId, product.sku],
                    set: {
                        name: data.title,
                        description: data.body_html,
                        price: parseFloat(data.variants[0]?.price || '0'),
                        inventoryQuantity: data.variants[0]?.inventory_quantity || 0,
                        updatedAt: new Date(),
                    },
                });
                break;
            }

            case 'products/delete': {
                // Mark product as deleted
                await db
                    .update(product)
                    .set({ status: 'archived', updatedAt: new Date() })
                    .where(
                        and(
                            eq(product.organizationId, matchingIntegration.organizationId),
                            eq(product.platformIds, { shopify: data.id.toString() })
                        )
                    );
                break;
            }

            case 'orders/create':
            case 'orders/updated': {
                // Sync order to database
                await db.insert(orders).values({
                    organizationId: matchingIntegration.organizationId,
                    customerId: data.customer?.id?.toString(),
                    customerName: `${data.customer?.first_name || ''} ${data.customer?.last_name || ''}`.trim(),
                    customerEmail: data.customer?.email,
                    customerPhone: data.customer?.phone,
                    status: data.fulfillment_status === 'fulfilled' ? 'delivered' : 'processing',
                    paymentStatus: data.financial_status === 'paid' ? 'paid' : 'pending',
                    subtotal: parseFloat(data.subtotal_price || '0'),
                    tax: parseFloat(data.total_tax || '0'),
                    shipping: parseFloat(data.total_shipping_price_set?.shop_money?.amount || '0'),
                    total: parseFloat(data.total_price || '0'),
                    currency: data.currency,
                    platform: 'shopify',
                    platformOrderId: data.id.toString(),
                    shippingAddress: data.shipping_address ? {
                        firstName: data.shipping_address.first_name,
                        lastName: data.shipping_address.last_name,
                        address1: data.shipping_address.address1,
                        address2: data.shipping_address.address2,
                        city: data.shipping_address.city,
                        province: data.shipping_address.province,
                        country: data.shipping_address.country,
                        zip: data.shipping_address.zip,
                        phone: data.shipping_address.phone,
                    } : undefined,
                    metadata: {
                        shopifyData: data,
                    },
                }).onConflictDoUpdate({
                    target: [orders.platformOrderId],
                    set: {
                        status: data.fulfillment_status === 'fulfilled' ? 'delivered' : 'processing',
                        paymentStatus: data.financial_status === 'paid' ? 'paid' : 'pending',
                        updatedAt: new Date(),
                    },
                });
                break;
            }

            default:
                console.log('Unhandled Shopify webhook topic:', topic);
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Shopify webhook error:', error);
        return NextResponse.json(
            { error: error.message || 'Webhook processing failed' },
            { status: 500 }
        );
    }
}
