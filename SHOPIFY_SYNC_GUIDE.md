# Shopify Bi-Directional Product Sync - Implementation Guide

## Overview

This implementation provides **bi-directional product and order sync** between your platform and Shopify. Products and orders can be synced in both directions:

- **Platform → Shopify**: Create or update products on Shopify when they're modified on your platform
- **Shopify → Platform**: Automatically sync products and orders from Shopify via webhooks and manual sync

## Features

✅ **Products API** - Full CRUD operations for products
✅ **Product Categories API** - Hierarchical category management
✅ **Orders API** - Complete order management system
✅ **Sync Orchestration** - Intelligent bi-directional sync with cursor pagination
✅ **Webhook Handlers** - Real-time updates from Shopify
✅ **Manual Sync Triggers** - On-demand sync capabilities
✅ **Sync Logging** - Complete audit trail of all sync operations

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Your Platform                      │
│                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐│
│  │   Products   │  │  Categories  │  │   Orders   ││
│  │     API      │  │     API      │  │    API     ││
│  └──────────────┘  └──────────────┘  └────────────┘│
│                                                      │
│  ┌──────────────────────────────────────────────────┐│
│  │        Sync Orchestration Service                ││
│  │  • syncProductsFromShopify()                     ││
│  │  • syncProductToShopify()                        ││
│  │  • syncOrdersFromShopify()                       ││
│  └──────────────────────────────────────────────────┘│
│           ▲                                ▼          │
│           │                                │          │
└───────────┼────────────────────────────────┼─────────┘
            │                                │
            │ Webhooks                       │ API Calls
            │                                │
┌───────────┼────────────────────────────────▼─────────┐
│                      Shopify                          │
│  • Products API (GraphQL Admin API v2025-10)         │
│  • Orders API                                         │
│  • Webhooks (products/*, orders/*)                   │
└──────────────────────────────────────────────────────┘
```

## API Endpoints

### Products

#### List Products
```bash
GET /api/products?search=keyword&categoryId=xxx&isActive=true&limit=50&offset=0
```

#### Get Single Product
```bash
GET /api/products/[id]
```

#### Create Product
```bash
POST /api/products
Content-Type: application/json

{
  "sku": "PROD-001",
  "name": "Product Name",
  "description": "Product description",
  "price": "99.99",
  "currency": "USD",
  "stock": 100,
  "categoryId": "category-id",
  "images": ["https://example.com/image.jpg"],
  "isActive": true
}
```

#### Update Product
```bash
PUT /api/products/[id]
Content-Type: application/json

{
  "name": "Updated Product Name",
  "price": "89.99",
  "stock": 150
}
```

#### Delete Product
```bash
DELETE /api/products/[id]
```

### Product Categories

#### List Categories
```bash
GET /api/products/categories?includeChildren=true
```

#### Create Category
```bash
POST /api/products/categories
Content-Type: application/json

{
  "name": "Electronics",
  "slug": "electronics",
  "description": "Electronic products",
  "parentId": null,
  "isActive": true
}
```

#### Update Category
```bash
PUT /api/products/categories/[id]
```

#### Delete Category
```bash
DELETE /api/products/categories/[id]
```

### Orders

#### List Orders
```bash
GET /api/orders?status=pending&platform=shopify&startDate=2024-01-01
```

#### Get Single Order
```bash
GET /api/orders/[id]
```

#### Create Order
```bash
POST /api/orders
Content-Type: application/json

{
  "customerEmail": "customer@example.com",
  "customerName": "John Doe",
  "status": "pending",
  "paymentStatus": "paid",
  "subtotal": "99.99",
  "totalAmount": "109.99",
  "currency": "USD",
  "items": [
    {
      "productId": "product-id",
      "quantity": 2,
      "unitPrice": "49.99"
    }
  ],
  "shippingAddress": {
    "address1": "123 Main St",
    "city": "New York",
    "state": "NY",
    "postalCode": "10001",
    "country": "US"
  }
}
```

#### Update Order
```bash
PUT /api/orders/[id]
Content-Type: application/json

{
  "status": "shipped",
  "trackingNumber": "1Z999AA10123456784",
  "carrier": "UPS"
}
```

### Sync Operations

#### Trigger Manual Sync
```bash
POST /api/sync
Content-Type: application/json

{
  "integrationId": "integration-id",
  "syncType": "products",  // or "orders", "both"
  "direction": "from_platform"  // or "to_platform", "bidirectional"
}
```

#### Get Sync Status
```bash
GET /api/sync?integrationId=integration-id
```

#### Sync Single Product to Shopify
```bash
POST /api/sync/product
Content-Type: application/json

{
  "productId": "product-id",
  "integrationId": "integration-id",
  "platform": "shopify"
}
```

## Webhook Configuration

### Shopify Webhook Setup

You need to configure these webhook topics in your Shopify app:

#### Product Webhooks
- **Endpoint**: `https://yourdomain.com/api/webhooks/shopify/products`
- **Topics**:
  - `products/create`
  - `products/update`
  - `products/delete`

#### Order Webhooks
- **Endpoint**: `https://yourdomain.com/api/webhooks/shopify/orders`
- **Topics**:
  - `orders/create`
  - `orders/updated`
  - `orders/fulfilled`
  - `orders/cancelled`

### Webhook Security

All webhooks are automatically verified using HMAC-SHA256 signature verification:

```typescript
// Automatically handled in webhook routes
const isValid = ShopifyService.verifyWebhook(
  requestBody,
  hmacHeader,
  webhookSecret
);
```

## Sync Orchestration

### How It Works

#### 1. Manual Sync (Platform ← Shopify)

```typescript
import { SyncOrchestrator } from '@/lib/sync/orchestrator';

// Sync all products from Shopify
const result = await SyncOrchestrator.syncProductsFromShopify(
  integrationId,
  organizationId
);

console.log(`Synced: ${result.synced}, Failed: ${result.failed}`);
```

**Features**:
- Handles pagination automatically using cursors
- Processes products in batches of 50
- Updates `platformSync.shopify` metadata
- Logs all operations to `sync_log` table
- Stores cursor position for resumable syncs

#### 2. Push to Shopify (Platform → Shopify)

```typescript
// Sync a single product to Shopify
const result = await SyncOrchestrator.syncProductToShopify(
  productId,
  integrationId,
  organizationId
);

if (result.success) {
  console.log('Product synced to Shopify!');
}
```

**Features**:
- Creates product on Shopify if it doesn't exist
- Updates existing product if already synced
- Stores Shopify product ID in `platformSync.shopify.productId`
- Automatic error handling and logging

#### 3. Real-time Webhooks (Shopify → Platform)

When products or orders change on Shopify:

1. Shopify sends webhook to your endpoint
2. Webhook signature is verified
3. Product/order is created or updated in your database
4. `platformSync` metadata is updated
5. Operation is logged to `sync_log`

## Database Schema

### Product Platform Sync Structure

```typescript
{
  platformSync: {
    shopify: {
      synced: true,
      productId: "gid://shopify/Product/123456789",
      lastSyncAt: "2024-01-15T10:30:00.000Z"
    },
    whatsapp: {
      synced: false,
      catalogId: null,
      lastSyncAt: null
    },
    facebook: {
      synced: false,
      productId: null,
      lastSyncAt: null
    }
  }
}
```

### Sync Log Tracking

Every sync operation is logged:

```sql
SELECT * FROM sync_log
WHERE integration_id = 'xxx'
ORDER BY created_at DESC;
```

Fields:
- `entityType`: "product" or "order"
- `entityId`: Platform or Shopify ID
- `action`: "sync_from_shopify", "sync_to_shopify", "webhook_update"
- `status`: "success" or "failed"
- `errorMessage`: Error details if failed
- `metadata`: Additional context

## Usage Examples

### Example 1: Initial Product Sync

```bash
# 1. Trigger full product sync from Shopify
curl -X POST https://yourdomain.com/api/sync \
  -H "Content-Type: application/json" \
  -d '{
    "integrationId": "int_123",
    "syncType": "products",
    "direction": "from_platform"
  }'

# Response:
{
  "success": true,
  "results": {
    "productsFromShopify": {
      "success": true,
      "synced": 150,
      "failed": 0,
      "errors": []
    }
  }
}
```

### Example 2: Create Product and Sync to Shopify

```bash
# 1. Create product on your platform
curl -X POST https://yourdomain.com/api/products \
  -H "Content-Type: application/json" \
  -d '{
    "sku": "TSHIRT-001",
    "name": "Cool T-Shirt",
    "description": "A very cool t-shirt",
    "price": "29.99",
    "stock": 100,
    "images": ["https://example.com/tshirt.jpg"]
  }'

# Response:
{
  "data": {
    "id": "prod_abc123",
    "sku": "TSHIRT-001",
    ...
  }
}

# 2. Sync product to Shopify
curl -X POST https://yourdomain.com/api/sync/product \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "prod_abc123",
    "integrationId": "int_123",
    "platform": "shopify"
  }'

# Response:
{
  "success": true,
  "message": "Product synced successfully"
}
```

### Example 3: Update Product Price

```bash
# 1. Update product on your platform
curl -X PUT https://yourdomain.com/api/products/prod_abc123 \
  -H "Content-Type: application/json" \
  -d '{
    "price": "24.99"
  }'

# 2. Sync updated product to Shopify
curl -X POST https://yourdomain.com/api/sync/product \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "prod_abc123",
    "integrationId": "int_123",
    "platform": "shopify"
  }'
```

### Example 4: Handle Webhook Updates

When a product is updated on Shopify, the webhook automatically:

1. Receives the update
2. Verifies the signature
3. Updates the product in your database
4. Updates `platformSync.shopify.lastSyncAt`
5. Logs the operation

**No action needed** - it happens automatically!

## Monitoring & Debugging

### Check Sync Status

```bash
GET /api/sync?integrationId=int_123
```

Response includes:
- Integration details
- Last sync time
- Current sync status
- Recent sync logs

### View Sync Logs

```typescript
// Query sync logs programmatically
const logs = await db
  .select()
  .from(syncLog)
  .where(eq(syncLog.integrationId, integrationId))
  .orderBy(desc(syncLog.createdAt))
  .limit(100);
```

### Common Issues

#### 1. Webhook Signature Verification Failed

**Cause**: Incorrect webhook secret in integration config

**Fix**: Update integration config with correct `webhookSecret`:
```typescript
{
  config: {
    accessToken: "...",
    shopDomain: "mystore.myshopify.com",
    webhookSecret: "correct-secret-here"
  }
}
```

#### 2. Product Already Exists on Shopify

**Cause**: Product was created manually on Shopify, not synced from platform

**Solution**: The sync will detect the existing product and update it instead of creating a duplicate.

#### 3. Rate Limiting

Shopify has rate limits. The system handles this with:
- Batch processing (50 items at a time)
- Cursor-based pagination
- Built-in retry logic in ShopifyService

## Performance Considerations

### Pagination

Large product catalogs are handled efficiently:
- Products synced in batches of 50
- Cursor stored in `integration.syncCursor`
- Resumable syncs (can continue from last position)

### Background Jobs (Optional Enhancement)

For production, consider adding:
```typescript
// Using a job queue (e.g., Bull)
queue.add('sync-products', {
  integrationId,
  organizationId
});
```

## Security

### Authentication

All API endpoints require authentication:
```typescript
const session = await auth();
if (!session?.user?.organizationId) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

### Webhook Verification

All webhooks verify HMAC signatures:
```typescript
const isValid = ShopifyService.verifyWebhook(body, hmacHeader, secret);
if (!isValid) {
  return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
}
```

### Organization Isolation

All queries are scoped to organization:
```typescript
where(eq(product.organizationId, session.user.organizationId))
```

## Testing

### Manual Testing

1. **Create Test Product**:
```bash
POST /api/products
```

2. **Sync to Shopify**:
```bash
POST /api/sync/product
```

3. **Verify on Shopify**:
- Check Shopify admin dashboard
- Product should appear with same details

4. **Update on Shopify**:
- Change product name in Shopify admin
- Webhook fires automatically
- Check your database - product updated

5. **Check Logs**:
```bash
GET /api/sync?integrationId=xxx
```

## Next Steps

### Enhancements

1. **Inventory Tracking**:
   - Real-time stock updates
   - Low stock alerts
   - Stock reservation

2. **Variant Support**:
   - Full variant sync
   - Variant-level inventory

3. **Image Sync**:
   - Upload images to Shopify
   - Image CDN optimization

4. **Bulk Operations**:
   - Bulk product import/export
   - CSV support

5. **Conflict Resolution**:
   - Timestamp-based conflict detection
   - Merge strategies

## Support

For issues or questions:
1. Check sync logs: `GET /api/sync`
2. Review error messages in `sync_log` table
3. Verify integration configuration
4. Check Shopify webhook delivery logs

## File Structure

```
apps/web/src/
├── app/api/
│   ├── products/
│   │   ├── route.ts              # Products CRUD
│   │   ├── [id]/route.ts         # Single product operations
│   │   └── categories/
│   │       ├── route.ts          # Categories CRUD
│   │       └── [id]/route.ts     # Single category operations
│   ├── orders/
│   │   ├── route.ts              # Orders CRUD
│   │   └── [id]/route.ts         # Single order operations
│   ├── sync/
│   │   ├── route.ts              # Manual sync trigger
│   │   └── product/route.ts      # Single product sync
│   └── webhooks/
│       └── shopify/
│           ├── products/route.ts # Product webhooks
│           └── orders/route.ts   # Order webhooks
└── lib/
    └── sync/
        └── orchestrator.ts       # Sync orchestration service
```

## Conclusion

You now have a complete bi-directional sync system that:

✅ Syncs products from Shopify to your platform
✅ Pushes products from your platform to Shopify
✅ Handles real-time updates via webhooks
✅ Manages orders from Shopify
✅ Provides complete audit trail
✅ Handles errors gracefully

The system is production-ready and can be extended to support additional platforms like WhatsApp and Facebook Marketplace using the same architecture.
