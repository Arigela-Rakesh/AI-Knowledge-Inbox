import { SearchResult } from '../types';
import {
  ComparisonQuestion,
  comparisonSubjectMatchQuality,
  parseComparisonQuestion,
} from './comparisonQuestionService';

export const INSUFFICIENT_CONTEXT_ANSWER =
  "I couldn't find this information in your saved knowledge. Please add a relevant note or URL first.";

interface QuestionConcept {
  key: string;
  pattern: RegExp;
}

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'can', 'did', 'do', 'does', 'for', 'from', 'give',
  'has', 'have', 'how', 'i', 'in', 'is', 'it', 'me', 'of', 'on', 'please',
  'current', 'now', 'present', 'tell', 'that', 'the', 'this', 'to', 'was',
  'were', 'what', 'when', 'where', 'which', 'who', 'whom', 'why', 'with',
  'according', 'based', 'between', 'compare', 'comparison', 'differ',
  'difference', 'different', 'document', 'documents', 'knowledge', 'my',
  'note', 'notes', 'saved', 'source', 'sources', 'url', 'urls', 'versus', 'vs',
]);

function questionConcepts(question: string): QuestionConcept[] {
  let remainder = question.toLowerCase();
  const concepts: QuestionConcept[] = [];
  const addPhraseConcept = (key: string, expression: RegExp, pattern: RegExp) => {
    if (expression.test(remainder)) {
      concepts.push({ key, pattern });
      remainder = remainder.replace(expression, ' ');
    }
  };

  if (/\bwhere\b.*\bborn\b/i.test(remainder)) {
    concepts.push({
      key: 'birthplace',
      pattern: /\b(?:was|is)\s+born\b.{0,160}\b(?:in|at)\b|\b(?:birthplace|place\s+of\s+birth)\b/i,
    });
    remainder = remainder.replace(/\bborn\b/gi, ' ');
  }

  addPhraseConcept(
    'chief-minister',
    /\b(?:chief\s+minister|cm)\b/gi,
    /\b(?:cm|chief[\s-]+minister)/i
  );
  addPhraseConcept('full-name', /\bfull\s+name\b/gi, /full\s*name/i);
  addPhraseConcept(
    'passport-number',
    /\bpassport\s+number\b/gi,
    /\bpassport\s+(?:number|no\.?)/i
  );
  addPhraseConcept(
    'birthplace',
    /\b(?:place\s+of\s+birth|birthplace)\b/gi,
    /\b(?:was|is)\s+born\b.{0,160}\b(?:in|at)\b|\b(?:birthplace|place\s+of\s+birth)\b/i
  );
  addPhraseConcept(
    'birth-date',
    /\b(?:date\s+of\s+birth|birth\s+date|birthday)\b/gi,
    /\b(?:born|date\s+of\s+birth|birth\s+date|birthday)/i
  );

  for (const token of remainder.match(/[\p{L}\p{N}]+/gu) ?? []) {
    if (token.length === 1 || STOP_WORDS.has(token)) continue;
    if (token === 'born' || token === 'birth') {
      concepts.push({ key: 'birth', pattern: /\b(?:born|birth|birthplace|birthday)/i });
      continue;
    }
    if (token === 'stats' || token === 'statistic' || token === 'statistics') {
      concepts.push({ key: 'statistics', pattern: /\b(?:stats?|statistics)\b/i });
      continue;
    }
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    concepts.push({ key: token, pattern: new RegExp(`\\b${escaped}(?:s|es)?\\b`, 'i') });
  }

  return concepts.filter((concept, index, all) =>
    all.findIndex(candidate => candidate.key === concept.key) === index
  );
}

function containsRequestedFact(question: string, evidence: string): boolean {
  if (/\bfull\s+name\b/i.test(question)) {
    const value = /full\s*name\s*(?::|is)?\s*(.+?)(?=born\b|date of birth\b|nickname\b|batting\b|bowling\b|role\b|[.!?;\n]|$)/i.exec(evidence)?.[1];
    return !!value && value.replace(/^is\s+/i, '').trim().split(/\s+/).length >= 2;
  }

  if (/\bwhere\b.*\bborn\b|\b(?:birthplace|place of birth)\b/i.test(question)) {
    return /\b(?:was|is)\s+born\b.{0,160}\b(?:in|at)\s+[\p{L}\d]|\b(?:birthplace|place of birth)\s*[:=]\s*[\p{L}\d]/iu.test(evidence);
  }

  if (/\b(?:when\b.*\bborn\b|date of birth|birth date|birthday)\b/i.test(question)) {
    return /\b(?:born|date of birth|birth date|birthday)\b.{0,60}\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}\s+[A-Z][a-z]+\s+\d{4})/i.test(evidence);
  }

  if (/\bpassport\s+number\b/i.test(question)) {
    return /\bpassport\s+(?:number|no\.?)\s*[:=]?\s*[A-Z0-9][A-Z0-9-]*/i.test(evidence);
  }

  if (/\b(?:cm|chief\s+minister)\b/i.test(question)) {
    const personName = "[A-Z][\\p{L}.'-]*(?:\\s+[A-Z][\\p{L}.'-]*){0,3}";
    const assignedToRole = new RegExp(
      `\\b(?:chief[\\s-]+minister|cm)\\b.{0,100}\\b(?:is|:|-)\\s*${personName}`,
      'iu'
    );
    const personHasRole = new RegExp(
      `${personName}\\s+is\\s+(?:the\\s+)?(?:chief[\\s-]+minister|cm)\\b`,
      'iu'
    );
    return assignedToRole.test(evidence) || personHasRole.test(evidence);
  }

  return true;
}

function chunkRejectionReason(question: string, chunk: SearchResult): string | undefined {
  const concepts = questionConcepts(question);
  if (concepts.length === 0) return 'No answerable concepts could be identified in the question.';
  const evidence = `${chunk.sourceTitle}\n${chunk.content}`;
  const missingConcepts = concepts
    .filter(concept => !concept.pattern.test(evidence))
    .map(concept => concept.key);
  if (missingConcepts.length > 0) {
    return `Missing requested concepts: ${missingConcepts.join(', ')}.`;
  }
  if (!containsRequestedFact(question, evidence)) {
    return 'The retrieved text does not state the requested fact or attribute.';
  }
  return undefined;
}

export interface ContextDecision {
  chunkId: string;
  sourceTitle: string;
  sourceType: SearchResult['sourceType'];
  similarity: number;
  sufficient: boolean;
  reason: string;
}

export interface ContextSufficiencyEvaluation {
  sufficientChunks: SearchResult[];
  decisions: ContextDecision[];
}

function comparisonEvaluation(
  chunks: SearchResult[],
  comparison: ComparisonQuestion
): ContextSufficiencyEvaluation {
  const byItem = new Map<string, SearchResult[]>();
  for (const chunk of chunks) {
    const itemChunks = byItem.get(chunk.itemId) ?? [];
    itemChunks.push(chunk);
    byItem.set(chunk.itemId, itemChunks);
  }

  const entityMatches = comparison.subjects.map(subject => {
    return {
      subject,
      matches: Array.from(byItem.entries())
        .map(([itemId, itemChunks]) => {
          const supportingChunks = itemChunks
            .map(chunk => ({
              chunk,
              quality: comparisonSubjectMatchQuality(
                subject,
                chunk.sourceTitle,
                chunk.sourceType,
                chunk.content
              ),
            }))
            .filter((match): match is { chunk: SearchResult; quality: number } =>
              match.quality !== undefined
            )
            .sort((a, b) => b.quality - a.quality || b.chunk.similarity - a.chunk.similarity);
          if (supportingChunks.length === 0) return undefined;
          return {
            itemId,
            quality: supportingChunks[0].quality,
            chunk: supportingChunks[0].chunk,
          };
        })
        .filter((match): match is { itemId: string; quality: number; chunk: SearchResult } => !!match)
        .sort((a, b) =>
          b.quality - a.quality || b.chunk.similarity - a.chunk.similarity
        ),
    };
  });

  const orderedMatches = [...entityMatches].sort((a, b) => a.matches.length - b.matches.length);
  const assignments = new Map<string, SearchResult>();
  const assignSources = (index: number, usedItems: Set<string>): boolean => {
    if (index >= orderedMatches.length) return true;
    const { subject, matches } = orderedMatches[index];
    for (const match of matches) {
      if (usedItems.has(match.itemId)) continue;
      assignments.set(subject.normalizedLabel, match.chunk);
      usedItems.add(match.itemId);
      if (assignSources(index + 1, usedItems)) return true;
      usedItems.delete(match.itemId);
      assignments.delete(subject.normalizedLabel);
    }
    return false;
  };

  const isSupported = assignSources(0, new Set());
  const selectedIds = new Set(Array.from(assignments.values(), chunk => chunk.chunkId));
  const sufficientChunks = isSupported
    ? comparison.subjects.flatMap(({ normalizedLabel }) => {
      const assignedChunk = assignments.get(normalizedLabel);
      return assignedChunk ? [assignedChunk] : [];
    })
    : [];
  const unmatchedEntities = entityMatches
    .filter(({ matches }) => matches.length === 0)
    .map(({ subject }) => subject.label);
  const comparisonRejectionReason = unmatchedEntities.length > 0
    ? `No retrieved chunk contains comparison subject(s): ${unmatchedEntities.join(', ')}.`
    : `Retrieved context cannot support each comparison subject (${comparison.subjects.map(subject => subject.label).join(', ')}) from a distinct source item.`;
  const decisions = chunks.map(chunk => {
    const assignedEntity = Array.from(assignments.entries())
      .find(([, assignedChunk]) => assignedChunk.chunkId === chunk.chunkId)?.[0];
    const sufficient = isSupported && selectedIds.has(chunk.chunkId);
    const mentionedEntities = comparison.subjects
      .filter(subject =>
        comparisonSubjectMatchQuality(subject, chunk.sourceTitle, chunk.sourceType, chunk.content) !== undefined
      )
      .map(subject => subject.label);
    return {
      chunkId: chunk.chunkId,
      sourceTitle: chunk.sourceTitle,
      sourceType: chunk.sourceType,
      similarity: chunk.similarity,
      sufficient,
      reason: sufficient
        ? `Selected as evidence for comparison subject "${comparison.subjects.find(subject => subject.normalizedLabel === assignedEntity)?.label ?? assignedEntity}".`
        : isSupported
          ? mentionedEntities.length > 0
            ? `Not selected; a higher-ranked chunk from the same source supports subject(s): ${mentionedEntities.join(', ')}.`
            : 'The chunk does not mention either comparison subject.'
          : comparisonRejectionReason,
    };
  });

  return { sufficientChunks, decisions };
}

export function evaluateContextSufficiency(
  question: string,
  chunks: SearchResult[]
): ContextSufficiencyEvaluation {
  const comparison = parseComparisonQuestion(question);
  if (comparison) return comparisonEvaluation(chunks, comparison);

  const concepts = questionConcepts(question);
  const titleSpecificItemIds = new Set(
    chunks
      .filter(chunk =>
        concepts.length > 0 && concepts.every(concept => concept.pattern.test(chunk.sourceTitle))
      )
      .map(chunk => chunk.itemId)
  );
  const decisions = chunks.map(chunk => {
    const rejectionReason = titleSpecificItemIds.size > 0 && !titleSpecificItemIds.has(chunk.itemId)
      ? 'A more specific saved source title matches all requested concepts.'
      : chunkRejectionReason(question, chunk);
    return {
      chunkId: chunk.chunkId,
      sourceTitle: chunk.sourceTitle,
      sourceType: chunk.sourceType,
      similarity: chunk.similarity,
      sufficient: rejectionReason === undefined,
      reason: rejectionReason ?? 'The retrieved text contains the requested concepts and fact pattern.',
    };
  });
  const sufficientCandidateIds = new Set(
    decisions.filter(decision => decision.sufficient).map(decision => decision.chunkId)
  );
  const bestChunkByItem = new Map<string, SearchResult>();
  for (const chunk of [...chunks].sort((a, b) => b.similarity - a.similarity)) {
    if (sufficientCandidateIds.has(chunk.chunkId) && !bestChunkByItem.has(chunk.itemId)) {
      bestChunkByItem.set(chunk.itemId, chunk);
    }
  }
  const selectedIds = titleSpecificItemIds.size > 0
    ? new Set(Array.from(bestChunkByItem.values(), chunk => chunk.chunkId))
    : sufficientCandidateIds;
  const sufficientChunks = chunks.filter(chunk => selectedIds.has(chunk.chunkId));

  return {
    sufficientChunks,
    decisions: decisions.map(decision =>
      decision.sufficient && !selectedIds.has(decision.chunkId)
        ? {
          ...decision,
          sufficient: false,
          reason: 'A higher-scoring chunk from this specific source already provides the requested evidence.',
        }
        : decision
    ),
  };
}

export function findSufficientContext(question: string, chunks: SearchResult[]): SearchResult[] {
  return evaluateContextSufficiency(question, chunks).sufficientChunks;
}
