// Turns text into a 384-dimension embedding with all-MiniLM-L6-v2.
// The model runs locally; it is downloaded once on first use and cached.
import { pipeline } from '@huggingface/transformers';

export const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';
export const EMBEDDING_DIMS = 384;

let extractorPromise = null;

function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = pipeline('feature-extraction', EMBEDDING_MODEL, { dtype: 'fp32' });
  }
  return extractorPromise;
}

// Mean-pooled, normalised (length 1) embedding, so cosine similarity
// equals the dot product.
export async function embedText(text) {
  if (typeof text !== 'string' || text.trim() === '') {
    throw new Error('Text to embed must be a non-empty string');
  }
  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

// pgvector accepts vectors as text in the form '[0.1,0.2,...]'
export function toPgVector(values) {
  return `[${values.join(',')}]`;
}
