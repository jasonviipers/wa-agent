"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

interface DeleteAgentDialogProps {
    agent: {
        id: string;
        name: string;
    };
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

async function deleteAgent(agentId: string) {
    const response = await fetch(`/api/agents/${agentId}`, {
        method: 'DELETE',
    });
    if (!response.ok) {
        throw new Error('Failed to delete agent');
    }
    return response.json();
}

export function DeleteAgentDialog({ agent, open, onOpenChange }: DeleteAgentDialogProps) {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const mutation = useMutation({
        mutationFn: () => deleteAgent(agent.id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['agents'] });
            toast({
                title: 'Agent deleted',
                description: 'The agent has been deleted successfully.',
            });
            onOpenChange(false);
        },
        onError: () => {
            toast({
                title: 'Error',
                description: 'Failed to delete agent. Please try again.',
                variant: 'destructive',
            });
        },
    });

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Agent</AlertDialogTitle>
                    <AlertDialogDescription>
                        Are you sure you want to delete "{agent.name}"? This action cannot be undone.
                        All conversations and data associated with this agent will be preserved but the agent will no longer be active.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={() => mutation.mutate()}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                        {mutation.isPending ? 'Deleting...' : 'Delete Agent'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
