import { detectQueryIntent } from '../src/services/queryIntentService';

describe('query intent detection', () => {
  it.each([
    ['Summarize my saved knowledge.', { kind: 'knowledge-summary' }],
    ['Give me an overview of everything I saved.', { kind: 'knowledge-summary' }],
    ['What information have I saved?', { kind: 'knowledge-summary' }],
    ['Summarize my notes and URLs.', { kind: 'knowledge-summary' }],
    ['Summarize my saved URLs.', { kind: 'knowledge-summary', sourceType: 'url' }],
    ['What can you tell me from my saved URLs?', { kind: 'knowledge-summary', sourceType: 'url' }],
    ['What can you tell me from my saved webpages?', { kind: 'knowledge-summary', sourceType: 'url' }],
    ['Summarize all my notes.', { kind: 'knowledge-summary', sourceType: 'note' }],
    ['What information is available in my notes?', { kind: 'knowledge-summary', sourceType: 'note' }],
    ['Give me an overview of my saved web pages.', { kind: 'knowledge-summary', sourceType: 'url' }],
    ['Find important information from my documents.', { kind: 'important-information' }],
    ['What are the key takeaways from my saved knowledge?', { kind: 'important-information' }],
    ['Extract important facts from my URLs.', { kind: 'important-information', sourceType: 'url' }],
    ['What are the main topics in my knowledge base?', { kind: 'important-information' }],
  ])('classifies "%s"', (question, expected) => {
    expect(detectQueryIntent(question)).toEqual(expected);
  });

  it.each([
    'What is React?',
    'Where was Rohit Sharma born?',
    'Who is the best T20I player according to my note?',
  ])('keeps factual question "%s" on the factual path', question => {
    expect(detectQueryIntent(question)).toEqual({ kind: 'factual-question' });
  });
});
