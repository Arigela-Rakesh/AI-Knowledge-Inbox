import { cosineSimilarity, serializeVector, deserializeVector } from '../src/utils/vectors';

describe('vectors utils', () => {
  describe('cosineSimilarity', () => {
    it('returns 1 for identical vectors', () => {
      const v = [1, 2, 3];
      expect(cosineSimilarity(v, v)).toBeCloseTo(1);
    });

    it('returns -1 for opposite vectors', () => {
      expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
    });

    it('returns 0 for orthogonal vectors', () => {
      expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
    });

    it('returns 0 for zero-magnitude vector', () => {
      expect(cosineSimilarity([0, 0], [1, 2])).toBe(0);
    });

    it('throws for mismatched dimensions', () => {
      expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow('dimension mismatch');
    });
  });

  describe('serializeVector / deserializeVector', () => {
    it('round-trips a vector', () => {
      const original = [0.1, 0.5, -0.3, 0.9];
      const buf = serializeVector(original);
      const restored = deserializeVector(buf);
      expect(restored.length).toBe(original.length);
      original.forEach((v, i) => expect(restored[i]).toBeCloseTo(v, 4));
    });

    it('handles large vectors', () => {
      const large = Array.from({ length: 1536 }, (_, i) => Math.sin(i));
      const buf = serializeVector(large);
      const restored = deserializeVector(buf);
      expect(restored.length).toBe(1536);
    });
  });
});
