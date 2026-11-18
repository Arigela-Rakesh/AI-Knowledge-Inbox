import { SearchResult } from '../types';

export interface ComparisonSubject {
  label: string;
  normalizedLabel: string;
  terms: string[];
  sourceType?: SearchResult['sourceType'];
}

export interface ComparisonQuestion {
  subjects: [ComparisonSubject, ComparisonSubject];
}

const SUBJECT_STOP_WORDS = new Set([
  'about', 'and', 'content', 'details', 'from', 'in', 'information', 'knowledge',
  'my', 'note', 'notes', 'of', 'saved', 'source', 'the', 'url', 'urls',
  'versus', 'vs', 'webpage', 'website', 'with',
]);

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function parseSubject(value: string): ComparisonSubject | undefined {
  const sourceType: ComparisonSubject['sourceType'] = /\b(?:note|notes)\b/i.test(value)
    ? 'note'
    : /\b(?:url|urls|website|webpage|link)\b/i.test(value)
      ? 'url'
      : undefined;
  const label = normalize(value)
    .split(/\s+/)
    .filter(term => !SUBJECT_STOP_WORDS.has(term))
    .join(' ');
  const terms = label.split(/\s+/).filter(Boolean);

  if (terms.length === 0) return undefined;
  return { label, normalizedLabel: label, terms, sourceType };
}

export function parseComparisonQuestion(question: string): ComparisonQuestion | undefined {
  const text = question.trim().replace(/[?.!]+$/, '');
  const patterns = [
    /\b(?:difference|differences)\s+between\s+(.+?)\s+and\s+(.+)$/i,
    /\bsimilarit(?:y|ies)\s+between\s+(.+?)\s+and\s+(.+)$/i,
    /\bcompare\s+(.+?)\s+(?:and|with|to|vs\.?|versus)\s+(.+)$/i,
    /^(.+?)\s+(?:vs\.?|versus)\s+(.+)$/i,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (!match) continue;

    const first = parseSubject(match[1]);
    const second = parseSubject(match[2]);
    if (!first || !second || first.normalizedLabel === second.normalizedLabel) return undefined;
    return { subjects: [first, second] };
  }
  return undefined;
}

export function isComparisonQuestion(question: string): boolean {
  return parseComparisonQuestion(question) !== undefined;
}

export function comparisonSubjectMatchQuality(
  subject: ComparisonSubject,
  sourceTitle: string,
  sourceType: SearchResult['sourceType'],
  content: string
): number | undefined {
  if (subject.sourceType && subject.sourceType !== sourceType) return undefined;

  const normalizedTitle = normalize(sourceTitle);
  if (normalizedTitle === subject.normalizedLabel) return 3;

  const titleTerms = new Set(normalizedTitle.split(/\s+/));
  if (subject.terms.every(term => titleTerms.has(term))) return 2;

  const normalizedContent = normalize(content);
  const contentTerms = new Set(normalizedContent.split(/\s+/));
  if (subject.terms.every(term => contentTerms.has(term))) return 1;
  return undefined;
}
