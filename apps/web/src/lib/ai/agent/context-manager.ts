import { createId } from "@paralleldrive/cuid2";
import { cache } from "react";
import type { AgentContextState, AgentDecision, AgentMemoryEntry, RetrievalResult } from "../rag/types";

/**
 * Entity extracted from conversation
 */
export type Entity = {
  type: "person" | "product" | "order" | "location" | "date" | "custom";
  value: string;
  confidence: number;
  firstMentioned: number;
  lastMentioned: number;
  occurrences: number;
  metadata?: Record<string, unknown>;
};

/**
 * Fact learned from conversation
 */
export type Fact = {
  key: string;
  value: unknown;
  confidence: number;
  source: string;
  timestamp: number;
  verified: boolean;
};

/**
 * Agent Context Manager
 * Maintains conversation state and learned information
 */
export class AgentContextManager {
  private state: AgentContextState;
  private maxMemoryEntries: number;
  private minRelevanceScore: number;

  constructor(conversationId: string, options?: {
    maxMemoryEntries?: number;
    minRelevanceScore?: number;
  }) {
    this.state = {
      conversationId,
      memory: [],
      entities: new Map(),
      facts: new Map(),
      preferences: {},
      metadata: {
        totalQueries: 0,
        avgConfidence: 0,
        lastUpdated: Date.now(),
      },
    };
    this.maxMemoryEntries = options?.maxMemoryEntries || 50;
    this.minRelevanceScore = options?.minRelevanceScore || 0.5;
  }

  /**
   * Add a memory entry
   */
  addMemory(
    query: string,
    response: string,
    retrievedDocs: RetrievalResult[],
    decision: AgentDecision
  ): void {
    const entry: AgentMemoryEntry = {
      id: createId(),
      conversationId: this.state.conversationId,
      query,
      response,
      retrievedDocs,
      decision,
      timestamp: Date.now(),
      relevanceScore: decision.confidence,
    };

    this.state.memory.push(entry);
    this.state.metadata.totalQueries++;
    this.state.metadata.lastUpdated = Date.now();

    // Update average confidence
    const totalConfidence = this.state.memory.reduce(
      (sum, m) => sum + (m.relevanceScore || 0),
      0
    );
    this.state.metadata.avgConfidence =
      totalConfidence / this.state.memory.length;

    // Prune old memories if over limit
    if (this.state.memory.length > this.maxMemoryEntries) {
      this.pruneMemories();
    }

    // Extract entities and facts
    this.extractEntities(query, response);
  }

  /**
   * Get relevant memories based on query
   */
  getRelevantMemories(
    query: string,
    limit: number = 5
  ): AgentMemoryEntry[] {
    // Simple keyword-based relevance (can be enhanced with embeddings)
    const queryTokens = query.toLowerCase().split(/\s+/);

    const scoredMemories = this.state.memory
      .map((memory) => {
        const memoryText =
          `${memory.query} ${memory.response}`.toLowerCase();
        const matchCount = queryTokens.filter((token) =>
          memoryText.includes(token)
        ).length;
        const score = matchCount / queryTokens.length;

        return { memory, score };
      })
      .filter(({ score }) => score >= this.minRelevanceScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scoredMemories.map(({ memory }) => memory);
  }

  /**
   * Extract entities from text
   */
  private extractEntities(query: string, response: string): void {
    // Simple entity extraction (can be enhanced with NER)
    const text = `${query} ${response}`;

    // Extract email addresses
    const emails = text.match(/\b[\w.%+-]+@[\w.-]+\.[A-Z]{2,}\b/gi) || [];
    emails.forEach((email) => {
      this.addEntity("person", email, 0.9);
    });

    // Extract phone numbers
    const phones =
      text.match(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g) || [];
    phones.forEach((phone) => {
      this.addEntity("person", phone, 0.8);
    });

    // Extract product IDs (assuming format: PROD-XXXXX)
    const productIds = text.match(/\bPROD-[A-Z0-9]+\b/gi) || [];
    productIds.forEach((id) => {
      this.addEntity("product", id, 0.95);
    });

    // Extract order IDs (assuming format: ORD-XXXXX)
    const orderIds = text.match(/\bORD-[A-Z0-9]+\b/gi) || [];
    orderIds.forEach((id) => {
      this.addEntity("order", id, 0.95);
    });

    // Extract dates (simple patterns)
    const dates =
      text.match(
        /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g
      ) || [];
    dates.forEach((date) => {
      this.addEntity("date", date, 0.7);
    });
  }

  /**
   * Add or update entity
   */
  private addEntity(
    type: Entity["type"],
    value: string,
    confidence: number
  ): void {
    const key = `${type}:${value}`;
    const existing = this.state.entities.get(key) as Entity | undefined;

    if (existing) {
      existing.lastMentioned = Date.now();
      existing.occurrences++;
      existing.confidence = Math.min(1, existing.confidence + 0.1);
    } else {
      this.state.entities.set(key, {
        type,
        value,
        confidence,
        firstMentioned: Date.now(),
        lastMentioned: Date.now(),
        occurrences: 1,
      });
    }
  }

  /**
   * Add a fact to knowledge
   */
  addFact(
    key: string,
    value: unknown,
    confidence: number,
    source: string,
    verified: boolean = false
  ): void {
    this.state.facts.set(key, {
      key,
      value,
      confidence,
      source,
      timestamp: Date.now(),
      verified,
    });
  }

  /**
   * Get a fact by key
   */
  getFact(key: string): Fact | undefined {
    return this.state.facts.get(key);
  }

  /**
   * Get all entities of a type
   */
  getEntitiesByType(type: Entity["type"]): Entity[] {
    return Array.from(this.state.entities.values()).filter(
      (entity) => entity.type === type
    ) as Entity[];
  }

  /**
   * Set a user preference
   */
  setPreference(key: string, value: unknown): void {
    this.state.preferences[key] = value;
    this.state.metadata.lastUpdated = Date.now();
  }

  /**
   * Get a user preference
   */
  getPreference(key: string): unknown {
    return this.state.preferences[key];
  }

  /**
   * Prune old or low-relevance memories
   */
  private pruneMemories(): void {
    // Keep most recent and highest relevance memories
    this.state.memory = this.state.memory
      .sort((a, b) => {
        const scoreA = (a.relevanceScore || 0) * 0.5 + (a.timestamp / Date.now()) * 0.5;
        const scoreB = (b.relevanceScore || 0) * 0.5 + (b.timestamp / Date.now()) * 0.5;
        return scoreB - scoreA;
      })
      .slice(0, this.maxMemoryEntries);
  }

  /**
   * Add user feedback to memory
   */
  addFeedback(
    memoryId: string,
    feedback: {
      helpful: boolean;
      rating?: number;
      comment?: string;
    }
  ): void {
    const memory = this.state.memory.find((m) => m.id === memoryId);
    if (memory) {
      memory.userFeedback = feedback;

      // Adjust relevance score based on feedback
      if (memory.relevanceScore) {
        memory.relevanceScore = feedback.helpful
          ? Math.min(1, memory.relevanceScore + 0.1)
          : Math.max(0, memory.relevanceScore - 0.2);
      }
    }
  }

  /**
   * Get context summary for agent
   */
  getContextSummary(): {
    recentMemories: AgentMemoryEntry[];
    keyEntities: Entity[];
    importantFacts: Fact[];
    preferences: Record<string, unknown>;
    metadata: AgentContextState["metadata"];
  } {
    return {
      recentMemories: this.state.memory.slice(-5),
      keyEntities: Array.from(this.state.entities.values())
        .sort((a, b) => b.confidence * b.occurrences - a.confidence * a.occurrences)
        .slice(0, 10),
      importantFacts: Array.from(this.state.facts.values())
        .filter((f) => f.confidence > 0.7)
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 10),
      preferences: this.state.preferences,
      metadata: this.state.metadata,
    };
  }

  /**
   * Export state for persistence
   */
  exportState(): AgentContextState {
    return {
      ...this.state,
      entities: Array.from(this.state.entities.entries()),
      facts: Array.from(this.state.facts.entries()),
    } as any; // Needs proper serialization
  }

  /**
   * Import state from persistence
   */
  importState(state: any): void {
    this.state = {
      ...state,
      entities: new Map(state.entities),
      facts: new Map(state.facts),
    };
  }

  /**
   * Clear all memory and context
   */
  clear(): void {
    this.state.memory = [];
    this.state.entities.clear();
    this.state.facts.clear();
    this.state.preferences = {};
    this.state.metadata = {
      totalQueries: 0,
      avgConfidence: 0,
      lastUpdated: Date.now(),
    };
  }
}

/**
 * Create or get cached context manager for a conversation
 * Uses React cache() for request deduplication
 */
export const getContextManager = cache((conversationId: string) => {
  return new AgentContextManager(conversationId);
});

/**
 * Persist context manager state to database (example)
 */
export async function persistContextState(
  conversationId: string,
  state: AgentContextState
): Promise<void> {
  // In production, persist to database
  // Example:
  // await db.insert(conversationContext).values({
  //   conversationId,
  //   state: JSON.stringify(state),
  //   updatedAt: new Date(),
  // });

  console.log(`💾 Persisting context for conversation: ${conversationId}`);
}

/**
 * Load context manager state from database (example)
 */
export async function loadContextState(
  conversationId: string
): Promise<AgentContextState | null> {
  // In production, load from database
  // Example:
  // const result = await db
  //   .select()
  //   .from(conversationContext)
  //   .where(eq(conversationContext.conversationId, conversationId))
  //   .limit(1);
  //
  // return result[0] ? JSON.parse(result[0].state) : null;

  console.log(`📂 Loading context for conversation: ${conversationId}`);
  return null;
}
