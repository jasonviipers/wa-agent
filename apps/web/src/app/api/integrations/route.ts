import { auth } from "@wagents/auth";
import { NextRequest, NextResponse } from "next/server";
import { createIntegration, listIntegrations } from "@/lib/integrations/operations";
import { z } from "zod";

const createIntegrationSchema = z.object({
    platform: z.enum(['shopify', 'facebook_marketplace', 'whatsapp', 'tiktok_shop', 'amazon', 'instagram', 'internal']),
    credentials: z.record(z.any()),
    settings: z.record(z.any()).optional(),
});

/**
 * GET /api/integrations
 * List all integrations for the organization
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

        const result = await listIntegrations(session.user.organizationId);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: 400 }
            );
        }

        return NextResponse.json({ integrations: result.integrations });
    } catch (error: any) {
        console.error('Error listing integrations:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/integrations
 * Create a new integration
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
        const validatedData = createIntegrationSchema.parse(body);

        const result = await createIntegration({
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
            { integration: result.integration },
            { status: 201 }
        );
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: 'Validation error', details: error.errors },
                { status: 400 }
            );
        }
        console.error('Error creating integration:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
