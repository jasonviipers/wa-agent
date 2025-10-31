"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/global/page-header";
import { Plus, CheckCircle2, XCircle, Settings, Trash2 } from "lucide-react";
import { ConnectIntegrationDialog } from "@/components/workspace/integrations/connect-integration-dialog";
import { useToast } from "@/hooks/use-toast";

interface Integration {
    id: string;
    platform: string;
    status: 'connected' | 'disconnected' | 'error' | 'pending';
    isActive: boolean;
    createdAt: Date;
    lastSyncAt?: Date;
}

const PLATFORM_INFO = {
    shopify: {
        name: 'Shopify',
        description: 'Sync products and orders from your Shopify store',
        icon: '🛍️',
        color: 'bg-green-100 text-green-700',
    },
    whatsapp: {
        name: 'WhatsApp Business',
        description: 'Connect WhatsApp Business API for customer messaging',
        icon: '💬',
        color: 'bg-green-100 text-green-700',
    },
    facebook_marketplace: {
        name: 'Facebook Marketplace',
        description: 'Sell products on Facebook Marketplace and Messenger',
        icon: '📘',
        color: 'bg-blue-100 text-blue-700',
    },
    tiktok_shop: {
        name: 'TikTok Shop',
        description: 'Connect your TikTok Shop for product sync',
        icon: '🎵',
        color: 'bg-pink-100 text-pink-700',
    },
    amazon: {
        name: 'Amazon',
        description: 'Integrate with Amazon Seller Central',
        icon: '📦',
        color: 'bg-orange-100 text-orange-700',
    },
    instagram: {
        name: 'Instagram Shopping',
        description: 'Enable shopping on Instagram',
        icon: '📸',
        color: 'bg-purple-100 text-purple-700',
    },
};

async function fetchIntegrations(): Promise<Integration[]> {
    const response = await fetch('/api/integrations');
    if (!response.ok) {
        throw new Error('Failed to fetch integrations');
    }
    const data = await response.json();
    return data.integrations;
}

async function toggleIntegration(integrationId: string) {
    const response = await fetch(`/api/integrations/${integrationId}/toggle`, {
        method: 'POST',
    });
    if (!response.ok) {
        throw new Error('Failed to toggle integration');
    }
    return response.json();
}

async function deleteIntegration(integrationId: string) {
    const response = await fetch(`/api/integrations/${integrationId}`, {
        method: 'DELETE',
    });
    if (!response.ok) {
        throw new Error('Failed to delete integration');
    }
    return response.json();
}

async function testConnection(integrationId: string) {
    const response = await fetch(`/api/integrations/${integrationId}/test`, {
        method: 'POST',
    });
    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Connection test failed');
    }
    return response.json();
}

export default function IntegrationsPage() {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [connectDialogOpen, setConnectDialogOpen] = useState(false);
    const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);

    const { data: integrations = [], isLoading } = useQuery({
        queryKey: ['integrations'],
        queryFn: fetchIntegrations,
    });

    const toggleMutation = useMutation({
        mutationFn: toggleIntegration,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['integrations'] });
            toast({
                title: 'Integration updated',
                description: 'Integration status has been updated.',
            });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: deleteIntegration,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['integrations'] });
            toast({
                title: 'Integration removed',
                description: 'The integration has been removed.',
            });
        },
    });

    const testMutation = useMutation({
        mutationFn: testConnection,
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['integrations'] });
            toast({
                title: data.connected ? 'Connection successful' : 'Connection failed',
                description: data.connected
                    ? 'Your integration is working correctly.'
                    : 'Failed to connect to the platform.',
                variant: data.connected ? 'default' : 'destructive',
            });
        },
        onError: (error: Error) => {
            toast({
                title: 'Connection test failed',
                description: error.message,
                variant: 'destructive',
            });
        },
    });

    const connectedPlatforms = new Set(integrations.map(i => i.platform));
    const availablePlatforms = Object.entries(PLATFORM_INFO).filter(
        ([platform]) => !connectedPlatforms.has(platform)
    );

    const handleConnect = (platform: string) => {
        setSelectedPlatform(platform);
        setConnectDialogOpen(true);
    };

    return (
        <div className="flex flex-col gap-8">
            <PageHeader
                title="Integrations"
                description="Connect your business platforms to enable AI agents across all channels"
            />

            {/* Connected Integrations */}
            {integrations.length > 0 && (
                <div>
                    <h2 className="text-lg font-semibold mb-4">Connected Platforms</h2>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {integrations.map((integration) => {
                            const info = PLATFORM_INFO[integration.platform as keyof typeof PLATFORM_INFO];
                            return (
                                <Card key={integration.id}>
                                    <CardHeader>
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className={`text-3xl p-2 rounded-lg ${info.color}`}>
                                                    {info.icon}
                                                </div>
                                                <div>
                                                    <CardTitle className="text-base">{info.name}</CardTitle>
                                                    <Badge
                                                        variant={
                                                            integration.status === 'connected'
                                                                ? 'default'
                                                                : integration.status === 'error'
                                                                ? 'destructive'
                                                                : 'secondary'
                                                        }
                                                        className="mt-1"
                                                    >
                                                        {integration.status}
                                                    </Badge>
                                                </div>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2 text-sm">
                                                {integration.isActive ? (
                                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                                ) : (
                                                    <XCircle className="h-4 w-4 text-muted-foreground" />
                                                )}
                                                <span className="text-muted-foreground">
                                                    {integration.isActive ? 'Active' : 'Inactive'}
                                                </span>
                                            </div>

                                            {integration.lastSyncAt && (
                                                <p className="text-xs text-muted-foreground">
                                                    Last synced: {new Date(integration.lastSyncAt).toLocaleString()}
                                                </p>
                                            )}

                                            <div className="flex gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="flex-1"
                                                    onClick={() => toggleMutation.mutate(integration.id)}
                                                    disabled={toggleMutation.isPending}
                                                >
                                                    {integration.isActive ? 'Disable' : 'Enable'}
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => testMutation.mutate(integration.id)}
                                                    disabled={testMutation.isPending}
                                                >
                                                    Test
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => deleteMutation.mutate(integration.id)}
                                                    disabled={deleteMutation.isPending}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Available Integrations */}
            {availablePlatforms.length > 0 && (
                <div>
                    <h2 className="text-lg font-semibold mb-4">Available Platforms</h2>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {availablePlatforms.map(([platform, info]) => (
                            <Card key={platform} className="relative overflow-hidden">
                                <CardHeader>
                                    <div className="flex items-center gap-3">
                                        <div className={`text-3xl p-2 rounded-lg ${info.color}`}>
                                            {info.icon}
                                        </div>
                                        <div className="flex-1">
                                            <CardTitle className="text-base">{info.name}</CardTitle>
                                            <CardDescription className="text-xs mt-1">
                                                {info.description}
                                            </CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <Button
                                        onClick={() => handleConnect(platform)}
                                        className="w-full"
                                        variant="outline"
                                    >
                                        <Plus className="mr-2 h-4 w-4" />
                                        Connect
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {integrations.length === 0 && (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <Settings className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No integrations yet</h3>
                        <p className="text-sm text-muted-foreground mb-4 text-center max-w-md">
                            Connect your business platforms to enable AI agents across all channels.
                        </p>
                    </CardContent>
                </Card>
            )}

            <ConnectIntegrationDialog
                platform={selectedPlatform}
                open={connectDialogOpen}
                onOpenChange={setConnectDialogOpen}
            />
        </div>
    );
}
