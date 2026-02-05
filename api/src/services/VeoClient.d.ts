export interface VeoGenerationRequest {
    prompt: string;
    negative_prompt?: string;
    width?: number;
    height?: number;
    fps?: number;
    durationSeconds?: number;
    aspectRatio?: '16:9' | '9:16' | '1:1';
    seed?: number;
    modelId?: string;
    withAudio?: boolean;
}
export interface VeoGenerationResponse {
    videoUrl: string;
    audioUrl?: string;
    metadata: {
        model: string;
        generationTimeMs: number;
        prompt: string;
    };
}
export declare class VeoClientError extends Error {
    readonly originalError?: unknown | undefined;
    constructor(message: string, originalError?: unknown | undefined);
}
export declare class VeoClient {
    private project;
    private location;
    private predictionClient;
    constructor(config: {
        project?: string;
        location?: string;
        googleCloud?: {
            projectId: string | undefined;
            location: string;
        };
    });
    private getModelId;
    /**
     * Generates a video using Google Veo on Vertex AI via PredictionServiceClient.
     */
    generateVideo(request: VeoGenerationRequest): Promise<VeoGenerationResponse>;
    healthCheck(): Promise<boolean>;
}
export default VeoClient;
//# sourceMappingURL=VeoClient.d.ts.map