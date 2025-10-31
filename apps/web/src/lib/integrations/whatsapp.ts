/**
 * WhatsApp Business Cloud API Integration
 * API Version: v21.0
 * Documentation: https://developers.facebook.com/docs/whatsapp/cloud-api/
 *
 * This service handles WhatsApp Business Platform integration using the Cloud API.
 * Supports messaging, interactive messages, templates, and commerce features.
 */

import type { integrationConfigWhatsApp } from "@wagents/db/schema/integration";
import crypto from "node:crypto";

export interface WhatsAppMessage {
  messaging_product: "whatsapp";
  recipient_type?: "individual";
  to: string;
  type: "text" | "template" | "interactive" | "image" | "video" | "document" | "audio" | "location" | "contacts";
  text?: { body: string; preview_url?: boolean };
  template?: WhatsAppTemplate;
  interactive?: WhatsAppInteractive;
  image?: { link: string; caption?: string };
  video?: { link: string; caption?: string };
  document?: { link: string; filename?: string; caption?: string };
  audio?: { link: string };
}

export interface WhatsAppTemplate {
  name: string;
  language: { code: string };
  components?: Array<{
    type: "header" | "body" | "button";
    parameters: Array<{ type: string; text?: string; payload?: string }>;
  }>;
}

export interface WhatsAppInteractive {
  type: "button" | "list" | "product" | "product_list";
  header?: { type: "text" | "image" | "video" | "document"; text?: string };
  body: { text: string };
  footer?: { text: string };
  action: WhatsAppAction;
}

export interface WhatsAppAction {
  button?: string; // For single product
  buttons?: Array<{ type: "reply"; reply: { id: string; title: string } }>; // For button replies
  sections?: Array<{
    title?: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  }>; // For lists
  catalog_id?: string; // For product lists
  product_retailer_id?: string; // For single product
  sections_product?: Array<{
    title?: string;
    product_items: Array<{ product_retailer_id: string }>;
  }>; // For multi-product lists
}

export interface WhatsAppWebhookMessage {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: { display_phone_number: string; phone_number_id: string };
        contacts?: Array<{ profile: { name: string }; wa_id: string }>;
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          type: string;
          text?: { body: string };
          interactive?: {
            type: string;
            button_reply?: { id: string; title: string };
            list_reply?: { id: string; title: string; description?: string };
          };
          order?: {
            catalog_id: string;
            product_items: Array<{
              product_retailer_id: string;
              quantity: number;
              item_price: number;
              currency: string;
            }>;
          };
        }>;
        statuses?: Array<{
          id: string;
          status: "sent" | "delivered" | "read" | "failed";
          timestamp: string;
          recipient_id: string;
        }>;
      };
      field: string;
    }>;
  }>;
}

export interface WhatsAppProduct {
  id: string;
  retailer_id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  availability: "in stock" | "out of stock";
  image_url?: string;
  url?: string;
}

export class WhatsAppService {
  private config: integrationConfigWhatsApp;
  private apiUrl: string;

  constructor(config: integrationConfigWhatsApp) {
    this.config = config;
    this.apiUrl = `https://graph.facebook.com/${config.apiVersion}`;
  }

  /**
   * Send a text message
   */
  async sendTextMessage(to: string, text: string, previewUrl = false): Promise<{ messaging_product: string; messages: Array<{ id: string }> }> {
    const message: WhatsAppMessage = {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text, preview_url: previewUrl },
    };

    return this.sendMessage(message);
  }

  /**
   * Send a template message
   */
  async sendTemplateMessage(
    to: string,
    templateName: string,
    languageCode: string,
    components?: WhatsAppTemplate["components"]
  ): Promise<{ messaging_product: string; messages: Array<{ id: string }> }> {
    const message: WhatsAppMessage = {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
        components,
      },
    };

    return this.sendMessage(message);
  }

  /**
   * Send an interactive message (buttons or list)
   */
  async sendInteractiveMessage(to: string, interactive: WhatsAppInteractive): Promise<{ messaging_product: string; messages: Array<{ id: string }> }> {
    const message: WhatsAppMessage = {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive,
    };

    return this.sendMessage(message);
  }

  /**
   * Send a product message (single product from catalog)
   */
  async sendProductMessage(
    to: string,
    catalogId: string,
    productRetailerId: string,
    bodyText: string,
    footerText?: string
  ): Promise<{ messaging_product: string; messages: Array<{ id: string }> }> {
    const message: WhatsAppMessage = {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "product",
        body: { text: bodyText },
        footer: footerText ? { text: footerText } : undefined,
        action: {
          catalog_id: catalogId,
          product_retailer_id: productRetailerId,
        },
      },
    };

    return this.sendMessage(message);
  }

  /**
   * Send a product list message (multiple products from catalog)
   */
  async sendProductListMessage(
    to: string,
    catalogId: string,
    headerText: string,
    bodyText: string,
    sections: Array<{
      title?: string;
      product_items: Array<{ product_retailer_id: string }>;
    }>
  ): Promise<{ messaging_product: string; messages: Array<{ id: string }> }> {
    const message: WhatsAppMessage = {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "product_list",
        header: { type: "text", text: headerText },
        body: { text: bodyText },
        action: {
          catalog_id: catalogId,
          sections_product: sections,
        },
      },
    };

    return this.sendMessage(message);
  }

  /**
   * Send an image
   */
  async sendImage(to: string, imageUrl: string, caption?: string): Promise<{ messaging_product: string; messages: Array<{ id: string }> }> {
    const message: WhatsAppMessage = {
      messaging_product: "whatsapp",
      to,
      type: "image",
      image: { link: imageUrl, caption },
    };

    return this.sendMessage(message);
  }

  /**
   * Send a video
   */
  async sendVideo(to: string, videoUrl: string, caption?: string): Promise<{ messaging_product: string; messages: Array<{ id: string }> }> {
    const message: WhatsAppMessage = {
      messaging_product: "whatsapp",
      to,
      type: "video",
      video: { link: videoUrl, caption },
    };

    return this.sendMessage(message);
  }

  /**
   * Send a document
   */
  async sendDocument(to: string, documentUrl: string, filename?: string, caption?: string): Promise<{ messaging_product: string; messages: Array<{ id: string }> }> {
    const message: WhatsAppMessage = {
      messaging_product: "whatsapp",
      to,
      type: "document",
      document: { link: documentUrl, filename, caption },
    };

    return this.sendMessage(message);
  }

  /**
   * Mark a message as read
   */
  async markAsRead(messageId: string): Promise<{ success: boolean }> {
    const url = `${this.apiUrl}/${this.config.phoneNumberId}/messages`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.config.accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`WhatsApp API error: ${JSON.stringify(error)}`);
    }

    return response.json();
  }

  /**
   * Get business profile
   */
  async getBusinessProfile(): Promise<{
    about?: string;
    address?: string;
    description?: string;
    email?: string;
    messaging_product: string;
    profile_picture_url?: string;
    websites?: string[];
    vertical?: string;
  }> {
    const url = `${this.apiUrl}/${this.config.phoneNumberId}/whatsapp_business_profile?fields=about,address,description,email,profile_picture_url,websites,vertical`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${this.config.accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`WhatsApp API error: ${JSON.stringify(error)}`);
    }

    const result = await response.json();
    return result.data[0];
  }

  /**
   * Update business profile
   */
  async updateBusinessProfile(updates: {
    about?: string;
    address?: string;
    description?: string;
    email?: string;
    vertical?: string;
    websites?: string[];
  }): Promise<{ success: boolean }> {
    const url = `${this.apiUrl}/${this.config.phoneNumberId}/whatsapp_business_profile`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.config.accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        ...updates,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`WhatsApp API error: ${JSON.stringify(error)}`);
    }

    return response.json();
  }

  /**
   * Upload media to WhatsApp
   */
  async uploadMedia(fileUrl: string, mimeType: string): Promise<{ id: string }> {
    const url = `${this.apiUrl}/${this.config.phoneNumberId}/media`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.config.accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        file: fileUrl,
        type: mimeType,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`WhatsApp API error: ${JSON.stringify(error)}`);
    }

    return response.json();
  }

  /**
   * Send a message (internal helper)
   */
  private async sendMessage(message: WhatsAppMessage): Promise<{ messaging_product: string; messages: Array<{ id: string }> }> {
    const url = `${this.apiUrl}/${this.config.phoneNumberId}/messages`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.config.accessToken}`,
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`WhatsApp API error: ${JSON.stringify(error)}`);
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
