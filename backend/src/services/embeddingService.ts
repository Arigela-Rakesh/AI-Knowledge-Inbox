import { config } from '../config';
import { logger } from '../utils/logger';
import { OllamaError, postOllama } from './ollamaClient';

// nomic-embed-text produces 768-dimensional vectors.
export const EXPECTED_DIMENSIONS = 768;

export type EmbeddingPurpose = 'document' | 'query';

interface OllamaEmbeddingResponse {
  embeddings?: unknown;
}

export async function generateEmbedding(
  text: string,
  purpose: EmbeddingPurpose = 'document'
): Promise<number[]> {
  const prefix = purpose === 'query' ? 'search_query: ' : 'search_document: ';
  const response = await postOllama<OllamaEmbeddingResponse>('embed', {
    model: config.ollama.embeddingModel,
    input: `${prefix}${text}`,
    truncate: true,
  });
  const vectors = response?.embeddings;
  const vector = Array.isArray(vectors) ? vectors[0] : undefined;

  if (!Array.isArray(vector) || vector.length !== EXPECTED_DIMENSIONS) {
    throw new OllamaError(
      `Ollama returned an invalid embedding; expected ${EXPECTED_DIMENSIONS} dimensions.`,
      502
    );
  }

  const numericVector: number[] = [];
  for (const value of vector) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new OllamaError('Ollama returned an embedding containing invalid values.', 502);
    }
    numericVector.push(value);
  }

  logger.debug('Ollama embedding generated', {
    model: config.ollama.embeddingModel,
    dimensions: numericVector.length,
    purpose,
  });
  return numericVector;
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];
  for (const text of texts) {
    results.push(await generateEmbedding(text));
  }
  return results;
}
