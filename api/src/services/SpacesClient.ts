/**
 * DigitalOcean Spaces Client
 * 
 * Typed client for S3-compatible object storage.
 * Handles uploading and managing video, image, and other production assets.
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type {
  SpacesConfig,
  SpacesUploadOptions,
  SpacesUploadResult,
  SignedUrlOptions,
  SignedUrlResult,
  ListObjectsOptions,
  ListObjectsResult,
  AssetMetadata,
  StoredAsset,
  AssetType,
} from '../types/spaces';
import { getSpacesCdnUrl } from '../types/spaces';
import crypto from 'crypto';

// =============================================================================
// Client Class
// =============================================================================

export class SpacesClient {
  private readonly s3: S3Client;
  private readonly config: SpacesConfig;

  constructor(config: SpacesConfig) {
    if (!config.key || !config.secret) {
      throw new Error('SpacesClient requires access key and secret');
    }

    this.config = config;
    this.s3 = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.key,
        secretAccessKey: config.secret,
      },
      forcePathStyle: false, // Use virtual-hosted style URLs
    });
  }

  // ---------------------------------------------------------------------------
  // Upload Operations
  // ---------------------------------------------------------------------------

  async upload(options: SpacesUploadOptions): Promise<SpacesUploadResult> {
    const bucket = options.bucket || this.config.bucket;
    
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: options.key,
      Body: options.body as Buffer | string,
      ContentType: options.contentType,
      ACL: options.acl || 'public-read',
      Metadata: options.metadata,
      CacheControl: options.cacheControl || 'max-age=31536000', // 1 year
    });

    const result = await this.s3.send(command);
    
    // Get object size
    const headCommand = new HeadObjectCommand({
      Bucket: bucket,
      Key: options.key,
    });
    const headResult = await this.s3.send(headCommand);

    return {
      url: this.getPublicUrl(options.key, bucket),
      key: options.key,
      bucket,
      etag: result.ETag || '',
      size: headResult.ContentLength || 0,
    };
  }

  /**
   * Upload a generated video from URL
   */
  async uploadFromUrl(
    sourceUrl: string,
    key: string,
    metadata: Partial<AssetMetadata>
  ): Promise<SpacesUploadResult> {
    const response = await fetch(sourceUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch from URL: ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') || 'video/mp4';

    return this.upload({
      key,
      body: buffer,
      contentType,
      metadata: Object.fromEntries(
        Object.entries({
          ...metadata,
          uploadedAt: new Date().toISOString(),
        }).map(([k, v]) => [k, String(v ?? '')])
      ),
    });
  }

  /**
   * Upload a generated image (poster, thumbnail, etc.)
   */
  async uploadImage(
    imageBuffer: Buffer,
    options: {
      productionId: string;
      type: AssetType;
      format?: 'png' | 'jpg' | 'webp';
      agentId: string;
    }
  ): Promise<StoredAsset> {
    const id = crypto.randomUUID();
    const ext = options.format || 'png';
    const key = `productions/${options.productionId}/${options.type}s/${id}.${ext}`;

    const contentTypeMap: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      webp: 'image/webp',
    };

    const result = await this.upload({
      key,
      body: imageBuffer,
      contentType: contentTypeMap[ext],
      metadata: {
        productionId: options.productionId,
        assetType: options.type,
        agentId: options.agentId,
      },
    });

    return {
      id,
      url: result.url,
      cdnUrl: getSpacesCdnUrl(this.config, key),
      key: result.key,
      bucket: result.bucket,
      contentType: contentTypeMap[ext],
      size: result.size,
      metadata: {
        productionId: options.productionId,
        assetType: options.type,
        generatedBy: 'manual',
        createdAt: new Date().toISOString(),
        agentId: options.agentId,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Upload a generated video shot
   */
  async uploadVideo(
    videoBuffer: Buffer,
    options: {
      productionId: string;
      shotId: string;
      agentId: string;
      prompt?: string;
    }
  ): Promise<StoredAsset> {
    const id = crypto.randomUUID();
    const key = `productions/${options.productionId}/shots/${options.shotId}/${id}.mp4`;

    const result = await this.upload({
      key,
      body: videoBuffer,
      contentType: 'video/mp4',
      metadata: {
        productionId: options.productionId,
        shotId: options.shotId,
        assetType: 'video',
        agentId: options.agentId,
        prompt: options.prompt || '',
      },
    });

    return {
      id,
      url: result.url,
      cdnUrl: getSpacesCdnUrl(this.config, key),
      key: result.key,
      bucket: result.bucket,
      contentType: 'video/mp4',
      size: result.size,
      metadata: {
        productionId: options.productionId,
        shotId: options.shotId,
        assetType: 'video',
        generatedBy: 'luma-dream-machine',
        prompt: options.prompt,
        createdAt: new Date().toISOString(),
        agentId: options.agentId,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  // ---------------------------------------------------------------------------
  // Read Operations
  // ---------------------------------------------------------------------------

  async getObject(key: string, bucket?: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: bucket || this.config.bucket,
      Key: key,
    });

    const response = await this.s3.send(command);
    const stream = response.Body;
    
    if (!stream) {
      throw new Error('Empty response body');
    }

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of stream as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  async exists(key: string, bucket?: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: bucket || this.config.bucket,
        Key: key,
      });
      await this.s3.send(command);
      return true;
    } catch {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Delete Operations
  // ---------------------------------------------------------------------------

  async delete(key: string, bucket?: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: bucket || this.config.bucket,
      Key: key,
    });
    await this.s3.send(command);
  }

  async deleteProduction(productionId: string): Promise<number> {
    const prefix = `productions/${productionId}/`;
    const objects = await this.listObjects({ prefix });
    
    let deleted = 0;
    for (const obj of objects.objects) {
      await this.delete(obj.key);
      deleted++;
    }
    
    return deleted;
  }

  // ---------------------------------------------------------------------------
  // List Operations
  // ---------------------------------------------------------------------------

  async listObjects(options: ListObjectsOptions = {}): Promise<ListObjectsResult> {
    const command = new ListObjectsV2Command({
      Bucket: options.bucket || this.config.bucket,
      Prefix: options.prefix,
      MaxKeys: options.maxKeys || 1000,
      ContinuationToken: options.continuationToken,
      Delimiter: options.delimiter,
    });

    const response = await this.s3.send(command);

    return {
      objects: (response.Contents || []).map((obj) => ({
        key: obj.Key || '',
        lastModified: obj.LastModified || new Date(),
        etag: obj.ETag || '',
        size: obj.Size || 0,
        storageClass: obj.StorageClass || 'STANDARD',
      })),
      isTruncated: response.IsTruncated || false,
      nextContinuationToken: response.NextContinuationToken,
      commonPrefixes: response.CommonPrefixes?.map((p) => p.Prefix || ''),
    };
  }

  async listProductionAssets(productionId: string): Promise<ListObjectsResult> {
    return this.listObjects({
      prefix: `productions/${productionId}/`,
    });
  }

  // ---------------------------------------------------------------------------
  // URL Generation
  // ---------------------------------------------------------------------------

  getPublicUrl(key: string, bucket?: string): string {
    const b = bucket || this.config.bucket;
    return `${this.config.endpoint.replace('https://', `https://${b}.`)}/${key}`;
  }

  getCdnUrl(key: string): string {
    return getSpacesCdnUrl(this.config, key);
  }

  async getSignedUrl(options: SignedUrlOptions): Promise<SignedUrlResult> {
    const bucket = options.bucket || this.config.bucket;
    const expiresIn = options.expiresIn || 3600;

    const command = options.operation === 'putObject'
      ? new PutObjectCommand({ Bucket: bucket, Key: options.key })
      : new GetObjectCommand({ Bucket: bucket, Key: options.key });

    const url = await getSignedUrl(this.s3, command, { expiresIn });

    return {
      url,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    };
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

let clientInstance: SpacesClient | null = null;

export function getSpacesClient(): SpacesClient {
  if (!clientInstance) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const config = require('../config').default || require('../config');
    
    if (!config.doSpaces?.key || !config.doSpaces?.secret) {
      throw new Error('DO_SPACES_KEY and DO_SPACES_SECRET environment variables are required');
    }
    
    clientInstance = new SpacesClient({
      key: config.doSpaces.key,
      secret: config.doSpaces.secret,
      bucket: config.doSpaces.bucket,
      region: config.doSpaces.region,
      endpoint: config.doSpaces.endpoint,
    });
  }
  return clientInstance;
}

export default SpacesClient;
