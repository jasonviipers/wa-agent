# Quick Reference: Existing Services & What's Ready to Use

## Service Methods Ready to Call

### Shopify Service (`ShopifyService`)
```typescript
import { ShopifyService } from "@/lib/integrations";

const config = {
  accessToken: "...",
  shopDomain: "mystore.myshopify.com",
  apiVersion: "2025-10",
  apiType: "graphql"
};

const shopify = new ShopifyService(config);

// Product Operations
await shopify.getProducts(first, after);           // List products with pagination
await shopify.getProduct(id);                      // Get single product
await shopify.createProduct({title, variants});    // Create product
await shopify.updateProduct(id, {title, status});  // Update product

// Order Operations
await shopify.getOrders(first, after);             // List orders

// Webhooks
await shopify.createWebhook("PRODUCTS_UPDATE", callbackUrl);  // Subscribe
ShopifyService.verifyWebhook(body, hmacHeader, secret);       // Verify
```

### WhatsApp Service (`WhatsAppService`)
```typescript
import { WhatsAppService } from "@/lib/integrations";

const config = {
  accessToken: "...",
  phoneNumberId: "...",
  businessAccountId: "...",
  webhookVerifyToken: "..."
};

const whatsapp = new WhatsAppService(config);

// Messages
await whatsapp.sendTextMessage(to, text);
await whatsapp.sendTemplateMessage(to, templateName, languageCode);
await whatsapp.sendProductMessage(to, catalogId, productId, bodyText);
await whatsapp.sendProductListMessage(to, catalogId, headerText, sections);
await whatsapp.sendImage(to, imageUrl, caption);
await whatsapp.sendVideo(to, videoUrl, caption);

// Profile
await whatsapp.getBusinessProfile();
await whatsapp.updateBusinessProfile({about, address});

// Media
await whatsapp.uploadMedia(fileUrl, mimeType);
await whatsapp.markAsRead(messageId);

// Webhooks
WhatsAppService.verifyWebhook(payload, signature, appSecret);
```

### Facebook Service (`FacebookMarketplaceService`)
```typescript
import { FacebookMarketplaceService } from "@/lib/integrations";

const config = {
  accessToken: "...",
  pageId: "...",
  catalogId: "...",
  businessId: "..."
};

const facebook = new FacebookMarketplaceService(config);

// Products
await facebook.upsertProducts(products[]);         // Batch update
await facebook.getProduct(retailerId);
await facebook.getProducts(limit, after);
await facebook.deleteProduct(retailerId);
await facebook.getCatalog();

// Orders
await facebook.getOrders(limit);
await facebook.updateOrderStatus(orderId, status, tracking);

// Messaging
await facebook.sendMessage(recipientId, "text or object");
await facebook.sendProductMessage(recipientId, productIds[]);
await facebook.sendTypingIndicator(recipientId, "typing_on");
await facebook.getPageInfo();

// Webhooks
FacebookMarketplaceService.verifyWebhook(payload, signature, appSecret);
```

## Utility Functions Ready to Use

```typescript
import {
  formatCurrency,
  parsePhoneNumber,
  validateWebhookSignature,
  RateLimiter,
  retryWithBackoff,
  chunk,
  sleep,
  sanitizeForUrl,
  createPaginationCursor,
  parsePaginationCursor,
  calculateChecksum,
  safeJsonParse,
  truncate,
  deepMerge,
  WebhookVerification
} from "@/lib/integrations";

// Formatting
formatCurrency(1999.99, "USD");              // "$1,999.99"
parsePhoneNumber("555-1234", "1");           // "+15551234"

// Webhook Verification
validateWebhookSignature(payload, sig, secret, "sha256");
WebhookVerification.shopify(body, hmac, secret);
WebhookVerification.whatsapp(payload, sig, secret);
WebhookVerification.facebook(payload, sig, secret);

// Rate Limiting
const limiter = new RateLimiter(100, 60000); // 100 requests per 60s
if (limiter.isAllowed("user-123")) { /* ... */ }
limiter.getRemaining("user-123");

// Retries
await retryWithBackoff(async () => shopify.getProducts(), 3, 1000);

// Utilities
chunk([1,2,3,4,5], 2);                       // [[1,2], [3,4], [5]]
await sleep(1000);
sanitizeForUrl("My Product Name");            // "my-product-name"
createPaginationCursor({after: "xyz"});       // base64 encoded
parsePaginationCursor(cursor);                // {after: "xyz"}
calculateChecksum("data");                    // SHA256 hash
safeJsonParse('{"a":1}', {});                 // Safe parsing
truncate("Long text", 10);                    // "Long te..."
deepMerge({a: 1}, {b: 2});                    // {a: 1, b: 2}
```

## Factory Pattern

```typescript
import { createIntegrationService } from "@/lib/integrations";

// Create service from platform name and config
const service = createIntegrationService("shopify", config);
// Returns ShopifyService | WhatsAppService | FacebookMarketplaceService

// Get all three verification functions
const isValid = {
  shopify: WebhookVerification.shopify(body, hmac, secret),
  whatsapp: WebhookVerification.whatsapp(payload, sig, secret),
  facebook: WebhookVerification.facebook(payload, sig, secret)
};
```

## Database Access Pattern

```typescript
import { db, eq, and } from "@wagents/db";
import { 
  integration, 
  product, 
  orders, 
  orderItems,
  webhook,
  syncLog 
} from "@wagents/db/schema";

// Fetch integration
const shopifyIntegration = await db
  .select()
  .from(integration)
  .where(and(
    eq(integration.platform, "shopify"),
    eq(integration.organizationId, orgId)
  ))
  .limit(1);

// Fetch products
const products = await db
  .select()
  .from(product)
  .where(eq(product.organizationId, orgId));

// Update product
await db
  .update(product)
  .set({
    stock: 100,
    updatedAt: new Date(),
    platformSync: {
      shopify: {
        synced: true,
        productId: "gid://shopify/Product/123",
        lastSyncAt: new Date().toISOString()
      }
    }
  })
  .where(eq(product.id, productId));

// Create sync log entry
await db
  .insert(syncLog)
  .values({
    integrationId,
    entityType: "product",
    entityId: productId,
    action: "update",
    status: "success"
  });
```

## Type Exports Available

```typescript
// Shopify Types
import type {
  ShopifyProduct,
  ShopifyVariant,
  ShopifyImage,
  ShopifyOrder,
  ShopifyLineItem,
  ShopifyCustomer,
  ShopifyAddress
} from "@/lib/integrations";

// WhatsApp Types
import type {
  WhatsAppMessage,
  WhatsAppTemplate,
  WhatsAppInteractive,
  WhatsAppAction,
  WhatsAppWebhookMessage,
  WhatsAppProduct
} from "@/lib/integrations";

// Facebook Types
import type {
  FacebookProduct,
  FacebookCatalog,
  FacebookOrder,
  FacebookMessengerMessage,
  FacebookProductTemplate
} from "@/lib/integrations";

// Integration Config Types (for validation)
import {
  IntegrationConfigShopify,
  IntegrationConfigFacebook,
  IntegrationConfigWhatsApp,
  IntegrationConfig
} from "@wagents/db/schema/integration";

type MyConfig = typeof IntegrationConfigShopify._output;
```

## Database Schema Types

```typescript
import { NewProduct, NewOrder, NewOrderItem } from "@wagents/db/schema";

// Insert a product
const newProduct: NewProduct = {
  sku: "ABC123",
  name: "Product Name",
  price: "99.99",
  currency: "USD",
  stock: 100
};
await db.insert(product).values(newProduct);

// Insert an order
const newOrder: NewOrder = {
  customerId: "cust-123",
  totalAmount: "99.99",
  subtotal: "99.99",
  status: "pending",
  paymentStatus: "pending"
};
const [createdOrder] = await db
  .insert(orders)
  .values(newOrder)
  .returning();
```

## Common Integration Workflows

### 1. Connect a Shopify Store
```typescript
// 1. User clicks "Connect Shopify"
// 2. Redirect to OAuth URL
// 3. User grants permissions
// 4. Get auth code, exchange for token
// 5. Store in database

const config = IntegrationConfigShopify.parse({
  accessToken: token,
  shopDomain: shop,
  apiVersion: "2025-10"
});

await db.insert(integration).values({
  platform: "shopify",
  status: "connected",
  organizationId: orgId,
  config,
  displayName: `${shop} Store`
});
```

### 2. Fetch All Products from Shopify
```typescript
const integration = await db.query.integration.findFirst({
  where: eq(integration.id, integrationId)
});

const shopify = new ShopifyService(integration.config);
let after = null;

do {
  const { products, pageInfo } = await shopify.getProducts(50, after);
  
  // Insert/update products
  for (const shopifyProduct of products) {
    await db
      .insert(product)
      .values({
        organizationId,
        sku: shopifyProduct.handle,
        name: shopifyProduct.title,
        // ... other fields
        platformSync: {
          shopify: {
            synced: true,
            productId: shopifyProduct.id,
            lastSyncAt: new Date().toISOString()
          }
        }
      })
      .onConflictDoUpdate({
        target: [product.sku],
        set: { updatedAt: new Date() }
      });
  }
  
  after = pageInfo.endCursor;
} while (pageInfo.hasNextPage);

// Update sync status
await db
  .update(integration)
  .set({
    lastSyncAt: new Date(),
    syncStatus: "idle"
  })
  .where(eq(integration.id, integrationId));
```

### 3. Handle Shopify Webhook
```typescript
// In POST /api/webhooks/shopify
import { WebhookVerification } from "@/lib/integrations";

const signature = request.headers.get("X-Shopify-Hmac-SHA256");
const body = await request.text();

// Verify
const isValid = WebhookVerification.shopify(
  body,
  signature,
  integration.config.webhookSecret
);

if (!isValid) {
  return new Response("Unauthorized", { status: 401 });
}

// Parse
const payload = JSON.parse(body);

if (payload.title) {
  // Product update
  await db
    .update(product)
    .set({
      name: payload.title,
      updatedAt: new Date(),
      platformSync: {
        shopify: {
          synced: true,
          productId: payload.id,
          lastSyncAt: new Date().toISOString()
        }
      }
    })
    .where(
      and(
        eq(product.organizationId, orgId),
        eq(product.platformSync + "->shopify->productId", payload.id)
      )
    );

  // Log
  await db.insert(syncLog).values({
    integrationId,
    entityType: "product",
    entityId: payload.id,
    action: "update",
    status: "success"
  });
}

return new Response("OK");
```

---

## Summary of Build Status

| Component | Status | File |
|-----------|--------|------|
| **ShopifyService** | ✓ Complete | `/apps/web/src/lib/integrations/shopify.ts` |
| **WhatsAppService** | ✓ Complete | `/apps/web/src/lib/integrations/whatsapp.ts` |
| **FacebookService** | ✓ Complete | `/apps/web/src/lib/integrations/facebook-marketplace.ts` |
| **Utilities** | ✓ Complete | `/apps/web/src/lib/integrations/utils.ts` |
| **Factory Pattern** | ✓ Complete | `/apps/web/src/lib/integrations/index.ts` |
| **Database Schemas** | ✓ Complete | `/packages/db/src/schema/*` |
| **Integration Config Zod** | ✓ Complete | `/packages/db/src/schema/integration.ts` |
| **Sync Orchestration** | ✗ Missing | - |
| **Webhook Handlers** | ✗ Missing | - |
| **OAuth Flow** | ✗ Missing | - |
| **API Routes** | ✗ Missing | - |
| **Background Jobs** | ✗ Missing | - |
| **UI Components** | ✗ Missing | - |

