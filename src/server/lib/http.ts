/**
 * fetch with a hard timeout. Vendor APIs (Gemini, ElevenLabs) have no built-in
 * wall-clock cap; without this a hung connection blocks a pipeline step until
 * the platform kills it. Aborts after `timeoutMs` and surfaces a clear error.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 60_000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Request to ${hostOf(url)} timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
