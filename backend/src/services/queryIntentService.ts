import { Item } from '../types';

export type KnowledgeWideIntent = {
  kind: 'knowledge-summary' | 'important-information';
  sourceType?: Item['source_type'];
};

export type QueryIntent =
  | { kind: 'factual-question' }
  | KnowledgeWideIntent;

function requestedSourceType(question: string): Item['source_type'] | undefined {
  const mentionsUrls = /\b(?:urls?|links?|webpages?|web\s+pages?|websites?)\b/i.test(question);
  const mentionsNotes = /\bnotes?\b/i.test(question);
  if (mentionsUrls && !mentionsNotes) return 'url';
  if (mentionsNotes && !mentionsUrls) return 'note';
  return undefined;
}

export function detectQueryIntent(question: string): QueryIntent {
  const normalized = question.toLowerCase().replace(/\s+/g, ' ').trim();
  const sourceType = requestedSourceType(normalized);

  if (
    /\b(?:important information|important facts?|key takeaways?|main topics?|key concepts?)\b/i.test(normalized) ||
    /\bextract\b/i.test(normalized)
  ) {
    return { kind: 'important-information', sourceType };
  }

  if (
    /\b(?:summari[sz](?:e|ing|ation)|summary|summaries|overview)\b/i.test(normalized) ||
    /\bwhat\s+(?:information|details)\b.*\b(?:have i|did i|i have|i saved|saved|stored)\b/i.test(normalized) ||
    /\bwhat\s+(?:information|details)\b.*\b(?:available|saved|stored)\b/i.test(normalized) ||
    /\beverything\b.*\b(?:i saved|i have saved|saved)\b/i.test(normalized) ||
    /\bwhat can you tell me from my saved (?:knowledge|documents|notes?|urls?|links?|webpages?|web\s+pages?|websites?)\b/i.test(normalized)
  ) {
    return { kind: 'knowledge-summary', sourceType };
  }

  return { kind: 'factual-question' };
}
