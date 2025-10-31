import { auth } from "@wagents/auth";
import { NextRequest, NextResponse } from "next/server";
import { toggleAgentStatus } from "@/lib/ai/agent/operations";

/**
 * POST /api/agents/[id]/toggle
 * Toggle agent status (active/inactive)
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
        const result = await toggleAgentStatus(id, session.user.organizationId);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: 400 }
            );
        }

        return NextResponse.json({ agent: result.agent });
    } catch (error: any) {
        console.error('Error toggling agent status:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
