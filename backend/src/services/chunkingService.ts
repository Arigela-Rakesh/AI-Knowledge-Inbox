import { config } from '../config';

/**
 * Token estimation strategy:
 * GPT tokenizers average ~4 characters per token for English text.
 * We use a character-based approximation: tokens ≈ chars / 4.
 * This avoids a heavy tokenizer dependency while staying close enough
 * for chunking purposes. For production, use tiktoken for exact counts.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export interface TextChunk {
  content: string;
  tokenCount: number;
  chunkIndex: number;
}

/**
 * Splits text into overlapping chunks preserving sentence boundaries.
 * Target: ~500 tokens per chunk, ~100 token overlap.
 * Strategy: split on sentence boundaries (. ! ?), accumulate until
 * target token count is reached, then start a new chunk with overlap.
 */
export function chunkText(text: string): TextChunk[] {
  const { targetTokens, overlapTokens } = config.chunking;

  // Split into sentences
  const sentences = text
    .replace(/\r\n/g, '\n')
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  if (sentences.length === 0) return [];

  const chunks: TextChunk[] = [];
  let currentSentences: string[] = [];
  let currentTokens = 0;

  for (const sentence of sentences) {
    const sentenceTokens = estimateTokens(sentence);

    // If a single sentence exceeds target, split it by words
    if (sentenceTokens > targetTokens && currentSentences.length === 0) {
      const wordChunks = splitLongSentence(sentence, targetTokens, overlapTokens);
      wordChunks.forEach(wc => chunks.push({ ...wc, chunkIndex: chunks.length }));
      continue;
    }

    if (currentTokens + sentenceTokens > targetTokens && currentSentences.length > 0) {
      const content = currentSentences.join(' ');
      chunks.push({ content, tokenCount: estimateTokens(content), chunkIndex: chunks.length });

      // Build overlap from tail of current sentences
      const overlapSentences: string[] = [];
      let overlapCount = 0;
      for (let i = currentSentences.length - 1; i >= 0; i--) {
        const t = estimateTokens(currentSentences[i]);
        if (overlapCount + t > overlapTokens) break;
        overlapSentences.unshift(currentSentences[i]);
        overlapCount += t;
      }
      currentSentences = [...overlapSentences, sentence];
      currentTokens = overlapCount + sentenceTokens;
    } else {
      currentSentences.push(sentence);
      currentTokens += sentenceTokens;
    }
  }

  if (currentSentences.length > 0) {
    const content = currentSentences.join(' ');
    chunks.push({ content, tokenCount: estimateTokens(content), chunkIndex: chunks.length });
  }

  return chunks;
}

function splitLongSentence(sentence: string, targetTokens: number, overlapTokens: number): TextChunk[] {
  const words = sentence.split(/\s+/);
  const chunks: TextChunk[] = [];
  let current: string[] = [];
  let currentTokens = 0;

  for (const word of words) {
    const wt = estimateTokens(word);
    if (currentTokens + wt > targetTokens && current.length > 0) {
      const content = current.join(' ');
      chunks.push({ content, tokenCount: estimateTokens(content), chunkIndex: 0 });

      const overlapWords: string[] = [];
      let ot = 0;
      for (let i = current.length - 1; i >= 0; i--) {
        const t = estimateTokens(current[i]);
        if (ot + t > overlapTokens) break;
        overlapWords.unshift(current[i]);
        ot += t;
      }
      current = [...overlapWords, word];
      currentTokens = ot + wt;
    } else {
      current.push(word);
      currentTokens += wt;
    }
  }

  if (current.length > 0) {
    const content = current.join(' ');
    chunks.push({ content, tokenCount: estimateTokens(content), chunkIndex: 0 });
  }

  return chunks;
}
