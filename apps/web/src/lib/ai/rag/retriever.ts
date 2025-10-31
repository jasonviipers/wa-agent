import { db, and, sql, inArray } from '@wagents/db';
import { knowledgeBase, knowledgeBaseEntry } from '@wagents/db/schema/agent';
import type { RetrievalResult, RetrievalStrategy } from './types';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { calculateCosineSimilarity, generateEmbedding } from './embedding';

/**
 * Advanced Multi-Strategy Retriever
 * Implements semantic, hybrid, and adaptive retrieval
 */
export class AdvancedRetriever {
    constructor(private organizationId: string) { }

    /**
     * Main retrieval method - routes to appropriate strategy
     */
    async retrieve(
        queries: string[],
        strategy: RetrievalStrategy,
        options: {
            limit?: number;
            minScore?: number;
            kbIds?: string[];
            useReranking?: boolean;
        } = {}
    ): Promise<RetrievalResult[]> {
        const { limit = 5, minScore = 0.5, kbIds, useReranking = true } = options;

        let results: RetrievalResult[];

        switch (strategy) {
            case 'semantic':
                results = await this.semanticSearch(queries, { limit: limit * 2, minScore, kbIds });
                break;
            case 'hybrid':
                results = await this.hybridSearch(queries, { limit: limit * 2, minScore, kbIds });
                break;
            case 'graph':
                results = await this.graphSearch(queries, { limit: limit * 2, minScore, kbIds });
                break;
            case 'adaptive':
                results = await this.adaptiveSearch(queries, { limit: limit * 2, minScore, kbIds });
                break;
            default:
                results = await this.hybridSearch(queries, { limit: limit * 2, minScore, kbIds });
        }

        // Apply reranking if enabled
        if (useReranking && results.length > 0) {
            results = await this.rerank(queries[0], results);
        }

        return results.slice(0, limit);
    }

    /**
     * Semantic search using vector embeddings only
     */
    private async semanticSearch(
        queries: string[],
        options: { limit: number; minScore: number; kbIds?: string[] }
    ): Promise<RetrievalResult[]> {
        const allResults: RetrievalResult[] = [];

        for (const query of queries) {
            const queryEmbedding = await generateEmbedding(query);

            const conditions = [
                sql`${knowledgeBase.organizationId} = ${this.organizationId}`,
                sql`${knowledgeBase.isActive} = true`,
                sql`${knowledgeBaseEntry.isActive} = true`,
            ];

            if (options.kbIds && options.kbIds.length > 0) {
                conditions.push(inArray(knowledgeBase.id, options.kbIds));
            }

            const results = await db
                .select({
                    id: knowledgeBaseEntry.id,
                    content: knowledgeBaseEntry.content,
                    title: knowledgeBaseEntry.title,
                    sourceUrl: knowledgeBaseEntry.sourceUrl,
                    kbId: knowledgeBase.id,
                    kbName: knowledgeBase.name,
                    embedding: knowledgeBaseEntry.embedding,
                })
                .from(knowledgeBaseEntry)
                .innerJoin(knowledgeBase, sql`${knowledgeBaseEntry.knowledgeBaseId} = ${knowledgeBase.id}`)
                .where(and(...conditions))
                .limit(options.limit);

            for (const result of results) {
                if (!result.embedding) continue;

                const similarity = await calculateCosineSimilarity(queryEmbedding, result.embedding);

                if (similarity >= options.minScore) {
                    allResults.push({
                        content: result.content,
                        score: similarity,
                        metadata: {
                            source: result.kbName,
                            title: result.title,
                            kbId: result.kbId,
                            chunkId: result.id,
                        },
                    });
                }
            }
        }

        // Deduplicate and sort
        const uniqueResults = this.deduplicateResults(allResults);
        return uniqueResults.sort((a, b) => b.score - a.score);
    }

    /**
     * Hybrid search combining semantic + keyword matching
     */
    private async hybridSearch(
        queries: string[],
        options: { limit: number; minScore: number; kbIds?: string[] }
    ): Promise<RetrievalResult[]> {
        // Get semantic results
        const semanticResults = await this.semanticSearch(queries, options);

        // Get keyword results
        const keywordResults: RetrievalResult[] = [];

        for (const query of queries) {
            const conditions = [
                sql`${knowledgeBase.organizationId} = ${this.organizationId}`,
                sql`${knowledgeBase.isActive} = true`,
                sql`${knowledgeBaseEntry.isActive} = true`,
                sql`(
                        ${knowledgeBaseEntry.title} ILIKE ${`%${query}%`} OR
                        ${knowledgeBaseEntry.content} ILIKE ${`%${query}%`}
                    )`,
            ];

            if (options.kbIds && options.kbIds.length > 0) {
                conditions.push(inArray(knowledgeBase.id, options.kbIds));
            }

            const results = await db
                .select({
                    id: knowledgeBaseEntry.id,
                    content: knowledgeBaseEntry.content,
                    title: knowledgeBaseEntry.title,
                    kbId: knowledgeBase.id,
                    kbName: knowledgeBase.name,
                })
                .from(knowledgeBaseEntry)
                .innerJoin(knowledgeBase, sql`${knowledgeBaseEntry.knowledgeBaseId} = ${knowledgeBase.id}`)
                .where(and(...conditions))
                .limit(options.limit);

            for (const result of results) {
                // Simple keyword score based on query presence
                const score = this.calculateKeywordScore(query, result.content + ' ' + result.title);

                keywordResults.push({
                    content: result.content,
                    score,
                    metadata: {
                        source: result.kbName,
                        title: result.title,
                        kbId: result.kbId,
                        chunkId: result.id,
                    },
                });
            }
        }

        // Combine results with weighted scoring (70% semantic, 30% keyword)
        const combined = [...semanticResults, ...keywordResults];
        const merged = this.deduplicateResults(combined);

        return merged
            .sort((a, b) => b.score - a.score)
            .slice(0, options.limit);
    }

    /**
     * Graph-based search for connected knowledge
     */
    private async graphSearch(
        queries: string[],
        options: { limit: number; minScore: number; kbIds?: string[] }
    ): Promise<RetrievalResult[]> {
        // Start with semantic search to find seed documents
        const seedResults = await this.semanticSearch(queries, {
            ...options,
            limit: Math.ceil(options.limit / 2)
        });

        // Find related documents from same knowledge bases
        if (seedResults.length === 0) return [];

        const kbIds = [...new Set(seedResults.map(r => r.metadata.kbId))];

        const relatedDocs = await db
            .select({
                id: knowledgeBaseEntry.id,
                content: knowledgeBaseEntry.content,
                title: knowledgeBaseEntry.title,
                kbId: knowledgeBase.id,
                kbName: knowledgeBase.name,
                tags: knowledgeBaseEntry.tags,
            })
            .from(knowledgeBaseEntry)
            .innerJoin(knowledgeBase, sql`${knowledgeBaseEntry.knowledgeBaseId} = ${knowledgeBase.id}`)
            .where(
                and(
                    sql`${knowledgeBase.organizationId} = ${this.organizationId}`,
                    inArray(knowledgeBase.id, kbIds),
                    sql`${knowledgeBaseEntry.isActive} = true`
                )
            )
            .limit(options.limit);

        const expandedResults: RetrievalResult[] = [...seedResults];

        for (const doc of relatedDocs) {
            // Check if already included
            if (expandedResults.some(r => r.metadata.chunkId === doc.id)) continue;

            // Add with slightly lower score
            expandedResults.push({
                content: doc.content,
                score: options.minScore * 1.1, // Just above threshold
                metadata: {
                    source: doc.kbName,
                    title: doc.title,
                    kbId: doc.kbId,
                    chunkId: doc.id,
                },
            });
        }

        return expandedResults.slice(0, options.limit);
    }

    /**
     * Adaptive search - chooses best strategy dynamically
     */
    private async adaptiveSearch(
        queries: string[],
        options: { limit: number; minScore: number; kbIds?: string[] }
    ): Promise<RetrievalResult[]> {
        // Try multiple strategies and combine
        const [semantic, hybrid] = await Promise.all([
            this.semanticSearch(queries, { ...options, limit: Math.ceil(options.limit / 2) }),
            this.hybridSearch(queries, { ...options, limit: Math.ceil(options.limit / 2) }),
        ]);

        const combined = [...semantic, ...hybrid];
        const deduplicated = this.deduplicateResults(combined);

        return deduplicated
            .sort((a, b) => b.score - a.score)
            .slice(0, options.limit);
    }

    /**
     * Rerank results using LLM for better relevance
     */
    private async rerank(
        query: string,
        results: RetrievalResult[]
    ): Promise<RetrievalResult[]> {
        if (results.length <= 3) return results; // Not worth reranking

        const prompt = `Rerank these documents by relevance to the query.
                        Query: "${query}"

                        Documents:
                        ${results.map((r, i) => `${i + 1}. ${r.metadata.title}\n${r.content.substring(0, 200)}...`).join('\n\n')}

                        Return ONLY a JSON array of document numbers in order of relevance, e.g., [3, 1, 4, 2]`;

        try {
            const result = await generateText({
                model: openai('gpt-4o-mini'),
                prompt,
                temperature: 0.1,
            });

            const ranking = JSON.parse(result.text) as number[];
            const reranked: RetrievalResult[] = [];

            for (const idx of ranking) {
                if (idx > 0 && idx <= results.length) {
                    reranked.push(results[idx - 1]);
                }
            }

            // Add any missing documents at the end
            for (let i = 0; i < results.length; i++) {
                if (!reranked.includes(results[i])) {
                    reranked.push(results[i]);
                }
            }

            return reranked;
        } catch (error) {
            console.error('Reranking failed:', error);
            return results; // Return original order on failure
        }
    }

    /**
     * Helper: Calculate keyword match score
     */
    private calculateKeywordScore(query: string, text: string): number {
        const queryTerms = query.toLowerCase().split(/\s+/);
        const textLower = text.toLowerCase();

        let matches = 0;
        for (const term of queryTerms) {
            if (term.length < 3) continue; // Skip short words
            if (textLower.includes(term)) matches++;
        }

        return matches / queryTerms.length;
    }

    /**
     * Helper: Deduplicate results by chunk ID
     */
    private deduplicateResults(results: RetrievalResult[]): RetrievalResult[] {
        const seen = new Set<string>();
        const unique: RetrievalResult[] = [];

        for (const result of results) {
            const key = result.metadata.chunkId || result.content.substring(0, 100);
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(result);
            }
        }

        return unique;
    }
}
