import type { ModelMessage } from 'ai';

export type AgentConfig = {
    id: string;
    organizationId: string;
    name: string;
    systemPrompt: string;
    model: string;
    temperature: number;
    maxTokens: number;
    settings: {
        greeting?: string;
        fallbackMessage?: string;
        handoffToHuman?: boolean;
        handoffConditions?: string[];
        responseTime?: number;
        maxMessagesPerConversation?: number;
    };
    knowledgeBases: string[]; // IDs of connected knowledge bases
};

export type ConversationContext = {
    conversationId: string;
    customerId?: string;
    customerName?: string;
    platform: string;
    history: ModelMessage[];
};

export type CreateAgentInput = {
    organizationId: string;
    userId: string;
    name: string;
    description?: string;
    systemPrompt: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    communicationStyle?: string;
    settings?: {
        greeting?: string;
        fallbackMessage?: string;
        handoffToHuman?: boolean;
        handoffConditions?: string[];
        businessHours?: {
            enabled: boolean;
            timezone?: string;
            schedule?: Record<string, { open: string; close: string }>;
        };
        language?: string;
        responseDelay?: number;
        maxMessagesPerConversation?: number;
        autoCloseConversationAfter?: number;
    };
    knowledgeBaseIds?: string[];
};

export type UpdateAgentInput = Partial<CreateAgentInput> & {
    id: string;
};

export type PlanFeature =
    | 'agents'
    | 'whatsappConnections'
    | 'monthlyCredits'
    | 'knowledgeBaseChars'
    | 'organizations'
    | 'gpt5Access'
    | 'calendarManagement'
    | 'appointments'
    | 'humanEscalation'
    | 'customDomain'
    | 'whiteLabel';
