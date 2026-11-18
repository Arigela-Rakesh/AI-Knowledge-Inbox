import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databasePath: process.env.DATABASE_PATH || './data/knowledge.db',
  ollama: {
    baseUrl: (process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/+$/, ''),
    embeddingModel: process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text',
    chatModel: process.env.OLLAMA_CHAT_MODEL || 'llama3.2:3b',
    timeoutMs: 120000,
  },
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  vectorSearch: {
    topK: 10,
    minSimilarity: 0.3,
  },
  chunking: {
    targetTokens: 500,
    overlapTokens: 100,
  },
};
