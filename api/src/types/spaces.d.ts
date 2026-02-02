/**
 * DigitalOcean Spaces Types
 *
 * Type definitions for S3-compatible object storage
 * Used for storing generated videos, images, and other production assets
 */
export interface SpacesUploadOptions {
    bucket?: string;
    key: string;
    body: Buffer | ReadableStream | string;
    contentType: string;
    acl?: SpacesACL;
    metadata?: Record<string, string>;
    cacheControl?: string;
}
export type SpacesACL = 'private' | 'public-read' | 'public-read-write' | 'authenticated-read';
export interface SpacesUploadResult {
    url: string;
    key: string;
    bucket: string;
    etag: string;
    size: number;
}
export type AssetType = 'video' | 'image' | 'Scripter' | 'thumbnail' | 'audio';
export interface AssetMetadata {
    productionId: string;
    shotId?: string;
    assetType: AssetType;
    generatedBy: 'flux.1-schnell' | 'flux.1-dev' | 'luma-dream-machine' | 'manual';
    prompt?: string;
    seed?: number;
    createdAt: string;
    agentId: string;
}
export interface StoredAsset {
    id: string;
    url: string;
    cdnUrl?: string;
    key: string;
    bucket: string;
    contentType: string;
    size: number;
    metadata: AssetMetadata;
    createdAt: Date;
    updatedAt: Date;
}
export interface SignedUrlOptions {
    key: string;
    bucket?: string;
    expiresIn?: number;
    operation?: 'getObject' | 'putObject';
}
export interface SignedUrlResult {
    url: string;
    expiresAt: Date;
}
export interface ListObjectsOptions {
    bucket?: string;
    prefix?: string;
    maxKeys?: number;
    continuationToken?: string;
    delimiter?: string;
}
export interface ListObjectsResult {
    objects: SpacesObject[];
    isTruncated: boolean;
    nextContinuationToken?: string;
    commonPrefixes?: string[];
}
export interface SpacesObject {
    key: string;
    lastModified: Date;
    etag: string;
    size: number;
    storageClass: string;
}
export interface SpacesConfig {
    key: string;
    secret: string;
    bucket: string;
    region: string;
    endpoint: string;
}
export declare function getSpacesCdnUrl(config: SpacesConfig, key: string): string;
//# sourceMappingURL=spaces.d.ts.map