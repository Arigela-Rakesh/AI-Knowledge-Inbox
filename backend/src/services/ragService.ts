import { semanticSearch } from './vectorSearchService';
import { generateAnswer } from './llmService';
import { QueryResponse } from '../types';
import { logger } from '../utils/logger';
import { evaluateContextSufficiency, INSUFFICIENT_CONTEXT_ANSWER } from './contextSufficiencyService';
import { summarizeKnowledge } from './knowledgeSummaryService';
import { detectQueryIntent } from './queryIntentService';

export async function queryKnowledge(question: string): Promise<QueryResponse> {
  logger.info('RAG query started', { question });

  const intent = detectQueryIntent(question);
  if (intent.kind !== 'factual-question') {
    return summarizeKnowledge(question, intent);
  }

  const retrievedChunks = await semanticSearch(question);
  const evaluation = evaluateContextSufficiency(question, retrievedChunks);
  const relevantChunks = evaluation.sufficientChunks;
  logger.info('RAG context sufficiency diagnostics', {
    question,
    retrievedChunkCount: retrievedChunks.length,
    sufficientChunkCount: relevantChunks.length,
    decisions: evaluation.decisions,
    rejectionReason: relevantChunks.length === 0
      ? evaluation.decisions.length > 0
        ? Array.from(new Set(evaluation.decisions.map(decision => decision.reason))).join(' ')
        : 'No chunks were retrieved, so no saved evidence could be evaluated.'
      : undefined,
  });

  if (relevantChunks.length === 0) {
    return { answer: INSUFFICIENT_CONTEXT_ANSWER, sources: [] };
  }

  const response = await generateAnswer(question, relevantChunks);
  return response;
}
