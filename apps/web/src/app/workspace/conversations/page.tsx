"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/global/page-header";
import { MessageSquare, User, Calendar, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    createdAt: Date;
}

interface Conversation {
    id: string;
    platform: string;
    customerName: string | null;
    customerPhone: string | null;
    customerEmail: string | null;
    status: 'active' | 'closed' | 'handed_off';
    messageCount: number;
    updatedAt: Date;
    messages?: Message[];
}

async function fetchConversations(filters: {
    status?: string;
    platform?: string;
}): Promise<Conversation[]> {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.platform) params.set('platform', filters.platform);

    const response = await fetch(`/api/conversations?${params.toString()}`);
    if (!response.ok) {
        throw new Error('Failed to fetch conversations');
    }
    const data = await response.json();
    return data.conversations;
}

async function fetchConversationMessages(conversationId: string): Promise<Conversation> {
    const response = await fetch(`/api/conversations/${conversationId}`);
    if (!response.ok) {
        throw new Error('Failed to fetch conversation');
    }
    const data = await response.json();
    return data.conversation;
}

export default function ConversationsPage() {
    const [selectedStatus, setSelectedStatus] = useState<string>('all');
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

    const { data: conversations = [], isLoading } = useQuery({
        queryKey: ['conversations', selectedStatus],
        queryFn: () => fetchConversations({
            status: selectedStatus === 'all' ? undefined : selectedStatus,
        }),
    });

    const { data: selectedConversation } = useQuery({
        queryKey: ['conversation', selectedConversationId],
        queryFn: () => fetchConversationMessages(selectedConversationId!),
        enabled: !!selectedConversationId,
    });

    const getPlatformBadge = (platform: string) => {
        const colors: Record<string, string> = {
            whatsapp: 'bg-green-100 text-green-700',
            facebook_marketplace: 'bg-blue-100 text-blue-700',
            shopify: 'bg-purple-100 text-purple-700',
            internal: 'bg-gray-100 text-gray-700',
        };
        return colors[platform] || colors.internal;
    };

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Conversations"
                description="Monitor and manage all customer interactions handled by your AI agents"
            />

            <Tabs value={selectedStatus} onValueChange={setSelectedStatus}>
                <TabsList>
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="active">Active</TabsTrigger>
                    <TabsTrigger value="closed">Closed</TabsTrigger>
                    <TabsTrigger value="handed_off">Handed Off</TabsTrigger>
                </TabsList>
            </Tabs>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-300px)]">
                {/* Conversations List */}
                <Card className="lg:col-span-1 overflow-hidden flex flex-col">
                    <CardContent className="p-0 flex-1 overflow-y-auto">
                        {isLoading ? (
                            <div className="p-8 text-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
                            </div>
                        ) : conversations.length === 0 ? (
                            <div className="p-8 text-center">
                                <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                                <p className="text-sm text-muted-foreground">
                                    No conversations found
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y">
                                {conversations.map((conversation) => (
                                    <button
                                        key={conversation.id}
                                        onClick={() => setSelectedConversationId(conversation.id)}
                                        className={cn(
                                            "w-full p-4 text-left hover:bg-muted/50 transition-colors",
                                            selectedConversationId === conversation.id && "bg-muted"
                                        )}
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <User className="h-4 w-4 text-muted-foreground" />
                                                <span className="font-medium text-sm">
                                                    {conversation.customerName ||
                                                     conversation.customerPhone ||
                                                     conversation.customerEmail ||
                                                     'Unknown'}
                                                </span>
                                            </div>
                                            <Badge
                                                variant={
                                                    conversation.status === 'active'
                                                        ? 'default'
                                                        : 'secondary'
                                                }
                                                className="text-xs"
                                            >
                                                {conversation.status}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                                            <Badge
                                                className={getPlatformBadge(conversation.platform)}
                                                variant="secondary"
                                            >
                                                {conversation.platform}
                                            </Badge>
                                            <span>{conversation.messageCount} messages</span>
                                        </div>
                                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <Calendar className="h-3 w-3" />
                                            {new Date(conversation.updatedAt).toLocaleString()}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Conversation Details */}
                <Card className="lg:col-span-2 overflow-hidden flex flex-col">
                    {selectedConversation ? (
                        <>
                            <div className="p-4 border-b">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="font-semibold">
                                            {selectedConversation.customerName ||
                                             selectedConversation.customerPhone ||
                                             'Conversation'}
                                        </h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Badge
                                                className={getPlatformBadge(selectedConversation.platform)}
                                                variant="secondary"
                                            >
                                                {selectedConversation.platform}
                                            </Badge>
                                            <Badge
                                                variant={
                                                    selectedConversation.status === 'active'
                                                        ? 'default'
                                                        : 'secondary'
                                                }
                                            >
                                                {selectedConversation.status}
                                            </Badge>
                                        </div>
                                    </div>
                                    {selectedConversation.status === 'active' && (
                                        <Button size="sm" variant="outline">
                                            Take Over
                                        </Button>
                                    )}
                                </div>
                            </div>

                            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                                {selectedConversation.messages?.map((message) => (
                                    <div
                                        key={message.id}
                                        className={cn(
                                            "flex",
                                            message.role === 'user' ? "justify-start" : "justify-end"
                                        )}
                                    >
                                        <div
                                            className={cn(
                                                "max-w-[80%] rounded-lg px-4 py-2",
                                                message.role === 'user'
                                                    ? "bg-muted"
                                                    : "bg-primary text-primary-foreground"
                                            )}
                                        >
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs font-medium">
                                                    {message.role === 'user' ? 'Customer' : 'AI Agent'}
                                                </span>
                                                <span className="text-xs opacity-70">
                                                    {new Date(message.createdAt).toLocaleTimeString()}
                                                </span>
                                            </div>
                                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </>
                    ) : (
                        <CardContent className="flex-1 flex items-center justify-center">
                            <div className="text-center">
                                <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                                <p className="text-muted-foreground">
                                    Select a conversation to view details
                                </p>
                            </div>
                        </CardContent>
                    )}
                </Card>
            </div>
        </div>
    );
}
