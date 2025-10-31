import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import type { AgentDecision } from './types';

/**
 * Query Processor - Decides if retrieval is needed and what strategy to use
 * Implements agentic decision-making for retrieval
 */
export class QueryProcessor {
    private model = openai('gpt-4o-mini');

    /**
     * Analyze query and decide retrieval strategy
     */
    async analyzeQuery(
        query: string,
        conversationHistory: string[]
    ): Promise<AgentDecision> {
        const prompt = `You are an intelligent query analyzer for a RAG system.
                    Analyze this query and decide:
                    1. Does it need external knowledge retrieval?
                    2. What retrieval strategy would be best?
                    3. Should we expand the query for better results?

                    Query: "${query}"

                    Recent conversation:
                    ${conversationHistory.slice(-3).join('\n')}

                    Consider:
                    - Can this be answered from general knowledge?
                    - Does it reference specific documents/products?
                    - Does it need real-time data?
                    - Is it a follow-up question needing context?

                    Respond with ONLY valid JSON, no markdown code blocks or additional text:

                    {
                      "shouldRetrieve": boolean,
                      "strategy": "semantic" | "hybrid" | "graph" | "adaptive",
                      "reasoning": "Brief explanation",
                      "confidence": 0.0-1.0,
                      "queryExpansions": ["expanded query 1", "expanded query 2"]
                    }`;

        try {
            const result = await generateText({
                model: this.model,
                prompt,
                temperature: 0.3,
            });

            console.log('Raw LLM response:', result.text); // Debug

            let cleanedText = result.text.trim();

            // Remove markdown code blocks if present
            if (cleanedText.startsWith('```json')) {
                cleanedText = cleanedText.slice(7).trim();
            } else if (cleanedText.startsWith('```')) {
                cleanedText = cleanedText.slice(3).trim();
            }
            if (cleanedText.endsWith('```')) {
                cleanedText = cleanedText.slice(0, -3).trim();
            }

            console.log('Cleaned text for parsing:', cleanedText); // Debug

            // Use regular JSON.parse instead of superjson for simplicity
            const decision = JSON.parse(cleanedText) as AgentDecision;

            // Validate required fields
            if (typeof decision.shouldRetrieve === 'undefined') {
                throw new Error('Missing required field: shouldRetrieve');
            }

            return decision;
        } catch (error) {
            console.error('Query analysis failed:', error);

            // Fallback to safe defaults with all required fields
            return {
                shouldRetrieve: true,
                strategy: 'hybrid',
                reasoning: 'Fallback due to parsing error: ' + (error instanceof Error ? error.message : 'Unknown error'),
                confidence: 0.5,
                queryExpansions: []
            };
        }
    }

    /**
     * Generate query expansions for better retrieval
     */
    async expandQuery(query: string): Promise<string[]> {
        const prompt = `Generate 3 semantically similar variations of this query for better document retrieval:

                        Original: "${query}"

                        Return ONLY a JSON array of strings, no other text:
                        ["variation 1", "variation 2", "variation 3"]`;

        try {
            const result = await generateText({
                model: this.model,
                prompt,
                temperature: 0.7,
            });

            const expansions = JSON.parse(result.text) as string[];
            return [query, ...expansions]; // Include original
        } catch (error) {
            console.error('Query expansion failed:', error);
            return [query];
        }
    }
}
