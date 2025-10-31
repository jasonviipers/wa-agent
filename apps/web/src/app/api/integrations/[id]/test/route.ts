import { auth } from "@wagents/auth";
import { NextRequest, NextResponse } from "next/server";
import { testIntegrationConnection } from "@/lib/integrations/operations";

/**
 * POST /api/integrations/[id]/test
 * Test integration connection
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
        const result = await testIntegrationConnection(id, session.user.organizationId);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error, connected: result.connected },
                { status: 400 }
            );
        }

        return NextResponse.json({ connected: result.connected });
    } catch (error: any) {
        console.error('Error testing integration connection:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error', connected: false },
            { status: 500 }
        );
    }
}
