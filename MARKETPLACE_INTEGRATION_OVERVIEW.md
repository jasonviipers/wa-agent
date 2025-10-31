# Marketplace Integration Architecture Overview

## Project Structure

**Repository**: wagents (AI Agent Platform)
**Current Branch**: claude/shopify-product-sync-011CUg7YFQ6aQ8yLv41SK4uE
**Recent Integration Commit**: `088bb93` - feat(integrations): add marketplace integration services

### Directory Structure:
```
/home/user/wa-agent/
├── apps/
│   └── web/                          # Next.js frontend + API routes
│       └── src/
│           ├── app/
│           │   ├── api/              # Backend API routes
│           │   ├── workspace/        # Main app UI
│           │   └── (auth)/           # Auth pages
│           └── lib/
│               ├── integrations/     # Integration services (NEW)
│               ├── ai/               # AI agent logic
│               ├── actions/          # Server actions
│               └── *.ts              # Utilities & helpers
└── packages/
    ├── db/                           # Database layer
    │   └── src/
    │       └── schema/               # Database schemas
    └── auth/                         # Authentication
```

---

## 1. EXISTING DATABASE MODELS & SCHEMAS

Location: `/home/user/wa-agent/packages/db/src/schema/`

### A. Integration Schema (`integration.ts`)
**Database Table**: `integration`

**Key Features**:
- Platform Enum: `shopify`, `facebook_marketplace`, `tiktok_shop`, `amazon`, `whatsapp`, `internal`
- Status Enum: `connected`, `disconnected`, `error`, `pending`, `syncing`, `needs_reauth`

**Fields**:
- `id`: Primary key (CUID2)
- `platform`: Integration platform type
- `status`: Current connection status
- `userId`, `organizationId`: Owner references
- `agentId`: Optional linked agent
- `displayName`: User-friendly name
- `config`: JSONB storing platform-specific config (Zod-validated)

**Sync Management Fields**:
- `lastSyncAt`: Timestamp of last successful sync
- `syncStatus`: `'idle'`, `'in_progress'`, `'failed'`
- `syncCursor`: JSONB cursor for pagination
- `syncError`: Error message if sync failed

**Rate Limiting Fields**:
- `rateLimitRemaining`: Current available requests
- `rateLimitResetAt`: When rate limit resets

**Platform Config Types** (Zod schemas):
- **Shopify**: accessToken, shopDomain, apiVersion, apiType (REST/GraphQL), scopes, webhookSecret
- **Facebook**: accessToken, pageId, catalogId, businessId, apiVersion, permissions
- **WhatsApp**: accessToken, phoneNumberId, businessAccountId, webhookVerifyToken, catalogId, shoppingCartEnabled

### B. Product Schema (`product.ts`)
**Database Table**: `product`

**Key Features**:
- Inventory tracking
- Multi-platform sync status
- Variants and attributes support
- SEO metadata

**Platform Sync Tracking** (JSONB):
```json
{
  "shopify": { "synced": boolean, "productId": string, "lastSyncAt": string },
  "whatsapp": { "synced": boolean, "catalogId": string, "lastSyncAt": string },
  "facebook": { "synced": boolean, "productId": string, "lastSyncAt": string },
  "tiktok": { "synced": boolean, "productId": string, "lastSyncAt": string },
  "amazon": { "synced": boolean, "asin": string, "lastSyncAt": string },
  "instagram": { "synced": boolean, "productId": string, "lastSyncAt": string }
}
```

**Product Fields**:
- `sku`, `name`, `description`, `shortDescription`
- `price`, `compareAtPrice`, `cost`, `currency`
- `stock`, `lowStockThreshold`, `trackInventory`
- `images[]`, `videoUrl`
- `variants[]` - Array with price, stock, attributes
- `attributes` - JSONB for custom attributes
- `categoryId` - Reference to product category
- `isActive`, `isFeatured`
- `viewCount`, `salesCount` - Metrics

### C. Product Category Schema (`product.ts`)
**Database Table**: `product_category`

- `organizationId`
- `name`, `description`
- `parentId` - For hierarchical categories
- `slug`, `imageUrl`
- `sortOrder`

### D. Order Schema (`order.ts`)
**Database Tables**: `orders`, `order_items`

**Order Fields**:
- `organizationId`, `conversationId`, `customerId`
- `status`: `pending`, `processing`, `shipped`, `delivered`, `cancelled`, `refunded`
- `platform`: Origin platform
- `platformOrderId`, `platformOrderNumber`
- `paymentStatus`: `pending`, `paid`, `failed`, `refunded`
- `paymentMethod`
- Amounts: `subtotal`, `tax`, `shipping`, `discount`, `totalAmount`, `currency`
- Shipping/Billing addresses (JSONB)
- `fulfillmentStatus`, `trackingNumber`, `carrier`
- `metadata` - JSONB for platform-specific data

**Order Items** (linked to orders table):
- `orderId` (FK)
- `productId` (FK)
- `variantId`, `productName`, `productSku`
- `quantity`, `unitPrice`, `subtotal`, `tax`, `discount`

### E. Webhook Schema (`webhook.ts`)
**Database Tables**: `webhook`, `sync_log`

**Webhook Table**:
- `organizationId`
- `platform`: Platform enum
- `webhookUrl`, `secret`
- `events[]`: JSONB array of subscribed events
- `isActive`
- `lastTriggered`

**Sync Log Table** (audit trail):
- `integrationId` (FK)
- `entityType`: `'product'`, `'order'`, `'inventory'`
- `entityId`
- `action`: `'create'`, `'update'`, `'delete'`
- `status`: `'success'`, `'failed'`, `'pending'`
- `errorMessage`
- `metadata` - JSONB

### F. Conversation Schema (`conversation.ts`)
**Database Table**: `conversation`

**Key Fields** (relevant to integrations):
- `platform`: Platform enum
- `platformConversationId`
- `customerId`, `customerEmail`, `customerPhone`, `customerName`
- `agentId` (FK)
- `status`: `active`, `closed`, `handed_off`
- `metadata` - JSONB (escalation, assignment, resolution info)

**Messages Table** (`message`):
- `type`: `text`, `image`, `audio`, `video`, `file`, `product`, `order`
- `platformMessageId`
- `metadata` - JSONB with products[], orderId, intent, confidence, toolCalls[]

### G. Agent Schema (`agent.ts`) - Referenced but not detailed here
- Agents can have linked integrations
- Used with tool definitions and agent tools

---

## 2. MARKETPLACE INTEGRATION SERVICES

Location: `/home/user/wa-agent/apps/web/src/lib/integrations/`

### Overview
Three complete integration service classes built using the **Vercel AI SDK** pattern:
- **ShopifyService** (488 lines)
- **WhatsAppService** (434 lines)
- **FacebookMarketplaceService** (483 lines)

Each service is a class that accepts config in constructor and exposes methods as async functions.

### A. Shopify Integration (`shopify.ts`)

**API Details**:
- Protocol: GraphQL Admin API (REST is legacy as of Oct 1, 2024)
- API Version: `2025-10`
- Base URL: `https://{shopDomain}/admin/api/{apiVersion}/graphql.json`
- Authentication: Bearer token (`X-Shopify-Access-Token` header)

**Core Methods**:

1. **Product Operations**:
   - `getProducts(first?, after?)` - Paginated products with cursor
   - `getProduct(id)` - Single product details
   - `createProduct(input)` - Create new product
   - `updateProduct(id, input)` - Update product metadata

2. **Order Operations**:
   - `getOrders(first?, after?)` - Paginated orders
   - Includes line items, customer, shipping address

3. **Webhook Management**:
   - `createWebhook(topic, callbackUrl)` - Subscribe to events
   - `static verifyWebhook(body, hmacHeader, secret)` - HMAC-SHA256 verification

**Data Types**:
- ShopifyProduct, ShopifyVariant, ShopifyImage
- ShopifyOrder, ShopifyLineItem, ShopifyCustomer, ShopifyAddress

**Scopes Required**:
```
read_products, write_products, read_orders, write_orders,
read_customers, read_inventory, read_fulfillments, write_fulfillments
```

### B. WhatsApp Integration (`whatsapp.ts`)

**API Details**:
- Protocol: WhatsApp Business Cloud API
- API Version: `v21.0`
- Base URL: `https://graph.facebook.com/{apiVersion}`
- Authentication: Bearer token (`Authorization` header)

**Core Methods**:

1. **Message Sending**:
   - `sendTextMessage(to, text, previewUrl)` - Plain text
   - `sendTemplateMessage(to, templateName, languageCode, components)` - Pre-approved templates
   - `sendInteractiveMessage(to, interactive)` - Buttons, lists, products
   - `sendProductMessage(to, catalogId, productId, bodyText)` - Single product
   - `sendProductListMessage(to, catalogId, headerText, sections)` - Multiple products
   - `sendImage(to, imageUrl, caption)`
   - `sendVideo(to, videoUrl, caption)`
   - `sendDocument(to, documentUrl, filename)`

2. **Message Management**:
   - `markAsRead(messageId)` - Mark message as read

3. **Business Profile**:
   - `getBusinessProfile()` - Get profile info
   - `updateBusinessProfile(updates)` - Update profile

4. **Media**:
   - `uploadMedia(fileUrl, mimeType)` - Upload media

5. **Webhook Verification**:
   - `static verifyWebhook(payload, signature, appSecret)` - HMAC-SHA256

**Data Types**:
- WhatsAppMessage, WhatsAppTemplate, WhatsAppInteractive
- WhatsAppWebhookMessage (incoming webhooks)
- WhatsAppProduct

**Supported Message Types**:
- text, template, interactive, image, video, document, audio, location, contacts

### C. Facebook Marketplace Integration (`facebook-marketplace.ts`)

**API Details**:
- Protocol: Facebook Graph API
- API Version: `v21.0`
- Base URL: `https://graph.facebook.com/{apiVersion}`
- Authentication: Bearer token (`Authorization` header)

**Core Methods**:

1. **Product Catalog Management**:
   - `upsertProducts(products[])` - Batch create/update via Catalog Batch API
   - `getProduct(retailerId)` - Single product by retailer ID
   - `getProducts(limit?, after?)` - Paginated products
   - `deleteProduct(retailerId)` - Remove product
   - `getCatalog()` - Get catalog info

2. **Order Management**:
   - `getOrders(limit?)` - Get commerce orders
   - `updateOrderStatus(orderId, status, tracking?)` - Update order state

3. **Messenger Integration**:
   - `sendMessage(recipientId, message|text)` - Send message
   - `sendProductMessage(recipientId, productIds[])` - Product template
   - `sendTypingIndicator(recipientId, action)` - Typing, seen indicators

4. **Page Info**:
   - `getPageInfo()` - Get page metadata

5. **Webhook Verification**:
   - `static verifyWebhook(payload, signature, appSecret)` - HMAC-SHA256

**Data Types**:
- FacebookProduct (with extensive fields: condition, sale_price, inventory, custom_data, etc.)
- FacebookCatalog, FacebookOrder, FacebookMessengerMessage, FacebookProductTemplate

**Supported Fields**:
- Condition: new, refurbished, used, used_like_new, used_good, used_fair, cpo
- Availability: in stock, out of stock, preorder, available for order, discontinued

---

## 3. INTEGRATION UTILITIES & HELPERS

Location: `/home/user/wa-agent/apps/web/src/lib/integrations/utils.ts`

### Utility Functions:
1. **Currency Formatting**: `formatCurrency(amount, currency)` - Intl.NumberFormat
2. **Phone Number**: `parsePhoneNumber(phone, countryCode)` - E.164 normalization
3. **Webhook Signature**: `validateWebhookSignature(payload, signature, secret, algorithm)`
4. **Rate Limiting**: `RateLimiter` class - Token bucket pattern
5. **Retry Logic**: `retryWithBackoff(fn, maxRetries, initialDelayMs)` - Exponential backoff
6. **Array Utilities**: `chunk(array, size)` - Chunk large arrays
7. **Async**: `sleep(ms)` - Promise-based delay
8. **String**: `sanitizeForUrl(str)` - Safe URL slugs
9. **Pagination**: `createPaginationCursor()`, `parsePaginationCursor()`
10. **Checksum**: `calculateChecksum(data)` - SHA256
11. **JSON**: `safeJsonParse(json, fallback)` - Error-safe parsing
12. **String**: `truncate(str, maxLength)` - Ellipsis truncation
13. **Objects**: `deepMerge(target, source)` - Recursive merge

### Index & Factory (`index.ts`):
```typescript
export function createIntegrationService(platform: string, config: any) {
  // Factory pattern to instantiate service
}

export const WebhookVerification = {
  shopify: (body, hmac, secret) => ShopifyService.verifyWebhook(...),
  whatsapp: (payload, signature, secret) => WhatsAppService.verifyWebhook(...),
  facebook: (payload, signature, secret) => FacebookMarketplaceService.verifyWebhook(...),
};
```

---

## 4. API ROUTES & ENDPOINTS

**Status**: Minimal - Only authentication routes exist currently

**Existing Routes**:
- `/api/auth/[...all]` - Better Auth authentication (OAuth, sessions, etc.)

**Missing/Needs to be Built**:
- `/api/integrations` - CRUD for integrations
- `/api/integrations/[id]/connect` - OAuth flow
- `/api/integrations/[id]/disconnect` - Revoke auth
- `/api/webhooks/shopify` - Shopify webhook handler
- `/api/webhooks/whatsapp` - WhatsApp webhook handler
- `/api/webhooks/facebook` - Facebook webhook handler
- `/api/products` - Product CRUD
- `/api/orders` - Order CRUD
- `/api/sync` - Trigger/manage sync operations

---

## 5. SYNC & WEBHOOK MECHANISMS

### Current State: **FOUNDATION BUILT, ORCHESTRATION MISSING**

**What Exists**:
1. **Database Schema for Tracking**:
   - `integration.lastSyncAt`, `syncStatus`, `syncCursor`, `syncError`
   - `product.platformSync` - Track per-platform sync status
   - `webhook` table for storing webhook subscriptions
   - `syncLog` table for audit trail

2. **Integration Services**: Full API clients ready to call

3. **Utility Functions**: Rate limiting, retry logic, pagination helpers

**What's Missing**:
1. **Sync Orchestration Service** - No service to:
   - Schedule periodic syncs
   - Fetch products from platforms
   - Update product table with platform data
   - Handle partial failures
   - Manage sync cursors

2. **Webhook Handlers** - No API routes to:
   - Receive and verify webhook signatures
   - Parse platform-specific payloads
   - Update database on product/order changes
   - Handle rate limiting during peak times
   - Retry failed updates

3. **Error Handling & Resilience** - No:
   - Circuit breaker for API failures
   - Dead letter queue for failed syncs
   - Automatic backoff strategies per platform
   - Error notification system

4. **Inventory Sync** - No implementation for:
   - Real-time inventory updates
   - Stock reservation logic
   - Overselling prevention

---

## 6. ARCHITECTURE PATTERNS USED

### A. Database Layer (Drizzle ORM)
```typescript
// Direct Drizzle imports from @wagents/db
import { db, eq, and, sql } from "@wagents/db";
import { product, orders, integration } from "@wagents/db/schema";

// Usage pattern
const products = await db
  .select()
  .from(product)
  .where(eq(product.organizationId, orgId));
```

### B. Service Instantiation Pattern (Factory)
```typescript
import { createIntegrationService } from "@/lib/integrations";

const integration = await db.query.integration.findFirst(...);
const service = createIntegrationService(integration.platform, integration.config);
const products = await service.getProducts();
```

### C. Verification Pattern (Shared Utilities)
```typescript
import { WebhookVerification } from "@/lib/integrations";

const isValid = WebhookVerification.shopify(body, hmacHeader, secret);
```

### D. Error Handling (Try-Catch with User Errors)
```typescript
try {
  await shopifyService.getProducts();
} catch (error) {
  if (error.status >= 400 && error.status < 500) {
    // Client error - don't retry
    throw error;
  }
  // Server error - retry with backoff
}
```

### E. Configuration Management (Zod Validation)
```typescript
const config = IntegrationConfigShopify.parse(rawConfig);
const service = new ShopifyService(config);
```

---

## 7. AGENT INTEGRATION

Location: `/home/user/wa-agent/apps/web/src/lib/ai/agent/`

**Agent Tools** (from `tools/core.ts`):
- `search_knowledge` - Search knowledge bases
- `product_search` - Search products in catalog (filters by stock, price, category)
- *(More tools likely exist in tools directory)*

**Tool Pattern**:
Uses Vercel AI SDK `tool()` function with Zod schemas for input validation.

**Agent Capabilities**:
- Can search products via `product_search` tool
- Agent receives organization ID and knowledge base IDs
- Can access product metadata, pricing, availability

---

## 8. TECH STACK SUMMARY

| Component | Technology | Version |
|-----------|-----------|---------|
| **Frontend** | Next.js | 16.0.0 |
| **Runtime** | Node.js (Bun) | 1.3.1 |
| **Language** | TypeScript | 5.8.2+ |
| **Styling** | Tailwind CSS | 4.1.16 |
| **ORM** | Drizzle ORM | 0.44.6 |
| **Database** | PostgreSQL | (via connection string) |
| **Auth** | Better Auth | 1.3.13 |
| **AI** | Vercel AI SDK | 5.0.83+ |
| **Monorepo** | Turborepo | 2.5.8 |
| **Validation** | Zod | 4.1.12 |
| **Serialization** | SuperJSON | 2.2.3 |
| **UI Components** | Radix UI + shadcn/ui | - |

---

## 9. WHAT EXISTS vs. WHAT NEEDS TO BE BUILT

### Exists ✓

1. **Database Schemas**:
   - Integration table with full config
   - Product/Category tables with platform sync tracking
   - Order/OrderItem tables
   - Webhook and sync_log tables
   - Conversation/Message tables

2. **Integration Services**:
   - ShopifyService (full-featured)
   - WhatsAppService (full-featured)
   - FacebookMarketplaceService (full-featured)
   - Webhook verification for all three

3. **Utilities**:
   - Rate limiting
   - Retry with backoff
   - Pagination helpers
   - Currency/phone formatting
   - Webhook validation

4. **Agent Tools**:
   - Product search integration
   - Knowledge base search

### Needs to be Built ✗

1. **Sync Orchestration** (HIGH PRIORITY):
   - Sync manager service
   - Scheduled/triggered sync jobs
   - Cursor management for pagination
   - Error handling and recovery
   - Progress tracking

2. **API Routes**:
   - Integration CRUD endpoints
   - OAuth flow endpoints
   - Webhook receiver endpoints
   - Product CRUD endpoints
   - Order CRUD endpoints
   - Sync trigger endpoints

3. **Webhook Handlers**:
   - Request signature verification
   - Payload parsing
   - Database updates
   - Event processing queue

4. **Background Jobs**:
   - Periodic product sync
   - Inventory sync
   - Order status updates
   - Webhook retry logic

5. **Error Handling**:
   - Circuit breaker pattern
   - Exponential backoff per platform
   - Dead letter queue
   - Error notifications

6. **UI Components**:
   - Integration setup forms
   - Sync status dashboard
   - Error logs/monitoring
   - Product management
   - Order management

7. **Testing**:
   - Unit tests for services
   - Integration tests for API routes
   - Webhook handler tests
   - Sync orchestration tests

---

## 10. DEPLOYMENT CONSIDERATIONS

1. **Environment Variables Required**:
   - `DATABASE_URL` - PostgreSQL connection
   - Shopify: `SHOPIFY_OAUTH_APP_ID`, `SHOPIFY_OAUTH_APP_SECRET`
   - WhatsApp: `WHATSAPP_APP_ID`, `WHATSAPP_APP_SECRET`
   - Facebook: `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`

2. **API Callback URLs**:
   - Webhook endpoints need public HTTPS URLs
   - OAuth redirects must be whitelisted on platforms

3. **Rate Limiting**:
   - Shopify: 2 API calls/second (typical)
   - WhatsApp: 80 API calls/second
   - Facebook: varies by endpoint

4. **Database Migrations**:
   - Use Drizzle migrations for schema changes
   - Commands: `db:push`, `db:migrate`, `db:generate`

---

## 11. FILE REFERENCE GUIDE

| Feature | File Path |
|---------|-----------|
| **Shopify Service** | `/home/user/wa-agent/apps/web/src/lib/integrations/shopify.ts` |
| **WhatsApp Service** | `/home/user/wa-agent/apps/web/src/lib/integrations/whatsapp.ts` |
| **Facebook Service** | `/home/user/wa-agent/apps/web/src/lib/integrations/facebook-marketplace.ts` |
| **Integration Utils** | `/home/user/wa-agent/apps/web/src/lib/integrations/utils.ts` |
| **Integration Index** | `/home/user/wa-agent/apps/web/src/lib/integrations/index.ts` |
| **Integration Schema** | `/home/user/wa-agent/packages/db/src/schema/integration.ts` |
| **Product Schema** | `/home/user/wa-agent/packages/db/src/schema/product.ts` |
| **Order Schema** | `/home/user/wa-agent/packages/db/src/schema/order.ts` |
| **Webhook Schema** | `/home/user/wa-agent/packages/db/src/schema/webhook.ts` |
| **Conversation Schema** | `/home/user/wa-agent/packages/db/src/schema/conversation.ts` |
| **Agent Tools** | `/home/user/wa-agent/apps/web/src/lib/ai/agent/tools/core.ts` |

