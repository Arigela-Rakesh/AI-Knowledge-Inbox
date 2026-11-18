process.env.DATABASE_PATH = ':memory:';

jest.mock('../src/services/urlExtractorService', () => ({
  extractUrlContent: jest.fn(),
}));

import { closeDb, dbRun, initDb } from '../src/database';
import { findAllItems, createItem, findItemByUrl, normalizeSourceUrl } from '../src/repositories/itemRepository';
import { ingestUrl } from '../src/services/ingestionService';
import { extractUrlContent } from '../src/services/urlExtractorService';

const mockedExtractUrlContent = jest.mocked(extractUrlContent);

beforeAll(async () => {
  await initDb();
});

afterAll(() => closeDb());

describe('normalized URL duplicate detection', () => {
  beforeEach(() => {
    mockedExtractUrlContent.mockReset();
    dbRun('DELETE FROM embeddings');
    dbRun('DELETE FROM chunks');
    dbRun('DELETE FROM items');
  });

  it('normalizes host case, default ports, and fragments without collapsing path or query differences', () => {
    expect(normalizeSourceUrl('HTTPS://EXAMPLE.COM:443/page?view=1#section'))
      .toBe('https://example.com/page?view=1');
    expect(normalizeSourceUrl('https://example.com/page?view=1'))
      .not.toBe(normalizeSourceUrl('https://example.com/page?view=2'));
    expect(normalizeSourceUrl('https://example.com/react'))
      .not.toBe(normalizeSourceUrl('https://example.com/reactjs'));
  });

  it('rejects duplicate URL ingestion across equivalent URL spellings', async () => {
    const existing = createItem({
      title: 'Existing page',
      content: 'Saved content.',
      source_type: 'url',
      source_url: 'HTTPS://EXAMPLE.COM:443/page?view=1#section',
    });

    expect(findItemByUrl('https://example.com/page?view=1#another')?.id).toBe(existing.id);
    await expect(ingestUrl({
      type: 'url',
      url: 'https://example.com/page?view=1',
    })).rejects.toThrow('URL already ingested');
    expect(mockedExtractUrlContent).not.toHaveBeenCalled();
    expect(findAllItems()).toHaveLength(1);
  });

  it('rechecks after fetching to avoid concurrent duplicate ingestion', async () => {
    mockedExtractUrlContent.mockResolvedValue({
      title: 'Concurrent page',
      content: '',
      url: 'https://example.com/concurrent',
    });

    const results = await Promise.allSettled([
      ingestUrl({ type: 'url', url: 'https://example.com/concurrent' }),
      ingestUrl({ type: 'url', url: 'https://EXAMPLE.com:443/concurrent#top' }),
    ]);

    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
    expect(findAllItems()).toHaveLength(1);
  });

  it('does not remove existing duplicate records or merge unrelated paths', () => {
    const first = createItem({
      title: 'First saved URL',
      content: 'First content.',
      source_type: 'url',
      source_url: 'https://example.com/react',
    });
    const second = createItem({
      title: 'Second saved URL',
      content: 'Second content.',
      source_type: 'url',
      source_url: 'https://example.com/react',
    });
    createItem({
      title: 'React.js URL',
      content: 'React.js content.',
      source_type: 'url',
      source_url: 'https://example.com/reactjs',
    });

    expect(findAllItems()).toHaveLength(3);
    expect([first.id, second.id]).toContain(findItemByUrl('https://example.com/react')?.id);
    expect(findItemByUrl('https://example.com/reactjs')?.title).toBe('React.js URL');
  });
});
