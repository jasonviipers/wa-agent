import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import type { RetrievalResult } from './types';

/**
 * Self-Reflective RAG Component
 * Evaluates and validates retrieval quality
 */
export class SelfReflectiveRAG {
    private model = openai('gpt-4o-mini');

    /**
     * Evaluate if retrieved documents are relevant
     */
    async evaluateRelevance(
        query: string,
        documents: RetrievalResult[]
    ): Promise<{
        isRelevant: boolean[];
        overallQuality: number;
        shouldRetrieveMore: boolean;
        feedback: string;
    }> {
        if (documents.length === 0) {
            return {
                isRelevant: [],
                overallQuality: 0,
                shouldRetrieveMore: true,
                feedback: 'No documents retrieved',
            };
        }

        const prompt = `Evaluate the relevance of these retrieved documents for answering the query.

                        Query: "${query}"

                        Documents:
                        ${documents.map((d, i) => `${i + 1}. ${d.metadata.title}\n${d.content.substring(0, 300)}...`).join('\n\n')}

                        For each document, determine if it's relevant (true/false).
                        Also provide an overall quality score (0-1) and whether more retrieval is needed.

                        Respond in JSON format:
                        {
                        "isRelevant": [true, false, true, ...],
                        "overallQuality": 0.0-1.0,
                        "shouldRetrieveMore": boolean,
                        "feedback": "brief explanation"
                    }`;

        try {
            const result = await generateText({
                model: this.model,
                prompt,
                temperature: 0.2,
            });

            return JSON.parse(result.text);
        } catch (error) {
            console.error('Relevance evaluation failed:', error);
            return {
                isRelevant: documents.map(() => true),
                overallQuality: 0.7,
                shouldRetrieveMore: false,
                feedback: 'Evaluation failed, assuming relevance',
            };
        }
    }

    /**
     * Validate generated response against retrieved context
     */
    async validateResponse(
        query: string,
        response: string,
        context: RetrievalResult[]
    ): Promise<{
        isFactuallyAccurate: boolean;
        confidence: number;
        issues: string[];
    }> {
        const prompt = `Validate this AI response against the provided context.

                    Query: "${query}"

                    Response: "${response}"

                    Context:
                    ${context.map(c => c.content.substring(0, 200)).join('\n\n')}

                    Check for:
                    1. Factual accuracy against context
                    2. Hallucinations or unsupported claims
                    3. Proper use of context

                    Respond in JSON format:
                    {
                    "isFactuallyAccurate": boolean,
                    "confidence": 0.0-1.0,
                    "issues": ["issue 1", "issue 2"]
                }`;

        try {
            const result = await generateText({
                model: this.model,
                prompt,
                temperature: 0.1,
            });

            return JSON.parse(result.text);
        } catch (error) {
            console.error('Response validation failed:', error);
            return {
                isFactuallyAccurate: true,
                confidence: 0.5,
                issues: [],
            };
        }
    }
}
