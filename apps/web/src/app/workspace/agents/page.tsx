"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Power, Settings, Trash2, Activity } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/global/page-header";
import { CreateAgentDialog } from "@/components/workspace/agents/create-agent-dialog";
import { DeleteAgentDialog } from "@/components/workspace/agents/delete-agent-dialog";

interface Agent {
    id: string;
    name: string;
    description: string | null;
    status: 'active' | 'inactive' | 'error';
    model: string;
    createdAt: Date;
    metrics?: {
        totalConversations?: number;
        totalMessages?: number;
        successRate?: number;
    };
}

async function fetchAgents(): Promise<Agent[]> {
    const response = await fetch('/api/agents');
    if (!response.ok) {
        throw new Error('Failed to fetch agents');
    }
    const data = await response.json();
    return data.agents;
}

async function toggleAgent(agentId: string) {
    const response = await fetch(`/api/agents/${agentId}/toggle`, {
        method: 'POST',
    });
    if (!response.ok) {
        throw new Error('Failed to toggle agent');
    }
    return response.json();
}

export default function AgentsPage() {
    const queryClient = useQueryClient();
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

    const { data: agents = [], isLoading } = useQuery({
        queryKey: ['agents'],
        queryFn: fetchAgents,
    });

    const toggleMutation = useMutation({
        mutationFn: toggleAgent,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['agents'] });
        },
    });

    const handleToggle = (agentId: string) => {
        toggleMutation.mutate(agentId);
    };

    const handleDeleteClick = (agent: Agent) => {
        setSelectedAgent(agent);
        setDeleteDialogOpen(true);
    };

    return (
        <div className="flex flex-col gap-8">
            <PageHeader
                title="AI Agents"
                description="Create and manage AI agents for automated sales, support, and customer interactions"
            >
                <Button onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Agent
                </Button>
            </PageHeader>

            {isLoading ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3].map((i) => (
                        <Card key={i} className="animate-pulse">
                            <CardHeader>
                                <div className="h-6 bg-muted rounded w-3/4 mb-2" />
                                <div className="h-4 bg-muted rounded w-full" />
                            </CardHeader>
                            <CardContent>
                                <div className="h-20 bg-muted rounded" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : agents.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <Activity className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No agents yet</h3>
                        <p className="text-sm text-muted-foreground mb-4 text-center max-w-md">
                            Create your first AI agent to start automating sales, support, and customer interactions.
                        </p>
                        <Button onClick={() => setCreateDialogOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            Create Your First Agent
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {agents.map((agent) => (
                        <Card key={agent.id} className="relative">
                            <CardHeader>
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <CardTitle className="text-lg">{agent.name}</CardTitle>
                                        <CardDescription className="mt-1">
                                            {agent.description || 'No description'}
                                        </CardDescription>
                                    </div>
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
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <p className="text-muted-foreground">Model</p>
                                            <p className="font-medium">{agent.model}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Conversations</p>
                                            <p className="font-medium">
                                                {agent.metrics?.totalConversations || 0}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="flex-1"
                                            onClick={() => handleToggle(agent.id)}
                                            disabled={toggleMutation.isPending}
                                        >
                                            <Power className="mr-2 h-4 w-4" />
                                            {agent.status === 'active' ? 'Deactivate' : 'Activate'}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            asChild
                                        >
                                            <Link href={`/workspace/agents/${agent.id}`}>
                                                <Settings className="h-4 w-4" />
                                            </Link>
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleDeleteClick(agent)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <CreateAgentDialog
                open={createDialogOpen}
                onOpenChange={setCreateDialogOpen}
            />

            {selectedAgent && (
                <DeleteAgentDialog
                    agent={selectedAgent}
                    open={deleteDialogOpen}
                    onOpenChange={setDeleteDialogOpen}
                />
            )}
        </div>
    );
}
