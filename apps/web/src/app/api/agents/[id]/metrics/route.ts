import { auth } from "@wagents/auth";
import { NextRequest, NextResponse } from "next/server";
import { getAgentMetrics } from "@/lib/ai/agent/operations";

/**
 * GET /api/agents/[id]/metrics
 * Get metrics for a specific agent
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
        const result = await getAgentMetrics(id);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: 404 }
            );
        }

        return NextResponse.json({ metrics: result.metrics });
    } catch (error: any) {
        console.error('Error getting agent metrics:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
