"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/global/page-header";
import { Activity, MessageSquare, TrendingUp, Clock } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface AgentDetailsProps {
    params: Promise<{ id: string }>;
}

async function fetchAgent(id: string) {
    const response = await fetch(`/api/agents/${id}`);
    if (!response.ok) {
        throw new Error('Failed to fetch agent');
    }
    const data = await response.json();
    return data.agent;
}

async function fetchAgentMetrics(id: string) {
    const response = await fetch(`/api/agents/${id}/metrics`);
    if (!response.ok) {
        throw new Error('Failed to fetch metrics');
    }
    const data = await response.json();
    return data.metrics;
}

export default function AgentDetailsPage({ params }: AgentDetailsProps) {
    const { id } = use(params);

    const { data: agent, isLoading: agentLoading } = useQuery({
        queryKey: ['agent', id],
        queryFn: () => fetchAgent(id),
    });

    const { data: metrics, isLoading: metricsLoading } = useQuery({
        queryKey: ['agent-metrics', id],
        queryFn: () => fetchAgentMetrics(id),
    });

    if (agentLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
                    <p className="text-muted-foreground">Loading agent...</p>
                </div>
            </div>
        );
    }

    if (!agent) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <p className="text-lg font-semibold mb-2">Agent not found</p>
                    <Button asChild>
                        <Link href="/workspace/agents">Back to Agents</Link>
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-8">
            <PageHeader
                title={agent.name}
                description={agent.description || 'No description'}
            >
                <Badge
                    variant={
                        agent.status === 'active'
                            ? 'default'
                            : agent.status === 'error'
                            ? 'destructive'
                            : 'secondary'
                    }
                >
                    {agent.status}
                </Badge>
            </PageHeader>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Total Conversations
                        </CardTitle>
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {metricsLoading ? '-' : metrics?.totalConversations || 0}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Total Messages
                        </CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {metricsLoading ? '-' : metrics?.totalMessages || 0}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Success Rate
                        </CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {metricsLoading ? '-' : `${(metrics?.successRate || 0).toFixed(1)}%`}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Avg Response Time
                        </CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {metricsLoading ? '-' : `${(metrics?.averageResponseTime || 0).toFixed(1)}s`}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="configuration" className="w-full">
                <TabsList>
                    <TabsTrigger value="configuration">Configuration</TabsTrigger>
                    <TabsTrigger value="knowledge">Knowledge Base</TabsTrigger>
                    <TabsTrigger value="settings">Settings</TabsTrigger>
                </TabsList>

                <TabsContent value="configuration" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Agent Configuration</CardTitle>
                            <CardDescription>
                                Core settings and behavior configuration
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Model</p>
                                    <p className="text-sm mt-1">{agent.model}</p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Communication Style</p>
                                    <p className="text-sm mt-1 capitalize">{agent.communicationStyle}</p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Temperature</p>
                                    <p className="text-sm mt-1">{agent.temperature}</p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Max Tokens</p>
                                    <p className="text-sm mt-1">{agent.maxTokens}</p>
                                </div>
                            </div>

                            <div>
                                <p className="text-sm font-medium text-muted-foreground mb-2">System Prompt</p>
                                <div className="bg-muted p-4 rounded-md">
                                    <p className="text-sm whitespace-pre-wrap">{agent.systemPrompt}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="knowledge" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Connected Knowledge Bases</CardTitle>
                            <CardDescription>
                                Knowledge bases used by this agent for answering questions
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {agent.knowledgeBases && agent.knowledgeBases.length > 0 ? (
                                <div className="space-y-2">
                                    {agent.knowledgeBases.map((kb: any) => (
                                        <div
                                            key={kb.id}
                                            className="flex items-center justify-between p-3 border rounded-lg"
                                        >
                                            <div>
                                                <p className="font-medium">{kb.name}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {kb.entriesCount || 0} entries
                                                </p>
                                            </div>
                                            <Badge variant={kb.isEnabled ? 'default' : 'secondary'}>
                                                {kb.isEnabled ? 'Enabled' : 'Disabled'}
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground text-center py-8">
                                    No knowledge bases connected
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="settings" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Agent Settings</CardTitle>
                            <CardDescription>
                                Advanced configuration and behavior settings
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {agent.settings ? (
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">Greeting Message</p>
                                        <p className="text-sm mt-1">{agent.settings.greeting || 'Not set'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">Fallback Message</p>
                                        <p className="text-sm mt-1">{agent.settings.fallbackMessage || 'Not set'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">Language</p>
                                        <p className="text-sm mt-1">{agent.settings.language || 'en'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">Handoff to Human</p>
                                        <p className="text-sm mt-1">{agent.settings.handoffToHuman ? 'Enabled' : 'Disabled'}</p>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground text-center py-8">
                                    No additional settings configured
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
