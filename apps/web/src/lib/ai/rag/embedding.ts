
import { cosineSimilarity, embedMany, embed } from 'ai';
import { openai } from '@ai-sdk/openai';
import { and, cosineDistance, db, desc, gt, sql } from '@wagents/db';
import { knowledgeBaseEntry } from '@wagents/db/schema/agent';

export interface EmbeddingResult {
    embeddings: number[][];
    tokens: number;
}

export const embeddingModel = openai.textEmbeddingModel('text-embedding-3-large');

export function generateChunks(input: string, chunkSize: number = 300, overlap: number = 50): string[] {
    const sentences = input
        .trim()
        .split(/[.!?]+/)
        .filter(s => s.trim().length > 0)
        .map(s => s.trim());
    
    const chunks: string[] = [];
    let currentChunk: string[] = [];
    let currentLength = 0;
    
    for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i];
        const sentenceLength = sentence.split(/\s+/).length;
        
        if (currentLength + sentenceLength > chunkSize && currentChunk.length > 0) {
            chunks.push(currentChunk.join('. ') + '.');
            
            // Keep overlap sentences
            const overlapCount = Math.ceil(currentChunk.length * (overlap / 100));
            currentChunk = currentChunk.slice(-overlapCount);
            currentLength = currentChunk.reduce((acc, s) => acc + s.split(/\s+/).length, 0);
        }
        
        currentChunk.push(sentence);
        currentLength += sentenceLength;
    }
    
    if (currentChunk.length > 0) {
        chunks.push(currentChunk.join('. ') + '.');
    }
    
    return chunks;
}

/**
 * Generate embeddings with metadata for enhanced retrieval
 */
export async function generateEmbeddings(
    value: string,
    metadata?: Record<string, any>
): Promise<Array<{ embedding: number[]; content: string; metadata?: Record<string, any> }>> {
    const chunks = generateChunks(value);
    const { embeddings } = await embedMany({
        model: embeddingModel,
        values: chunks,
    });
    
    return embeddings.map((e, i) => ({ 
        content: chunks[i], 
        embedding: e,
        metadata 
    }));
}

/**
 * Single embedding generation
 */
export async function generateEmbedding(value: string): Promise<number[]> {
    const input = value.replaceAll('\\n', ' ');
    const { embedding } = await embed({
        model: embeddingModel,
        value: input,
    });
    return embedding;
}

/**
 * Calculate cosine similarity between two embeddings
 * Returns a value between -1 and 1, where 1 means identical
 */
export async function calculateCosineSimilarity(embedding1: number[], embedding2: number[]): Promise<number> {
    return await cosineSimilarity(embedding1, embedding2);
}

/**
 * Hybrid Search with Semantic + Keyword 
 * Combines vector similarity with metadata filtering
 */
export async function hybridSearch(
    userQuery: string,
    options: {
        limit?: number;
        minSimilarity?: number;
        filters?: {
            knowledgeBaseId?: string;
            tags?: string[];
            dateRange?: { start?: Date; end?: Date };
        };
    } = {}
): Promise<Array<{ content: string; similarity: number; metadata: any; id: string }>> {
    const { limit = 5, minSimilarity = 0.5, filters = {} } = options;
    
    // Expand query for better retrieval
    const queryVariations = await expandQuery(userQuery);
    const queryEmbeddings = await Promise.all(
        queryVariations.map(q => generateEmbedding(q))
    );
    
    // Average the embeddings for a composite search vector
    const avgEmbedding = queryEmbeddings[0].map((_, i) => 
        queryEmbeddings.reduce((sum, emb) => sum + emb[i], 0) / queryEmbeddings.length
    );
    
    const similarity = sql<number>`1 - (${cosineDistance(
        knowledgeBaseEntry.embedding,
        avgEmbedding,
    )})`;

     const conditions = [gt(similarity, minSimilarity)];
    
    if (filters.knowledgeBaseId) {
        conditions.push(sql`${knowledgeBaseEntry.knowledgeBaseId} = ${filters.knowledgeBaseId}`);
    }
    
    if (filters.tags && filters.tags.length > 0) {
        conditions.push(
            sql`${knowledgeBaseEntry.tags} && ARRAY[${filters.tags.join(',')}]::text[]`
        );
    }
    
    if (filters.dateRange?.start) {
        conditions.push(sql`${knowledgeBaseEntry.createdAt} >= ${filters.dateRange.start}`);
    }
    
    if (filters.dateRange?.end) {
        conditions.push(sql`${knowledgeBaseEntry.createdAt} <= ${filters.dateRange.end}`);
    }

     const results = await db
        .select({ 
            id: knowledgeBaseEntry.id,
            content: knowledgeBaseEntry.content, 
            similarity,
            metadata: knowledgeBaseEntry.metadata,
            title: knowledgeBaseEntry.title,
            tags: knowledgeBaseEntry.tags,
        })
        .from(knowledgeBaseEntry)
        .where(and(...conditions))
        .orderBy(desc(similarity))
        .limit(limit);
    
    return results;
}

/**WYD ::
 * Query Expansion
 * Expands user query with synonyms and related terms for better retrieval
 */
export async function expandQuery(query: string): Promise<string[]> {
   // This would ideally use an LLM to generate query variations
    // For now, return the original query plus common expansions
    const expansions = [query];
    
    // Add question variations
    if (!query.toLowerCase().includes('what') && !query.toLowerCase().includes('how')) {
        expansions.push(`What is ${query}?`);
        expansions.push(`How does ${query} work?`);
    }
    
    return expansions;
}
