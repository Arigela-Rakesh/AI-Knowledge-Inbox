process.env.DATABASE_PATH = ':memory:';

jest.mock('../src/services/embeddingService', () => ({
  generateEmbedding: jest.fn(),
}));

import { generateEmbedding } from '../src/services/embeddingService';
import { migrateEmbeddings } from '../src/scripts/migrateEmbeddings';
import { closeDb, dbAll, dbRun, initDb } from '../src/database';
import { deserializeVector, serializeVector } from '../src/utils/vectors';

const mockedGenerateEmbedding = jest.mocked(generateEmbedding);
const originalVector = new Array(768).fill(-0.25);
const ollamaVector = new Array(768).fill(0.75);

async function seedExistingData(): Promise<void> {
  await initDb();
  dbRun(
    `INSERT INTO items (id, title, content, source_type, source_url, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['item-1', 'Saved note', 'Original item content', 'note', null, '2026-01-01', '2026-01-01']
  );
  dbRun(
    `INSERT INTO chunks (id, item_id, chunk_index, content, token_count, created_at)
     VALUES (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?)`,
    ['chunk-1', 'item-1', 0, 'First saved chunk', 4, '2026-01-01',
      'chunk-2', 'item-1', 1, 'Second saved chunk', 4, '2026-01-01']
  );
  dbRun(
    `INSERT INTO embeddings (id, chunk_id, model, dimensions, vector, created_at)
     VALUES (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?)`,
    ['embedding-1', 'chunk-1', 'old-provider-model', 768, serializeVector(originalVector), '2026-01-01',
      'embedding-2', 'chunk-2', 'old-provider-model', 768, serializeVector(originalVector), '2026-01-01']
  );
}

beforeEach(async () => {
  mockedGenerateEmbedding.mockReset();
  await seedExistingData();
});

afterEach(() => {
  closeDb();
});

describe('migrateEmbeddings', () => {
  it('replaces all vectors only after generating embeddings for every chunk', async () => {
    mockedGenerateEmbedding.mockResolvedValue(ollamaVector);

    await migrateEmbeddings();

    const embeddings = dbAll<{
      chunk_id: string;
      model: string;
      dimensions: number;
      vector: Uint8Array;
    }>('SELECT chunk_id, model, dimensions, vector FROM embeddings ORDER BY chunk_id');
    expect(embeddings).toHaveLength(2);
    expect(embeddings.map(row => row.chunk_id)).toEqual(['chunk-1', 'chunk-2']);
    expect(embeddings.every(row => row.model === 'nomic-embed-text')).toBe(true);
    expect(embeddings.every(row => row.dimensions === 768)).toBe(true);
    expect(deserializeVector(embeddings[0].vector)).toEqual(ollamaVector);
    expect(dbAll('SELECT id, content FROM chunks')).toHaveLength(2);
    expect(dbAll('SELECT id, content FROM items')).toEqual([
      expect.objectContaining({ id: 'item-1', content: 'Original item content' }),
    ]);
  });

  it('preserves every existing vector if generating any chunk embedding fails', async () => {
    mockedGenerateEmbedding
      .mockResolvedValueOnce(ollamaVector)
      .mockRejectedValueOnce(new Error('Ollama unavailable'));

    await expect(migrateEmbeddings()).rejects.toThrow('existing embeddings were preserved');

    const embeddings = dbAll<{
      id: string;
      model: string;
      vector: Uint8Array;
    }>('SELECT id, model, vector FROM embeddings ORDER BY id');
    expect(embeddings).toHaveLength(2);
    expect(embeddings.map(row => row.id)).toEqual(['embedding-1', 'embedding-2']);
    expect(embeddings.every(row => row.model === 'old-provider-model')).toBe(true);
    expect(deserializeVector(embeddings[0].vector)).toEqual(originalVector);
    expect(deserializeVector(embeddings[1].vector)).toEqual(originalVector);
    expect(dbAll('SELECT id, content FROM chunks')).toHaveLength(2);
  });
});
