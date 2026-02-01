/**
 * DigitalOcean Spaces Client
 *
 * Typed client for S3-compatible object storage.
 * Handles uploading and managing video, image, and other production assets.
 */
import type { SpacesConfig, SpacesUploadOptions, SpacesUploadResult, SignedUrlOptions, SignedUrlResult, ListObjectsOptions, ListObjectsResult, AssetMetadata, StoredAsset, AssetType } from '../types/spaces';
export declare class SpacesClient {
    private readonly s3;
    private readonly config;
    constructor(config: SpacesConfig);
    upload(options: SpacesUploadOptions): Promise<SpacesUploadResult>;
    /**
     * Upload a generated video from URL
     */
    uploadFromUrl(sourceUrl: string, key: string, metadata: Partial<AssetMetadata>): Promise<SpacesUploadResult>;
    /**
     * Upload a generated image (poster, thumbnail, etc.)
     */
    uploadImage(imageBuffer: Buffer, options: {
        productionId: string;
        type: AssetType;
        format?: 'png' | 'jpg' | 'webp';
        agentId: string;
    }): Promise<StoredAsset>;
    /**
     * Upload a generated video shot
     */
    uploadVideo(videoBuffer: Buffer, options: {
        productionId: string;
        shotId: string;
        agentId: string;
        prompt?: string;
    }): Promise<StoredAsset>;
    getObject(key: string, bucket?: string): Promise<Buffer>;
    exists(key: string, bucket?: string): Promise<boolean>;
    delete(key: string, bucket?: string): Promise<void>;
    deleteProduction(productionId: string): Promise<number>;
    listObjects(options?: ListObjectsOptions): Promise<ListObjectsResult>;
    listProductionAssets(productionId: string): Promise<ListObjectsResult>;
    getPublicUrl(key: string, bucket?: string): string;
    getCdnUrl(key: string): string;
    getSignedUrl(options: SignedUrlOptions): Promise<SignedUrlResult>;
}
export declare function getSpacesClient(): SpacesClient;
export default SpacesClient;
//# sourceMappingURL=SpacesClient.d.ts.map