/**
 * Shopify GraphQL Admin API Integration
 * API Version: 2025-10
 * Documentation: https://shopify.dev/docs/api/admin-graphql
 *
 * This service handles Shopify integration using the latest GraphQL Admin API.
 * REST API is legacy as of October 1, 2024.
 */

import type { integrationConfigShopify } from "@wagents/db/schema/integration";


export interface ShopifyProduct {
  id: string;
  title: string;
  description: string;
  handle: string;
  vendor: string;
  productType: string;
  tags: string[];
  status: "ACTIVE" | "ARCHIVED" | "DRAFT";
  variants: ShopifyVariant[];
  images: ShopifyImage[];
  priceRange: {
    minVariantPrice: { amount: string; currencyCode: string };
    maxVariantPrice: { amount: string; currencyCode: string };
  };
}

export interface ShopifyVariant {
  id: string;
  title: string;
  sku: string;
  price: string;
  inventoryQuantity: number;
  availableForSale: boolean;
}

export interface ShopifyImage {
  id: string;
  url: string;
  altText?: string;
}

export interface ShopifyOrder {
  id: string;
  name: string;
  email: string;
  totalPrice: string;
  subtotalPrice: string;
  totalTax: string;
  currencyCode: string;
  financialStatus: string;
  fulfillmentStatus: string;
  lineItems: ShopifyLineItem[];
  customer: ShopifyCustomer;
  shippingAddress?: ShopifyAddress;
  createdAt: string;
  updatedAt: string;
}

export interface ShopifyLineItem {
  id: string;
  title: string;
  quantity: number;
  variant: {
    id: string;
    title: string;
    price: string;
  };
}

export interface ShopifyCustomer {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export interface ShopifyAddress {
  address1: string;
  address2?: string;
  city: string;
  province: string;
  zip: string;
  country: string;
}

export class ShopifyService {
  private config: integrationConfigShopify;
  private apiUrl: string;

  constructor(config: integrationConfigShopify) {
    this.config = config;
    this.apiUrl = `https://${config.shopDomain}/admin/api/${config.apiVersion}/graphql.json`;
  }

  /**
   * Make a GraphQL request to Shopify Admin API
   */
  private async graphqlRequest<T>(query: string, variables?: Record<string, any>): Promise<T> {
    const response = await fetch(this.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": this.config.accessToken,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.statusText}`);
    }

    const result = await response.json();

    if (result.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
    }

    return result.data;
  }

  /**
   * Fetch products with pagination
   */
  async getProducts(first = 50, after?: string): Promise<{ products: ShopifyProduct[]; pageInfo: any }> {
    const query = `
      query GetProducts($first: Int!, $after: String) {
        products(first: $first, after: $after) {
          edges {
            node {
              id
              title
              description
              handle
              vendor
              productType
              tags
              status
              variants(first: 10) {
                edges {
                  node {
                    id
                    title
                    sku
                    price
                    inventoryQuantity
                    availableForSale
                  }
                }
              }
              images(first: 5) {
                edges {
                  node {
                    id
                    url
                    altText
                  }
                }
              }
              priceRangeV2 {
                minVariantPrice {
                  amount
                  currencyCode
                }
                maxVariantPrice {
                  amount
                  currencyCode
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
        }
      }
    `;

    const data = await this.graphqlRequest<any>(query, { first, after });

    return {
      products: data.products.edges.map((edge: any) => ({
        ...edge.node,
        variants: edge.node.variants.edges.map((v: any) => v.node),
        images: edge.node.images.edges.map((i: any) => i.node),
        priceRange: edge.node.priceRangeV2,
      })),
      pageInfo: data.products.pageInfo,
    };
  }

  /**
   * Get a single product by ID
   */
  async getProduct(id: string): Promise<ShopifyProduct | null> {
    const query = `
      query GetProduct($id: ID!) {
        product(id: $id) {
          id
          title
          description
          handle
          vendor
          productType
          tags
          status
          variants(first: 100) {
            edges {
              node {
                id
                title
                sku
                price
                inventoryQuantity
                availableForSale
              }
            }
          }
          images(first: 10) {
            edges {
              node {
                id
                url
                altText
              }
            }
          }
          priceRangeV2 {
            minVariantPrice {
              amount
              currencyCode
            }
            maxVariantPrice {
              amount
              currencyCode
            }
          }
        }
      }
    `;

    const data = await this.graphqlRequest<any>(query, { id });

    if (!data.product) return null;

    return {
      ...data.product,
      variants: data.product.variants.edges.map((v: any) => v.node),
      images: data.product.images.edges.map((i: any) => i.node),
      priceRange: data.product.priceRangeV2,
    };
  }

  /**
   * Create a new product
   */
  async createProduct(input: {
    title: string;
    description?: string;
    vendor?: string;
    productType?: string;
    tags?: string[];
    variants?: Array<{ price: string; sku?: string; inventoryQuantity?: number }>;
  }): Promise<ShopifyProduct> {
    const query = `
      mutation CreateProduct($input: ProductInput!) {
        productCreate(input: $input) {
          product {
            id
            title
            description
            handle
            vendor
            productType
            tags
            status
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const data = await this.graphqlRequest<any>(query, { input });

    if (data.productCreate.userErrors.length > 0) {
      throw new Error(`Failed to create product: ${JSON.stringify(data.productCreate.userErrors)}`);
    }

    return data.productCreate.product;
  }

  /**
   * Update a product
   */
  async updateProduct(id: string, input: Partial<{
    title: string;
    description: string;
    vendor: string;
    productType: string;
    tags: string[];
    status: "ACTIVE" | "ARCHIVED" | "DRAFT";
  }>): Promise<ShopifyProduct> {
    const query = `
      mutation UpdateProduct($input: ProductInput!) {
        productUpdate(input: $input) {
          product {
            id
            title
            description
            status
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const data = await this.graphqlRequest<any>(query, { input: { id, ...input } });

    if (data.productUpdate.userErrors.length > 0) {
      throw new Error(`Failed to update product: ${JSON.stringify(data.productUpdate.userErrors)}`);
    }

    return data.productUpdate.product;
  }

  /**
   * Fetch orders with pagination
   */
  async getOrders(first = 50, after?: string): Promise<{ orders: ShopifyOrder[]; pageInfo: any }> {
    const query = `
      query GetOrders($first: Int!, $after: String) {
        orders(first: $first, after: $after) {
          edges {
            node {
              id
              name
              email
              totalPriceSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              subtotalPriceSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              totalTaxSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              financialStatus
              fulfillmentStatus
              lineItems(first: 50) {
                edges {
                  node {
                    id
                    title
                    quantity
                    variant {
                      id
                      title
                      price
                    }
                  }
                }
              }
              customer {
                id
                email
                firstName
                lastName
                phone
              }
              shippingAddress {
                address1
                address2
                city
                province
                zip
                country
              }
              createdAt
              updatedAt
            }
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
        }
      }
    `;

    const data = await this.graphqlRequest<any>(query, { first, after });

    return {
      orders: data.orders.edges.map((edge: any) => ({
        id: edge.node.id,
        name: edge.node.name,
        email: edge.node.email,
        totalPrice: edge.node.totalPriceSet.shopMoney.amount,
        subtotalPrice: edge.node.subtotalPriceSet.shopMoney.amount,
        totalTax: edge.node.totalTaxSet.shopMoney.amount,
        currencyCode: edge.node.totalPriceSet.shopMoney.currencyCode,
        financialStatus: edge.node.financialStatus,
        fulfillmentStatus: edge.node.fulfillmentStatus,
        lineItems: edge.node.lineItems.edges.map((li: any) => li.node),
        customer: edge.node.customer,
        shippingAddress: edge.node.shippingAddress,
        createdAt: edge.node.createdAt,
        updatedAt: edge.node.updatedAt,
      })),
      pageInfo: data.orders.pageInfo,
    };
  }

  /**
   * Create a webhook subscription
   */
  async createWebhook(topic: string, callbackUrl: string): Promise<{ id: string; topic: string }> {
    const query = `
      mutation CreateWebhook($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
        webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
          webhookSubscription {
            id
            topic
            endpoint {
              __typename
              ... on WebhookHttpEndpoint {
                callbackUrl
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const data = await this.graphqlRequest<any>(query, {
      topic,
      webhookSubscription: {
        callbackUrl,
        format: "JSON",
      },
    });

    if (data.webhookSubscriptionCreate.userErrors.length > 0) {
      throw new Error(`Failed to create webhook: ${JSON.stringify(data.webhookSubscriptionCreate.userErrors)}`);
    }

    return data.webhookSubscriptionCreate.webhookSubscription;
  }

  /**
   * Verify webhook signature
   */
  static verifyWebhook(body: string, hmacHeader: string, secret: string): boolean {
    const crypto = require("node:crypto");
    const hash = crypto
      .createHmac("sha256", secret)
      .update(body, "utf8")
      .digest("base64");

    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hmacHeader));
  }
}
