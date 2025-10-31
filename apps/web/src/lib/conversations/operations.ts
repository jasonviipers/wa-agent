import { db, eq, and, desc, sql } from "@wagents/db";
import { conversation, message } from "@wagents/db/schema/conversation";

/**
 * List conversations for an organization
 */
export async function listConversations(organizationId: string, filters?: {
    agentId?: string;
    status?: 'active' | 'closed' | 'handed_off';
    platform?: string;
    limit?: number;
    offset?: number;
}) {
    try {
        let query = db
            .select()
            .from(conversation)
            .where(eq(conversation.organizationId, organizationId));

        if (filters?.agentId) {
            query = query.where(eq(conversation.agentId, filters.agentId));
        }

        if (filters?.status) {
            query = query.where(eq(conversation.status, filters.status));
        }

        if (filters?.platform) {
            query = query.where(eq(conversation.platform, filters.platform));
        }

        const conversations = await query
            .orderBy(desc(conversation.updatedAt))
            .limit(filters?.limit || 50)
            .offset(filters?.offset || 0);

        return {
            success: true,
            conversations,
        };
    } catch (error: any) {
        console.error('Error listing conversations:', error);
        return {
            success: false,
            error: error.message || 'Failed to list conversations',
        };
    }
}

/**
 * Get conversation by ID with messages
 */
export async function getConversationById(conversationId: string, organizationId: string) {
    try {
        const conversationData = await db
            .select()
            .from(conversation)
            .where(
                and(
                    eq(conversation.id, conversationId),
                    eq(conversation.organizationId, organizationId)
                )
            )
            .limit(1);

        if (conversationData.length === 0) {
            return { success: false, error: 'Conversation not found' };
        }

        // Get messages
        const messages = await db
            .select()
            .from(message)
            .where(eq(message.conversationId, conversationId))
            .orderBy(message.createdAt);

        return {
            success: true,
            conversation: {
                ...conversationData[0],
                messages,
            },
        };
    } catch (error: any) {
        console.error('Error getting conversation:', error);
        return {
            success: false,
            error: error.message || 'Failed to get conversation',
        };
    }
}

/**
 * Create a new conversation
 */
export async function createConversation(input: {
    organizationId: string;
    agentId: string;
    platform: string;
    customerId?: string;
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
    metadata?: Record<string, any>;
}) {
    try {
        const newConversation = await db.insert(conversation).values({
            organizationId: input.organizationId,
            agentId: input.agentId,
            platform: input.platform,
            customerId: input.customerId,
            customerName: input.customerName,
            customerPhone: input.customerPhone,
            customerEmail: input.customerEmail,
            status: 'active',
            messageCount: 0,
            metadata: input.metadata || {},
        }).returning();

        return {
            success: true,
            conversation: newConversation[0],
        };
    } catch (error: any) {
        console.error('Error creating conversation:', error);
        return {
            success: false,
            error: error.message || 'Failed to create conversation',
        };
    }
}

/**
 * Update conversation status
 */
export async function updateConversationStatus(
    conversationId: string,
    organizationId: string,
    status: 'active' | 'closed' | 'handed_off'
) {
    try {
        const updated = await db
            .update(conversation)
            .set({
                status,
                updatedAt: new Date(),
            })
            .where(
                and(
                    eq(conversation.id, conversationId),
                    eq(conversation.organizationId, organizationId)
                )
            )
            .returning();

        if (updated.length === 0) {
            throw new Error('Conversation not found');
        }

        return {
            success: true,
            conversation: updated[0],
        };
    } catch (error: any) {
        console.error('Error updating conversation status:', error);
        return {
            success: false,
            error: error.message || 'Failed to update conversation status',
        };
    }
}

/**
 * Add a message to a conversation
 */
export async function addMessage(input: {
    conversationId: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    contentType?: 'text' | 'image' | 'audio' | 'video' | 'file' | 'product' | 'order';
    mediaUrl?: string;
    metadata?: Record<string, any>;
    toolCalls?: any[];
    credits?: number;
}) {
    try {
        const newMessage = await db.insert(message).values({
            conversationId: input.conversationId,
            role: input.role,
            content: input.content,
            contentType: input.contentType || 'text',
            mediaUrl: input.mediaUrl,
            metadata: input.metadata || {},
            toolCalls: input.toolCalls,
            status: 'sent',
            credits: input.credits,
        }).returning();

        // Update conversation message count
        await db
            .update(conversation)
            .set({
                messageCount: sql`${conversation.messageCount} + 1`,
                updatedAt: new Date(),
            })
            .where(eq(conversation.id, input.conversationId));

        return {
            success: true,
            message: newMessage[0],
        };
    } catch (error: any) {
        console.error('Error adding message:', error);
        return {
            success: false,
            error: error.message || 'Failed to add message',
        };
    }
}

/**
 * Get conversation statistics
 */
export async function getConversationStats(organizationId: string, agentId?: string) {
    try {
        let query = db
            .select({
                total: sql<number>`count(*)`,
                active: sql<number>`count(*) filter (where ${conversation.status} = 'active')`,
                closed: sql<number>`count(*) filter (where ${conversation.status} = 'closed')`,
                handedOff: sql<number>`count(*) filter (where ${conversation.status} = 'handed_off')`,
            })
            .from(conversation)
            .where(eq(conversation.organizationId, organizationId));

        if (agentId) {
            query = query.where(eq(conversation.agentId, agentId));
        }

        const [stats] = await query;

        return {
            success: true,
            stats,
        };
    } catch (error: any) {
        console.error('Error getting conversation stats:', error);
        return {
            success: false,
            error: error.message || 'Failed to get conversation stats',
        };
    }
}
