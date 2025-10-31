import { getPlanBySlug, type PlanSlug } from "@/components/settings/billing/plan";
import { db, eq, count, sql } from "@wagents/db";
import { agent } from "@wagents/db/schema/agent";
import { organization } from "@wagents/db/schema/auth";
import type { PlanFeature } from "./types";

/**
 * Check if organization can create more agents based on their plan
 */
export async function canCreateAgent(organizationId: string): Promise<{
    allowed: boolean;
    reason?: string;
    currentCount: number;
    maxAllowed: number;
}> {
    try {
        const org = await db
            .select()
            .from(organization)
            .where(eq(organization.id, organizationId))
            .limit(1);

        if (org.length === 0) {
            return {
                allowed: false,
                reason: 'Organization not found',
                currentCount: 0,
                maxAllowed: 0,
            };
        }

        const planSlug = (org[0].subscriptionPlan || 'free') as PlanSlug;
        const plan = getPlanBySlug(planSlug);

        if (!plan) {
            return {
                allowed: false,
                reason: 'Invalid subscription plan',
                currentCount: 0,
                maxAllowed: 0,
            };
        }

        // Count current agents
        const result = await db
            .select({ count: count() })
            .from(agent)
            .where(eq(agent.organizationId, organizationId));

        const currentCount = result[0]?.count || 0;
        const maxAllowed = plan.limits.agents;

        return {
            allowed: currentCount < maxAllowed,
            reason: currentCount >= maxAllowed
                ? `Your ${plan.name} plan allows only ${maxAllowed} agent(s). Upgrade to create more.`
                : undefined,
            currentCount,
            maxAllowed,
        };
    } catch (error) {
        console.error('Error checking agent creation limit:', error);
        return {
            allowed: false,
            reason: 'Error checking plan limits',
            currentCount: 0,
            maxAllowed: 0,
        };
    }
}

/**
 * Check if organization can use advanced features based on their plan
 */
export async function canUseFeature(
    organizationId: string,
    feature: PlanFeature
): Promise<boolean> {
    try {
        const org = await db
            .select()
            .from(organization)
            .where(eq(organization.id, organizationId))
            .limit(1);

        if (org.length === 0) return false;

        const planSlug = (org[0].subscriptionPlan || 'free') as PlanSlug;
        const plan = getPlanBySlug(planSlug);

        if (!plan) return false;
        const limits = plan.limits as Record<string, unknown>;
        if (['agents', 'whatsappConnections', 'monthlyCredits', 'knowledgeBaseChars', 'organizations'].includes(feature)) {
            const value = limits[feature] as number;
            return value > 0;
        }
        const value = limits[feature] as boolean | undefined;
        return value === true;

    } catch (error) {
        console.error('Error checking feature access:', error);
        return false;
    }
}

/**
 * Check if organization has enough credits
 */
export async function hasEnoughCredits(
    organizationId: string,
    requiredCredits: number
): Promise<boolean> {
    try {
        const org = await db
            .select()
            .from(organization)
            .where(eq(organization.id, organizationId))
            .limit(1);

        if (org.length === 0) return false;

        const monthlyCredits = org[0].monthlyCredits || 0;
        const usedCredits = org[0].usedCredits || 0;

        return (monthlyCredits - usedCredits) >= requiredCredits;
    } catch (error) {
        console.error('Error checking credits:', error);
        return false;
    }
}

/**
 * Deduct credits from organization
 */
export async function deductCredits(
    organizationId: string,
    credits: number
): Promise<void> {
    try {
        await db
            .update(organization)
            .set({
                usedCredits: sql`used_credits + ${credits}`,
            })
            .where(eq(organization.id, organizationId));
    } catch (error) {
        console.error('Error deducting credits:', error);
        throw error;
    }
}
