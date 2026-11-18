export interface Item {
  id: string;
  title: string;
  content?: string;
  source_type: 'note' | 'url';
  source_url: string | null;
  created_at: string;
  updated_at: string;
  preview?: string;
  chunks?: Chunk[];
}

export interface Chunk {
  id: string;
  item_id: string;
  chunk_index: number;
  content: string;
  token_count: number;
  created_at: string;
}

export interface SourceCitation {
  itemId: string;
  chunkId?: string;
  title: string;
  url: string | null;
  snippet: string;
  similarity?: number;
}

export interface QueryResponse {
  answer: string;
  sources: SourceCitation[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface IngestResult {
  item: Item;
  chunksCreated: number;
  embeddingsCreated: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceCitation[];
  timestamp: Date;
}

export interface ChatConversation {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messages: ChatMessage[];
}

export interface ChatHistory {
  version: 1;
  activeConversationId: string;
  conversations: ChatConversation[];
}
