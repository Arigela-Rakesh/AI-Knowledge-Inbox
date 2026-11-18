export interface Item {
  id: string;
  title: string;
  content: string;
  source_type: 'note' | 'url';
  source_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Chunk {
  id: string;
  item_id: string;
  chunk_index: number;
  content: string;
  token_count: number;
  created_at: string;
}

export interface Embedding {
  id: string;
  chunk_id: string;
  model: string;
  dimensions: number;
  vector: Uint8Array;
  created_at: string;
}

export interface ChunkWithMeta {
  chunkId: string;
  itemId: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  sourceType: 'note' | 'url';
  sourceTitle: string;
  sourceUrl: string | null;
}

export interface SearchResult {
  chunkId: string;
  itemId: string;
  content: string;
  similarity: number;
  sourceTitle: string;
  sourceUrl: string | null;
  sourceType: 'note' | 'url';
}

export interface QueryResponse {
  answer: string;
  sources: SourceCitation[];
}

export interface SourceCitation {
  itemId: string;
  chunkId?: string;
  title: string;
  url: string | null;
  snippet: string;
  similarity?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
