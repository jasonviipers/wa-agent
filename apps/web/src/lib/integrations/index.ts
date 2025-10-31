/**
 * Integration utilities and helpers
 * Centralized export for all marketplace integrations
 */

import { FacebookMarketplaceService } from "./facebook-marketplace";
import { ShopifyService } from "./shopify";
import { WhatsAppService } from "./whatsapp";

export { ShopifyService } from "./shopify";
export type {
  ShopifyProduct,
  ShopifyVariant,
  ShopifyImage,
  ShopifyOrder,
  ShopifyLineItem,
  ShopifyCustomer,
  ShopifyAddress,
} from "./shopify";

export { WhatsAppService } from "./whatsapp";
export type {
  WhatsAppMessage,
  WhatsAppTemplate,
  WhatsAppInteractive,
  WhatsAppAction,
  WhatsAppWebhookMessage,
  WhatsAppProduct,
} from "./whatsapp";

export { FacebookMarketplaceService } from "./facebook-marketplace";
export type {
  FacebookProduct,
  FacebookCatalog,
  FacebookOrder,
  FacebookMessengerMessage,
  FacebookProductTemplate,
} from "./facebook-marketplace";

/**
 * Integration factory - creates service instances from config
 */
export function createIntegrationService(platform: string, config: any) {
  switch (platform) {
    case "shopify":
      return new ShopifyService(config);
    case "whatsapp":
      return new WhatsAppService(config);
    case "facebook_marketplace":
      return new FacebookMarketplaceService(config);
    default:
      throw new Error(`Unsupported integration platform: ${platform}`);
  }
}

/**
 * Webhook verification utilities
 */
export const WebhookVerification = {
  shopify: (body: string, hmac: string, secret: string) => {
    return ShopifyService.verifyWebhook(body, hmac, secret);
  },
  whatsapp: (payload: string, signature: string, secret: string) => {
    return WhatsAppService.verifyWebhook(payload, signature, secret);
  },
  facebook: (payload: string, signature: string, secret: string) => {
    return FacebookMarketplaceService.verifyWebhook(payload, signature, secret);
  },
};
