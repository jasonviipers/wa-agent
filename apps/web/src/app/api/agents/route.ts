import { auth } from "@wagents/auth";
import { NextRequest, NextResponse } from "next/server";
import { createAgent, listAgents } from "@/lib/ai/agent/operations";
import { z } from "zod";

const createAgentSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().optional(),
    systemPrompt: z.string().min(1),
    model: z.string().default('gpt-4o-mini'),
    temperature: z.number().min(0).max(2).default(0.7),
    maxTokens: z.number().min(1).max(32000).default(1000),
    communicationStyle: z.enum(['normal', 'formal', 'casual', 'friendly', 'professional']).default('normal'),
    settings: z.object({
        greeting: z.string().optional(),
        fallbackMessage: z.string().optional(),
        handoffToHuman: z.boolean().default(false),
        handoffConditions: z.array(z.string()).optional(),
        businessHours: z.object({
            enabled: z.boolean(),
            timezone: z.string().optional(),
            schedule: z.record(z.object({
                open: z.string(),
                close: z.string(),
            })).optional(),
        }).optional(),
        language: z.string().default('en'),
        responseDelay: z.number().min(0).optional(),
        maxMessagesPerConversation: z.number().min(1).optional(),
        autoCloseConversationAfter: z.number().min(1).optional(),
    }).optional(),
    knowledgeBaseIds: z.array(z.string()).optional(),
});

/**
 * GET /api/agents
 * List all agents for the organization
 */
export async function GET(request: NextRequest) {
    try {
        const session = await auth.api.getSession({
            headers: request.headers
        });

        if (!session?.user?.organizationId) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const result = await listAgents(session.user.organizationId);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: 400 }
            );
        }

        return NextResponse.json({ agents: result.agents });
    } catch (error: any) {
        console.error('Error listing agents:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/agents
 * Create a new agent
 */
export async function POST(request: NextRequest) {
    try {
        const session = await auth.api.getSession({
            headers: request.headers
        });

        if (!session?.user?.organizationId || !session?.user?.id) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const validatedData = createAgentSchema.parse(body);

        const result = await createAgent({
            ...validatedData,
            organizationId: session.user.organizationId,
            userId: session.user.id,
        });

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { agent: result.agent },
            { status: 201 }
        );
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: 'Validation error', details: error.errors },
                { status: 400 }
            );
        }
        console.error('Error creating agent:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
