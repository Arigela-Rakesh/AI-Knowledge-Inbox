import { chunkText, estimateTokens } from '../src/services/chunkingService';

describe('chunkingService', () => {
  describe('estimateTokens', () => {
    it('estimates tokens as ceil(chars/4)', () => {
      expect(estimateTokens('hello')).toBe(2); // 5/4 = 1.25 -> 2
      expect(estimateTokens('a'.repeat(400))).toBe(100);
    });

    it('returns 0 for empty string', () => {
      expect(estimateTokens('')).toBe(0);
    });
  });

  describe('chunkText', () => {
    it('returns empty array for empty string', () => {
      expect(chunkText('')).toEqual([]);
    });

    it('returns single chunk for short text', () => {
      const chunks = chunkText('Hello world. This is a test.');
      expect(chunks.length).toBe(1);
      expect(chunks[0].chunkIndex).toBe(0);
      expect(chunks[0].content).toContain('Hello world');
    });

    it('splits long text into multiple chunks', () => {
      // ~2500 tokens worth of text
      const sentence = 'This is a sentence that contains some words. ';
      const longText = sentence.repeat(200);
      const chunks = chunkText(longText);
      expect(chunks.length).toBeGreaterThan(1);
    });

    it('assigns sequential chunk indices', () => {
      const sentence = 'This is a sentence. ';
      const longText = sentence.repeat(200);
      const chunks = chunkText(longText);
      chunks.forEach((c, i) => expect(c.chunkIndex).toBe(i));
    });

    it('no chunk has empty content', () => {
      const text = 'Short text. Another sentence. Third one.';
      const chunks = chunkText(text);
      chunks.forEach(c => expect(c.content.trim().length).toBeGreaterThan(0));
    });

    it('each chunk has a positive tokenCount', () => {
      const chunks = chunkText('Hello world. This is a test sentence.');
      chunks.forEach(c => expect(c.tokenCount).toBeGreaterThan(0));
    });
  });
});
