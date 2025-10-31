"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface CreateAgentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

async function createAgent(data: any) {
    const response = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create agent');
    }
    return response.json();
}

export function CreateAgentDialog({ open, onOpenChange }: CreateAgentDialogProps) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        systemPrompt: '',
        model: 'gpt-4o-mini',
        communicationStyle: 'professional',
        temperature: 0.7,
    });

    const mutation = useMutation({
        mutationFn: createAgent,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['agents'] });
            toast({
                title: 'Agent created',
                description: 'Your AI agent has been created successfully.',
            });
            onOpenChange(false);
            setFormData({
                name: '',
                description: '',
                systemPrompt: '',
                model: 'gpt-4o-mini',
                communicationStyle: 'professional',
                temperature: 0.7,
            });
        },
        onError: (error: Error) => {
            toast({
                title: 'Error',
                description: error.message,
                variant: 'destructive',
            });
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        mutation.mutate(formData);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Create AI Agent</DialogTitle>
                    <DialogDescription>
                        Create a new AI agent to automate customer interactions across your platforms.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Agent Name *</Label>
                        <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="Sales Agent"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Input
                            id="description"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Handles product inquiries and sales"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="systemPrompt">System Prompt *</Label>
                        <Textarea
                            id="systemPrompt"
                            value={formData.systemPrompt}
                            onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
                            placeholder="You are a helpful sales assistant. Your goal is to help customers find the right products..."
                            rows={6}
                            required
                        />
                        <p className="text-xs text-muted-foreground">
                            This defines your agent's role and behavior. Be specific about what the agent should and shouldn't do.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="model">AI Model</Label>
                            <Select
                                value={formData.model}
                                onValueChange={(value) => setFormData({ ...formData, model: value })}
                            >
                                <SelectTrigger id="model">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="gpt-4o-mini">GPT-4o Mini (Fast & Affordable)</SelectItem>
                                    <SelectItem value="gpt-4o">GPT-4o (Recommended)</SelectItem>
                                    <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                                    <SelectItem value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="communicationStyle">Communication Style</Label>
                            <Select
                                value={formData.communicationStyle}
                                onValueChange={(value) => setFormData({ ...formData, communicationStyle: value })}
                            >
                                <SelectTrigger id="communicationStyle">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="professional">Professional</SelectItem>
                                    <SelectItem value="friendly">Friendly</SelectItem>
                                    <SelectItem value="casual">Casual</SelectItem>
                                    <SelectItem value="formal">Formal</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="temperature">
                            Temperature: {formData.temperature}
                        </Label>
                        <input
                            type="range"
                            id="temperature"
                            min="0"
                            max="2"
                            step="0.1"
                            value={formData.temperature}
                            onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                            className="w-full"
                        />
                        <p className="text-xs text-muted-foreground">
                            Lower values make responses more focused and deterministic, higher values make them more creative.
                        </p>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={mutation.isPending}>
                            {mutation.isPending ? 'Creating...' : 'Create Agent'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
