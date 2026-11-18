process.env.DATABASE_PATH = ':memory:';

jest.mock('../src/services/embeddingService', () => ({
  generateEmbedding: jest.fn().mockResolvedValue(new Array(768).fill(0.5)),
}));

import { semanticSearch } from '../src/services/vectorSearchService';
import { initDb, closeDb, dbRun } from '../src/database';
import { serializeVector } from '../src/utils/vectors';

beforeAll(async () => {
  await initDb();
});

afterAll(() => closeDb());

describe('vectorSearchService', () => {
  it('returns empty array when no embeddings exist', async () => {
    const results = await semanticSearch('test question');
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(0);
  });

  it('retrieves relevant chunks beyond the previous five-result limit from notes and URLs', async () => {
    for (let index = 0; index < 6; index++) {
      const itemId = `search-item-${index}`;
      const chunkId = `search-chunk-${index}`;
      const sourceType = index % 2 === 0 ? 'note' : 'url';
      dbRun(
        `INSERT INTO items (id, title, content, source_type, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [itemId, `Search item ${index}`, 'Saved search content', sourceType, '2026-01-01', '2026-01-01']
      );
      dbRun(
        `INSERT INTO chunks (id, item_id, chunk_index, content, token_count, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [chunkId, itemId, 0, `Saved search chunk ${index}`, 4, '2026-01-01']
      );
      dbRun(
        `INSERT INTO embeddings (id, chunk_id, model, dimensions, vector, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [`search-embedding-${index}`, chunkId, 'nomic-embed-text', 768, serializeVector(new Array(768).fill(0.5)), '2026-01-01']
      );
    }

    const results = await semanticSearch('search question');

    expect(results).toHaveLength(6);
    expect(new Set(results.map(result => result.sourceType))).toEqual(new Set(['note', 'url']));
  });

  it('includes a lower-ranked comparison source outside the global top ten', async () => {
    for (let index = 0; index < 12; index++) {
      const itemId = `alpha-item-${index}`;
      const chunkId = `alpha-chunk-${index}`;
      dbRun(
        `INSERT INTO items (id, title, content, source_type, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [itemId, 'Alpha', 'Alpha source content', 'url', '2026-01-01', '2026-01-01']
      );
      dbRun(
        `INSERT INTO chunks (id, item_id, chunk_index, content, token_count, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [chunkId, itemId, index, 'Alpha source content', 4, '2026-01-01']
      );
      dbRun(
        `INSERT INTO embeddings (id, chunk_id, model, dimensions, vector, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [`alpha-embedding-${index}`, chunkId, 'nomic-embed-text', 768, serializeVector(new Array(768).fill(0.5)), '2026-01-01']
      );
    }

    const betaVector = new Array(768).fill(0);
    betaVector.fill(0.5, 0, 200);
    dbRun(
      `INSERT INTO items (id, title, content, source_type, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['beta-item', 'Beta', 'Beta source content', 'note', '2026-01-01', '2026-01-01']
    );
    dbRun(
      `INSERT INTO chunks (id, item_id, chunk_index, content, token_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['beta-chunk', 'beta-item', 0, 'Beta source content', 4, '2026-01-01']
    );
    dbRun(
      `INSERT INTO embeddings (id, chunk_id, model, dimensions, vector, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['beta-embedding', 'beta-chunk', 'nomic-embed-text', 768, serializeVector(betaVector), '2026-01-01']
    );

    const results = await semanticSearch('Alpha vs Beta');

    expect(results).toHaveLength(10);
    expect(results.map(result => result.itemId)).toContain('alpha-item-0');
    expect(results.map(result => result.itemId)).toContain('beta-item');
  });

  it('refuses to search legacy vectors until the Ollama migration is complete', async () => {
    dbRun(
      `INSERT INTO items (id, title, content, source_type, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['legacy-item', 'Legacy note', 'Saved content', 'note', '2026-01-01', '2026-01-01']
    );
    dbRun(
      `INSERT INTO chunks (id, item_id, chunk_index, content, token_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['legacy-chunk', 'legacy-item', 0, 'Legacy chunk', 3, '2026-01-01']
    );
    dbRun(
      `INSERT INTO embeddings (id, chunk_id, model, dimensions, vector, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['legacy-embedding', 'legacy-chunk', 'old-provider-model', 768, serializeVector(new Array(768).fill(0.1)), '2026-01-01']
    );

    await expect(semanticSearch('test question')).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining('migrate:embeddings'),
    });
  });
});
