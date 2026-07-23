import { loadEnv, type Env } from '../config/env';
import { fetchWithTimeout } from '../lib/http';
import { getVertexAccessToken, resolveVertexProject } from '../lib/vertex-auth';

/**
 * Where Gemini calls actually go. Two backends, same request/response shapes:
 *
 *  - `studio`  — Gemini Developer API (aka AI Studio). Auth = API key header.
 *  - `vertex`  — Vertex AI on Google Cloud. Auth = service-account OAuth token,
 *                and the URL is project/location-scoped. This is what a plain
 *                gcloud project (with its free credits) gives you — there is no
 *                AI Studio key on a fresh Cloud project.
 *
 * The `:generateContent` body is identical across both, so callers build the
 * body once and this module only decides URL + auth.
 */
const STUDIO_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

type Backend = 'studio' | 'vertex';

/**
 * Explicit `GEMINI_BACKEND` wins; otherwise infer Vertex when any Vertex
 * credential source is configured via env. We deliberately do NOT sniff the
 * on-disk ADC file here — a machine that happens to have `gcloud` logged in
 * shouldn't silently hijack a Studio (API-key) setup.
 */
function resolveBackend(env: Env): Backend {
  if (env.GEMINI_BACKEND) return env.GEMINI_BACKEND;
  const vertexConfigured =
    env.GOOGLE_CLOUD_PROJECT ||
    env.GOOGLE_SERVICE_ACCOUNT_KEY ||
    env.GOOGLE_WORKLOAD_IDENTITY_AUDIENCE ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS;
  return vertexConfigured ? 'vertex' : 'studio';
}

/**
 * The Gemini backend that image calls will actually use. Exposed so the photo
 * egress guard can hard-refuse sending a child's photo to the AI-Studio key path
 * (Vertex's GCP terms give a stronger no-training posture for the one call).
 */
export function resolveGeminiBackend(): Backend {
  return resolveBackend(loadEnv());
}

function vertexUrl(env: Env, model: string, method: string): string {
  const project = resolveVertexProject();
  const location = env.GOOGLE_CLOUD_LOCATION;
  // The global endpoint has no region prefix; regional endpoints do.
  const host =
    location === 'global'
      ? 'https://aiplatform.googleapis.com'
      : `https://${location}-aiplatform.googleapis.com`;
  return `${host}/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:${method}`;
}

/**
 * POST a Gemini `:method` (e.g. `generateContent`) request for `model`, routed
 * to whichever backend is configured. Returns the raw `Response` so each
 * provider keeps its own domain-specific error message and body parsing.
 */
export async function callGemini(
  model: string,
  method: string,
  body: unknown,
  timeoutMs = 60_000,
): Promise<Response> {
  const env = loadEnv();
  const payload = JSON.stringify(body);

  if (resolveBackend(env) === 'vertex') {
    const token = await getVertexAccessToken();
    return fetchWithTimeout(
      vertexUrl(env, model, method),
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: payload,
      },
      timeoutMs,
    );
  }

  if (!env.GEMINI_API_KEY) {
    throw new Error(
      'Gemini is not configured (set GEMINI_API_KEY for AI Studio, or GEMINI_BACKEND=vertex ' +
        'with GOOGLE_CLOUD_PROJECT + GOOGLE_SERVICE_ACCOUNT_KEY for Vertex AI)',
    );
  }
  return fetchWithTimeout(
    `${STUDIO_ENDPOINT}/${model}:${method}`,
    {
      method: 'POST',
      // Key in a header, not the query string — URLs end up in logs and traces.
      headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: payload,
    },
    timeoutMs,
  );
}
