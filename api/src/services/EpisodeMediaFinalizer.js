"use strict";
/**
 * EpisodeMediaFinalizer.ts
 *
 * Produces a single voiced MP4 by muxing the selected clip video with the
 * episode-level TTS audio, then uploads the result to Spaces and persists
 * the final URL on the Episode.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.__testing = void 0;
exports.finalizeEpisodeWithTtsAudio = finalizeEpisodeWithTtsAudio;
const client_1 = require("@prisma/client");
const SpacesClient_1 = require("./SpacesClient");
const child_process_1 = require("child_process");
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const fs_1 = require("fs");
const prisma = new client_1.PrismaClient();
function runFfmpeg(args) {
    return new Promise((resolve, reject) => {
        const child = (0, child_process_1.spawn)('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
        let stderr = '';
        child.stderr.on('data', (chunk) => {
            stderr += chunk.toString('utf8');
        });
        child.on('error', (err) => {
            reject(err);
        });
        child.on('close', (code) => {
            if (code === 0)
                return resolve({ stderr });
            const error = new Error(`ffmpeg exited with code ${code}`);
            error.stderr = stderr;
            reject(error);
        });
    });
}
function detectAudioExtension(contentType) {
    const ct = (contentType || '').toLowerCase();
    if (ct.includes('wav'))
        return 'wav';
    if (ct.includes('mp4') || ct.includes('m4a') || ct.includes('aac'))
        return 'm4a';
    return 'mp3';
}
function buildMuxArgs(inputVideoPath, inputAudioPath, outputPath) {
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
function getFinalKey(episodeId) {
    return `episodes/${episodeId}/final_with_audio.mp4`;
}
async function downloadToFile(url, filePath) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to download: ${url} (HTTP ${response.status})`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs_1.promises.writeFile(filePath, buffer);
    return { contentType: response.headers.get('content-type') };
}
/**
 * Finalizes an episode into a single voiced MP4.
 *
 * Idempotency:
 * - If the episode is already pointing at `final_with_audio.mp4`, it returns skipped.
 */
async function finalizeEpisodeWithTtsAudio(episodeId) {
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
    if (!episode)
        return { status: 'skipped', reason: 'episode_not_found' };
    const selectedVideoUrl = episode.clip_variants[0]?.video_url || episode.video_url;
    if (!selectedVideoUrl)
        return { status: 'skipped', reason: 'missing_selected_video_url' };
    const ttsAudioUrl = episode.tts_audio_url;
    if (!ttsAudioUrl)
        return { status: 'skipped', reason: 'missing_tts_audio_url' };
    const finalKey = getFinalKey(episodeId);
    if (episode.video_url && episode.video_url.includes(finalKey)) {
        return { status: 'skipped', reason: 'already_finalized' };
    }
    const tmpDir = await fs_1.promises.mkdtemp(path_1.default.join(os_1.default.tmpdir(), `episode-finalize-${episodeId}-`));
    try {
        const inputVideoPath = path_1.default.join(tmpDir, 'input.mp4');
        const audioMeta = await downloadToFile(ttsAudioUrl, path_1.default.join(tmpDir, 'audio'));
        const audioExt = detectAudioExtension(audioMeta.contentType);
        const inputAudioPath = path_1.default.join(tmpDir, `input.${audioExt}`);
        // Download assets
        await downloadToFile(selectedVideoUrl, inputVideoPath);
        await fs_1.promises.rename(path_1.default.join(tmpDir, 'audio'), inputAudioPath);
        const outputPath = path_1.default.join(tmpDir, 'output.mp4');
        // Mux
        await runFfmpeg(buildMuxArgs(inputVideoPath, inputAudioPath, outputPath));
        // Upload
        const spaces = (0, SpacesClient_1.getSpacesClient)();
        const outBuffer = await fs_1.promises.readFile(outputPath);
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
    }
    finally {
        await fs_1.promises.rm(tmpDir, { recursive: true, force: true });
    }
}
exports.__testing = {
    buildMuxArgs,
    detectAudioExtension,
    getFinalKey,
};
//# sourceMappingURL=EpisodeMediaFinalizer.js.map