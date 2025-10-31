import { auth } from "@wagents/auth";
import { NextRequest, NextResponse } from "next/server";
import { addMessage } from "@/lib/conversations/operations";
import { z } from "zod";

const addMessageSchema = z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string().min(1),
    contentType: z.enum(['text', 'image', 'audio', 'video', 'file', 'product', 'order']).default('text'),
    mediaUrl: z.string().url().optional(),
    metadata: z.record(z.any()).optional(),
    toolCalls: z.array(z.any()).optional(),
});

/**
 * POST /api/conversations/[id]/messages
 * Add a message to a conversation
 */
export async function POST(
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
        const validatedData = addMessageSchema.parse(body);

        const result = await addMessage({
            conversationId: id,
            ...validatedData,
        });

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { message: result.message },
            { status: 201 }
        );
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: 'Validation error', details: error.errors },
                { status: 400 }
            );
        }
        console.error('Error adding message:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
