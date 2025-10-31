import { auth } from "@wagents/auth";
import { NextRequest, NextResponse } from "next/server";
import { getIntegrationById, updateIntegration, deleteIntegration } from "@/lib/integrations/operations";
import { z } from "zod";

const updateIntegrationSchema = z.object({
    credentials: z.record(z.any()).optional(),
    settings: z.record(z.any()).optional(),
    status: z.enum(['connected', 'disconnected', 'error', 'pending', 'syncing', 'needs_reauth']).optional(),
});

/**
 * GET /api/integrations/[id]
 * Get a specific integration by ID
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
        const result = await getIntegrationById(id, session.user.organizationId);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: 404 }
            );
        }

        return NextResponse.json({ integration: result.integration });
    } catch (error: any) {
        console.error('Error getting integration:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/integrations/[id]
 * Update a specific integration
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
        const validatedData = updateIntegrationSchema.parse(body);

        const result = await updateIntegration({
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

        return NextResponse.json({ integration: result.integration });
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: 'Validation error', details: error.errors },
                { status: 400 }
            );
        }
        console.error('Error updating integration:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/integrations/[id]
 * Delete a specific integration
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
        const result = await deleteIntegration(id, session.user.organizationId);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: 400 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting integration:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
