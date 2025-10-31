"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface ConnectIntegrationDialogProps {
    platform: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const PLATFORM_CONFIGS = {
    shopify: {
        name: 'Shopify',
        fields: [
            { key: 'shopDomain', label: 'Shop Domain', placeholder: 'your-store.myshopify.com', required: true },
            { key: 'accessToken', label: 'Access Token', placeholder: 'shpat_...', required: true, type: 'password' },
            { key: 'apiKey', label: 'API Key', placeholder: 'Your API Key', required: false },
            { key: 'apiSecret', label: 'API Secret', placeholder: 'Your API Secret', required: false, type: 'password' },
        ],
    },
    whatsapp: {
        name: 'WhatsApp Business',
        fields: [
            { key: 'phoneNumberId', label: 'Phone Number ID', placeholder: '1234567890', required: true },
            { key: 'accessToken', label: 'Access Token', placeholder: 'EAA...', required: true, type: 'password' },
            { key: 'businessAccountId', label: 'Business Account ID', placeholder: '1234567890', required: false },
        ],
    },
    facebook_marketplace: {
        name: 'Facebook Marketplace',
        fields: [
            { key: 'catalogId', label: 'Catalog ID', placeholder: '1234567890', required: true },
            { key: 'accessToken', label: 'Access Token', placeholder: 'EAA...', required: true, type: 'password' },
            { key: 'pageId', label: 'Page ID', placeholder: '1234567890', required: false },
        ],
    },
    tiktok_shop: {
        name: 'TikTok Shop',
        fields: [
            { key: 'shopId', label: 'Shop ID', placeholder: '1234567890', required: true },
            { key: 'accessToken', label: 'Access Token', placeholder: 'Your access token', required: true, type: 'password' },
        ],
    },
    amazon: {
        name: 'Amazon',
        fields: [
            { key: 'sellerId', label: 'Seller ID', placeholder: 'A1B2C3D4E5F6G7', required: true },
            { key: 'mwsAuthToken', label: 'MWS Auth Token', placeholder: 'amzn.mws...', required: true, type: 'password' },
            { key: 'marketplaceId', label: 'Marketplace ID', placeholder: 'ATVPDKIKX0DER', required: false },
        ],
    },
    instagram: {
        name: 'Instagram Shopping',
        fields: [
            { key: 'accountId', label: 'Instagram Business Account ID', placeholder: '1234567890', required: true },
            { key: 'accessToken', label: 'Access Token', placeholder: 'EAA...', required: true, type: 'password' },
        ],
    },
};

async function createIntegration(data: any) {
    const response = await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create integration');
    }
    return response.json();
}

export function ConnectIntegrationDialog({ platform, open, onOpenChange }: ConnectIntegrationDialogProps) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [credentials, setCredentials] = useState<Record<string, string>>({});

    const config = platform ? PLATFORM_CONFIGS[platform as keyof typeof PLATFORM_CONFIGS] : null;

    useEffect(() => {
        if (open && config) {
            // Reset credentials when dialog opens
            const initialCredentials: Record<string, string> = {};
            config.fields.forEach(field => {
                initialCredentials[field.key] = '';
            });
            setCredentials(initialCredentials);
        }
    }, [open, config]);

    const mutation = useMutation({
        mutationFn: createIntegration,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['integrations'] });
            toast({
                title: 'Integration connected',
                description: `${config?.name} has been connected successfully.`,
            });
            onOpenChange(false);
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
        if (!platform) return;

        mutation.mutate({
            platform,
            credentials,
        });
    };

    if (!config) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Connect {config.name}</DialogTitle>
                    <DialogDescription>
                        Enter your {config.name} credentials to connect your account.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {config.fields.map((field) => (
                        <div key={field.key} className="space-y-2">
                            <Label htmlFor={field.key}>
                                {field.label}
                                {field.required && <span className="text-destructive ml-1">*</span>}
                            </Label>
                            <Input
                                id={field.key}
                                type={field.type || 'text'}
                                value={credentials[field.key] || ''}
                                onChange={(e) =>
                                    setCredentials({ ...credentials, [field.key]: e.target.value })
                                }
                                placeholder={field.placeholder}
                                required={field.required}
                            />
                        </div>
                    ))}

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={mutation.isPending}>
                            {mutation.isPending ? 'Connecting...' : 'Connect'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
