jest.mock('../src/services/vectorSearchService', () => ({
  semanticSearch: jest.fn(),
}));

jest.mock('../src/services/llmService', () => ({
  generateAnswer: jest.fn(),
}));

jest.mock('../src/services/knowledgeSummaryService', () => ({
  summarizeKnowledge: jest.fn(),
}));

import { SearchResult, QueryResponse } from '../src/types';
import { semanticSearch } from '../src/services/vectorSearchService';
import { generateAnswer } from '../src/services/llmService';
import { summarizeKnowledge } from '../src/services/knowledgeSummaryService';
import { queryKnowledge } from '../src/services/ragService';
import { INSUFFICIENT_CONTEXT_ANSWER } from '../src/services/contextSufficiencyService';

const mockedSemanticSearch = jest.mocked(semanticSearch);
const mockedGenerateAnswer = jest.mocked(generateAnswer);
const mockedSummarizeKnowledge = jest.mocked(summarizeKnowledge);

const rohitIntro: SearchResult = {
  chunkId: 'rohit-intro',
  itemId: 'rohit-wikipedia',
  content:
    'Rohit SharmaPersonal informationFull nameRohit Gurunath Sharma' +
    'Born (1987-04-30) 30 April 1987Nagpur, Maharashtra, IndiaNicknameHitman',
  similarity: 0.801,
  sourceTitle: 'Rohit Sharma',
  sourceUrl: 'https://en.wikipedia.org/wiki/Rohit_Sharma',
  sourceType: 'url',
};

const rohitBirthplace: SearchResult = {
  ...rohitIntro,
  chunkId: 'rohit-early-life',
  content:
    'Sharma was born on 30 April 1987 into a Marathi-Telugu family in Bansod, Nagpur, Maharashtra, India. ' +
    'His mother is from Visakhapatnam, Andhra Pradesh.',
  similarity: 0.716,
};

const unrelatedRohitChunk: SearchResult = {
  ...rohitIntro,
  chunkId: 'rohit-tv-references',
  content:
    'Chief selector M. S. K. Prasad selected Sharma for the team. He also appeared on Telugu television.',
  similarity: 0.602,
};

const telanganaSource: SearchResult = {
  chunkId: 'telangana-cm',
  itemId: 'telangana-government',
  content: 'The Chief Minister of Telangana is Revanth Reddy.',
  similarity: 0.74,
  sourceTitle: 'Telangana Government',
  sourceUrl: 'https://example.com/telangana-government',
  sourceType: 'url',
};

const t20iNote: SearchResult = {
  chunkId: 't20i-note',
  itemId: 'best-t20i-note',
  content: "Compared to Kohli, Surya is the best T20I player in India and has more than 25 half-centuries and 4 centuries in T20Is.",
  similarity: 0.823,
  sourceTitle: 'Best T20I player',
  sourceUrl: null,
  sourceType: 'note',
};

const reactSource: SearchResult = {
  chunkId: 'react-definition',
  itemId: 'react-w3schools',
  content: 'React is used to build single-page applications and reusable UI components. Navigation also mentions React.js.',
  similarity: 0.731,
  sourceTitle: 'React',
  sourceUrl: 'https://www.w3schools.com/react/',
  sourceType: 'url',
};

const reactJsSource: SearchResult = {
  chunkId: 'react-js-definition',
  itemId: 'react-js-w3schools',
  content: 'React is a front-end JavaScript library. React.js is used to build UI components.',
  similarity: 0.801,
  sourceTitle: 'React.js',
  sourceUrl: 'https://www.w3schools.com/REACT/DEFAULT.ASP',
  sourceType: 'url',
};

const supportedResponse: QueryResponse = {
  answer: 'The saved page identifies Revanth Reddy as the Chief Minister of Telangana.',
  sources: [{
    itemId: telanganaSource.itemId,
    chunkId: telanganaSource.chunkId,
    title: telanganaSource.sourceTitle,
    url: telanganaSource.sourceUrl,
    snippet: telanganaSource.content,
    similarity: telanganaSource.similarity,
  }],
};

beforeEach(() => {
  mockedSemanticSearch.mockReset();
  mockedGenerateAnswer.mockReset();
  mockedSummarizeKnowledge.mockReset();
});

describe('queryKnowledge context sufficiency gate', () => {
  it.each([
    'Summarize my saved knowledge.',
    'Find important information from my documents.',
    'What can you tell me from my saved URLs?',
  ])('routes knowledge-wide question "%s" without semantic retrieval', async question => {
    const response = { answer: 'Summary of saved items.', sources: [] };
    mockedSummarizeKnowledge.mockResolvedValue(response);

    await expect(queryKnowledge(question)).resolves.toEqual(response);

    expect(mockedSummarizeKnowledge).toHaveBeenCalledTimes(1);
    expect(mockedSemanticSearch).not.toHaveBeenCalled();
  });

  it('answers a supported full-name question and preserves its citation', async () => {
    mockedSemanticSearch.mockResolvedValue([rohitIntro]);
    mockedGenerateAnswer.mockResolvedValue({
      answer: 'Rohit Sharma’s full name is Rohit Gurunath Sharma.',
      sources: [{
        itemId: rohitIntro.itemId,
        chunkId: rohitIntro.chunkId,
        title: rohitIntro.sourceTitle,
        url: rohitIntro.sourceUrl,
        snippet: rohitIntro.content,
        similarity: rohitIntro.similarity,
      }],
    });

    const result = await queryKnowledge("What is Rohit Sharma's full name?");

    expect(result.answer).toContain('Rohit Gurunath Sharma');
    expect(result.sources[0].chunkId).toBe(rohitIntro.chunkId);
    expect(mockedGenerateAnswer).toHaveBeenCalledWith(
      "What is Rohit Sharma's full name?",
      [rohitIntro]
    );
  });

  it('answers a supported birthplace question using the matching chunk', async () => {
    mockedSemanticSearch.mockResolvedValue([unrelatedRohitChunk, rohitBirthplace]);
    mockedGenerateAnswer.mockResolvedValue({
      answer: 'Rohit Sharma was born in Bansod, Nagpur, Maharashtra, India.',
      sources: [],
    });

    await queryKnowledge('Where was Rohit Sharma born?');

    expect(mockedGenerateAnswer).toHaveBeenCalledWith(
      'Where was Rohit Sharma born?',
      [rohitBirthplace]
    );
  });

  it('answers a birthplace question when its relevant chunk ranks below the former top five', async () => {
    const rankedResults = [
      rohitIntro,
      ...Array.from({ length: 4 }, (_, index) => ({
        ...unrelatedRohitChunk,
        chunkId: `rohit-unrelated-${index}`,
        similarity: 0.75 - index * 0.01,
      })),
      rohitBirthplace,
    ];
    mockedSemanticSearch.mockResolvedValue(rankedResults);
    mockedGenerateAnswer.mockResolvedValue({
      answer: 'Rohit Sharma was born in Bansod, Nagpur, Maharashtra, India.',
      sources: [],
    });

    await queryKnowledge("What is Rohit Sharma's birthplace?");

    expect(mockedGenerateAnswer).toHaveBeenCalledWith(
      "What is Rohit Sharma's birthplace?",
      [rohitBirthplace]
    );
  });

  it('answers the best T20I player question from a note despite query framing words', async () => {
    mockedSemanticSearch.mockResolvedValue([unrelatedRohitChunk, t20iNote]);
    mockedGenerateAnswer.mockResolvedValue({
      answer: 'According to your note, Surya is the best T20I player in India.',
      sources: [],
    });

    await queryKnowledge('Who is the best T20I player according to my note?');

    expect(mockedGenerateAnswer).toHaveBeenCalledWith(
      'Who is the best T20I player according to my note?',
      [t20iNote]
    );
  });

  it('answers React from its saved URL', async () => {
    mockedSemanticSearch.mockResolvedValue([reactSource, reactJsSource]);
    mockedGenerateAnswer.mockResolvedValue({
      answer: 'React is used to build single-page applications and reusable UI components.',
      sources: [],
    });

    await queryKnowledge('What is React?');

    expect(mockedGenerateAnswer).toHaveBeenCalledWith('What is React?', [reactSource, reactJsSource]);
  });

  it('answers React.js from its saved URL', async () => {
    mockedSemanticSearch.mockResolvedValue([
      reactSource,
      reactJsSource,
      {
        ...reactJsSource,
        chunkId: 'react-js-navigation',
        content: 'Navigation links include React.js tutorials and examples.',
        similarity: 0.752,
      },
    ]);
    mockedGenerateAnswer.mockResolvedValue({
      answer: 'React.js is a front-end JavaScript library.',
      sources: [],
    });

    await queryKnowledge('What is React.js?');

    expect(mockedGenerateAnswer).toHaveBeenCalledWith('What is React.js?', [reactJsSource]);
  });

  it.each([
    'React vs React.js',
    'Compare React and React.js',
    'What is the difference between React and React.js?',
    'What are the similarities between React and React.js?',
  ])('passes both saved URL sources for "%s"', async question => {
    mockedSemanticSearch.mockResolvedValue([reactJsSource, reactSource]);
    mockedGenerateAnswer.mockResolvedValue({
      answer: 'Both are React learning resources; the React.js page describes the library, while the React page emphasizes single-page applications and reusable components.',
      sources: [],
    });

    await queryKnowledge(question);

    expect(mockedGenerateAnswer).toHaveBeenCalledWith(
      question,
      [reactSource, reactJsSource]
    );
  });

  it('retrieves a referenced URL and note for a comparison', async () => {
    const question = 'Compare the information in my Rohit Sharma URL and my T20I note.';
    mockedSemanticSearch.mockResolvedValue([rohitBirthplace, t20iNote]);
    mockedGenerateAnswer.mockResolvedValue({
      answer: 'The saved URL is about Rohit Sharma, while the note identifies Surya as the best T20I player.',
      sources: [],
    });

    await queryKnowledge(question);

    expect(mockedGenerateAnswer).toHaveBeenCalledWith(
      question,
      [rohitBirthplace, t20iNote]
    );
  });

  it('does not generate a comparison when only one distinct source is available', async () => {
    mockedSemanticSearch.mockResolvedValue([reactJsSource]);

    const result = await queryKnowledge('React vs React.js');

    expect(result).toEqual({ answer: INSUFFICIENT_CONTEXT_ANSWER, sources: [] });
    expect(mockedGenerateAnswer).not.toHaveBeenCalled();
  });

  it('rejects the unrelated Telangana query despite a high-scoring Rohit result', async () => {
    mockedSemanticSearch.mockResolvedValue([unrelatedRohitChunk]);

    const result = await queryKnowledge('Who is the CM of Telangana?');

    expect(result).toEqual({ answer: INSUFFICIENT_CONTEXT_ANSWER, sources: [] });
    expect(mockedGenerateAnswer).not.toHaveBeenCalled();
  });

  it('returns the insufficiency response without generating an answer when there are no documents', async () => {
    mockedSemanticSearch.mockResolvedValue([]);

    const result = await queryKnowledge('Who is the CM of Telangana?');

    expect(result).toEqual({ answer: INSUFFICIENT_CONTEXT_ANSWER, sources: [] });
    expect(mockedGenerateAnswer).not.toHaveBeenCalled();
  });

  it('answers from a relevant Telangana source and excludes unrelated retrieved chunks', async () => {
    mockedSemanticSearch.mockResolvedValue([unrelatedRohitChunk, telanganaSource]);
    mockedGenerateAnswer.mockResolvedValue(supportedResponse);

    const result = await queryKnowledge('Who is the CM of Telangana?');

    expect(mockedGenerateAnswer).toHaveBeenCalledWith(
      'Who is the CM of Telangana?',
      [telanganaSource]
    );
    expect(result).toEqual(supportedResponse);
  });

  it('rejects a Telangana page that mentions the role but does not state its officeholder', async () => {
    mockedSemanticSearch.mockResolvedValue([{
      ...telanganaSource,
      content: 'The Chief Minister of Telangana leads the state government.',
    }]);

    const result = await queryKnowledge('Who is the CM of Telangana?');

    expect(result).toEqual({ answer: INSUFFICIENT_CONTEXT_ANSWER, sources: [] });
    expect(mockedGenerateAnswer).not.toHaveBeenCalled();
  });

  it('rejects an unsupported passport question even when Rohit chunks score highly', async () => {
    const highScoringRohitChunk = { ...rohitIntro, similarity: 0.766 };
    mockedSemanticSearch.mockResolvedValue([highScoringRohitChunk]);

    const result = await queryKnowledge("What is Rohit Sharma's passport number?");

    expect(result).toEqual({ answer: INSUFFICIENT_CONTEXT_ANSWER, sources: [] });
    expect(mockedGenerateAnswer).not.toHaveBeenCalled();
  });

  it('rejects an unsupported PM question despite high-scoring India-related chunks', async () => {
    mockedSemanticSearch.mockResolvedValue([
      { ...unrelatedRohitChunk, similarity: 0.659 },
      { ...rohitIntro, chunkId: 'rohit-india', content: 'Rohit Sharma represents India in international cricket.' },
    ]);

    const result = await queryKnowledge('Who is the PM of India?');

    expect(result).toEqual({ answer: INSUFFICIENT_CONTEXT_ANSWER, sources: [] });
    expect(mockedGenerateAnswer).not.toHaveBeenCalled();
  });
});
