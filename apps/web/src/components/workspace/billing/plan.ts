/**
 * Replier Platform Plans Configuration
 * Defines subscription plans with their limits and features
 */

export const plans = [
  {
    name: "Starter",
    slug: "starter",
    price: {
      monthly: 29,
      yearly: 290,
    },
    originalPrice: {
      monthly: 49,
      yearly: 490,
    },
    description: "Perfect for getting started",
    badge: null,
    features: [
      "1 agent",
      "1 organization",
      "1 connected WhatsApp account",
      "1 connected Facebook account",
      "2,000 credits/month",
      "1M knowledge base characters",
      "Advanced analytics",
      "Priority email support",
      "Basic integrations",
    ],
    limits: {
      agents: 1,
      organizations: 1,
      whatsappConnections: 1,
      facebookConnections: 1,
      tiktokConnections: 0,
      instagramConnections: 0,
      totalIntegrations: 2, // WhatsApp + Facebook
      monthlyCredits: 2000,
      knowledgeBaseChars: 1000000,
      gpt5Access: false,
      calendarManagement: false,
      appointments: false,
      humanEscalation: false,
      customDomain: false,
      whiteLabel: false,
    },
  },
  {
    name: "Pro",
    slug: "pro",
    price: {
      monthly: 49,
      yearly: 490,
    },
    originalPrice: {
      monthly: 69,
      yearly: 690,
    },
    description: "For growing businesses",
    badge: "Most Popular",
    features: [
      "2 agents",
      "1 organization",
      "2 connected WhatsApp accounts",
      "1 connected Facebook Marketplace",
      "1 connected TikTok Shop",
      "5,000 credits/month",
      "5M knowledge base characters",
      "GPT-5 model access",
      "Calendar management",
      "Appointment booking",
      "Human escalation & event alerts",
      "Advanced analytics",
      "Priority support",
    ],
    limits: {
      agents: 2,
      organizations: 1,
      whatsappConnections: 2,
      facebookConnections: 1,
      tiktokConnections: 1,
      instagramConnections: 0,
      totalIntegrations: 3, // WhatsApp (2) + Facebook + TikTok
      monthlyCredits: 5000,
      knowledgeBaseChars: 5000000,
      gpt5Access: true,
      calendarManagement: true,
      appointments: true,
      humanEscalation: true,
      customDomain: false,
      whiteLabel: false,
    },
  },
  {
    name: "Business",
    slug: "business",
    price: {
      monthly: 199,
      yearly: 1990,
    },
    originalPrice: {
      monthly: 399,
      yearly: 3990,
    },
    description: "For teams and enterprises",
    badge: "Best Value",
    features: [
      "4 agents per organization",
      "4 organizations",
      "4 connected WhatsApp accounts per organization",
      "4 Facebook connections per organization",
      "4 TikTok Shop connections per organization",
      "2 Instagram connections per organization",
      "30,000 credits/month",
      "20M knowledge base characters per organization",
      "GPT-5 model access",
      "Calendar management",
      "Appointment booking",
      "Human escalation & event alerts",
      "Custom domain & white label",
      "VIP onboarding support",
      "Advanced analytics & reporting",
      "Dedicated account manager",
    ],
    limits: {
      agents: 4, // per organization
      organizations: 4,
      whatsappConnections: 4, // per organization
      facebookConnections: 4, // per organization
      tiktokConnections: 4, // per organization
      instagramConnections: 2, // per organization
      totalIntegrations: 14, // Total across all platforms per org
      monthlyCredits: 30000,
      knowledgeBaseChars: 20000000, // per organization
      gpt5Access: true,
      calendarManagement: true,
      appointments: true,
      humanEscalation: true,
      customDomain: true,
      whiteLabel: true,
      vipSupport: true,
    },
  },
] as const;

export type PlanSlug = (typeof plans)[number]["slug"];
export type Plan = (typeof plans)[number];

/**
 * Get a plan by its slug
 */
export function getPlanBySlug(slug: string): Plan | undefined {
  return plans.find((plan) => plan.slug === slug);
}

/**
 * Check if a plan has a specific feature
 */
export function hasFeature(
  planSlug: string,
  feature: keyof Plan["limits"]
): boolean {
  const plan = getPlanBySlug(planSlug);
  if (!plan) return false;
  return !!plan.limits[feature];
}

/**
 * Get the limit value for a specific feature
 */
export function getLimit(
  planSlug: string,
  limit: keyof Plan["limits"]
): number | boolean | undefined {
  const plan = getPlanBySlug(planSlug);
  if (!plan) return undefined;
  return plan.limits[limit];
}

/**
 * Get the numeric limit for a feature (returns 0 for boolean false)
 */
export function getNumericLimit(
  planSlug: string,
  limit: keyof Plan["limits"]
): number {
  const value = getLimit(planSlug, limit);
  if (typeof value === "boolean") return value ? Infinity : 0;
  return typeof value === "number" ? value : 0;
}

/**
 * Check if a user can create more of a specific resource
 */
export function canCreateResource(
  planSlug: string,
  resourceType: "agents" | "organizations" | "whatsappConnections" | "facebookConnections" | "tiktokConnections" | "instagramConnections",
  currentCount: number
): boolean {
  const limit = getNumericLimit(planSlug, resourceType);
  return currentCount < limit;
}

/**
 * Get remaining quota for a resource
 */
export function getRemainingQuota(
  planSlug: string,
  resourceType: keyof Plan["limits"],
  currentCount: number
): number {
  const limit = getNumericLimit(planSlug, resourceType);
  const remaining = limit - currentCount;
  return Math.max(0, remaining);
}

/**
 * Platform type definition for integrations
 */
export type PlatformType = "whatsapp" | "facebook" | "tiktok" | "instagram" | "shopify" | "amazon";

/**
 * Get allowed platforms for a plan
 */
export function getAllowedPlatforms(planSlug: string): PlatformType[] {
  const plan = getPlanBySlug(planSlug);
  if (!plan) return [];

  const platforms: PlatformType[] = [];
  
  if (plan.limits.whatsappConnections > 0) platforms.push("whatsapp");
  if (plan.limits.facebookConnections > 0) platforms.push("facebook");
  if (plan.limits.tiktokConnections > 0) platforms.push("tiktok");
  if (plan.limits.instagramConnections > 0) platforms.push("instagram");
  
  // Business plan gets all platforms
  if (planSlug === "business") {
    platforms.push("shopify", "amazon");
  }

  return platforms;
}

/**
 * Check if a platform is allowed for a plan
 */
export function isPlatformAllowed(planSlug: string, platform: PlatformType): boolean {
  return getAllowedPlatforms(planSlug).includes(platform);
}

/**
 * Get platform-specific connection limit
 */
export function getPlatformLimit(planSlug: string, platform: PlatformType): number {
  const plan = getPlanBySlug(planSlug);
  if (!plan) return 0;

  const limitMap: Record<PlatformType, keyof Plan["limits"]> = {
    whatsapp: "whatsappConnections",
    facebook: "facebookConnections",
    tiktok: "tiktokConnections",
    instagram: "instagramConnections",
    shopify: "totalIntegrations",
    amazon: "totalIntegrations",
  };

  const limitKey = limitMap[platform];
  return getNumericLimit(planSlug, limitKey);
}

/**
 * Validate if user can add a new integration for a specific platform
 */
export function canAddIntegration(
  planSlug: string,
  platform: PlatformType,
  currentPlatformCount: number
): { allowed: boolean; reason?: string } {
  if (!isPlatformAllowed(planSlug, platform)) {
    return {
      allowed: false,
      reason: `Platform ${platform} is not available in your ${planSlug} plan`,
    };
  }

  const limit = getPlatformLimit(planSlug, platform);
  if (currentPlatformCount >= limit) {
    return {
      allowed: false,
      reason: `You've reached the maximum of ${limit} ${platform} connection(s) for your ${planSlug} plan`,
    };
  }

  return { allowed: true };
}

/**
 * Get upgrade message for a resource type
 */
export function getUpgradeMessage(
  currentPlan: string,
  resourceType: "agents" | "organizations" | "integrations"
): string {
  const messages: Record<typeof resourceType, string> = {
    agents: `Upgrade your plan to create more agents`,
    organizations: `Upgrade to Business plan to create multiple organizations`,
    integrations: `Upgrade your plan to connect more platforms`,
  };

  return messages[resourceType];
}