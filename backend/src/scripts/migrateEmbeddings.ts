import { initDb, closeDb, dbAll, dbRun } from '../database';
import { generateEmbedding } from '../services/embeddingService';
import { serializeVector } from '../utils/vectors';
import { config } from '../config';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

interface ChunkRow {
  id: string;
  content: string;
  item_id: string;
}

export async function migrateEmbeddings(): Promise<void> {
  const chunks = dbAll<ChunkRow>(`SELECT id, content, item_id FROM chunks ORDER BY item_id, rowid`);
  logger.info('Starting embedding migration to Ollama', {
    model: config.ollama.embeddingModel,
    chunks: chunks.length,
  });

  dbRun(`DROP TABLE IF EXISTS temp.embedding_migration_stage`);
  dbRun(`
    CREATE TEMP TABLE embedding_migration_stage (
      id TEXT NOT NULL,
      chunk_id TEXT NOT NULL,
      model TEXT NOT NULL,
      dimensions INTEGER NOT NULL,
      vector BLOB NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  try {
    for (let index = 0; index < chunks.length; index++) {
      const chunk = chunks[index];
      const vector = await generateEmbedding(chunk.content, 'document');
      dbRun(
        `INSERT INTO temp.embedding_migration_stage (id, chunk_id, model, dimensions, vector, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          chunk.id,
          config.ollama.embeddingModel,
          vector.length,
          serializeVector(vector),
          new Date().toISOString(),
        ]
      );

      if ((index + 1) % 10 === 0 || index + 1 === chunks.length) {
        logger.info('Embedding migration progress', { completed: index + 1, total: chunks.length });
      }
    }

    dbRun('BEGIN TRANSACTION');
    try {
      dbRun('DELETE FROM embeddings');
      dbRun(`
        INSERT INTO embeddings (id, chunk_id, model, dimensions, vector, created_at)
        SELECT id, chunk_id, model, dimensions, vector, created_at
        FROM temp.embedding_migration_stage
      `);
      dbRun('DROP TABLE temp.embedding_migration_stage');
      dbRun('COMMIT');
    } catch (err) {
      dbRun('ROLLBACK');
      throw err;
    }

    logger.info('Embedding migration completed; all vectors now use Ollama', {
      migrated: chunks.length,
      model: config.ollama.embeddingModel,
    });
  } catch (err) {
    dbRun('DROP TABLE IF EXISTS temp.embedding_migration_stage');
    throw new Error(
      `Embedding migration failed; existing embeddings were preserved. ${(err as Error).message}`
    );
  }
}

async function main(): Promise<void> {
  await initDb();
  try {
    await migrateEmbeddings();
  } finally {
    closeDb();
  }
}

if (require.main === module) {
  main().catch(err => {
    logger.error('Embedding migration failed', { error: (err as Error).message });
    process.exitCode = 1;
  });
}
