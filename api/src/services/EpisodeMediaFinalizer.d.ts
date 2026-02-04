/**
 * EpisodeMediaFinalizer.ts
 *
 * Produces a single voiced MP4 by muxing the selected clip video with the
 * episode-level TTS audio, then uploads the result to Spaces and persists
 * the final URL on the Episode.
 */
export type FinalizeEpisodeResult = {
    status: 'skipped';
    reason: string;
} | {
    status: 'completed';
    video_url: string;
    key: string;
};
declare function detectAudioExtension(contentType: string | null): 'mp3' | 'wav' | 'm4a';
declare function buildMuxArgs(inputVideoPath: string, inputAudioPath: string, outputPath: string): string[];
declare function getFinalKey(episodeId: string): string;
/**
 * Finalizes an episode into a single voiced MP4.
 *
 * Idempotency:
 * - If the episode is already pointing at `final_with_audio.mp4`, it returns skipped.
 */
export declare function finalizeEpisodeWithTtsAudio(episodeId: string): Promise<FinalizeEpisodeResult>;
export declare const __testing: {
    buildMuxArgs: typeof buildMuxArgs;
    detectAudioExtension: typeof detectAudioExtension;
    getFinalKey: typeof getFinalKey;
};
export {};
//# sourceMappingURL=EpisodeMediaFinalizer.d.ts.map