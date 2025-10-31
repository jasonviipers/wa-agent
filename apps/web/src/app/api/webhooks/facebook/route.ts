import { NextRequest, NextResponse } from "next/server";
import { db, eq, and } from "@wagents/db";
import { integration } from "@wagents/db/schema/integration";
import { conversation, message } from "@wagents/db/schema/conversation";
import { agent } from "@wagents/db/schema/agent";
import { FacebookMarketplaceService } from "@/lib/integrations/facebook-marketplace";
import { executeAgentWithAgenticRAG } from "@/lib/ai/agent/engine";
import { createConversation, addMessage } from "@/lib/conversations/operations";

/**
 * GET /api/webhooks/facebook
 * Facebook webhook verification
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    // Verify the webhook
    const VERIFY_TOKEN = process.env.FACEBOOK_VERIFY_TOKEN || 'wagents_verify_token';

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('Facebook webhook verified');
        return new NextResponse(challenge, { status: 200 });
    }

    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

/**
 * POST /api/webhooks/facebook
 * Facebook Messenger webhook handler for incoming messages
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Facebook sends test messages during webhook setup
        if (!body.entry) {
            return NextResponse.json({ success: true });
        }

        // Process each entry
        for (const entry of body.entry) {
            const messaging = entry.messaging;

            if (!messaging) continue;

            for (const event of messaging) {
                // Skip if not a message event or if it's an echo
                if (!event.message || event.message.is_echo) continue;

                const senderId = event.sender.id;
                const messageText = event.message.text;
                const pageId = event.recipient.id;

                if (!messageText) continue;

                // Find the integration for this page
                const integrations = await db
                    .select()
                    .from(integration)
                    .where(
                        and(
                            eq(integration.platform, 'facebook_marketplace'),
                            eq(integration.isActive, true)
                        )
                    );

                const matchingIntegration = integrations.find(
                    (int: any) => int.credentials.pageId === pageId
                );

                if (!matchingIntegration) {
                    console.error('No matching Facebook integration found for page:', pageId);
                    continue;
                }

                // Find active agents for this organization
                const agents = await db
                    .select()
                    .from(agent)
                    .where(
                        and(
                            eq(agent.organizationId, matchingIntegration.organizationId),
                            eq(agent.status, 'active')
                        )
                    )
                    .limit(1);

                if (agents.length === 0) {
                    console.error('No active agents found for organization:', matchingIntegration.organizationId);
                    continue;
                }

                const selectedAgent = agents[0];

                // Find or create conversation
                let existingConversation = await db
                    .select()
                    .from(conversation)
                    .where(
                        and(
                            eq(conversation.organizationId, matchingIntegration.organizationId),
                            eq(conversation.platform, 'facebook_marketplace'),
                            eq(conversation.customerId, senderId),
                            eq(conversation.status, 'active')
                        )
                    )
                    .limit(1);

                let conversationId: string;

                if (existingConversation.length === 0) {
                    // Create new conversation
                    const newConv = await createConversation({
                        organizationId: matchingIntegration.organizationId,
                        agentId: selectedAgent.id,
                        platform: 'facebook_marketplace',
                        customerId: senderId,
                        metadata: {
                            pageId,
                        },
                    });

                    if (!newConv.success) {
                        console.error('Failed to create conversation:', newConv.error);
                        continue;
                    }

                    conversationId = newConv.conversation!.id;
                } else {
                    conversationId = existingConversation[0].id;
                }

                // Add user message to conversation
                await addMessage({
                    conversationId,
                    role: 'user',
                    content: messageText,
                    contentType: 'text',
                    metadata: {
                        facebookMessageId: event.message.mid,
                        timestamp: event.timestamp,
                    },
                });

                // Get conversation history
                const conversationHistory = await db
                    .select()
                    .from(message)
                    .where(eq(message.conversationId, conversationId))
                    .orderBy(message.createdAt)
                    .limit(20);

                // Execute agent to generate response
                const agentResponse = await executeAgentWithAgenticRAG({
                    agentId: selectedAgent.id,
                    messages: conversationHistory.map(m => ({
                        role: m.role as 'user' | 'assistant' | 'system',
                        content: m.content,
                    })),
                    organizationId: matchingIntegration.organizationId,
                    streaming: false,
                });

                if (!agentResponse.success || !agentResponse.response) {
                    console.error('Agent execution failed:', agentResponse.error);
                    continue;
                }

                const responseText = typeof agentResponse.response === 'string'
                    ? agentResponse.response
                    : agentResponse.response.content;

                // Save agent response to conversation
                await addMessage({
                    conversationId,
                    role: 'assistant',
                    content: responseText,
                    contentType: 'text',
                    credits: agentResponse.creditsUsed,
                });

                // Send response via Facebook Messenger
                const facebook = new FacebookMarketplaceService(
                    matchingIntegration.credentials.catalogId,
                    matchingIntegration.credentials.accessToken
                );

                await facebook.sendMessage(senderId, responseText);
            }
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Facebook webhook error:', error);
        return NextResponse.json(
            { error: error.message || 'Webhook processing failed' },
            { status: 500 }
        );
    }
}
