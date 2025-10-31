import { PageHeader } from '@/components/global/page-header';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CurrentPlanCard } from '@/components/workspace/billing/current-plan-card';
import { createErrorState, getSession } from '@/lib/actions/helper';
import { db,eq } from '@wagents/db';
import { organization } from '@wagents/db/schema/auth';
import { Suspense } from 'react';

export default async function BillingPage() {
    const session = await getSession();

    // const [org] = await db
    //     .select()
    //     .from(organization)
    //     .where(eq(organization.id, session.session.activeOrganizationId))
    //     .limit(1);

    //     console.log(org);
    return (
        <div className="space-y-6">
            <PageHeader
                title="Billing & Subscription"
                description="Manage your billing, subscription plans, and account details."
            />
            <div className="grid gap-6 lg:grid-cols-3">
                {/* Sidebar - Current Plan Info */}
                <div className="lg:col-span-1">
                    {/* <Suspense fallback={<CurrentPlanSkeleton />}>
                        <CurrentPlanCard
                            planSlug="pro"
                            subscriptionStatus="active"
                            usedCredits={320}
                            monthlyCredits={1000}
                            creditsResetDate={new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)}
                            subscriptionEndDate={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)}
                            organizationId={org.id}
                            currentUsage={{
                                agents: 5,
                                organizations: 1,
                                whatsappConnections: 2,
                                facebookConnections: 1,
                                tiktokConnections: 0,
                                instagramConnections: 1,
                            }}
                        />
                    </Suspense> */}
                </div>
            </div>
        </div>
    )
}

function CurrentPlanSkeleton() {
    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-32" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-10 w-full" />
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-32" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-10 w-full" />
                </CardContent>
            </Card>
        </div>
    );
}

function PlanSelectorSkeleton() {
    return (
        <div className="space-y-6">
            <Skeleton className="h-16 w-full" />
            <div className="grid gap-4 md:grid-cols-2">
                <Skeleton className="h-96 w-full" />
                <Skeleton className="h-96 w-full" />
                <Skeleton className="h-96 w-full" />
                <Skeleton className="h-96 w-full" />
            </div>
        </div>
    );
}