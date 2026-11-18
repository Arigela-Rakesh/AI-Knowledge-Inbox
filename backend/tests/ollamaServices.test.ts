jest.mock('../src/services/ollamaClient', () => ({
  OllamaError: class OllamaError extends Error {
    constructor(message: string, public readonly status: number) {
      super(message);
    }
  },
  postOllama: jest.fn(),
}));

import { generateEmbedding, EXPECTED_DIMENSIONS } from '../src/services/embeddingService';
import { generateAnswer, generateKnowledgeSummary } from '../src/services/llmService';
import { postOllama } from '../src/services/ollamaClient';
import { Item, SearchResult } from '../src/types';

const mockedPostOllama = jest.mocked(postOllama);
const vector = new Array(EXPECTED_DIMENSIONS).fill(0.25);
const source: SearchResult = {
  chunkId: 'chunk-1',
  itemId: 'item-1',
  content: 'Machine learning lets systems learn from data.',
  similarity: 0.9,
  sourceTitle: 'ML notes',
  sourceUrl: null,
  sourceType: 'note',
};

beforeEach(() => mockedPostOllama.mockReset());

describe('Ollama embedding service', () => {
  it('uses the document prefix and validates the returned vector', async () => {
    mockedPostOllama.mockResolvedValue({ embeddings: [vector] });

    await expect(generateEmbedding('saved text')).resolves.toEqual(vector);
    expect(mockedPostOllama).toHaveBeenCalledWith('embed', {
      model: 'nomic-embed-text',
      input: 'search_document: saved text',
      truncate: true,
    });
  });

  it('uses the query prefix with the same embedding model', async () => {
    mockedPostOllama.mockResolvedValue({ embeddings: [vector] });

    await generateEmbedding('question text', 'query');

    expect(mockedPostOllama).toHaveBeenCalledWith('embed', {
      model: 'nomic-embed-text',
      input: 'search_query: question text',
      truncate: true,
    });
  });

  it('rejects vectors with invalid dimensions', async () => {
    mockedPostOllama.mockResolvedValue({ embeddings: [[0.1, 0.2]] });

    await expect(generateEmbedding('saved text')).rejects.toThrow(
      `expected ${EXPECTED_DIMENSIONS} dimensions`
    );
  });
});

describe('Ollama LLM service', () => {
  it('summarizes every document with citations tied to original item IDs', async () => {
    const savedItems: Item[] = [
      {
        id: 'note-source',
        title: 'T20I note',
        content: 'Surya is the best T20I player according to this note.',
        source_type: 'note',
        source_url: null,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
      {
        id: 'url-source',
        title: 'React guide',
        content: 'React is a front-end library for reusable UI components.',
        source_type: 'url',
        source_url: 'https://example.com/react',
        created_at: '2026-01-02',
        updated_at: '2026-01-02',
      },
    ];
    mockedPostOllama.mockResolvedValue({
      message: {
        content: JSON.stringify({
          summary:
            "[SOURCE_1] compared to Kohli, Surya is the best T20I player in India and his have more than 25 half centuries and 4 centuries in T20I's.\n" +
            '[SOURCE_2] React is a front-end library for reusable UI components.',
        }),
      },
    });

    const result = await generateKnowledgeSummary(
      'Summarize my saved knowledge.',
      savedItems,
      'knowledge-summary'
    );

    expect(result.answer).toContain('### Your Saved Knowledge Summary');
    expect(result.answer).toContain('T20I note');
    expect(result.answer).toContain('React guide');
    expect(result.answer).toContain('[1]');
    expect(result.answer).toContain('[2]');
    expect(result.sources.map(citation => citation.itemId)).toEqual(['note-source', 'url-source']);
    expect(result.sources.map(citation => citation.url)).toEqual([null, 'https://example.com/react']);
    expect(result.sources[0].similarity).toBeUndefined();
    expect(mockedPostOllama).toHaveBeenCalledTimes(1);
    const request = mockedPostOllama.mock.calls[0][1] as {
      messages: Array<{ role: string; content: string }>;
    };
    const summarySystemPrompt = request.messages.find(message => message.role === 'system')?.content ?? '';
    const summaryUserPrompt = request.messages.find(message => message.role === 'user')?.content ?? '';
    expect(summarySystemPrompt).toContain('Never use pretrained or outside knowledge');
    expect(summarySystemPrompt).toContain('Ignore navigation menus, cookie notices, advertisements');
    expect(summarySystemPrompt).toContain('Copy selected sentences verbatim.');
    expect(mockedPostOllama.mock.calls[0][1]).not.toHaveProperty('format');
    expect(summaryUserPrompt).toContain('[SOURCE_1]');
    expect(summaryUserPrompt).toContain('[SOURCE_2]');
  });

  it('falls back to each saved source when Ollama omits grouped source labels', async () => {
    const savedItems: Item[] = [
      {
        id: 'grouped-note',
        title: 'Saved note',
        content: 'Surya is the best T20I player according to this note.',
        source_type: 'note',
        source_url: null,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
      {
        id: 'grouped-url',
        title: 'React guide',
        content:
          'React is a front-end JavaScript library. It uses reusable components and a virtual DOM. ' +
          'Cookie notices and certification promotions appear in page navigation.',
        source_type: 'url',
        source_url: 'https://example.com/react',
        created_at: '2026-01-02',
        updated_at: '2026-01-02',
      },
    ];
    mockedPostOllama.mockResolvedValue({
      message: { content: 'A blended summary without source labels.' },
    });

    const result = await generateKnowledgeSummary(
      'Summarize my saved knowledge.',
      savedItems,
      'knowledge-summary'
    );

    expect(result.answer).toContain('Surya is the best T20I player according to this note.');
    expect(result.answer).toContain('React is a front-end JavaScript library.');
    expect(result.answer).toContain('It uses reusable components and a virtual DOM.');
    expect(result.answer).not.toContain('Cookie notices');
    expect(result.answer).not.toContain('A blended summary');
    expect(result.sources.map(source => source.itemId)).toEqual(['grouped-note', 'grouped-url']);
  });

  it('splits large documents into bounded Ollama requests and combines their summaries', async () => {
    const largeItem: Item = {
      id: 'large-document',
      title: 'Large document',
      content: `START_FACT ${'This saved document contains useful facts. '.repeat(1200)} END_FACT`,
      source_type: 'url',
      source_url: 'https://example.com/large',
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    };
    let activeRequests = 0;
    let maxActiveRequests = 0;
    mockedPostOllama.mockImplementation(async () => {
      activeRequests += 1;
      maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
      await new Promise(resolve => setTimeout(resolve, 5));
      activeRequests -= 1;
      return {
        message: { content: JSON.stringify({ summary: 'This saved document contains useful facts.' }) },
      };
    });

    await generateKnowledgeSummary(
      'Find important information from my documents.',
      [largeItem],
      'important-information'
    );

    expect(mockedPostOllama.mock.calls.length).toBeGreaterThan(2);
    expect(maxActiveRequests).toBe(2);
    const userPrompts = mockedPostOllama.mock.calls.map(([, body]) => {
      const request = body as { messages: Array<{ role: string; content: string }> };
      return request.messages.find(message => message.role === 'user')?.content ?? '';
    });
    expect(userPrompts.some(prompt => prompt.includes('START_FACT'))).toBe(true);
    expect(userPrompts.some(prompt => prompt.includes('END_FACT'))).toBe(true);
    expect(userPrompts.every(prompt => prompt.length < 19000)).toBe(true);
  });

  it('accepts plain-text summaries when Ollama ignores JSON formatting', async () => {
    const savedItem: Item = {
      id: 'plain-text-source',
      title: 'Saved note',
      content: 'React is a front-end JavaScript library. It builds UI components.',
      source_type: 'note',
      source_url: null,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    };
    mockedPostOllama.mockResolvedValue({
      message: { content: 'React is a front-end JavaScript library.' },
    });

    const result = await generateKnowledgeSummary(
      'Summarize my saved notes.',
      [savedItem],
      'knowledge-summary'
    );

    expect(result.answer).toContain('React is a front-end JavaScript library.');
    expect(result.sources[0].itemId).toBe(savedItem.id);
  });

  it('recovers a summary string when Ollama emits invalid JSON escapes', async () => {
    const savedItem: Item = {
      id: 'malformed-json-source',
      title: 'Saved note',
      content: 'React is a front-end JavaScript library. It builds UI components.',
      source_type: 'note',
      source_url: null,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    };
    mockedPostOllama.mockResolvedValue({
      message: { content: '{"summary":"React is a front-end JavaScript library.\nIt builds UI components."}' },
    });

    const result = await generateKnowledgeSummary(
      'Summarize my saved notes.',
      [savedItem],
      'knowledge-summary'
    );

    expect(result.answer).toContain('React is a front-end JavaScript library.');
    expect(result.answer).toContain('It builds UI components.');
  });

  it('rejects summary dates that are not supported by the source text', async () => {
    const savedItem: Item = {
      id: 'grounded-source',
      title: 'Rohit Sharma',
      content: 'Rohit Sharma was born in Nagpur, Maharashtra, India in 1987.',
      source_type: 'url',
      source_url: 'https://example.com/rohit',
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    };
    mockedPostOllama.mockResolvedValue({
      message: { content: 'Rohit Sharma was born on 30 April 1992 in Nagpur.' },
    });

    const result = await generateKnowledgeSummary(
      'Summarize my saved knowledge.',
      [savedItem],
      'knowledge-summary'
    );

    expect(result.answer).toContain('1987');
    expect(result.answer).not.toContain('1992');
  });

  it('returns one source citation when multiple cited chunks belong to the same item', async () => {
    mockedPostOllama.mockResolvedValue({
      message: {
        content: JSON.stringify({
          answer: 'Machine learning lets systems learn from data.',
          citations: ['SOURCE_1', 'SOURCE_2'],
        }),
      },
    });
    const secondChunk: SearchResult = {
      ...source,
      chunkId: 'chunk-2',
      content: 'Machine learning can support predictions from data.',
    };

    const result = await generateAnswer('What is machine learning?', [source, secondChunk]);

    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].itemId).toBe(source.itemId);
  });

  it('sends retrieved context to the configured model and maps source citations', async () => {
    mockedPostOllama.mockResolvedValue({
      message: { content: JSON.stringify({ answer: 'It learns from data.', citations: ['SOURCE_1'] }) },
    });

    const result = await generateAnswer('What is machine learning?', [source]);

    expect(mockedPostOllama).toHaveBeenCalledWith('chat', expect.objectContaining({
      model: 'llama3.2:3b',
      stream: false,
      format: 'json',
      options: { temperature: 0, num_predict: 256 },
    }));
    expect(mockedPostOllama).toHaveBeenCalledWith('chat', expect.objectContaining({
      messages: expect.arrayContaining([
        expect.objectContaining({ role: 'user', content: expect.stringContaining(source.content) }),
        expect.objectContaining({
          role: 'system',
          content: expect.stringContaining("Answer the user's exact question using only the retrieved context."),
        }),
      ]),
    }));
    expect(result.answer).toBe('It learns from data.');
    expect(result.sources).toEqual([
      expect.objectContaining({ itemId: source.itemId, chunkId: source.chunkId, title: source.sourceTitle }),
    ]);
  });

  it.each([
    'Compare React and React.js.',
    'React vs React.js',
    'What is the difference between React and React.js?',
    'What are the similarities between React and React.js?',
  ])('cites both sources for "%s" when the model cites only one', async question => {
    const reactSource: SearchResult = {
      ...source,
      chunkId: 'react-chunk',
      itemId: 'react-item',
      content: 'React is used to build single-page applications and reusable UI components.',
      sourceTitle: 'React',
      sourceUrl: 'https://example.com/react',
      sourceType: 'url',
    };
    const reactJsSource: SearchResult = {
      ...source,
      chunkId: 'react-js-chunk',
      itemId: 'react-js-item',
      content: 'React.js is a front-end JavaScript library.',
      sourceTitle: 'React.js',
      sourceUrl: 'https://example.com/react-js',
      sourceType: 'url',
    };
    mockedPostOllama.mockResolvedValue({
      message: { content: JSON.stringify({ answer: 'Both pages discuss the React library.', citations: ['SOURCE_1'] }) },
    });

    const result = await generateAnswer(question, [reactJsSource, reactSource]);

    expect(result.sources.map(citation => citation.itemId)).toEqual(['react-js-item', 'react-item']);
    const chatRequest = mockedPostOllama.mock.calls[0][1] as {
      messages: Array<{ role: string; content: string }>;
    };
    const suppliedContext = chatRequest.messages.find(message => message.role === 'user')?.content ?? '';
    expect(suppliedContext).toContain(reactJsSource.content);
    expect(suppliedContext).toContain(reactSource.content);
  });

  it('answers broad stats requests with all labeled figures and cites the supporting excerpt', async () => {
    const statsContent =
      `${'Unrelated biographical text '.repeat(20)} ` +
      'Career statistics Competition Test ODI T20I FC Matches 67 291 159 129 ' +
      'Runs scored 4,301 12,120 4,231 9,318 Batting average 40.57 49.26 32.05 49.04 ' +
      '100s/50s 12/18 35/63 5/32 29/38 Top score 212 264 121* 309* Medal record irrelevant details.';
    const statsSource = { ...source, content: statsContent };
    const result = await generateAnswer('Give stats for Rohit Sharma', [statsSource]);

    expect(result.answer).toContain('Test - Matches: 67; Runs scored: 4,301; Batting average: 40.57; 100s/50s: 12/18; Top score: 212');
    expect(result.answer).toContain('ODI - Matches: 291; Runs scored: 12,120; Batting average: 49.26; 100s/50s: 35/63; Top score: 264');
    expect(result.answer).toContain('T20I - Matches: 159; Runs scored: 4,231; Batting average: 32.05; 100s/50s: 5/32; Top score: 121*');
    expect(result.answer).toContain('First-class - Matches: 129; Runs scored: 9,318; Batting average: 49.04; 100s/50s: 29/38; Top score: 309*');
    expect(result.answer).not.toContain('100s/50s: 18/32');
    expect(mockedPostOllama).not.toHaveBeenCalled();
    expect(result.sources[0].snippet).toContain('Career statistics');
    expect(result.sources[0].snippet).toContain('Batting average 40.57 49.26 32.05');
    expect(result.sources[0].snippet).not.toContain('Unrelated biographical text');
    expect(result.sources[0].snippet).not.toContain('Medal record');
  });

  it('converts an object-shaped model answer to the API string format', async () => {
    mockedPostOllama.mockResolvedValue({
      message: { content: JSON.stringify({ answer: { 'Full name': 'Rohit Gurunath Sharma' }, citations: ['SOURCE_1'] }) },
    });

    const result = await generateAnswer('What is his full name?', [source]);

    expect(result.answer).toBe('Full name: Rohit Gurunath Sharma');
  });

  it('answers a birthplace question from the birth sentence only across multiple chunks', async () => {
    const unrelated = {
      ...source,
      chunkId: 'chunk-unrelated',
      content: 'ODI debut was in Dublin, Ireland. T20I matches were played in Mumbai, India.',
    };
    const birthplace = {
      ...source,
      chunkId: 'chunk-birthplace',
      content:
        'Rohit Sharma was born in Bansod, Nagpur, Maharashtra, India. ' +
        'His mother is from Visakhapatnam, Andhra Pradesh. ODI debut: Dublin, Ireland.',
    };
    mockedPostOllama.mockResolvedValue({
      message: {
        content: JSON.stringify({
          answer: 'Rohit Sharma was born in Bansod, Nagpur, Maharashtra, India.',
          citations: ['SOURCE_1'],
        }),
      },
    });

    const result = await generateAnswer('Where was Rohit Sharma born?', [unrelated, birthplace]);

    const chatRequest = mockedPostOllama.mock.calls[0][1] as {
      messages: Array<{ role: string; content: string }>;
    };
    const suppliedContext = chatRequest.messages.find(message => message.role === 'user')?.content ?? '';
    expect(suppliedContext).toContain('Rohit Sharma was born in Bansod, Nagpur, Maharashtra, India.');
    expect(suppliedContext).not.toContain('Visakhapatnam');
    expect(suppliedContext).not.toContain('Dublin');
    expect(result.answer).toBe('Rohit Sharma was born in Bansod, Nagpur, Maharashtra, India.');
    expect(result.sources).toEqual([
      expect.objectContaining({ chunkId: 'chunk-birthplace', snippet: birthplace.content.split('.')[0] + '.' }),
    ]);
  });

  it('provides focused evidence for full-name, birth-date, and nickname questions', async () => {
    const cases = [
      {
        question: 'What is the full name of Rohit Sharma?',
        content: 'Full nameRohit Gurunath SharmaBorn (1987-04-30) 30 April 1987',
        answer: "Rohit Sharma's full name is Rohit Gurunath Sharma.",
        expectedEvidence: 'Full name: Rohit Gurunath Sharma',
      },
      {
        question: 'When was Rohit Sharma born?',
        content: 'Born (1987-04-30) 30 April 1987 (age 39)Nagpur, Maharashtra, India',
        answer: 'Rohit Sharma was born on 30 April 1987.',
        expectedEvidence: 'Date of birth: 30 April 1987',
      },
      {
        question: 'What is Rohit Sharma’s nickname?',
        content: 'NicknameHitman[1]Shana[2]BattingRight-handedBowlingRight-arm off break',
        answer: 'His nickname is Hitman.',
        expectedEvidence: 'Nickname: Hitman',
      },
    ];

    for (const testCase of cases) {
      mockedPostOllama.mockResolvedValueOnce({
        message: { content: JSON.stringify({ answer: testCase.answer, citations: ['SOURCE_1'] }) },
      });
      const result = await generateAnswer(testCase.question, [{ ...source, content: testCase.content }]);
      const chatRequest = mockedPostOllama.mock.calls.at(-1)?.[1] as {
        messages: Array<{ role: string; content: string }>;
      };
      const suppliedContext = chatRequest.messages.find(message => message.role === 'user')?.content ?? '';
      expect(suppliedContext).toContain(testCase.expectedEvidence);
      expect(result.answer).toBe(testCase.answer);
      expect(result.sources).toHaveLength(1);
    }
  });

  it('uses the exact missing-information response and omits unsupported citations', async () => {
    mockedPostOllama.mockResolvedValue({
      message: {
        content: JSON.stringify({
        answer: "I couldn't find this information in your saved knowledge. Please add a relevant note or URL first.",
          citations: [],
        }),
      },
    });

    const result = await generateAnswer(
      'What is Rohit Sharma’s passport number?',
      [{ ...source, content: 'Rohit Sharma was born in Nagpur, Maharashtra, India.' }]
    );

    expect(result.answer).toBe("I couldn't find this information in your saved knowledge. Please add a relevant note or URL first.");
    expect(result.sources).toEqual([]);
    expect(mockedPostOllama).toHaveBeenCalled();
  });

  it('returns the missing-information response without calling Ollama when no chunks are retrieved', async () => {
    const result = await generateAnswer('What is machine learning?', []);

    expect(result.answer).toBe("I couldn't find this information in your saved knowledge. Please add a relevant note or URL first.");
    expect(result.sources).toEqual([]);
    expect(mockedPostOllama).not.toHaveBeenCalled();
  });
});
