/**
 * Cosine similarity between two vectors.
 * Returns a value in [-1, 1]. Higher = more similar.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error('Vector dimension mismatch');

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  magA = Math.sqrt(magA);
  magB = Math.sqrt(magB);

  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}

export function serializeVector(vector: number[]): Uint8Array {
  const buf = new ArrayBuffer(vector.length * 4);
  const view = new DataView(buf);
  for (let i = 0; i < vector.length; i++) {
    view.setFloat32(i * 4, vector[i], true); // little-endian
  }
  return new Uint8Array(buf);
}

export function deserializeVector(data: Uint8Array): number[] {
  // sql.js returns BLOB as Uint8Array; create a DataView over its underlying buffer
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const len = data.byteLength / 4;
  const result: number[] = new Array(len);
  for (let i = 0; i < len; i++) {
    result[i] = view.getFloat32(i * 4, true);
  }
  return result;
}
