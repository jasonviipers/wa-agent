import { db, eq } from "@wagents/db";
import * as schema from "@wagents/db/schema/auth";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import {
  apiKey,
  lastLoginMethod,
  magicLink,
  organization,
} from "better-auth/plugins";
import { passkey } from "better-auth/plugins/passkey";
import { polar, checkout, portal, webhooks } from "@polar-sh/better-auth";
import { polarClient } from "./lib/payments";


export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  baseURL: process.env.BETTER_AUTH_URL as string,
  secret: process.env.BETTER_AUTH_SECRET as string,
  socialProviders: {
    google: {
      accessType: "offline",
      prompt: "select_account consent",
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
    },
  },
  advanced: {
    defaultCookieAttributes: {
      sameSite: "none",
      secure: true,
      httpOnly: true,
    },
  },
  plugins: [
    apiKey(),
    passkey(),
    organization({
      schema: {
        organization: {
          additionalFields: {
            businessType: {
              type: "string",
              required: false,
              input: true,
            },
            teamSize: {
              type: "string",
              required: false,
              input: true,
            },
            salesVolume: {
              type: "string",
              required: false,
              input: true,
            },
            aiStrategy: {
              type: "string",
              required: false,
              input: true,
            },
            settings: {
              type: "string",
              required: false,
              input: true,
              defaultValue: "{}",
            },
            workspaceUrl: {
              type: "string",
              required: false,
              input: true,
            },
            onboardingCompleted: {
              type: "boolean",
              required: false,
              defaultValue: false,
              input: true,
            },
            onboardingStep: {
              type: "number",
              required: false,
              defaultValue: 0,
              input: true,
            },
            subscriptionPlan: {
              type: "string",
              required: false,
              input: true,
              defaultValue: "free",
            },
            subscriptionStatus: {
              type: "string",
              required: false,
              input: true,
              defaultValue: "inactive",
            },
            subscriptionId: {
              type: "string",
              required: false,
              input: true,
            },
          },
        },
      },
    }),
    lastLoginMethod({
      storeInDatabase: true,
    }),
    magicLink({
      sendMagicLink: async ({ email, token, url }) => {
        console.log(email, token, url);
      },
    }),
    polar({
      client: polarClient,
      createCustomerOnSignUp: true,
      enableCustomerPortal: true,
      use: [
        checkout({
          products: [
            {
              productId: process.env.POLAR_PRODUCT_STARTER_ID as string,
              slug: "starter",
            },
            {
              productId: process.env.POLAR_PRODUCT_PRO_ID as string,
              slug: "pro",
            },
            {
              productId: process.env.POLAR_PRODUCT_ENTERPRISE_ID as string,
              slug: "business",
            },
          ],
          successUrl: process.env.POLAR_SUCCESS_URL as string,
          authenticatedUsersOnly: true,
        }),
        portal(),
        webhooks({
          secret: process.env.POLAR_WEBHOOK_SECRET as string,
          
          // Handle subscription creation
          onSubscriptionCreated: async (payload) => {
            console.log("Subscription created:", payload);
            
            const referenceId = payload.data.metadata?.referenceId;
            if (!referenceId) return;

            // Map product slug
            const productSlugMap: Record<string, string> = {
              [process.env.POLAR_PRODUCT_STARTER_ID as string]: "starter",
              [process.env.POLAR_PRODUCT_PRO_ID as string]: "pro",
              [process.env.POLAR_PRODUCT_ENTERPRISE_ID as string]: "business",
            };

            const planSlug = productSlugMap[payload.data.productId];
            if (!planSlug) return;

            // Get plan limits
            const planLimits = {
              starter: { credits: 2000 },
              pro: { credits: 5000 },
              business: { credits: 30000 },
            };

            const limits = planLimits[planSlug as keyof typeof planLimits];

            await db
              .update(schema.organization)
              .set({
                subscriptionPlan: planSlug,
                subscriptionStatus: payload.data.status,
                subscriptionId: payload.data.id,
                subscriptionStartDate: new Date(payload.data.currentPeriodStart),
                subscriptionEndDate: new Date(payload.data.currentPeriodEnd || payload.data.currentPeriodStart),
                monthlyCredits: limits.credits,
                usedCredits: 0,
                creditsResetDate: new Date(payload.data.currentPeriodEnd || payload.data.currentPeriodStart),
              })
              .where(eq(schema.organization.id, referenceId));
          },

          // Handle subscription status changes
          onSubscriptionActive: async (payload) => {
            console.log("Subscription activated:", payload);
            
            const referenceId = payload.data.metadata?.referenceId;
            if (!referenceId) return;

            await db
              .update(schema.organization)
              .set({
                subscriptionStatus: "active",
                subscriptionEndDate: new Date(payload.data.currentPeriodEnd || payload.data.currentPeriodStart),
              })
              .where(eq(schema.organization.id, referenceId));
          },

          onSubscriptionCanceled: async (payload) => {
            console.log("Subscription canceled:", payload);
            
            const referenceId = payload.data.metadata?.referenceId;
            if (!referenceId) return;

            await db
              .update(schema.organization)
              .set({
                subscriptionStatus: "canceled",
              })
              .where(eq(schema.organization.id, referenceId));
          },

          onSubscriptionRevoked: async (payload) => {
            console.log("Subscription revoked:", payload);
            
            const referenceId = payload.data.metadata?.referenceId;
            if (!referenceId) return;

            await db
              .update(schema.organization)
              .set({
                subscriptionPlan: "free",
                subscriptionStatus: "inactive",
                subscriptionId: null,
                monthlyCredits: 500,
                usedCredits: 0,
              })
              .where(eq(schema.organization.id, referenceId));
          },

          // Handle one-time purchases
          onOrderPaid: async (payload) => {
            console.log("Order paid:", payload);
            
            // Handle one-time purchases if needed
            const referenceId = payload.data.metadata?.referenceId;
            if (!referenceId) return;

            // If it's a subscription order, it will be handled by subscription webhooks
            // You can add custom logic here for one-time purchases
          },
        }),
      ],
    }),
  ],
});