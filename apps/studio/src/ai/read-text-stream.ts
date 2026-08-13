/**
 * Drain a text/plain stream into a string, reporting each decoded chunk.
 *
 * The AI route streams tokens as UTF-8. The editor needs both the running
 * total (to show the proposal) and the final string (to accept it). Keeping
 * the decoder here means the panel never sees bytes.
 */
export async function readTextStream(
  body: ReadableStream<Uint8Array>,
  onChunk: (text: string) => void,
): Promise<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let full = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    full += chunk
    onChunk(chunk)
  }

  full += decoder.decode()
  return full
}
