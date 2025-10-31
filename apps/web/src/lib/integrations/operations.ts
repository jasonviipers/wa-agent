import { db, eq, and } from "@wagents/db";
import { integration } from "@wagents/db/schema/integration";
import type { PlatformType, IntegrationStatus } from "@wagents/db/schema/integration";

export interface CreateIntegrationInput {
    organizationId: string;
    userId: string;
    platform: PlatformType;
    credentials: Record<string, any>;
    settings?: Record<string, any>;
}

export interface UpdateIntegrationInput {
    id: string;
    organizationId: string;
    credentials?: Record<string, any>;
    settings?: Record<string, any>;
    status?: IntegrationStatus;
}

/**
 * Create a new integration
 */
export async function createIntegration(input: CreateIntegrationInput) {
    try {
        // Check if integration already exists for this platform
        const existing = await db
            .select()
            .from(integration)
            .where(
                and(
                    eq(integration.organizationId, input.organizationId),
                    eq(integration.platform, input.platform)
                )
            )
            .limit(1);

        if (existing.length > 0) {
            throw new Error(`Integration for ${input.platform} already exists`);
        }

        const newIntegration = await db.insert(integration).values({
            organizationId: input.organizationId,
            userId: input.userId,
            platform: input.platform,
            credentials: input.credentials,
            settings: input.settings || {},
            status: 'pending',
            isActive: false,
        }).returning();

        return {
            success: true,
            integration: newIntegration[0],
        };
    } catch (error: any) {
        console.error('Error creating integration:', error);
        return {
            success: false,
            error: error.message || 'Failed to create integration',
        };
    }
}

/**
 * Update an existing integration
 */
export async function updateIntegration(input: UpdateIntegrationInput) {
    try {
        const { id, organizationId, ...updateData } = input;

        const updated = await db
            .update(integration)
            .set({
                ...updateData,
                updatedAt: new Date(),
            })
            .where(
                and(
                    eq(integration.id, id),
                    eq(integration.organizationId, organizationId)
                )
            )
            .returning();

        if (updated.length === 0) {
            throw new Error('Integration not found');
        }

        return {
            success: true,
            integration: updated[0],
        };
    } catch (error: any) {
        console.error('Error updating integration:', error);
        return {
            success: false,
            error: error.message || 'Failed to update integration',
        };
    }
}

/**
 * Delete an integration
 */
export async function deleteIntegration(integrationId: string, organizationId: string) {
    try {
        await db
            .delete(integration)
            .where(
                and(
                    eq(integration.id, integrationId),
                    eq(integration.organizationId, organizationId)
                )
            );

        return {
            success: true,
        };
    } catch (error: any) {
        console.error('Error deleting integration:', error);
        return {
            success: false,
            error: error.message || 'Failed to delete integration',
        };
    }
}

/**
 * Get integration by ID
 */
export async function getIntegrationById(integrationId: string, organizationId: string) {
    try {
        const integrationData = await db
            .select()
            .from(integration)
            .where(
                and(
                    eq(integration.id, integrationId),
                    eq(integration.organizationId, organizationId)
                )
            )
            .limit(1);

        if (integrationData.length === 0) {
            return { success: false, error: 'Integration not found' };
        }

        return {
            success: true,
            integration: integrationData[0],
        };
    } catch (error: any) {
        console.error('Error getting integration:', error);
        return {
            success: false,
            error: error.message || 'Failed to get integration',
        };
    }
}

/**
 * List all integrations for an organization
 */
export async function listIntegrations(organizationId: string) {
    try {
        const integrations = await db
            .select()
            .from(integration)
            .where(eq(integration.organizationId, organizationId))
            .orderBy(integration.createdAt);

        return {
            success: true,
            integrations,
        };
    } catch (error: any) {
        console.error('Error listing integrations:', error);
        return {
            success: false,
            error: error.message || 'Failed to list integrations',
        };
    }
}

/**
 * Toggle integration active status
 */
export async function toggleIntegrationStatus(integrationId: string, organizationId: string) {
    try {
        const integrationData = await db
            .select()
            .from(integration)
            .where(
                and(
                    eq(integration.id, integrationId),
                    eq(integration.organizationId, organizationId)
                )
            )
            .limit(1);

        if (integrationData.length === 0) {
            throw new Error('Integration not found');
        }

        const isActive = integrationData[0].isActive;

        const updated = await db
            .update(integration)
            .set({
                isActive: !isActive,
                status: !isActive ? 'connected' : 'disconnected',
                updatedAt: new Date(),
            })
            .where(eq(integration.id, integrationId))
            .returning();

        return {
            success: true,
            integration: updated[0],
        };
    } catch (error: any) {
        console.error('Error toggling integration status:', error);
        return {
            success: false,
            error: error.message || 'Failed to toggle integration status',
        };
    }
}

/**
 * Test integration connection
 */
export async function testIntegrationConnection(integrationId: string, organizationId: string) {
    try {
        const result = await getIntegrationById(integrationId, organizationId);

        if (!result.success || !result.integration) {
            throw new Error('Integration not found');
        }

        const { platform, credentials } = result.integration;

        // Test connection based on platform
        let connectionTest = false;

        switch (platform) {
            case 'shopify': {
                const { ShopifyService } = await import('./shopify');
                const shopify = new ShopifyService(
                    credentials.shopDomain,
                    credentials.accessToken
                );
                try {
                    await shopify.getProducts({ limit: 1 });
                    connectionTest = true;
                } catch (error) {
                    connectionTest = false;
                }
                break;
            }
            case 'whatsapp': {
                const { WhatsAppService } = await import('./whatsapp');
                const whatsapp = new WhatsAppService(
                    credentials.phoneNumberId,
                    credentials.accessToken
                );
                try {
                    await whatsapp.getBusinessProfile();
                    connectionTest = true;
                } catch (error) {
                    connectionTest = false;
                }
                break;
            }
            case 'facebook_marketplace': {
                const { FacebookMarketplaceService } = await import('./facebook-marketplace');
                const facebook = new FacebookMarketplaceService(
                    credentials.catalogId,
                    credentials.accessToken
                );
                try {
                    await facebook.getCatalog();
                    connectionTest = true;
                } catch (error) {
                    connectionTest = false;
                }
                break;
            }
            default:
                connectionTest = true; // For platforms without test implementation
        }

        // Update status based on test result
        await db
            .update(integration)
            .set({
                status: connectionTest ? 'connected' : 'error',
                lastSyncAt: connectionTest ? new Date() : undefined,
            })
            .where(eq(integration.id, integrationId));

        return {
            success: true,
            connected: connectionTest,
        };
    } catch (error: any) {
        console.error('Error testing integration connection:', error);

        // Update status to error
        await db
            .update(integration)
            .set({
                status: 'error',
                syncError: error.message,
            })
            .where(eq(integration.id, integrationId));

        return {
            success: false,
            error: error.message || 'Failed to test integration connection',
            connected: false,
        };
    }
}
