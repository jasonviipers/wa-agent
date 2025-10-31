export type ActionState<T = unknown> =
  | {
      status: "success";
      data: T;
      message?: string;
      timestamp: number;
    }
  | {
      status: "error";
      error: string;
      details?: unknown;
      timestamp: number;
    }
  | {
      status: "idle";
    };

export type FormState<T = unknown> = {
  status: "idle" | "pending" | "success" | "error";
  data?: T;
  error?: string;
  details?: unknown;
  message?: string;
  timestamp?: number;
};

export type AgentSettings = {
  greeting?: string;
  fallbackMessage?: string;
  handoffToHuman?: boolean;
  responseTime?: "fast" | "balanced" | "thorough";
  enabledFeatures?: string[];
  businessHours?: {
    enabled: boolean;
    timezone: string;
    schedule: Record<string, { open: string; close: string }>;
  };
  autoEscalation?: {
    enabled: boolean;
    timeout: number;
    maxAttempts: number;
  };
};

/**
 * Agent metrics with proper typing
 */
export type AgentMetrics = {
  totalConversations: number;
  totalMessages: number;
  activeConversations: number;
  averageResponseTime: number;
  successRate: number;
  customerSatisfaction: number;
};

/**
 * Platform configuration
 */
export type PlatformConfig = {
  whatsapp?: {
    enabled: boolean;
    phoneNumberId?: string;
    businessAccountId?: string;
  };
  facebook?: {
    enabled: boolean;
    pageId?: string;
    accessToken?: string;
  };
  shopify?: {
    enabled: boolean;
    shopDomain?: string;
    accessToken?: string;
  };
  instagram?: {
    enabled: boolean;
    accountId?: string;
  };
};

/**
 * Cache tags revalidation
 */
export const CACHE_TAGS = {
  agents: (orgId: string) => `agents-${orgId}`,
  agent: (agentId: string) => `agent-${agentId}`,
  agentMetrics: (agentId: string) => `agent-metrics-${agentId}`,
  knowledgeBases: (orgId: string) => `knowledge-bases-${orgId}`,
  agentKnowledgeBases: (agentId: string) => `agent-kbs-${agentId}`,
  templates: () => "agent-templates",
} as const;

/**
 * Error codes for better error handling
 */
export enum ActionErrorCode {
  UNAUTHORIZED = "UNAUTHORIZED",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  NOT_FOUND = "NOT_FOUND",
  INSUFFICIENT_PERMISSIONS = "INSUFFICIENT_PERMISSIONS",
  PLAN_LIMIT_REACHED = "PLAN_LIMIT_REACHED",
  FEATURE_NOT_AVAILABLE = "FEATURE_NOT_AVAILABLE",
  DATABASE_ERROR = "DATABASE_ERROR",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

/**
 * Branded type for IDs to prevent mixing different ID types
 */
export type AgentId = string & { readonly __brand: "AgentId" };
export type OrganizationId = string & { readonly __brand: "OrganizationId" };
export type KnowledgeBaseId = string & {
  readonly __brand: "KnowledgeBaseId";
};
export type UserId = string & { readonly __brand: "UserId" };

/**
 * Helper to create branded IDs (runtime no-op, compile-time safety)
 */
export const brandId = {
  agent: (id: string) => id as AgentId,
  organization: (id: string) => id as OrganizationId,
  knowledgeBase: (id: string) => id as KnowledgeBaseId,
  user: (id: string) => id as UserId,
};
