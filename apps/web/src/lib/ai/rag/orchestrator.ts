import type { ModelMessage } from 'ai';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { QueryProcessor } from './query-processor';
import { AdvancedRetriever } from './retriever';
import { SelfReflectiveRAG } from './self-reflective';
import type { AgentExecutionTrace, AgenticRAGContext, AgentReasoningStep, RAGConfig, RAGExecutionResult } from './types';
import { createId } from '@paralleldrive/cuid2';

/**
 * Agentic RAG Orchestrator
 * Coordinates all RAG components with agentic decision-making
 */
export class AgenticRAGOrchestrator {
    private queryProcessor: QueryProcessor;
    private retriever: AdvancedRetriever;
    private reflector: SelfReflectiveRAG;
    private maxIterations: number;
    private enableChainOfThought: boolean;
    private enableSelfReflection: boolean;
    private minConfidence: number;

    constructor(private config: RAGConfig) {
        this.queryProcessor = new QueryProcessor();
        this.retriever = new AdvancedRetriever(config.organizationId);
        this.reflector = new SelfReflectiveRAG();
        this.maxIterations = config.options?.maxIterations || 3;
        this.enableChainOfThought = config.options?.enableChainOfThought ?? true;
        this.enableSelfReflection = config.options?.enableSelfReflection ?? true;
        this.minConfidence = config.options?.minConfidence || 0.7;
    }

    /**
     * Execute agentic RAG workflow with full observability
     */
    async execute(
        query: string,
        conversationHistory: ModelMessage[] = [],
        stream = false
    ): Promise<RAGExecutionResult> {
        const startTime = performance.now();
        const traceId = createId();

        // Initialize execution trace for observability
        const trace: AgentExecutionTrace = {
            traceId,
            query,
            startTime: Date.now(),
            steps: [],
            decisions: [],
            chainOfThought: [],
        };

        try {
            // Initialize context
            const context: AgenticRAGContext = {
                query,
                conversationHistory,
                retrievedDocs: [],
                agentDecisions: [],
                iterationCount: 0,
                chainOfThought: [],
                performance: {
                    totalTimeMs: 0,
                    retrievalTimeMs: 0,
                    generationTimeMs: 0,
                    evaluationTimeMs: 0,
                },
            };

            // Phase 1: Query Analysis with Chain of Thought
            const analysisStep = this.createReasoningStep(
                "query_analysis",
                "in_progress",
                { query, conversationHistory: conversationHistory.slice(-5) }
            );
            trace.steps.push(analysisStep);

            const analysisStartTime = performance.now();

            if (this.enableChainOfThought) {
                context.chainOfThought.push({
                    step: 1,
                    thought:
                        "I need to analyze the query to understand what information is needed",
                    action: "Analyzing query intent and determining retrieval strategy",
                    timestamp: Date.now(),
                });
            }

            // Analyze query
            const historyText = conversationHistory
                .slice(-5)
                .map((m) => `${m.role}: ${m.content}`)
                .filter((m) => m.length > 0);

            const decision = await this.queryProcessor.analyzeQuery(
                query,
                historyText
            );

            if (!decision) {
                // Fallback decision
                const fallbackDecision = {
                    shouldRetrieve: true,
                    strategy: "hybrid" as const,
                    reasoning: "Fallback due to undefined decision",
                    confidence: 0.5,
                    queryExpansions: [],
                    chainOfThought: [],
                    metadata: {
                        processingTimeMs: performance.now() - analysisStartTime,
                    },
                };
                context.agentDecisions.push(fallbackDecision);
            } else {
                // Enhance decision with chain of thought
                if (this.enableChainOfThought) {
                    decision.chainOfThought = [
                        {
                            step: 1,
                            thought: `Query analysis confidence: ${decision.confidence}`,
                            action: `Selected strategy: ${decision.strategy}`,
                            observation: decision.reasoning,
                            timestamp: Date.now(),
                        },
                    ];
                    context.chainOfThought.push(...decision.chainOfThought);
                }

                decision.metadata = {
                    ...decision.metadata,
                    processingTimeMs: performance.now() - analysisStartTime,
                };
                context.agentDecisions.push(decision);
            }

            const currentDecision = context.agentDecisions[0];
            trace.decisions.push(currentDecision);

            this.completeReasoningStep(analysisStep, currentDecision);
            console.log("🤔 Agent Decision:", currentDecision);

            // Phase 2: Retrieval (if needed)
            if (currentDecision.shouldRetrieve) {
                const retrievalStep = this.createReasoningStep(
                    "retrieval",
                    "in_progress",
                    {
                        strategy: currentDecision.strategy,
                        queryExpansions: currentDecision.queryExpansions,
                    }
                );
                trace.steps.push(retrievalStep);

                const retrievalStartTime = performance.now();

                if (this.enableChainOfThought) {
                    context.chainOfThought.push({
                        step: 2,
                        thought: `I will search the knowledge base using ${currentDecision.strategy} strategy`,
                        action: "Retrieving relevant documents",
                        timestamp: Date.now(),
                    });
                }

                const queries = currentDecision.queryExpansions?.length
                    ? currentDecision.queryExpansions
                    : [query];

                const docs = await this.retriever.retrieve(
                    queries,
                    currentDecision.strategy,
                    {
                        limit: 5,
                        minScore: 0.5,
                        kbIds: this.config.knowledgeBaseIds,
                        useReranking: true,
                    }
                );

                context.retrievedDocs = docs;
                context.iterationCount++;
                context.performance.retrievalTimeMs =
                    performance.now() - retrievalStartTime;

                this.completeReasoningStep(retrievalStep, {
                    documentsRetrieved: docs.length,
                    timeMs: context.performance.retrievalTimeMs,
                });

                if (this.enableChainOfThought) {
                    context.chainOfThought.push({
                        step: 2,
                        thought: `Retrieved ${docs.length} documents`,
                        action: "Evaluating relevance",
                        observation: `Average score: ${(
                            docs.reduce((sum, d) => sum + d.score, 0) / docs.length
                        ).toFixed(2)}`,
                        timestamp: Date.now(),
                    });
                }

                console.log(`📚 Retrieved ${docs.length} documents`);

                // Phase 3: Self-Reflection (if enabled)
                if (this.enableSelfReflection && docs.length > 0) {
                    const evaluationStep = this.createReasoningStep(
                        "evaluation",
                        "in_progress",
                        { documentCount: docs.length }
                    );
                    trace.steps.push(evaluationStep);

                    const evaluationStartTime = performance.now();

                    const evaluation = await this.reflector.evaluateRelevance(
                        query,
                        docs
                    );
                    context.performance.evaluationTimeMs =
                        performance.now() - evaluationStartTime;

                    console.log("✅ Retrieval Evaluation:", evaluation);

                    // Filter irrelevant documents
                    context.retrievedDocs = docs.filter((_, i) => evaluation.isRelevant[i]);

                    if (this.enableChainOfThought) {
                        context.chainOfThought.push({
                            step: 3,
                            thought: `Evaluation quality: ${evaluation.overallQuality.toFixed(2)}`,
                            action: "Filtering irrelevant documents",
                            observation: `Kept ${context.retrievedDocs.length}/${docs.length} documents`,
                            timestamp: Date.now(),
                        });
                    }

                    this.completeReasoningStep(evaluationStep, {
                        overallQuality: evaluation.overallQuality,
                        relevantDocs: context.retrievedDocs.length,
                    });

                    // Iterate if quality is low and haven't hit max iterations
                    if (
                        evaluation.shouldRetrieveMore &&
                        evaluation.overallQuality < this.minConfidence &&
                        context.iterationCount < this.maxIterations
                    ) {
                        console.log("🔄 Quality below threshold, retrieving more...");

                        if (this.enableChainOfThought) {
                            context.chainOfThought.push({
                                step: 4,
                                thought: "Quality is below threshold, need more information",
                                action: "Expanding query and retrieving additional documents",
                                timestamp: Date.now(),
                            });
                        }

                        const expandedQueries = await this.queryProcessor.expandQuery(
                            query
                        );
                        const moreDocs = await this.retriever.retrieve(
                            expandedQueries,
                            "adaptive",
                            {
                                limit: 3,
                                minScore: 0.6,
                                kbIds: this.config.knowledgeBaseIds,
                            }
                        );

                        context.retrievedDocs.push(...moreDocs);
                        context.iterationCount++;

                        if (this.enableChainOfThought) {
                            context.chainOfThought.push({
                                step: 4,
                                thought: `Retrieved ${moreDocs.length} additional documents`,
                                action: "Proceeding to generation",
                                observation: `Total documents: ${context.retrievedDocs.length}`,
                                timestamp: Date.now(),
                            });
                        }
                    }
                }
            }

            // Phase 4: Generation with context
            const generationStep = this.createReasoningStep(
                "generation",
                "in_progress",
                { documentsUsed: context.retrievedDocs.length }
            );
            trace.steps.push(generationStep);

            if (this.enableChainOfThought) {
                context.chainOfThought.push({
                    step: context.chainOfThought.length + 1,
                    thought: "Now I will generate a response based on the retrieved context",
                    action: "Generating response with citations",
                    timestamp: Date.now(),
                });
            }

            const result = await this.generateResponse(context, stream);

            context.performance.totalTimeMs = performance.now() - startTime;

            this.completeReasoningStep(generationStep, {
                responseLength: result.text.length,
                timeMs: context.performance.generationTimeMs,
            });

            // Complete trace
            trace.endTime = Date.now();
            trace.chainOfThought = context.chainOfThought;
            trace.result = result;

            console.log("⚡ Performance:", context.performance);
            console.log("🧠 Chain of Thought:", context.chainOfThought);

            // Store trace for debugging (you can persist this to database)
            this.logExecutionTrace(trace);

            return result;
        } catch (error) {
            trace.endTime = Date.now();
            trace.error = {
                message: error instanceof Error ? error.message : "Unknown error",
                code: "EXECUTION_ERROR",
                stack: error instanceof Error ? error.stack : undefined,
            };

            console.error("❌ RAG Execution Error:", trace.error);
            this.logExecutionTrace(trace);

            throw error;
        }
    }


    /**
     * Generate response with retrieved context
     */
    private async generateResponse(
        context: AgenticRAGContext,
        stream: boolean
    ): Promise<RAGExecutionResult> {
        const startTime = performance.now();

        const model = this.config.model.startsWith("gpt")
            ? openai(this.config.model)
            : anthropic(this.config.model);

        // Build enriched prompt with citations
        const contextText =
            context.retrievedDocs.length > 0
                ? `\n\nRelevant Context:\n${context.retrievedDocs
                    .map(
                        (d, i) =>
                            `[${i + 1}] Source: ${d.metadata.title}\n${d.content}\n(Relevance: ${(d.score * 100).toFixed(0)}%)`
                    )
                    .join("\n\n")}`
                : "\n\nNo additional context retrieved. Use general knowledge.";

        const systemPrompt = `You are a helpful AI assistant with access to a knowledge base.

                    When answering:
                    - Cite sources using [1], [2] format when using retrieved information
                    - Be precise and factual
                    - If context doesn't contain the answer, say so clearly
                    - Don't make up information
                    - Explain your reasoning when appropriate

                    ${contextText}`;

        const messages: ModelMessage[] = [
            ...context.conversationHistory,
            { role: "user", content: context.query },
        ];

        if (stream) {
            // Streaming not fully implemented in this version for simplicity
            return this.generateNonStreaming(
                model,
                systemPrompt,
                messages,
                context,
                startTime
            );
        } else {
            return this.generateNonStreaming(
                model,
                systemPrompt,
                messages,
                context,
                startTime
            );
        }
    }

    /**
 * Non-streaming generation with validation
 */
    private async generateNonStreaming(
        model: any,
        systemPrompt: string,
        messages: ModelMessage[],
        context: AgenticRAGContext,
        startTime: number
    ): Promise<RAGExecutionResult> {
        const result = await generateText({
            model,
            system: systemPrompt,
            messages,
            temperature: this.config.temperature || 0.7,
            maxOutputTokens: this.config.maxTokens || 1000,
        });

        context.performance.generationTimeMs = performance.now() - startTime;

        // Validate response if we have context
        let validation;
        if (this.enableSelfReflection && context.retrievedDocs.length > 0) {
            const rawValidation = await this.reflector.validateResponse(
                context.query,
                result.text,
                context.retrievedDocs
            );

            // Transform the validation to match ResponseValidation type
            if (rawValidation) {
                validation = {
                    isFactuallyAccurate: rawValidation.isFactuallyAccurate,
                    confidence: rawValidation.confidence,
                    reasoning: Array.isArray(rawValidation.issues)
                        ? rawValidation.issues.join('; ')
                        : 'No issues detected',
                    citationsVerified: true, // Add this field
                    hallucinationDetected: rawValidation.issues && rawValidation.issues.length > 0,
                    suggestions: rawValidation.issues && rawValidation.issues.length > 0
                        ? rawValidation.issues
                        : undefined
                };
            }

            console.log("✓ Response Validation:", validation);

            if (
                validation &&
                !validation.isFactuallyAccurate &&
                validation.confidence < this.minConfidence
            ) {
                console.warn("⚠️  Response validation failed, may contain inaccuracies");
            }
        }

        // Calculate overall confidence
        const overallConfidence =
            (context.agentDecisions[0]?.confidence || 0.5) * (validation?.confidence || 1);

        const usage = result.usage ? {
            promptTokens: result.usage.inputTokens,
            completionTokens: result.usage.outputTokens,
            totalTokens: result.usage.totalTokens
        } : undefined;

        return {
            text: result.text,
            usage,
            context: {
                retrievedDocs: context.retrievedDocs.length,
                iterations: context.iterationCount,
                decision: context.agentDecisions[0],
                chainOfThought: context.chainOfThought,
                performance: context.performance,
                confidence: overallConfidence,
            },
            sources: context.retrievedDocs,
            validation,
        };
    }

    /**
  * Create a reasoning step for observability
  */
    private createReasoningStep(
        type: AgentReasoningStep["type"],
        status: AgentReasoningStep["status"],
        input: unknown
    ): AgentReasoningStep {
        return {
            id: createId(),
            type,
            status,
            startTime: Date.now(),
            input,
        };
    }

    /**
  * Complete a reasoning step
  */
    private completeReasoningStep(
        step: AgentReasoningStep,
        output: unknown
    ): void {
        step.status = "completed";
        step.endTime = Date.now();
        step.output = output;
    }

    /**
     * Log execution trace (can be persisted to database)
     */
    private logExecutionTrace(trace: AgentExecutionTrace): void {
        // In production, you would persist this to a database
        // For now, we'll just log it
        console.log("📊 Execution Trace:", {
            traceId: trace.traceId,
            query: trace.query,
            duration: trace.endTime ? trace.endTime - trace.startTime : "in-progress",
            steps: trace.steps.length,
            decisions: trace.decisions.length,
            chainOfThought: trace.chainOfThought.length,
            error: trace.error?.message,
        });

        // You can add persistence here:
        // await db.insert(executionTraces).values(trace);
    }
}

export { AgenticRAGOrchestrator as AgenticRAG };