import { loadEnv } from '../../config/env';
import { fetchWithTimeout } from '../../lib/http';
import { assertNoSensitive } from '../../lib/tokenize';
import type { AudioProvider, AudioResult } from '../types';

/**
 * Audio provider — ElevenLabs (§3). Flash-class voice for cost. Only invoked
 * when the purchased tier includes audio. Re-derive cost from real script length.
 */
const MODEL = 'eleven_flash_v2_5';
// Warm, kid-appropriate default voice. Configurable per product/locale later.
const DEFAULT_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL';
const ENDPOINT = 'https://api.elevenlabs.io/v1/text-to-speech';

export class ElevenLabsAudioProvider implements AudioProvider {
  readonly name = MODEL;

  async synthesize(script: string): Promise<AudioResult> {
    const env = loadEnv();
    if (!env.ELEVENLABS_API_KEY) {
      throw new Error('ELEVENLABS_API_KEY is not configured but an audio tier was purchased');
    }
    // The narration script is the localized page text — it legitimately contains
    // the child's spoken nickname, so we do NOT guard on the name here. We DO
    // fail closed on personal-data patterns (email/phone/URL/long IDs) that
    // should never appear in a story and must not egress to the voice vendor (§9).
    assertNoSensitive(script, []);
    const res = await fetchWithTimeout(
      `${ENDPOINT}/${DEFAULT_VOICE_ID}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': env.ELEVENLABS_API_KEY,
          'content-type': 'application/json',
          accept: 'audio/mpeg',
        },
        body: JSON.stringify({ text: script, model_id: MODEL }),
      },
      120_000,
    );
    if (!res.ok) {
      throw new Error(`ElevenLabs synthesis failed (${res.status}): ${await res.text()}`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    return { buffer, mime: 'audio/mpeg', usage: { model: MODEL, characters: script.length } };
  }
}
