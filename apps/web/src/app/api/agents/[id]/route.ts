import { auth } from "@wagents/auth";
import { NextRequest, NextResponse } from "next/server";
import { getAgentById, updateAgent, deleteAgent, toggleAgentStatus, getAgentMetrics } from "@/lib/ai/agent/operations";
import { z } from "zod";

const updateAgentSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().optional(),
    systemPrompt: z.string().min(1).optional(),
    model: z.string().optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().min(1).max(32000).optional(),
    communicationStyle: z.enum(['normal', 'formal', 'casual', 'friendly', 'professional']).optional(),
    status: z.enum(['active', 'inactive', 'error']).optional(),
    settings: z.object({
        greeting: z.string().optional(),
        fallbackMessage: z.string().optional(),
        handoffToHuman: z.boolean().optional(),
        handoffConditions: z.array(z.string()).optional(),
        businessHours: z.object({
            enabled: z.boolean(),
            timezone: z.string().optional(),
            schedule: z.record(z.object({
                open: z.string(),
                close: z.string(),
            })).optional(),
        }).optional(),
        language: z.string().optional(),
        responseDelay: z.number().min(0).optional(),
        maxMessagesPerConversation: z.number().min(1).optional(),
        autoCloseConversationAfter: z.number().min(1).optional(),
    }).optional(),
    knowledgeBaseIds: z.array(z.string()).optional(),
});

/**
 * GET /api/agents/[id]
 * Get a specific agent by ID
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
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

        const { id } = await params;
        const result = await getAgentById(id);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: 404 }
            );
        }

        // Verify the agent belongs to the user's organization
        if (result.agent?.organizationId !== session.user.organizationId) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 403 }
            );
        }

        return NextResponse.json({ agent: result.agent });
    } catch (error: any) {
        console.error('Error getting agent:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/agents/[id]
 * Update a specific agent
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
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

        const { id } = await params;
        const body = await request.json();
        const validatedData = updateAgentSchema.parse(body);

        const result = await updateAgent({
            id,
            organizationId: session.user.organizationId,
            ...validatedData,
        });

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: 400 }
            );
        }

        return NextResponse.json({ agent: result.agent });
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: 'Validation error', details: error.errors },
                { status: 400 }
            );
        }
        console.error('Error updating agent:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/agents/[id]
 * Delete a specific agent
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
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

        const { id } = await params;
        const result = await deleteAgent(id, session.user.organizationId);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: 400 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting agent:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
