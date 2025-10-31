import { auth } from "@wagents/auth";
import { NextRequest, NextResponse } from "next/server";
import { getConversationStats } from "@/lib/conversations/operations";

/**
 * GET /api/conversations/stats
 * Get conversation statistics
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

        const result = await getConversationStats(session.user.organizationId, agentId);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: 400 }
            );
        }

        return NextResponse.json({ stats: result.stats });
    } catch (error: any) {
        console.error('Error getting conversation stats:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
