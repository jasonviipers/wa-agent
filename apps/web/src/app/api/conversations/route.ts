import { auth } from "@wagents/auth";
import { NextRequest, NextResponse } from "next/server";
import { listConversations, createConversation } from "@/lib/conversations/operations";
import { z } from "zod";

const createConversationSchema = z.object({
    agentId: z.string(),
    platform: z.string(),
    customerId: z.string().optional(),
    customerName: z.string().optional(),
    customerPhone: z.string().optional(),
    customerEmail: z.string().email().optional(),
    metadata: z.record(z.any()).optional(),
});

/**
 * GET /api/conversations
 * List conversations for the organization
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

        const { searchParams } = new URL(request.url);
        const agentId = searchParams.get('agentId') || undefined;
        const status = searchParams.get('status') as 'active' | 'closed' | 'handed_off' | undefined;
        const platform = searchParams.get('platform') || undefined;
        const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
        const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined;

        const result = await listConversations(session.user.organizationId, {
            agentId,
            status,
            platform,
            limit,
            offset,
        });

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: 400 }
            );
        }

        return NextResponse.json({ conversations: result.conversations });
    } catch (error: any) {
        console.error('Error listing conversations:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/conversations
 * Create a new conversation
 */
export async function POST(request: NextRequest) {
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

        const body = await request.json();
        const validatedData = createConversationSchema.parse(body);

        const result = await createConversation({
            ...validatedData,
            organizationId: session.user.organizationId,
        });

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { conversation: result.conversation },
            { status: 201 }
        );
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: 'Validation error', details: error.errors },
                { status: 400 }
            );
        }
        console.error('Error creating conversation:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
