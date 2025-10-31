"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/global/page-header";
import { Activity, MessageSquare, ShoppingCart, TrendingUp, Users, Zap } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface DashboardStats {
    agents: {
        total: number;
        active: number;
    };
    conversations: {
        total: number;
        active: number;
        closed: number;
    };
    messages: {
        total: number;
        thisMonth: number;
    };
    integrations: {
        total: number;
        connected: number;
    };
}

async function fetchDashboardStats(): Promise<DashboardStats> {
    const [agentsRes, conversationsRes, integrationsRes, statsRes] = await Promise.all([
        fetch('/api/agents'),
        fetch('/api/conversations'),
        fetch('/api/integrations'),
        fetch('/api/conversations/stats'),
    ]);

    const agents = await agentsRes.json();
    const conversations = await conversationsRes.json();
    const integrations = await integrationsRes.json();
    const stats = await statsRes.json();

    return {
        agents: {
            total: agents.agents?.length || 0,
            active: agents.agents?.filter((a: any) => a.status === 'active').length || 0,
        },
        conversations: {
            total: stats.stats?.total || 0,
            active: stats.stats?.active || 0,
            closed: stats.stats?.closed || 0,
        },
        messages: {
            total: 0,
            thisMonth: 0,
        },
        integrations: {
            total: integrations.integrations?.length || 0,
            connected: integrations.integrations?.filter((i: any) => i.status === 'connected').length || 0,
        },
    };
}

export default function WorkspacePage() {
    const { data: stats, isLoading } = useQuery({
        queryKey: ['dashboard-stats'],
        queryFn: fetchDashboardStats,
    });

    return (
        <div className="flex flex-col gap-8">
            <PageHeader
                title="Dashboard"
                description="Overview of your AI agents and business performance"
            />

            {/* Key Metrics */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Active Agents
                        </CardTitle>
                        <Zap className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {isLoading ? '-' : stats?.agents.active || 0}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            of {stats?.agents.total || 0} total agents
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Active Conversations
                        </CardTitle>
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {isLoading ? '-' : stats?.conversations.active || 0}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {stats?.conversations.closed || 0} closed
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Connected Platforms
                        </CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {isLoading ? '-' : stats?.integrations.connected || 0}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            of {stats?.integrations.total || 0} integrations
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Total Conversations
                        </CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {isLoading ? '-' : stats?.conversations.total || 0}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            All time
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Quick Actions */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card className="hover:shadow-md transition-shadow">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Zap className="h-5 w-5" />
                            AI Agents
                        </CardTitle>
                        <CardDescription>
                            Create and manage AI agents for automated customer interactions
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button asChild className="w-full">
                            <Link href="/workspace/agents">Manage Agents</Link>
                        </Button>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Activity className="h-5 w-5" />
                            Integrations
                        </CardTitle>
                        <CardDescription>
                            Connect platforms like Shopify, WhatsApp, and Facebook
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button asChild className="w-full" variant="outline">
                            <Link href="/workspace/integrations">View Integrations</Link>
                        </Button>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <MessageSquare className="h-5 w-5" />
                            Conversations
                        </CardTitle>
                        <CardDescription>
                            Monitor all customer interactions handled by your agents
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button asChild className="w-full" variant="outline">
                            <Link href="/workspace/conversations">View Conversations</Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* Getting Started */}
            {stats?.agents.total === 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Get Started with wagents</CardTitle>
                        <CardDescription>
                            Follow these steps to set up your AI-powered sales and support automation
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-start gap-4">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                1
                            </div>
                            <div className="flex-1">
                                <h4 className="font-semibold mb-1">Connect Your Platforms</h4>
                                <p className="text-sm text-muted-foreground mb-2">
                                    Connect Shopify, WhatsApp, Facebook Marketplace, or other platforms
                                </p>
                                <Button asChild size="sm">
                                    <Link href="/workspace/integrations">Connect Platforms</Link>
                                </Button>
                            </div>
                        </div>

                        <div className="flex items-start gap-4">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                2
                            </div>
                            <div className="flex-1">
                                <h4 className="font-semibold mb-1">Create Your First AI Agent</h4>
                                <p className="text-sm text-muted-foreground mb-2">
                                    Set up an AI agent to handle sales, support, or negotiations
                                </p>
                                <Button asChild size="sm">
                                    <Link href="/workspace/agents">Create Agent</Link>
                                </Button>
                            </div>
                        </div>

                        <div className="flex items-start gap-4">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                                3
                            </div>
                            <div className="flex-1">
                                <h4 className="font-semibold mb-1">Monitor Conversations</h4>
                                <p className="text-sm text-muted-foreground">
                                    Watch your AI agents handle customer interactions automatically
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
