/**
 * EpisodeMediaFinalizer.ts
 *
 * Produces a single voiced MP4 by muxing the selected clip video with the
 * episode-level TTS audio, then uploads the result to Spaces and persists
 * the final URL on the Episode.
 */

import { PrismaClient } from '@prisma/client';
import { getSpacesClient } from './SpacesClient';
import { spawn } from 'child_process';
import os from 'os';
import path from 'path';
import { promises as fs } from 'fs';

const prisma = new PrismaClient();

export type FinalizeEpisodeResult =
  | { status: 'skipped'; reason: string }
  | { status: 'completed'; video_url: string; key: string };

function runFfmpeg(args: string[]): Promise<{ stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });

    child.on('error', (err) => {
      reject(err);
    });

    child.on('close', (code) => {
      if (code === 0) return resolve({ stderr });
      const error = new Error(`ffmpeg exited with code ${code}`);
      (error as any).stderr = stderr;
      reject(error);
    });
  });
}

function detectAudioExtension(contentType: string | null): 'mp3' | 'wav' | 'm4a' {
  const ct = (contentType || '').toLowerCase();
  if (ct.includes('wav')) return 'wav';
  if (ct.includes('mp4') || ct.includes('m4a') || ct.includes('aac')) return 'm4a';
  return 'mp3';
}

function buildMuxArgs(inputVideoPath: string, inputAudioPath: string, outputPath: string): string[] {
  return [
    '-y',
    '-i',
    inputVideoPath,
    '-i',
    inputAudioPath,
    // Copy video stream, transcode audio to AAC for MP4 container
    '-c:v',
    'copy',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-shortest',
    '-movflags',
    '+faststart',
    outputPath,
  ];
}

function getFinalKey(episodeId: string): string {
  return `episodes/${episodeId}/final_with_audio.mp4`;
}

async function downloadToFile(url: string, filePath: string): Promise<{ contentType: string | null }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download: ${url} (HTTP ${response.status})`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(filePath, buffer);
  return { contentType: response.headers.get('content-type') };
}

/**
 * Finalizes an episode into a single voiced MP4.
 *
 * Idempotency:
 * - If the episode is already pointing at `final_with_audio.mp4`, it returns skipped.
 */
export async function finalizeEpisodeWithTtsAudio(episodeId: string): Promise<FinalizeEpisodeResult> {
  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
    include: {
      clip_variants: {
        where: { is_selected: true },
        take: 1,
        select: { id: true, video_url: true },
      },
    },
  });

  if (!episode) return { status: 'skipped', reason: 'episode_not_found' };

  const selectedVideoUrl = episode.clip_variants[0]?.video_url || episode.video_url;
  if (!selectedVideoUrl) return { status: 'skipped', reason: 'missing_selected_video_url' };

  const ttsAudioUrl = (episode as any).tts_audio_url as string | null;
  if (!ttsAudioUrl) return { status: 'skipped', reason: 'missing_tts_audio_url' };

  const finalKey = getFinalKey(episodeId);
  if (episode.video_url && episode.video_url.includes(finalKey)) {
    return { status: 'skipped', reason: 'already_finalized' };
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `episode-finalize-${episodeId}-`));

  try {
    const inputVideoPath = path.join(tmpDir, 'input.mp4');
    const audioMeta = await downloadToFile(ttsAudioUrl, path.join(tmpDir, 'audio'));
    const audioExt = detectAudioExtension(audioMeta.contentType);
    const inputAudioPath = path.join(tmpDir, `input.${audioExt}`);

    // Download assets
    await downloadToFile(selectedVideoUrl, inputVideoPath);
    await fs.rename(path.join(tmpDir, 'audio'), inputAudioPath);

    const outputPath = path.join(tmpDir, 'output.mp4');

    // Mux
    await runFfmpeg(buildMuxArgs(inputVideoPath, inputAudioPath, outputPath));

    // Upload
    const spaces = getSpacesClient();
    const outBuffer = await fs.readFile(outputPath);
    const upload = await spaces.upload({
      key: finalKey,
      body: outBuffer,
      contentType: 'video/mp4',
      metadata: {
        episodeId: String(episode.id),
        seriesId: String(episode.series_id),
        assetType: 'final',
        generatedBy: 'ffmpeg-mux',
      },
    });

    await prisma.episode.update({
      where: { id: episodeId },
      data: { video_url: upload.url },
    });

    return { status: 'completed', video_url: upload.url, key: finalKey };
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

export const __testing = {
  buildMuxArgs,
  detectAudioExtension,
  getFinalKey,
};
