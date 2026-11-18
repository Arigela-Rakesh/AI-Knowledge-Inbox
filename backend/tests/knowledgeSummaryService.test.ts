jest.mock('../src/repositories/itemRepository', () => ({
  findAllItems: jest.fn(),
}));

jest.mock('../src/services/llmService', () => ({
  generateKnowledgeSummary: jest.fn(),
}));

import { findAllItems } from '../src/repositories/itemRepository';
import { generateKnowledgeSummary } from '../src/services/llmService';
import { Item } from '../src/types';
import { EMPTY_KNOWLEDGE_ANSWER, summarizeKnowledge } from '../src/services/knowledgeSummaryService';

const mockedFindAllItems = jest.mocked(findAllItems);
const mockedGenerateKnowledgeSummary = jest.mocked(generateKnowledgeSummary);

const items: Item[] = [
  {
    id: 'note-1',
    title: 'Saved note',
    content: 'Note content.',
    source_type: 'note',
    source_url: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  },
  {
    id: 'url-1',
    title: 'Saved page',
    content: 'Page content.',
    source_type: 'url',
    source_url: 'https://example.com/page',
    created_at: '2026-01-02',
    updated_at: '2026-01-02',
  },
];

beforeEach(() => {
  mockedFindAllItems.mockReset().mockReturnValue(items);
  mockedGenerateKnowledgeSummary.mockReset().mockResolvedValue({ answer: 'Summary', sources: [] });
});

describe('knowledge-wide summary retrieval', () => {
  it('passes every saved item to the summary generator', async () => {
    await summarizeKnowledge('Summarize my saved knowledge.', { kind: 'knowledge-summary' });

    expect(mockedGenerateKnowledgeSummary).toHaveBeenCalledWith(
      'Summarize my saved knowledge.',
      items,
      'knowledge-summary'
    );
  });

  it('filters to URL items for a URL-specific request', async () => {
    await summarizeKnowledge('Summarize my saved URLs.', {
      kind: 'knowledge-summary',
      sourceType: 'url',
    });

    expect(mockedGenerateKnowledgeSummary).toHaveBeenCalledWith(
      'Summarize my saved URLs.',
      [items[1]],
      'knowledge-summary'
    );
  });

  it('filters to note items for a note-specific request', async () => {
    await summarizeKnowledge('Summarize all my notes.', {
      kind: 'knowledge-summary',
      sourceType: 'note',
    });

    expect(mockedGenerateKnowledgeSummary).toHaveBeenCalledWith(
      'Summarize all my notes.',
      [items[0]],
      'knowledge-summary'
    );
  });

  it('distinguishes an empty knowledge base from an empty semantic search', async () => {
    mockedFindAllItems.mockReturnValue([]);

    await expect(summarizeKnowledge('Summarize my saved knowledge.', {
      kind: 'knowledge-summary',
    })).resolves.toEqual({ answer: EMPTY_KNOWLEDGE_ANSWER, sources: [] });

    expect(mockedGenerateKnowledgeSummary).not.toHaveBeenCalled();
  });

  it('reports when a requested source type has no saved items', async () => {
    mockedFindAllItems.mockReturnValue([items[0]]);

    await expect(summarizeKnowledge('Summarize my saved URLs.', {
      kind: 'knowledge-summary',
      sourceType: 'url',
    })).resolves.toEqual({
      answer: 'No saved URLs were found in your knowledge base.',
      sources: [],
    });
  });
});
