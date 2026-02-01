/**
 * Layer 0 Unit Tests for SpacesClient
 * 
 * Tests the SpacesClient class logic without making real S3 calls.
 * Uses mocked AWS SDK to verify request handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SpacesClient } from '../../src/services/SpacesClient';

// Mock AWS SDK
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({
    send: vi.fn(),
  })),
  PutObjectCommand: vi.fn().mockImplementation((params) => ({ ...params, _type: 'PutObject' })),
  GetObjectCommand: vi.fn().mockImplementation((params) => ({ ...params, _type: 'GetObject' })),
  DeleteObjectCommand: vi.fn().mockImplementation((params) => ({ ...params, _type: 'DeleteObject' })),
  ListObjectsV2Command: vi.fn().mockImplementation((params) => ({ ...params, _type: 'ListObjectsV2' })),
  HeadObjectCommand: vi.fn().mockImplementation((params) => ({ ...params, _type: 'HeadObject' })),
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://presigned-url.example.com'),
}));

describe('SpacesClient', () => {
  let client: SpacesClient;
  const mockConfig = {
    key: 'test-access-key',
    secret: 'test-secret-key',
    bucket: 'molt-studios-assets',
    region: 'nyc3',
    endpoint: 'https://nyc3.digitaloceanspaces.com',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    client = new SpacesClient(mockConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should throw error if access key is missing', () => {
      expect(() => new SpacesClient({
        ...mockConfig,
        key: '',
      })).toThrow('SpacesClient requires access key and secret');
    });

    it('should throw error if secret key is missing', () => {
      expect(() => new SpacesClient({
        ...mockConfig,
        secret: '',
      })).toThrow('SpacesClient requires access key and secret');
    });

    it('should create client with valid config', () => {
      expect(client).toBeDefined();
    });
  });

  describe('getPublicUrl', () => {
    it('should generate correct public URL', () => {
      const url = client.getPublicUrl('productions/123/poster.png');
      expect(url).toBe('https://molt-studios-assets.nyc3.digitaloceanspaces.com/productions/123/poster.png');
    });

    it('should use custom bucket if provided', () => {
      const url = client.getPublicUrl('test.png', 'other-bucket');
      expect(url).toBe('https://other-bucket.nyc3.digitaloceanspaces.com/test.png');
    });
  });

  describe('getCdnUrl', () => {
    it('should generate CDN URL', () => {
      const url = client.getCdnUrl('productions/123/video.mp4');
      expect(url).toBe('https://molt-studios-assets.nyc3.cdn.digitaloceanspaces.com/productions/123/video.mp4');
    });
  });

  describe('upload', () => {
    it('should call S3 put and head commands', async () => {
      const mockS3 = (client as any).s3;
      mockS3.send = vi.fn()
        .mockResolvedValueOnce({ ETag: '"abc123"' }) // PutObject
        .mockResolvedValueOnce({ ContentLength: 1024 }); // HeadObject

      const result = await client.upload({
        key: 'test/file.txt',
        body: Buffer.from('test content'),
        contentType: 'text/plain',
      });

      expect(mockS3.send).toHaveBeenCalledTimes(2);
      expect(result.key).toBe('test/file.txt');
      expect(result.bucket).toBe('molt-studios-assets');
      expect(result.etag).toBe('"abc123"');
      expect(result.size).toBe(1024);
    });

    it('should use public-read ACL by default', async () => {
      const mockS3 = (client as any).s3;
      mockS3.send = vi.fn()
        .mockResolvedValueOnce({ ETag: '"abc123"' })
        .mockResolvedValueOnce({ ContentLength: 100 });

      await client.upload({
        key: 'test.txt',
        body: 'content',
        contentType: 'text/plain',
      });

      // Check the command was created with public-read ACL
      const { PutObjectCommand } = await import('@aws-sdk/client-s3');
      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          ACL: 'public-read',
        })
      );
    });

    it('should set cache control header', async () => {
      const mockS3 = (client as any).s3;
      mockS3.send = vi.fn()
        .mockResolvedValueOnce({ ETag: '"abc123"' })
        .mockResolvedValueOnce({ ContentLength: 100 });

      await client.upload({
        key: 'test.txt',
        body: 'content',
        contentType: 'text/plain',
        cacheControl: 'max-age=3600',
      });

      const { PutObjectCommand } = await import('@aws-sdk/client-s3');
      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          CacheControl: 'max-age=3600',
        })
      );
    });
  });

  describe('uploadImage', () => {
    it('should generate correct key path for posters', async () => {
      const mockS3 = (client as any).s3;
      mockS3.send = vi.fn()
        .mockResolvedValueOnce({ ETag: '"abc123"' })
        .mockResolvedValueOnce({ ContentLength: 50000 });

      const result = await client.uploadImage(Buffer.from('image data'), {
        productionId: 'prod-123',
        type: 'poster',
        format: 'png',
        agentId: 'agent-456',
      });

      expect(result.key).toMatch(/^productions\/prod-123\/posters\/[a-f0-9-]+\.png$/);
      expect(result.contentType).toBe('image/png');
      expect(result.metadata.assetType).toBe('poster');
      expect(result.metadata.productionId).toBe('prod-123');
    });

    it('should handle different image formats', async () => {
      const mockS3 = (client as any).s3;
      mockS3.send = vi.fn()
        .mockResolvedValueOnce({ ETag: '"abc123"' })
        .mockResolvedValueOnce({ ContentLength: 30000 });

      const result = await client.uploadImage(Buffer.from('image'), {
        productionId: 'prod-123',
        type: 'thumbnail',
        format: 'webp',
        agentId: 'agent-456',
      });

      expect(result.key).toMatch(/\.webp$/);
      expect(result.contentType).toBe('image/webp');
    });
  });

  describe('uploadVideo', () => {
    it('should generate correct key path for shots', async () => {
      const mockS3 = (client as any).s3;
      mockS3.send = vi.fn()
        .mockResolvedValueOnce({ ETag: '"abc123"' })
        .mockResolvedValueOnce({ ContentLength: 5000000 });

      const result = await client.uploadVideo(Buffer.from('video data'), {
        productionId: 'prod-123',
        shotId: 'shot-456',
        agentId: 'agent-789',
        prompt: 'A beautiful sunset',
      });

      expect(result.key).toMatch(/^productions\/prod-123\/shots\/shot-456\/[a-f0-9-]+\.mp4$/);
      expect(result.contentType).toBe('video/mp4');
      expect(result.metadata.shotId).toBe('shot-456');
      expect(result.metadata.generatedBy).toBe('luma-dream-machine');
    });
  });

  describe('exists', () => {
    it('should return true when object exists', async () => {
      const mockS3 = (client as any).s3;
      mockS3.send = vi.fn().mockResolvedValueOnce({});

      const result = await client.exists('test/file.txt');
      expect(result).toBe(true);
    });

    it('should return false when object does not exist', async () => {
      const mockS3 = (client as any).s3;
      mockS3.send = vi.fn().mockRejectedValueOnce(new Error('Not found'));

      const result = await client.exists('nonexistent.txt');
      expect(result).toBe(false);
    });
  });

  describe('delete', () => {
    it('should call DeleteObjectCommand', async () => {
      const mockS3 = (client as any).s3;
      mockS3.send = vi.fn().mockResolvedValueOnce({});

      await client.delete('test/file.txt');

      expect(mockS3.send).toHaveBeenCalledTimes(1);
      const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
      expect(DeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: 'molt-studios-assets',
        Key: 'test/file.txt',
      });
    });
  });

  describe('listObjects', () => {
    it('should list objects with prefix', async () => {
      const mockS3 = (client as any).s3;
      mockS3.send = vi.fn().mockResolvedValueOnce({
        Contents: [
          { Key: 'test/a.txt', LastModified: new Date(), ETag: '"a"', Size: 100, StorageClass: 'STANDARD' },
          { Key: 'test/b.txt', LastModified: new Date(), ETag: '"b"', Size: 200, StorageClass: 'STANDARD' },
        ],
        IsTruncated: false,
      });

      const result = await client.listObjects({ prefix: 'test/' });

      expect(result.objects).toHaveLength(2);
      expect(result.objects[0].key).toBe('test/a.txt');
      expect(result.isTruncated).toBe(false);
    });

    it('should handle pagination', async () => {
      const mockS3 = (client as any).s3;
      mockS3.send = vi.fn().mockResolvedValueOnce({
        Contents: [{ Key: 'a.txt', LastModified: new Date(), ETag: '"a"', Size: 100, StorageClass: 'STANDARD' }],
        IsTruncated: true,
        NextContinuationToken: 'next-token',
      });

      const result = await client.listObjects({ maxKeys: 1 });

      expect(result.isTruncated).toBe(true);
      expect(result.nextContinuationToken).toBe('next-token');
    });
  });

  describe('listProductionAssets', () => {
    it('should list all assets for a production', async () => {
      const mockS3 = (client as any).s3;
      mockS3.send = vi.fn().mockResolvedValueOnce({
        Contents: [
          { Key: 'productions/123/poster.png', LastModified: new Date(), ETag: '"a"', Size: 50000, StorageClass: 'STANDARD' },
          { Key: 'productions/123/shots/1.mp4', LastModified: new Date(), ETag: '"b"', Size: 5000000, StorageClass: 'STANDARD' },
        ],
        IsTruncated: false,
      });

      const result = await client.listProductionAssets('123');

      expect(result.objects).toHaveLength(2);
      
      const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');
      expect(ListObjectsV2Command).toHaveBeenCalledWith(
        expect.objectContaining({
          Prefix: 'productions/123/',
        })
      );
    });
  });

  describe('getSignedUrl', () => {
    it('should generate pre-signed URL for download', async () => {
      // Re-mock the presigner to ensure it works
      const presigner = await import('@aws-sdk/s3-request-presigner');
      vi.mocked(presigner.getSignedUrl).mockResolvedValueOnce('https://presigned-url.example.com');

      const result = await client.getSignedUrl({
        key: 'test/file.mp4',
        expiresIn: 3600,
      });

      expect(result.url).toBe('https://presigned-url.example.com');
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should generate pre-signed URL for upload', async () => {
      const presigner = await import('@aws-sdk/s3-request-presigner');
      vi.mocked(presigner.getSignedUrl).mockResolvedValueOnce('https://presigned-url.example.com');

      const result = await client.getSignedUrl({
        key: 'uploads/new-file.mp4',
        operation: 'putObject',
        expiresIn: 1800,
      });

      expect(result.url).toBe('https://presigned-url.example.com');
    });
  });

  describe('deleteProduction', () => {
    it('should delete all assets for a production', async () => {
      const mockS3 = (client as any).s3;
      mockS3.send = vi.fn()
        // First call: list objects
        .mockResolvedValueOnce({
          Contents: [
            { Key: 'productions/123/poster.png', LastModified: new Date(), ETag: '"a"', Size: 50000, StorageClass: 'STANDARD' },
            { Key: 'productions/123/shots/1.mp4', LastModified: new Date(), ETag: '"b"', Size: 5000000, StorageClass: 'STANDARD' },
          ],
          IsTruncated: false,
        })
        // Delete calls
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      const deleted = await client.deleteProduction('123');

      expect(deleted).toBe(2);
      expect(mockS3.send).toHaveBeenCalledTimes(3); // 1 list + 2 deletes
    });
  });
});
