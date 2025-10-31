import type { ModelMessage } from "ai";
import type { Entity } from "../../agent/context-manager";

/**
 * Retrieval strategies
 */
export type RetrievalStrategy =
  | "semantic"
  | "hybrid"
  | "graph"
  | "adaptive"
  | "none";

/**
 * Agent decision with reasoning transparency
 */
export type AgentDecision = {
  shouldRetrieve: boolean;
  strategy: RetrievalStrategy;
  reasoning: string;
  confidence: number;
  queryExpansions: string[];
  chainOfThought?: ChainOfThought[];
  metadata?: {
    processingTimeMs: number;
    tokensUsed?: number;
    modelUsed?: string;
  };
};

/**
 * Chain of Thought step for reasoning transparency
 */
export type ChainOfThought = {
  step: number;
  thought: string;
  action: string;
  observation?: string;
  timestamp: number;
};

/**
 * Retrieval result with enhanced metadata
 */
export type RetrievalResult = {
  content: string;
  score: number;
  metadata: {
    source: string;
    title: string;
    kbId: string;
    chunkId: string;
    timestamp?: number;
    author?: string;
    tags?: string[];
    relevanceReasoning?: string;
  };
};

/**
 * Relevance evaluation
 */
export type RelevanceEvaluation = {
  isRelevant: boolean[];
  overallQuality: number;
  shouldRetrieveMore: boolean;
  reasoning: string;
  confidence: number;
  chainOfThought?: ChainOfThought[];
};

/**
 * Response validation
 */
export type ResponseValidation = {
  isFactuallyAccurate: boolean;
  confidence: number;
  reasoning: string;
  citationsVerified: boolean;
  hallucinationDetected: boolean;
  suggestions?: string[];
};

/**
 * Agentic RAG Context with full reasoning trace
 */
export type AgenticRAGContext = {
  query: string;
  conversationHistory: ModelMessage[];
  retrievedDocs: RetrievalResult[];
  agentDecisions: AgentDecision[];
  iterationCount: number;
  chainOfThought: ChainOfThought[];
  performance: {
    totalTimeMs: number;
    retrievalTimeMs: number;
    generationTimeMs: number;
    evaluationTimeMs: number;
  };
  metadata?: {
    modelUsed: string;
    tokensUsed: number;
    cacheHit: boolean;
  };
};

/**
 * RAG execution result
 */
export type RAGExecutionResult = {
  text: string;
  usage?: {
    promptTokens: number | undefined;
    completionTokens: number | undefined;
    totalTokens: number | undefined;
  } | undefined
  context: {
    retrievedDocs: number;
    iterations: number;
    decision: AgentDecision;
    chainOfThought: ChainOfThought[];
    performance: AgenticRAGContext["performance"];
    confidence: number;
  };
  sources?: RetrievalResult[];
  validation?: ResponseValidation;
};

/**
 * RAG configuration
 */
export type RAGConfig = {
  organizationId: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  knowledgeBaseIds?: string[];
  options?: {
    enableChainOfThought?: boolean;
    enableSelfReflection?: boolean;
    maxIterations?: number;
    minConfidence?: number;
    enableCaching?: boolean;
    streamingEnabled?: boolean;
  };
};

/**
 * Retrieval options
 */
export type RetrievalOptions = {
  limit?: number;
  minScore?: number;
  kbIds?: string[];
  useReranking?: boolean;
  expandQueries?: boolean;
  filters?: Record<string, unknown>;
};

/**
 * Agent reasoning step (for observability)
 */
export type AgentReasoningStep = {
  id: string;
  type:
  | "query_analysis"
  | "retrieval"
  | "evaluation"
  | "generation"
  | "validation";
  status: "pending" | "in_progress" | "completed" | "failed";
  startTime: number;
  endTime?: number;
  input: unknown;
  output?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Agent execution trace (for debugging and observability)
 */
export type AgentExecutionTrace = {
  traceId: string;
  query: string;
  startTime: number;
  endTime?: number;
  steps: AgentReasoningStep[];
  decisions: AgentDecision[];
  chainOfThought: ChainOfThought[];
  result?: RAGExecutionResult;
  error?: {
    message: string;
    code: string;
    stack?: string;
  };
};

/**
 * Agent memory entry (for context persistence)
 */
export type AgentMemoryEntry = {
  id: string;
  conversationId: string;
  query: string;
  response: string;
  retrievedDocs: RetrievalResult[];
  decision: AgentDecision;
  timestamp: number;
  relevanceScore?: number;
  userFeedback?: {
    helpful: boolean;
    rating?: number;
    comment?: string;
  };
};

/**
 * Agent context manager state
 */
export type AgentContextState = {
  conversationId: string;
  memory: AgentMemoryEntry[];
  entities: Map<string, Entity>;
  facts: Map<string, { value: unknown; confidence: number; source: string; key: string; timestamp: number; verified: boolean }>;
  preferences: Record<string, unknown>;
  metadata: {
    totalQueries: number;
    avgConfidence: number;
    lastUpdated: number;
  };
};
