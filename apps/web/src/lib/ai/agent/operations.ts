import { agent, agentKnowledgeBase, knowledgeBase } from "@wagents/db/schema/agent";
import { canCreateAgent, canUseFeature } from "./management";
import type { CreateAgentInput, UpdateAgentInput } from "./types";
import { and, count, db, eq } from "@wagents/db";


/**
 * Create a new agent
 */
export async function createAgent(input: CreateAgentInput) {
    try {
        const canCreate = await canCreateAgent(input.organizationId);

        if (!canCreate.allowed) {
            throw new Error(canCreate.reason || 'Cannot create agent');
        }

        // Validate model access
        if (input.model?.includes('gpt-5') || input.model?.includes('o1')) {
            const hasAccess = await canUseFeature(input.organizationId, 'gpt5Access');
            if (!hasAccess) {
                throw new Error('Your plan does not include access to advanced models. Please upgrade.');
            }
        }

        const newAgent = await db.insert(agent).values({
            organizationId: input.organizationId,
            userId: input.userId,
            createdBy: input.userId,
            name: input.name,
            description: input.description,
            systemPrompt: input.systemPrompt,
            model: input.model || 'gpt-4o-mini',
            temperature: input.temperature?.toString() || '0.7',
            maxTokens: input.maxTokens || 1000,
            communicationStyle: input.communicationStyle || 'normal',
            status: 'inactive',
            settings: input.settings as {
                greeting?: string | undefined;
                fallbackMessage?: string | undefined;
                handoffToHuman?: boolean | undefined;
                handoffConditions?: string[] | undefined;
                businessHours?: {
                    enabled: boolean;
                    timezone?: string;
                    schedule?: Record<string, {
                        open: string;
                        close: string;
                    }>;
                };
                language?: string;
                responseDelay?: number;
                maxMessagesPerConversation?: number;
                autoCloseConversationAfter?: number;
            }
        }).returning();

        // Connect knowledge bases if provided
        if (input.knowledgeBaseIds && input.knowledgeBaseIds.length > 0) {
            await Promise.all(
                input.knowledgeBaseIds.map(kbId =>
                    db.insert(agentKnowledgeBase).values({
                        agentId: newAgent[0].id,
                        knowledgeBaseId: kbId,
                        priority: 0,
                        isEnabled: true,
                        createdAt: new Date(),
                    })
                )
            );
        }

        return {
            success: true,
            agent: newAgent[0],
        };
    } catch (error: any) {
        console.error('Error creating agent:', error);
        return {
            success: false,
            error: error.message || 'Failed to create agent',
        };
    }
}

/**
 * Update an existing agent
 */
export async function updateAgent(input: UpdateAgentInput) {
    try {
        const { id, knowledgeBaseIds, ...updateData } = input;

        // Validate model access if model is being changed
        if (updateData.model?.includes('gpt-5') || updateData.model?.includes('o1')) {
            const hasAccess = await canUseFeature(input.organizationId!, 'gpt5Access');
            if (!hasAccess) {
                throw new Error('Your plan does not include access to advanced models. Please upgrade.');
            }
        }

        // Update agent
        const updated = await db
            .update(agent)
            .set({
                ...updateData,
                temperature: updateData.temperature?.toString(),
                settings: updateData.settings as any,
                updatedAt: new Date(),
            })
            .where(eq(agent.id, id))
            .returning();

        // Update knowledge bases if provided
        if (knowledgeBaseIds) {
            // Remove existing connections
            await db
                .delete(agentKnowledgeBase)
                .where(eq(agentKnowledgeBase.agentId, id));

            // Add new connections
            if (knowledgeBaseIds.length > 0) {
                await Promise.all(
                    knowledgeBaseIds.map(kbId =>
                        db.insert(agentKnowledgeBase).values({
                            agentId: id,
                            knowledgeBaseId: kbId,
                            priority: 0,
                            isEnabled: true,
                            createdAt: new Date(),
                        })
                    )
                );
            }
        }

        return {
            success: true,
            agent: updated[0],
        };
    } catch (error: any) {
        console.error('Error updating agent:', error);
        return {
            success: false,
            error: error.message || 'Failed to update agent',
        };
    }
}

/**
 * Delete an agent
 */
export async function deleteAgent(agentId: string, organizationId: string) {
    try {
        await db
            .delete(agent)
            .where(
                and(
                    eq(agent.id, agentId),
                    eq(agent.organizationId, organizationId)
                )
            );

        return {
            success: true,
        };
    } catch (error: any) {
        console.error('Error deleting agent:', error);
        return {
            success: false,
            error: error.message || 'Failed to delete agent',
        };
    }
}

/**
 * Get agent by ID with all related data
 */
export async function getAgentById(agentId: string) {
    try {
        const agentData = await db
            .select()
            .from(agent)
            .where(eq(agent.id, agentId))
            .limit(1);

        if (agentData.length === 0) {
            return { success: false, error: 'Agent not found' };
        }

        // Get connected knowledge bases
        const knowledgeBases = await db
            .select({
                id: knowledgeBase.id,
                name: knowledgeBase.name,
                type: knowledgeBase.type,
                entriesCount: knowledgeBase.entriesCount,
                isEnabled: agentKnowledgeBase.isEnabled,
                priority: agentKnowledgeBase.priority,
            })
            .from(agentKnowledgeBase)
            .innerJoin(knowledgeBase, eq(agentKnowledgeBase.knowledgeBaseId, knowledgeBase.id))
            .where(eq(agentKnowledgeBase.agentId, agentId));

        return {
            success: true,
            agent: {
                ...agentData[0],
                knowledgeBases,
            },
        };
    } catch (error: any) {
        console.error('Error getting agent:', error);
        return {
            success: false,
            error: error.message || 'Failed to get agent',
        };
    }
}


/**
 * List all agents for an organization
 */
export async function listAgents(organizationId: string) {
    try {
        const agents = await db
            .select()
            .from(agent)
            .where(eq(agent.organizationId, organizationId))
            .orderBy(agent.createdAt);

        return {
            success: true,
            agents,
        };
    } catch (error: any) {
        console.error('Error listing agents:', error);
        return {
            success: false,
            error: error.message || 'Failed to list agents',
        };
    }
}

/**
 * Toggle agent status (active/inactive)
 */
export async function toggleAgentStatus(agentId: string, organizationId: string) {
    try {
        const agentData = await db
            .select()
            .from(agent)
            .where(
                and(
                    eq(agent.id, agentId),
                    eq(agent.organizationId, organizationId)
                )
            )
            .limit(1);

        if (agentData.length === 0) {
            throw new Error('Agent not found');
        }

        const currentStatus = agentData[0].status;
        const newStatus = currentStatus === 'active' ? 'inactive' : 'active';

        const updated = await db
            .update(agent)
            .set({
                status: newStatus,
                updatedAt: new Date(),
            })
            .where(eq(agent.id, agentId))
            .returning();

        return {
            success: true,
            agent: updated[0],
        };
    } catch (error: any) {
        console.error('Error toggling agent status:', error);
        return {
            success: false,
            error: error.message || 'Failed to toggle agent status',
        };
    }
}

/**
 * Get agent metrics
 */
export async function getAgentMetrics(agentId: string) {
    try {
        const { conversation, message } = await import('@wagents/db/schema/conversation');

        // Get conversation stats
        const [conversationStats] = await db
            .select({
                total: count(),
            })
            .from(conversation)
            .where(eq(conversation.agentId, agentId));

        // Get message stats
        const conversations = await db
            .select({ id: conversation.id })
            .from(conversation)
            .where(eq(conversation.agentId, agentId));

        const conversationIds = conversations.map(c => c.id);

        let messageStats = { total: 0 };
        if (conversationIds.length > 0) {
            [messageStats] = await db
                .select({
                    total: count(),
                })
                .from(message)
                .where(
                    and(
                        eq(message.role, 'assistant')
                    )
                );
        }

        // Get agent data for credits
        const agentData = await db
            .select()
            .from(agent)
            .where(eq(agent.id, agentId))
            .limit(1);

        return {
            success: true,
            metrics: {
                totalConversations: conversationStats.total || 0,
                totalMessages: messageStats.total || 0,
                activeConversations: agentData[0]?.metrics?.activeConversations || 0,
                averageResponseTime: agentData[0]?.metrics?.averageResponseTime || 0,
                successRate: agentData[0]?.metrics?.successRate || 0,
                customerSatisfaction: agentData[0]?.metrics?.customerSatisfaction || 0,
            },
        };
    } catch (error: any) {
        console.error('Error getting agent metrics:', error);
        return {
            success: false,
            error: error.message || 'Failed to get agent metrics',
        };
    }
}