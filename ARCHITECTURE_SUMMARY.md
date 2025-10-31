# Shopify Product Sync Architecture - Visual Summary

## High-Level Architecture (What Exists vs What's Needed)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        WAGENTS PLATFORM                              │
├─────────────────────────────────────────────────────────────────────┤
│
│  ┌─────────────────────────────────────────────────────────────┐
│  │              MARKETPLACE PLATFORMS (External)                │
│  │  ┌──────────┐  ┌──────────┐  ┌────────────┐               │
│  │  │ Shopify  │  │ WhatsApp │  │ Facebook   │               │
│  │  │  GraphQL │  │ Cloud API│  │ Marketplace│               │
│  │  │   API    │  │          │  │   API      │               │
│  │  └──────────┘  └──────────┘  └────────────┘               │
│  └─────────────────────────────────────────────────────────────┘
│                            ▲    ▲    ▲
│                            │    │    │
│              ┌─────────────┴────┴────┴──────────┐
│              │  WEBHOOKS (⚠ NEEDS IMPLEMENTATION)│
│              │  - Product Updates                │
│              │  - Order Changes                  │
│              │  - Inventory Sync                 │
│              └────────────┬─────────────────────┘
│                           │
│    ┌──────────────────────▼──────────────────────┐
│    │     API LAYER (⚠ MOSTLY MISSING)            │
│    │  ┌──────────────────────────────────────┐  │
│    │  │ Routes:                              │  │
│    │  │ • /api/integrations/[id]/connect    │  │
│    │  │ • /api/webhooks/shopify             │  │
│    │  │ • /api/webhooks/whatsapp            │  │
│    │  │ • /api/webhooks/facebook            │  │
│    │  │ • /api/sync (trigger/status)        │  │
│    │  │ • /api/products (CRUD)              │  │
│    │  │ • /api/orders (CRUD)                │  │
│    │  └──────────────────────────────────────┘  │
│    └──────────────────────────────────────────────┘
│                           │
│    ┌──────────────────────▼──────────────────────┐
│    │  SERVICE LAYER (✓ PARTIALLY BUILT)          │
│    │  ┌──────────────────────────────────────┐  │
│    │  │ ✓ ShopifyService                    │  │
│    │  │ ✓ WhatsAppService                   │  │
│    │  │ ✓ FacebookMarketplaceService        │  │
│    │  │ ✓ Webhook Verification              │  │
│    │  │ ✓ Utility Functions                 │  │
│    │  │ ⚠ SyncOrchestrationService (MISSING)│  │
│    │  │ ⚠ BackgroundJobRunner (MISSING)     │  │
│    │  └──────────────────────────────────────┘  │
│    └──────────────────────────────────────────────┘
│                           │
│    ┌──────────────────────▼──────────────────────┐
│    │  DATA LAYER (✓ FULLY BUILT)                 │
│    │  ┌──────────────────────────────────────┐  │
│    │  │ PostgreSQL + Drizzle ORM             │  │
│    │  │ ✓ integration table                  │  │
│    │  │ ✓ product table                      │  │
│    │  │ ✓ product_category table             │  │
│    │  │ ✓ orders table                       │  │
│    │  │ ✓ order_items table                  │  │
│    │  │ ✓ webhook table                      │  │
│    │  │ ✓ sync_log table (audit trail)       │  │
│    │  │ ✓ conversation & message tables      │  │
│    │  └──────────────────────────────────────┘  │
│    └──────────────────────────────────────────────┘
│                           │
│    ┌──────────────────────▼──────────────────────┐
│    │  AGENT INTEGRATION (✓ PARTIAL)              │
│    │  • product_search tool ✓                    │
│    │  • Platform-specific tools (⚠ MISSING)     │
│    └──────────────────────────────────────────────┘

```

---

## Data Flow: Shopify Product Sync (What Needs to be Built)

```
1. INITIAL SYNC
═══════════════════════════════════════════════════════════════════════

User connects Shopify → 
  [OAuth Flow] 
    → Store credentials in integration.config
    → Set integration.status = 'connected'

Manual Trigger: "Sync Products" Button
  ↓
[Sync Orchestration Service] ⚠ NEEDS IMPLEMENTATION
  ├─ Create sync job
  ├─ Fetch products from Shopify
  │   └─ ShopifyService.getProducts()  ✓ READY
  ├─ Parse & transform data
  ├─ Insert/update product table
  ├─ Track in syncLog table
  ├─ Update integration.lastSyncAt
  ├─ Update product.platformSync.shopify
  └─ Handle errors → integration.syncError


2. WEBHOOK LISTENING (for real-time updates)
═══════════════════════════════════════════════════════════════════════

Shopify Product Updated
  ↓
[Webhook Sent] → POST /api/webhooks/shopify ⚠ ROUTE MISSING
  ├─ Verify signature (WebhookVerification.shopify) ✓ READY
  ├─ Parse payload
  ├─ Extract product ID & changes
  ├─ Update product table
  ├─ Update product.platformSync.shopify
  ├─ Log in syncLog table ✓ SCHEMA READY
  └─ Notify agent (if listening)


3. PAGINATION & CURSORS
═══════════════════════════════════════════════════════════════════════

Large product catalog (1000+ products)
  ↓
[Sync Manager] ⚠ NEEDS IMPLEMENTATION
  ├─ Store cursor: integration.syncCursor = { after: "eyJ..." }
  ├─ Fetch batch (50 products)
  ├─ Process & insert
  ├─ Update cursor for next batch
  ├─ Continue until hasNextPage = false
  └─ Complete: integration.syncStatus = 'idle'


4. ERROR HANDLING & RETRIES
═══════════════════════════════════════════════════════════════════════

Network error or rate limit hit
  ↓
[Retry with Backoff] ✓ UTILITY READY
  ├─ Exponential backoff (1s → 2s → 4s)
  ├─ Max retries: 3
  ├─ Update integration.syncStatus = 'in_progress'
  ├─ Log attempt in syncLog
  └─ If failed: integration.syncError = "Max retries exceeded"

```

---

## Database Schema Integration Points

```
┌─ integration ─────────────────────────┐
│                                       │
│  id, platform, status                 │
│  config: {                            │
│    accessToken,                       │
│    shopDomain,                        │
│    apiVersion                         │
│  }                                    │
│                                       │
│  lastSyncAt ──────────────┐           │
│  syncStatus ──────────┐    │           │
│  syncCursor ──────┐   │    │           │
│  syncError        │   │    │           │
└───────────────────┼───┼────┼───────────┘
                    │   │    │
                    │   │    └─────────────┐
                    │   └─────────┐        │
                    └─────┐       │        │
                          │       │        │
            ┌─────────────▼─┐   ┌─▼──────────────┐
            │ syncLog table │   │ product table  │
            │               │   │                │
            │ entityType    │   │ platformSync   │
            │ entityId      │   │ {              │
            │ action        │   │   shopify: {   │
            │ status        │   │     synced,    │
            │ errorMessage  │   │     productId, │
            └───────────────┘   │     lastSyncAt │
                                │   }            │
                                │ }              │
                                └────────────────┘
```

---

## Critical Implementation Sequence

### Phase 1: Core Sync (Week 1)
1. ✓ Database schemas (DONE)
2. ✓ Integration services (DONE)
3. **NEXT: OAuth/Connect Flow**
   - POST /api/integrations/connect
   - Store credentials securely
   - Test API connection

4. **NEXT: Manual Sync Endpoint**
   - POST /api/sync
   - Implement SyncOrchestrationService
   - Fetch products → Store in DB
   - Handle pagination with syncCursor

### Phase 2: Webhook Handlers (Week 2)
5. **Implement Webhook Receivers**
   - POST /api/webhooks/shopify
   - POST /api/webhooks/whatsapp
   - POST /api/webhooks/facebook
   - Signature verification ✓ (ready)
   - Update products in real-time

### Phase 3: Background Jobs (Week 3)
6. **Periodic Sync**
   - Scheduler (Cron or Bull Queue)
   - Auto-sync every 1 hour
   - Error notifications

7. **Inventory Tracking**
   - Real-time stock updates
   - Overselling prevention
   - Stock reservation logic

### Phase 4: UI & Monitoring (Week 4)
8. **Dashboard**
   - Integration status
   - Last sync time
   - Sync logs
   - Error alerts

9. **Product Management UI**
   - CRUD operations
   - Platform sync status
   - Bulk operations

---

## Key Files to Modify/Create

### New Files Needed:

```
/home/user/wa-agent/apps/web/src/
├── app/api/
│   ├── integrations/
│   │   ├── route.ts                    # CRUD integrations
│   │   └── [id]/
│   │       ├── connect/route.ts        # OAuth flow
│   │       └── disconnect/route.ts     # Revoke
│   │
│   ├── webhooks/
│   │   ├── shopify/route.ts            # Shopify webhook
│   │   ├── whatsapp/route.ts           # WhatsApp webhook
│   │   └── facebook/route.ts           # Facebook webhook
│   │
│   ├── products/
│   │   └── route.ts                    # CRUD products
│   │
│   ├── orders/
│   │   └── route.ts                    # CRUD orders
│   │
│   └── sync/
│       └── route.ts                    # Trigger/status
│
├── lib/
│   ├── sync/
│   │   ├── orchestrator.ts             # SyncOrchestrationService
│   │   ├── jobs.ts                     # Background job runner
│   │   └── handlers.ts                 # Webhook handlers
│   │
│   └── integrations/
│       └── oauth.ts                    # OAuth helpers (NEW)
│
└── actions/
    └── integrations.ts                 # Server actions for settings

```

### Existing Files to Extend:

```
/home/user/wa-agent/packages/db/src/schema/
├── integration.ts                      # Already complete ✓
├── product.ts                          # Already complete ✓
├── order.ts                            # Already complete ✓
└── webhook.ts                          # Add syncLog indexes

/home/user/wa-agent/apps/web/src/lib/integrations/
├── index.ts                            # Add oauth helpers
└── oauth.ts                            # NEW: OAuth utilities
```

---

## Platform-Specific Details

### Shopify OAuth Flow
```
1. POST /api/integrations/connect?platform=shopify
2. Redirect to: https://admin.shopify.com/oauth/authorize?
   - client_id=SHOPIFY_APP_ID
   - scope=read_products,write_products,...
   - redirect_uri=https://yourapp.com/api/auth/shopify/callback
3. User authorizes
4. Shopify POSTs auth code back
5. Exchange code for accessToken
6. Store in integration.config
```

### Shopify Webhook Topics
```
Required Topics:
- PRODUCTS_UPDATE (inventory changes)
- PRODUCTS_CREATE (new products)
- ORDERS_CREATE (new orders)
- ORDERS_UPDATE (order status)

Verify with HMAC-SHA256
```

---

## Testing Strategy

```
Unit Tests:
- ShopifyService methods ✓ (service ready)
- SyncOrchestrationService (when built)
- Webhook handlers
- Pagination logic

Integration Tests:
- Full sync flow (mock Shopify)
- Webhook receive & process
- Database updates
- Error scenarios

API Tests:
- GET /api/integrations
- POST /api/sync
- POST /api/webhooks/shopify
- etc.
```

---

## Success Criteria

✓ Phase 1: Can manually sync 100+ products from Shopify
✓ Phase 2: Webhooks update products in real-time
✓ Phase 3: Automatic hourly syncs without manual intervention
✓ Phase 4: Dashboard shows sync status, logs, and errors
✓ Agents can query and sell synced products

