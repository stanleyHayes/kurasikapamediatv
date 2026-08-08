/**
 * Embeddings, deliberately separate from AiPort.
 *
 * Anthropic ships no embedding model, so the AI adapter cannot serve this even
 * though both are "AI". Keeping it a distinct port means the provider decision
 * — Voyage, OpenAI, Cohere, or Atlas-managed embeddings — is one adapter and
 * one wiring line, decided when semantic search lands in R2 rather than guessed
 * now.
 *
 * `dimensions` must match the `numDimensions` on the Atlas Vector Search index.
 * A mismatch is a silent quality failure, not an error, so it is part of the
 * contract rather than a config value.
 */
export interface EmbeddingPort {
  readonly dimensions: number
  embed(text: string): Promise<readonly number[]>
  embedMany(texts: readonly string[]): Promise<readonly (readonly number[])[]>
}
