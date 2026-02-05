"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VeoClient = exports.VeoClientError = void 0;
// import { VertexAI } from '@google-cloud/vertexai'; // Removed
const aiplatform_1 = require("@google-cloud/aiplatform");
class VeoClientError extends Error {
    originalError;
    constructor(message, originalError) {
        super(message);
        this.originalError = originalError;
        this.name = 'VeoClientError';
    }
}
exports.VeoClientError = VeoClientError;
// =============================================================================
// Client Class
// =============================================================================
class VeoClient {
    project;
    location;
    predictionClient;
    constructor(config) {
        // Handle both config structures (legacy and new)
        const projectId = config.project || config.googleCloud?.projectId;
        const location = config.location || config.googleCloud?.location;
        if (!projectId) {
            throw new Error('Google Cloud Project ID is required for VeoClient');
        }
        this.project = projectId;
        this.location = location || 'us-central1';
        // Initialize PredictionServiceClient
        const apiEndpoint = `${this.location}-aiplatform.googleapis.com`;
        this.predictionClient = new aiplatform_1.v1beta1.PredictionServiceClient({
            apiEndpoint: apiEndpoint,
            projectId: this.project,
        });
    }
    getModelId(requestedId) {
        return requestedId || 'veo-3.0-generate-preview';
    }
    /**
     * Generates a video using Google Veo on Vertex AI via PredictionServiceClient.
     */
    async generateVideo(request) {
        const startTime = Date.now();
        const modelId = this.getModelId(request.modelId);
        // Resource name for the model
        const endpoint = `projects/${this.project}/locations/${this.location}/publishers/google/models/${modelId}`;
        console.log(`[VeoClient] Requesting video from ${modelId} via PredictionServiceClient...`);
        try {
            // Prepare Parameters
            const parametersMap = {
                sampleCount: 1,
                video_length: request.durationSeconds ? `${request.durationSeconds}s` : '5s',
                aspect_ratio: request.aspectRatio || '16:9',
                fps: request.fps || 24,
            };
            if (request.seed) {
                parametersMap.seed = request.seed;
            }
            if (request.withAudio) {
                parametersMap.audio_generation_config = {
                    enabled: true
                };
            }
            // Prepare Instances
            const instanceMap = {
                prompt: request.prompt,
                negative_prompt: request.negative_prompt
            };
            // Convert to Protobuf Values
            const instance = aiplatform_1.helpers.toValue(instanceMap);
            const parameters = aiplatform_1.helpers.toValue(parametersMap);
            if (!instance || !parameters) {
                throw new Error('Failed to serialize request to Protobuf Value');
            }
            const predictionRequest = {
                endpoint,
                instances: [instance],
                parameters
            };
            // Call PredictLongRunning
            const [operation] = await this.predictionClient.predictLongRunning(predictionRequest);
            if (!operation.name) {
                throw new Error('No operation name returned');
            }
            console.log(`[VeoClient] Operation started: ${operation.name}`);
            console.log(`[VeoClient] Polling for completion (this may take 1-2 minutes)...`);
            // Wait for operation to complete
            const [response] = await operation.promise();
            if (!response || !response.predictions || response.predictions.length === 0) {
                throw new Error('Operation completed but returned no predictions');
            }
            const prediction = response.predictions[0];
            // Handle Protobuf Struct if strictly typed, but SDK usually unmarshals it?
            // Actually `predictions` are usually Type `Value[]` (Protobuf Value).
            // We need helpers.fromValue to get JS object.
            const predictionData = aiplatform_1.helpers.fromValue(prediction);
            console.log('[VeoClient] Prediction received:', JSON.stringify(predictionData, null, 2));
            // Extract Video URL
            let videoUrl = '';
            // Check for simple GCS URI string (common in some models)
            if (typeof predictionData === 'string' && predictionData.startsWith('gs://')) {
                videoUrl = predictionData;
            }
            // Check for object structure
            else if (typeof predictionData === 'object' && predictionData !== null) {
                const pd = predictionData;
                if (pd.video?.gcsUri)
                    videoUrl = pd.video.gcsUri;
                else if (pd.gcsUri)
                    videoUrl = pd.gcsUri;
                else if (pd.uri)
                    videoUrl = pd.uri;
            }
            if (!videoUrl) {
                console.error('[VeoClient] Could not identify video URL. Raw data:', predictionData);
                throw new Error('Could not identify video URL in prediction response.');
            }
            // Convert GS URI to HTTP URL
            if (videoUrl.startsWith('gs://')) {
                videoUrl = videoUrl.replace('gs://', 'https://storage.googleapis.com/');
            }
            return {
                videoUrl: videoUrl,
                metadata: {
                    model: modelId,
                    generationTimeMs: Date.now() - startTime,
                    prompt: request.prompt,
                }
            };
        }
        catch (error) {
            console.error('Veo generation error:', error);
            throw new VeoClientError('Failed to generate video with Veo SDK', error);
        }
    }
    async healthCheck() {
        try {
            return !!this.predictionClient;
        }
        catch (e) {
            return false;
        }
    }
}
exports.VeoClient = VeoClient;
exports.default = VeoClient;
//# sourceMappingURL=VeoClient.js.map