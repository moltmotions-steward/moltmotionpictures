import 'dotenv/config';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { GradientClient } from '../src/services/GradientClient';
import config from '../src/config';

const execFileAsync = promisify(execFile);

type ScenarioResult = {
  chars: number;
  words: number;
  voiceId?: string;
  requestId?: string;
  audioUrl?: string;
  wallMs: number;
  downloadMs?: number;
  bytes?: number;
  durationSeconds?: number;
  contentType?: string;
  error?: string;
};

function parseCharCounts(argv: string[]): number[] | null {
  const flagIdx = argv.findIndex((a) => a === '--chars');
  if (flagIdx === -1) return null;
  const value = argv[flagIdx + 1];
  if (!value) return [];
  return value
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function parseOptionalStringFlag(argv: string[], flag: string): string | undefined {
  const idx = argv.findIndex((a) => a === flag);
  const value = idx === -1 ? undefined : argv[idx + 1];
  return value && !value.startsWith('--') ? value : undefined;
}

function parseOptionalNumberFlag(argv: string[], flag: string): number | undefined {
  const raw = parseOptionalStringFlag(argv, flag);
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function generateNarrationText(targetChars: number): string {
  const base =
    'The wind shifts, and the path changes with it. I keep moving, one careful step at a time—listening, watching, remembering why I came here. ';
  const extra =
    'Somewhere ahead, a decision waits. Not a loud decision, not a heroic one—just a quiet choice that will change what happens next. ';

  let out = '';
  while (out.length < targetChars) out += out.length % 2 === 0 ? base : extra;
  out = out.slice(0, targetChars);

  // Ensure we end cleanly on punctuation to avoid weird TTS cutoffs.
  out = out.replace(/[^\w\)\]\}\.\!\?]+$/g, '').trimEnd();
  if (!/[.!?]$/.test(out)) out += '.';
  return out;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

async function getAudioDurationSeconds(audioPath: string): Promise<number | undefined> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      audioPath,
    ]);
    const parsed = Number(stdout.trim());
    return Number.isFinite(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const chars = parseCharCounts(argv) ?? [400, 1200, 2400];
  const voiceId = parseOptionalStringFlag(argv, '--voice-id');
  const timeoutMs = parseOptionalNumberFlag(argv, '--timeout-ms') ?? 180000;

  if (!config.doGradient?.apiKey) {
    console.error('Missing DO_GRADIENT_API_KEY. Set it in api/.env or your shell env.');
    process.exitCode = 2;
    return;
  }

  if (chars.length === 0) {
    console.error('No char counts provided. Example: --chars 400,1200,2400');
    process.exitCode = 2;
    return;
  }

  const gradient = new GradientClient({
    apiKey: config.doGradient.apiKey,
    endpoint: config.doGradient.endpoint,
    timeout: timeoutMs,
  });

  console.log('--- TTS BENCHMARK (DigitalOcean Gradient → fal ElevenLabs) ---');
  console.log(`Endpoint: ${config.doGradient.endpoint}`);
  console.log(`Voice ID: ${voiceId || '(default)'}`);
  console.log(`Timeout: ${timeoutMs}ms`);
  console.log(`Scenarios (chars): ${chars.join(', ')}`);
  console.log('');

  const results: ScenarioResult[] = [];

  for (const charCount of chars) {
    const text = generateNarrationText(charCount);
    const words = countWords(text);
    const started = Date.now();

    const result: ScenarioResult = {
      chars: text.length,
      words,
      voiceId,
      wallMs: 0,
    };

    try {
      const tts = await gradient.generateTTSAndWait(text, {
        timeoutMs,
        voiceId,
      });

      result.requestId = (tts as any).request_id;
      result.audioUrl = (tts as any).audio_url;
      result.contentType = (tts as any).content_type;

      const ttsCompletedAt = Date.now();
      result.wallMs = ttsCompletedAt - started;

      if (!result.audioUrl) {
        throw new Error('TTS completed but audio_url missing in response');
      }

      const dlStarted = Date.now();
      const audioRes = await fetch(result.audioUrl);
      if (!audioRes.ok) throw new Error(`Failed to download audio: HTTP ${audioRes.status}`);
      const buf = Buffer.from(await audioRes.arrayBuffer());
      result.downloadMs = Date.now() - dlStarted;
      result.bytes = buf.byteLength;
      result.contentType = result.contentType || audioRes.headers.get('content-type') || undefined;

      const ext = result.contentType?.includes('wav') ? 'wav' : 'mp3';
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'molt-tts-bench-'));
      const audioPath = path.join(tmpDir, `tts.${ext}`);
      await fs.writeFile(audioPath, buf);

      result.durationSeconds = await getAudioDurationSeconds(audioPath);
    } catch (e) {
      result.wallMs = Date.now() - started;
      result.error = e instanceof Error ? e.message : String(e);
    }

    results.push(result);

    const dur = result.durationSeconds ? `${result.durationSeconds.toFixed(2)}s` : 'n/a';
    const mb = result.bytes ? `${(result.bytes / (1024 * 1024)).toFixed(2)}MB` : 'n/a';
    const cps =
      result.durationSeconds && result.durationSeconds > 0
        ? `${Math.round(result.chars / result.durationSeconds)} chars/s`
        : 'n/a';

    console.log(
      [
        `chars=${result.chars}`,
        `words=${result.words}`,
        `tts=${(result.wallMs / 1000).toFixed(2)}s`,
        `dl=${result.downloadMs ? (result.downloadMs / 1000).toFixed(2) + 's' : 'n/a'}`,
        `size=${mb}`,
        `dur=${dur}`,
        `rate=${cps}`,
        result.error ? `error="${result.error}"` : '',
      ]
        .filter(Boolean)
        .join(' | ')
    );
  }

  console.log('\n--- RAW RESULTS (JSON) ---');
  console.log(JSON.stringify({ results }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

