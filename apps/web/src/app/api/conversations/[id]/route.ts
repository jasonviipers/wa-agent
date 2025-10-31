import { auth } from "@wagents/auth";
import { NextRequest, NextResponse } from "next/server";
import { getConversationById, updateConversationStatus } from "@/lib/conversations/operations";
import { z } from "zod";

const updateConversationSchema = z.object({
    status: z.enum(['active', 'closed', 'handed_off']),
});

/**
 * GET /api/conversations/[id]
 * Get a specific conversation by ID with messages
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
        const result = await getConversationById(id, session.user.organizationId);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: 404 }
            );
        }

        return NextResponse.json({ conversation: result.conversation });
    } catch (error: any) {
        console.error('Error getting conversation:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/conversations/[id]
 * Update conversation status
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
        const validatedData = updateConversationSchema.parse(body);

        const result = await updateConversationStatus(
            id,
            session.user.organizationId,
            validatedData.status
        );

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: 400 }
            );
        }

        return NextResponse.json({ conversation: result.conversation });
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: 'Validation error', details: error.errors },
                { status: 400 }
            );
        }
        console.error('Error updating conversation:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
