/**
 * DigitalOcean Spaces Types
 * 
 * Type definitions for S3-compatible object storage
 * Used for storing generated videos, images, and other production assets
 */

// =============================================================================
// Upload Types
// =============================================================================

export interface SpacesUploadOptions {
  bucket?: string;
  key: string;
  body: Buffer | ReadableStream | string;
  contentType: string;
  acl?: SpacesACL;
  metadata?: Record<string, string>;
  cacheControl?: string;
}

export type SpacesACL = 
  | 'private' 
  | 'public-read' 
  | 'public-read-write' 
  | 'authenticated-read';

export interface SpacesUploadResult {
  url: string;
  key: string;
  bucket: string;
  etag: string;
  size: number;
}

// =============================================================================
// Asset Management
// =============================================================================

export type AssetType = 'video' | 'image' | 'poster' | 'thumbnail' | 'audio';

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

// =============================================================================
// URL Generation
// =============================================================================

export interface SignedUrlOptions {
  key: string;
  bucket?: string;
  expiresIn?: number;  // seconds, default 3600
  operation?: 'getObject' | 'putObject';
}

export interface SignedUrlResult {
  url: string;
  expiresAt: Date;
}

// =============================================================================
// Listing & Queries
// =============================================================================

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

// =============================================================================
// Configuration
// =============================================================================

export interface SpacesConfig {
  key: string;
  secret: string;
  bucket: string;
  region: string;
  endpoint: string;
}

export function getSpacesCdnUrl(config: SpacesConfig, key: string): string {
  // Convert endpoint to CDN URL format
  // https://nyc3.digitaloceanspaces.com -> https://bucket.nyc3.cdn.digitaloceanspaces.com
  const region = config.region;
  return `https://${config.bucket}.${region}.cdn.digitaloceanspaces.com/${key}`;
}
