import { createItem, findItemByUrl } from '../repositories/itemRepository';
import { createChunk } from '../repositories/chunkRepository';
import { createEmbedding, findEmbeddingByChunkId } from '../repositories/embeddingRepository';
import { chunkText } from './chunkingService';
import { generateEmbedding } from './embeddingService';
import { extractUrlContent } from './urlExtractorService';
import { serializeVector } from '../utils/vectors';
import { config } from '../config';
import { Item } from '../types';
import { logger } from '../utils/logger';

export interface IngestNoteInput {
  type: 'note';
  title: string;
  content: string;
}

export interface IngestUrlInput {
  type: 'url';
  url: string;
  title?: string;
}

export type IngestInput = IngestNoteInput | IngestUrlInput;

export interface IngestResult {
  item: Item;
  chunksCreated: number;
  embeddingsCreated: number;
}

async function processItem(item: Item): Promise<{ chunksCreated: number; embeddingsCreated: number }> {
  const textChunks = chunkText(item.content);
  let chunksCreated = 0;
  let embeddingsCreated = 0;

  for (const tc of textChunks) {
    const chunk = createChunk({
      item_id: item.id,
      chunk_index: tc.chunkIndex,
      content: tc.content,
      token_count: tc.tokenCount,
    });
    chunksCreated++;

    const existing = findEmbeddingByChunkId(chunk.id);
    if (!existing) {
      const vector = await generateEmbedding(tc.content);
      createEmbedding({
        chunk_id: chunk.id,
        model: config.ollama.embeddingModel,
        dimensions: vector.length,
        vector: serializeVector(vector),
      });
      embeddingsCreated++;
    }
  }

  logger.info('Item processed', { itemId: item.id, chunksCreated, embeddingsCreated });
  return { chunksCreated, embeddingsCreated };
}

export async function ingestNote(input: IngestNoteInput): Promise<IngestResult> {
  const item = createItem({
    title: input.title,
    content: input.content,
    source_type: 'note',
    source_url: null,
  });

  const { chunksCreated, embeddingsCreated } = await processItem(item);
  return { item, chunksCreated, embeddingsCreated };
}

export async function ingestUrl(input: IngestUrlInput): Promise<IngestResult> {
  const existing = findItemByUrl(input.url);
  if (existing) {
    throw new Error(`URL already ingested: ${input.url}`);
  }

  const extracted = await extractUrlContent(input.url);
  const ingestedWhileFetching = findItemByUrl(input.url);
  if (ingestedWhileFetching) {
    throw new Error(`URL already ingested: ${input.url}`);
  }
  const title = input.title || extracted.title;

  const item = createItem({
    title,
    content: extracted.content,
    source_type: 'url',
    source_url: input.url,
  });

  const { chunksCreated, embeddingsCreated } = await processItem(item);
  return { item, chunksCreated, embeddingsCreated };
}
