import type { AgentConfig, ConversationContext } from "../types";
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { generateText, stepCountIs, streamText, type ModelMessage } from "ai";
import { calculateCredits, saveMessage } from "../helper";
import { createAgenticKnowledgeSearchTool, createHandoffTool, CreateOrderTool, createProductSearchTool } from "../tools/core";

/**
 * Main agent execution function
 * Handles a single message in a conversation
 */
export async function executeAgentWithAgenticRAG({
    agentConfig,
    context,
    userMessage,
    stream = false,
}: {
    agentConfig: AgentConfig;
    context: ConversationContext;
    userMessage: string;
    stream?: boolean;
}) {
    const modelProvider = agentConfig.model.startsWith('gpt')
        ? openai(agentConfig.model)
        : anthropic(agentConfig.model);

    const systemPrompt = `${agentConfig.systemPrompt}

        IMPORTANT INSTRUCTIONS:
        - You are an AI sales and customer support agent for ${agentConfig.name}
        - You have access to an advanced knowledge base search system
        - When you need information, use the search_knowledge tool
        - The system will intelligently retrieve and validate information
        - Always cite sources when using knowledge base information
        - Be helpful, professional, and concise
        ${agentConfig.settings.handoffToHuman ? '- Escalate to human when appropriate using the handoff tool' : ''}

        Customer Context:
        - Platform: ${context.platform}
        - Customer: ${context.customerName || 'Guest'}
        ${context.customerId ? `- Customer ID: ${context.customerId}` : ''}
        `;

    const messages: ModelMessage[] = [
        ...context.history,
        { role: 'user', content: userMessage }
    ];

    const tools = {
        searchKnowledge: createAgenticKnowledgeSearchTool(agentConfig),
        searchProducts: createProductSearchTool(agentConfig.organizationId),
        createOrder: CreateOrderTool(agentConfig.organizationId),
        ...(agentConfig.settings.handoffToHuman && {
            handoffToHuman: createHandoffTool(context.conversationId)
        })
    };

    try {
        if (stream) {
            const result = await streamText({
                model: modelProvider,
                system: systemPrompt,
                messages,
                tools,
                temperature: agentConfig.temperature,
                maxOutputTokens: agentConfig.maxTokens,
                stopWhen: stepCountIs(5), // Allow multiple tool calls
                onFinish: async ({ text, toolCalls, usage }) => {
                    await saveMessage({
                        conversationId: context.conversationId,
                        role: 'assistant',
                        content: text,
                        toolCalls,
                        creditsUsed: calculateCredits(usage),
                    });
                },
            });
            return result;
        } else {
            const result = await generateText({
                model: modelProvider,
                system: systemPrompt,
                messages,
                tools,
                temperature: agentConfig.temperature,
                maxOutputTokens: agentConfig.maxTokens,
                maxRetries: 3,
                stopWhen: stepCountIs(5),
            });

            await saveMessage({
                conversationId: context.conversationId,
                role: 'assistant',
                content: result.text,
                toolCalls: result.toolCalls,
                creditsUsed: calculateCredits(result.usage),
            });

            return result;
        }
    } catch (error) {
        console.error('Agent execution error:', error);

        const fallbackMessage = agentConfig.settings.fallbackMessage ||
            "I apologize, but I'm having trouble processing your request right now. Please try again or contact our support team.";

        await saveMessage({
            conversationId: context.conversationId,
            role: 'assistant',
            content: fallbackMessage,
            creditsUsed: 0,
        });

        return { text: fallbackMessage };
    }
}
