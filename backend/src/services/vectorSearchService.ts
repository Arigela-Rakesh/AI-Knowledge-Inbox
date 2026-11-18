import { countChunksMissingEmbeddingModel, findAllEmbeddingsWithChunks } from '../repositories/embeddingRepository';
import { generateEmbedding } from './embeddingService';
import { cosineSimilarity, deserializeVector } from '../utils/vectors';
import { config } from '../config';
import { SearchResult } from '../types';
import { logger } from '../utils/logger';
import { countAllChunks } from '../repositories/chunkRepository';
import { countAllItems } from '../repositories/itemRepository';
import {
  ComparisonSubject,
  comparisonSubjectMatchQuality,
  parseComparisonQuestion,
} from './comparisonQuestionService';

class EmbeddingMigrationRequiredError extends Error {
  public readonly status = 409;
}

function comparisonAwareSelection(
  candidates: SearchResult[],
  subjects: [ComparisonSubject, ComparisonSubject]
): SearchResult[] {
  const chunksByItem = new Map<string, SearchResult[]>();
  for (const candidate of candidates) {
    const itemChunks = chunksByItem.get(candidate.itemId) ?? [];
    itemChunks.push(candidate);
    chunksByItem.set(candidate.itemId, itemChunks);
  }

  const subjectMatches = subjects.map(subject => ({
    subject,
    matches: Array.from(chunksByItem.entries())
      .map(([itemId, chunks]) => {
        const supportingChunks = chunks
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
        const best = supportingChunks[0];
        return best ? { itemId, ...best } : undefined;
      })
      .filter((match): match is { itemId: string; chunk: SearchResult; quality: number } => !!match)
      .sort((a, b) => b.quality - a.quality || b.chunk.similarity - a.chunk.similarity),
  }));
  const orderedMatches = [...subjectMatches].sort((a, b) => a.matches.length - b.matches.length);
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

  const hasDistinctSources = assignSources(0, new Set());
  const selected = hasDistinctSources
    ? subjects.flatMap(subject => {
      const chunk = assignments.get(subject.normalizedLabel);
      return chunk ? [chunk] : [];
    })
    : [];
  if (!hasDistinctSources) {
    const selectedItems = new Set<string>();
    for (const candidate of candidates) {
      if (selectedItems.size >= config.vectorSearch.topK) break;
      if (selectedItems.has(candidate.itemId)) continue;
      selected.push(candidate);
      selectedItems.add(candidate.itemId);
    }
  }
  const selectedIds = new Set(selected.map(chunk => chunk.chunkId));
  const limit = Math.max(config.vectorSearch.topK, selected.length);
  for (const candidate of candidates) {
    if (selected.length >= limit) break;
    if (selectedIds.has(candidate.chunkId)) continue;
    selected.push(candidate);
    selectedIds.add(candidate.chunkId);
  }
  return selected;
}

export async function semanticSearch(question: string): Promise<SearchResult[]> {
  const savedKnowledgeItemCount = countAllItems();
  const storedChunkCount = countAllChunks();
  const missingEmbeddings = countChunksMissingEmbeddingModel(config.ollama.embeddingModel);
  if (missingEmbeddings > 0) {
    logger.error('Vector retrieval diagnostics', {
      question,
      embeddingModel: config.ollama.embeddingModel,
      savedKnowledgeItemCount,
      storedChunkCount,
      missingEmbeddingCount: missingEmbeddings,
      chunksConsidered: 0,
      retrievedChunks: [],
      rejectionReason: 'Some saved chunks do not have embeddings for the configured model.',
    });
    throw new EmbeddingMigrationRequiredError(
      `${missingEmbeddings} chunks need Ollama embeddings. Run \`npm run migrate:embeddings --prefix backend\` first.`
    );
  }

  const questionVector = await generateEmbedding(question, 'query');
  const rows = findAllEmbeddingsWithChunks(config.ollama.embeddingModel);
  const scored: SearchResult[] = [];
  const excludedChunks: Array<{ chunkId: string; reason: string }> = [];

  for (const row of rows) {
    try {
      if (row.dimensions !== questionVector.length) {
        excludedChunks.push({
          chunkId: row.chunk_id,
          reason: `Stored dimension metadata is ${row.dimensions}; query dimensions are ${questionVector.length}.`,
        });
        continue;
      }

      const vector = deserializeVector(row.vector);
      if (vector.length !== questionVector.length) {
        excludedChunks.push({
          chunkId: row.chunk_id,
          reason: `Stored vector has ${vector.length} dimensions; query has ${questionVector.length}.`,
        });
        continue;
      }

      const similarity = cosineSimilarity(questionVector, vector);
      if (!Number.isFinite(similarity)) {
        excludedChunks.push({ chunkId: row.chunk_id, reason: 'Cosine similarity was not finite.' });
        continue;
      }
      scored.push({
        chunkId: row.chunk_id,
        itemId: row.item_id,
        content: row.chunk_content,
        similarity,
        sourceTitle: row.title,
        sourceUrl: row.source_url,
        sourceType: row.source_type as 'note' | 'url',
      });
    } catch (error: unknown) {
      excludedChunks.push({
        chunkId: row.chunk_id,
        reason: error instanceof Error ? error.message : 'Stored vector could not be decoded.',
      });
    }
  }

  const aboveThreshold = scored
    .filter(result => result.similarity >= config.vectorSearch.minSimilarity)
    .sort((a, b) => b.similarity - a.similarity);
  const comparison = parseComparisonQuestion(question);
  const retrieved = comparison
    ? comparisonAwareSelection(aboveThreshold, comparison.subjects)
    : aboveThreshold.slice(0, config.vectorSearch.topK);

  logger.info('Vector retrieval diagnostics', {
    question,
    embeddingModel: config.ollama.embeddingModel,
    queryEmbeddingDimensions: questionVector.length,
    savedKnowledgeItemCount,
    storedChunkCount,
    storedEmbeddingCount: rows.length,
    chunksConsidered: scored.length,
    chunksExcluded: excludedChunks,
    chunksAboveSimilarityThreshold: aboveThreshold.length,
    similarityThreshold: config.vectorSearch.minSimilarity,
    topK: config.vectorSearch.topK,
    selectionStrategy: comparison ? 'comparison-source-diversity' : 'global-similarity',
    retrievedChunkCount: retrieved.length,
    distinctRetrievedItemCount: new Set(retrieved.map(result => result.itemId)).size,
    retrievedChunks: retrieved.map(result => ({
      chunkId: result.chunkId,
      itemId: result.itemId,
      sourceTitle: result.sourceTitle,
      sourceType: result.sourceType,
      similarity: result.similarity,
    })),
  });
  return retrieved;
}
