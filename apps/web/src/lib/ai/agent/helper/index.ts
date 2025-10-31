import { and, db, eq, sql } from '@wagents/db';
import { agent } from '@wagents/db/schema/agent';
import { conversation, message } from '@wagents/db/schema/conversation';
import type { AgentConfig, ConversationContext } from '../types';
import type { ModelMessage } from 'ai';

/**
 * Save message to database
 */
export async function saveMessage({
    conversationId,
    role,
    content,
    toolCalls,
    creditsUsed,
}: {
    conversationId: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    toolCalls?: any[];
    creditsUsed: number;
}) {
    try {
        await db.insert(message).values({
            conversationId,
            role,
            content,
            creditsUsed,
            metadata: toolCalls ? { toolCalls } : undefined,
            createdAt: new Date(),
        });

        // Update conversation stats
        await db
            .update(conversation)
            .set({
                messageCount: sql`message_count + 1`,
                lastMessageAt: new Date(),
                totalCreditsUsed: sql`total_credits_used + ${creditsUsed}`,
            })
            .where(eq(conversation.id, conversationId));

    } catch (error) {
        console.error('Error saving message:', error);
    }
}

/**
 * Calculate credits based on token usage
 */
export function calculateCredits(usage: any): number {
    //TODO:: Example pricing: 1 credit per 1000 tokens
    const totalTokens = (usage.promptTokens || 0) + (usage.completionTokens || 0);
    return Math.ceil(totalTokens / 1000);
}

/**
 * Load agent configuration from database
 */
export async function loadAgentConfig(agentId: string): Promise<AgentConfig | null> {
    try {
        const result = await db
            .select()
            .from(agent)
            .where(eq(agent.id, agentId))
            .limit(1);

        if (result.length === 0) return null;

        const agentData = result[0];

        // Load connected knowledge bases
        const { agentKnowledgeBase } = await import('@wagents/db/schema/agent');
        const knowledgeBases = await db
            .select({ knowledgeBaseId: agentKnowledgeBase.knowledgeBaseId })
            .from(agentKnowledgeBase)
            .where(
                and(
                    eq(agentKnowledgeBase.agentId, agentId),
                    eq(agentKnowledgeBase.isEnabled, true)
                )
            );

        return {
            id: agentData.id,
            organizationId: agentData.organizationId,
            name: agentData.name,
            systemPrompt: agentData.systemPrompt,
            model: agentData.model,
            temperature: parseFloat(agentData.temperature?.toString() || '0.7'),
            maxTokens: agentData.maxTokens || 1000,
            settings: (agentData.settings as any) || {},
            knowledgeBases: knowledgeBases.map(kb => kb.knowledgeBaseId),
        };
    } catch (error) {
        console.error('Error loading agent config:', error);
        return null;
    }
}

/**
 * Load conversation context
 */
export async function loadConversationContext(
    conversationId: string
): Promise<ConversationContext | null> {
    try {
        const convData = await db
            .select()
            .from(conversation)
            .where(eq(conversation.id, conversationId))
            .limit(1);

        if (convData.length === 0) return null;

        const conv = convData[0];

        // Load message history
        const messages = await db
            .select()
            .from(message)
            .where(eq(message.conversationId, conversationId))
            .orderBy(message.createdAt)
            .limit(50); // Last 50 messages

        const history: ModelMessage[] = messages.map(msg => ({
            role: msg.role as 'user' | 'assistant' | 'system',
            content: msg.content,
        }));

        return {
            conversationId: conv.id,
            customerId: conv.customerId || undefined,
            customerName: conv.customerName || undefined,
            platform: conv.platform,
            history,
        };
    } catch (error) {
        console.error('Error loading conversation context:', error);
        return null;
    }
}