/**
 * Read request bodies with a hard byte ceiling before JSON parsing. This keeps
 * unauthenticated endpoints from turning a large request into an unbounded
 * string/JSON allocation. The reverse proxy should still enforce its own
 * client_max_body_size as the first line of defense.
 */
export async function readBoundedBytes(request: Request, maxBytes: number) {
  const contentLength = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(contentLength) && contentLength > maxBytes) return null;

  const body = request.body;
  if (!body) return null;

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function readBoundedText(request: Request, maxBytes: number) {
  const bytes = await readBoundedBytes(request, maxBytes);
  return bytes === null ? null : new TextDecoder().decode(bytes);
}

export async function readBoundedJson(request: Request, maxBytes = 128 * 1024) {
  const text = await readBoundedText(request, maxBytes);
  if (text === null) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}
