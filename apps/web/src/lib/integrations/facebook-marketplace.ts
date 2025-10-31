/**
 * Facebook Marketplace & Commerce Platform Integration
 * API Version: v21.0
 * Documentation: https://developers.facebook.com/docs/commerce-platform/
 *
 * This service handles Facebook Marketplace integration using the Commerce Platform APIs.
 * Supports product catalog management, orders, and Messenger integration.
 */

import type { integrationConfigFacebook } from "@wagents/db/schema/integration";
import { stringify } from "superjson";
import crypto from "node:crypto";

export interface FacebookProduct {
  id?: string;
  retailer_id: string; // Your internal product ID
  name: string;
  description: string;
  availability: "in stock" | "out of stock" | "preorder" | "available for order" | "discontinued";
  condition: "new" | "refurbished" | "used" | "used_like_new" | "used_good" | "used_fair" | "cpo";
  price: number;
  currency: string;
  brand?: string;
  category?: string;
  image_url?: string;
  additional_image_urls?: string[];
  url?: string;
  sale_price?: number;
  sale_price_start_date?: string;
  sale_price_end_date?: string;
  inventory?: number;
  custom_data?: Record<string, any>;
  material?: string;
  pattern?: string;
  color?: string;
  size?: string;
  gender?: string;
  age_group?: string;
  item_group_id?: string; // For product variants
  google_product_category?: string;
}

export interface FacebookCatalog {
  id: string;
  name: string;
  product_count: number;
  business: { id: string; name: string };
  vertical: string;
}

export interface FacebookOrder {
  id: string;
  order_status: {
    state: "CREATED" | "PROCESSING" | "SHIPPED" | "COMPLETED" | "REFUNDED" | "CANCELED";
  };
  created: string;
  last_updated: string;
  buyer_details: {
    name: string;
    email: string;
  };
  shipping_address: {
    name: string;
    street1: string;
    street2?: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
  items: Array<{
    id: string;
    product_id: string;
    retailer_id: string;
    quantity: number;
    price_per_unit: number;
    tax_details?: {
      estimated_tax: number;
      captured_tax: number;
    };
  }>;
  estimated_payment_details: {
    subtotal: number;
    tax: number;
    shipping: number;
    total: number;
  };
}

export interface FacebookMessengerMessage {
  recipient: { id: string };
  message: {
    text?: string;
    attachment?: {
      type: "image" | "audio" | "video" | "file" | "template";
      payload: any;
    };
    quick_replies?: Array<{
      content_type: "text" | "user_phone_number" | "user_email";
      title?: string;
      payload?: string;
      image_url?: string;
    }>;
  };
  messaging_type?: "RESPONSE" | "UPDATE" | "MESSAGE_TAG";
  tag?: string;
}

export interface FacebookProductTemplate {
  recipient: { id: string };
  message: {
    attachment: {
      type: "template";
      payload: {
        template_type: "product";
        elements: Array<{
          id: string; // Product ID from catalog
        }>;
      };
    };
  };
}

export class FacebookMarketplaceService {
  private config: integrationConfigFacebook;
  private apiUrl: string;

  constructor(config: integrationConfigFacebook) {
    this.config = config;
    this.apiUrl = `https://graph.facebook.com/${config.apiVersion}`;
  }

  /**
   * Create or update a product in catalog (Batch API)
   */
  async upsertProducts(products: FacebookProduct[]): Promise<{ handles: string[] }> {
    if (!this.config.catalogId) {
      throw new Error("Catalog ID is required for product operations");
    }

    const requests = products.map((product, _index) => ({
      method: "UPDATE",
      retailer_id: product.retailer_id,
      data: product,
    }));

    const url = `${this.apiUrl}/${this.config.catalogId}/batch`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.config.accessToken}`,
      },
      body: stringify({
        requests,
        allow_upsert: true,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Facebook API error: ${JSON.stringify(error)}`);
    }

    return response.json();
  }

  /**
   * Get a product from catalog by retailer ID
   */
  async getProduct(retailerId: string): Promise<FacebookProduct | null> {
    if (!this.config.catalogId) {
      throw new Error("Catalog ID is required for product operations");
    }

    const url = `${this.apiUrl}/${this.config.catalogId}/products?filter={"retailer_id":{"eq":"${retailerId}"}}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${this.config.accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Facebook API error: ${stringify(error)}`);
    }

    const result = await response.json();
    return result.data[0] || null;
  }

  /**
   * Get all products from catalog with pagination
   */
  async getProducts(limit = 100, after?: string): Promise<{ data: FacebookProduct[]; paging: any }> {
    if (!this.config.catalogId) {
      throw new Error("Catalog ID is required for product operations");
    }

    let url = `${this.apiUrl}/${this.config.catalogId}/products?limit=${limit}`;
    if (after) {
      url += `&after=${after}`;
    }

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${this.config.accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Facebook API error: ${stringify(error)}`);
    }

    return response.json();
  }

  /**
   * Delete a product from catalog
   */
  async deleteProduct(retailerId: string): Promise<{ success: boolean }> {
    if (!this.config.catalogId) {
      throw new Error("Catalog ID is required for product operations");
    }

    const url = `${this.apiUrl}/${this.config.catalogId}/products?retailer_id=${retailerId}`;

    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${this.config.accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Facebook API error: ${stringify(error)}`);
    }

    return response.json();
  }

  /**
   * Get catalog information
   */
  async getCatalog(): Promise<FacebookCatalog> {
    if (!this.config.catalogId) {
      throw new Error("Catalog ID is required");
    }

    const url = `${this.apiUrl}/${this.config.catalogId}?fields=id,name,product_count,business,vertical`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${this.config.accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Facebook API error: ${stringify(error)}`);
    }

    return response.json();
  }

  /**
   * Get orders from commerce manager
   */
  async getOrders(limit = 25): Promise<{ data: FacebookOrder[] }> {
    if (!this.config.pageId) {
      throw new Error("Page ID is required for order operations");
    }

    const url = `${this.apiUrl}/${this.config.pageId}/commerce_orders?limit=${limit}&fields=id,order_status,created,last_updated,buyer_details,shipping_address,items,estimated_payment_details`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${this.config.accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Facebook API error: ${stringify(error)}`);
    }

    return response.json();
  }

  /**
   * Update order status
   */
  async updateOrderStatus(
    orderId: string,
    status: "PROCESSING" | "SHIPPED" | "COMPLETED" | "REFUNDED" | "CANCELED",
    tracking?: { carrier: string; tracking_number: string }
  ): Promise<{ success: boolean }> {
    const url = `${this.apiUrl}/${orderId}`;

    const body: any = {
      state: status,
    };

    if (tracking && status === "SHIPPED") {
      body.shipment_details = {
        tracking_number: tracking.tracking_number,
        carrier: tracking.carrier,
      };
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.config.accessToken}`,
      },
      body: stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Facebook API error: ${stringify(error)}`);
    }

    return response.json();
  }

  /**
   * Send a message via Messenger
   */
  async sendMessage(recipientId: string, message: string | FacebookMessengerMessage["message"]): Promise<{ recipient_id: string; message_id: string }> {
    if (!this.config.pageId) {
      throw new Error("Page ID is required for messaging");
    }

    const url = `${this.apiUrl}/${this.config.pageId}/messages`;

    const payload: FacebookMessengerMessage = {
      recipient: { id: recipientId },
      message: typeof message === "string" ? { text: message } : message,
      messaging_type: "RESPONSE",
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.config.accessToken}`,
      },
      body: stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Facebook API error: ${stringify(error)}`);
    }

    return response.json();
  }

  /**
   * Send a product template message via Messenger
   */
  async sendProductMessage(recipientId: string, productIds: string[]): Promise<{ recipient_id: string; message_id: string }> {
    if (!this.config.pageId) {
      throw new Error("Page ID is required for messaging");
    }

    const url = `${this.apiUrl}/${this.config.pageId}/messages`;

    const payload: FacebookProductTemplate = {
      recipient: { id: recipientId },
      message: {
        attachment: {
          type: "template",
          payload: {
            template_type: "product",
            elements: productIds.map((id) => ({ id })),
          },
        },
      },
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.config.accessToken}`,
      },
      body: stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Facebook API error: ${stringify(error)}`);
    }

    return response.json();
  }

  /**
   * Send typing indicator
   */
  async sendTypingIndicator(recipientId: string, action: "typing_on" | "typing_off" | "mark_seen"): Promise<{ recipient_id: string }> {
    if (!this.config.pageId) {
      throw new Error("Page ID is required for messaging");
    }

    const url = `${this.apiUrl}/${this.config.pageId}/messages`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.config.accessToken}`,
      },
      body: stringify({
        recipient: { id: recipientId },
        sender_action: action,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Facebook API error: ${stringify(error)}`);
    }

    return response.json();
  }

  /**
   * Get page information
   */
  async getPageInfo(): Promise<{ id: string; name: string; category: string }> {
    if (!this.config.pageId) {
      throw new Error("Page ID is required");
    }

    const url = `${this.apiUrl}/${this.config.pageId}?fields=id,name,category`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${this.config.accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Facebook API error: ${stringify(error)}`);
    }

    return response.json();
  }

  /**
   * Verify webhook signature
   */
  static verifyWebhook(payload: string, signature: string | null, appSecret: string): boolean {
    if (!signature) return false;

    const expectedSignature = crypto
      .createHmac("sha256", appSecret)
      .update(payload)
      .digest("hex");

    // Remove 'sha256=' prefix from signature if present
    const receivedSignature = signature.replace("sha256=", "");

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(receivedSignature)
    );
  }
}
