import { findAllItems } from '../repositories/itemRepository';
import { Item, QueryResponse } from '../types';
import { logger } from '../utils/logger';
import { generateKnowledgeSummary } from './llmService';
import { KnowledgeWideIntent } from './queryIntentService';

export const EMPTY_KNOWLEDGE_ANSWER =
  'Your knowledge base is empty. Add some notes or URLs to get started.';

export async function summarizeKnowledge(
  question: string,
  intent: KnowledgeWideIntent
): Promise<QueryResponse> {
  const allItems = findAllItems();
  if (allItems.length === 0) {
    return { answer: EMPTY_KNOWLEDGE_ANSWER, sources: [] };
  }

  const items = intent.sourceType
    ? allItems.filter((item: Item) => item.source_type === intent.sourceType)
    : allItems;

  if (items.length === 0) {
    const sourceLabel = intent.sourceType === 'url' ? 'URLs' : 'notes';
    return {
      answer: `No saved ${sourceLabel} were found in your knowledge base.`,
      sources: [],
    };
  }

  logger.info('Knowledge-wide query started', {
    question,
    intent: intent.kind,
    sourceType: intent.sourceType ?? 'all',
    savedItemCount: items.length,
    itemIds: items.map(item => item.id),
  });

  return generateKnowledgeSummary(question, items, intent.kind);
}
