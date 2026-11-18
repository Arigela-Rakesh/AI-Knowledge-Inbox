process.env.DATABASE_PATH = ':memory:';
process.env.NODE_ENV = 'test';

jest.mock('../src/services/embeddingService', () => ({
  generateEmbedding: jest.fn().mockResolvedValue(new Array(768).fill(0.1)),
  generateEmbeddings: jest.fn().mockResolvedValue([new Array(768).fill(0.1)]),
  EXPECTED_DIMENSIONS: 1536,
}));

jest.mock('../src/services/llmService', () => ({
  generateAnswer: jest.fn().mockResolvedValue({
    answer: 'This is a mocked answer.',
    sources: [],
  }),
}));

import request from 'supertest';
import app, { initDb } from '../src/app';
import { closeDb } from '../src/database';

beforeAll(async () => {
  await initDb();
});

afterAll(() => {
  closeDb();
});

describe('GET /api/health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
  });
});

describe('GET /api/items', () => {
  it('returns array', async () => {
    const res = await request(app).get('/api/items');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('POST /api/ingest', () => {
  it('rejects missing type', async () => {
    const res = await request(app).post('/api/ingest').send({ title: 'Test' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects note with missing content', async () => {
    const res = await request(app).post('/api/ingest').send({ type: 'note', title: 'T' });
    expect(res.status).toBe(400);
  });

  it('ingests a note successfully', async () => {
    const res = await request(app).post('/api/ingest').send({
      type: 'note',
      title: 'Test Note',
      content: 'This is test content for the note.',
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.item.title).toBe('Test Note');
    expect(res.body.data.chunksCreated).toBeGreaterThan(0);
  });

  it('rejects invalid URL format', async () => {
    const res = await request(app).post('/api/ingest').send({ type: 'url', url: 'not-a-url' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/items/:id', () => {
  it('returns 404 for unknown id', async () => {
    const res = await request(app).get('/api/items/nonexistent-id');
    expect(res.status).toBe(404);
  });

  it('returns item after ingestion', async () => {
    const ingest = await request(app).post('/api/ingest').send({
      type: 'note',
      title: 'Detail Test',
      content: 'Content for detail test.',
    });
    expect(ingest.status).toBe(201);
    const id = ingest.body.data.item.id;
    const res = await request(app).get(`/api/items/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(id);
  });
});

describe('DELETE /api/items/:id', () => {
  it('returns 404 for unknown id', async () => {
    const res = await request(app).delete('/api/items/nonexistent-id');
    expect(res.status).toBe(404);
  });

  it('deletes an existing item', async () => {
    const ingest = await request(app).post('/api/ingest').send({
      type: 'note',
      title: 'Delete Me',
      content: 'This will be deleted.',
    });
    expect(ingest.status).toBe(201);
    const id = ingest.body.data.item.id;
    const del = await request(app).delete(`/api/items/${id}`);
    expect(del.status).toBe(200);
    const get = await request(app).get(`/api/items/${id}`);
    expect(get.status).toBe(404);
  });
});

describe('POST /api/query', () => {
  it('rejects empty question', async () => {
    const res = await request(app).post('/api/query').send({ question: '' });
    expect(res.status).toBe(400);
  });

  it('returns 200 for valid question', async () => {
    const res = await request(app).post('/api/query').send({ question: 'What is machine learning?' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.answer).toBe('string');
  });
});
