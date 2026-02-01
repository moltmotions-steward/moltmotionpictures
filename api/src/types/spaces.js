"use strict";
/**
 * DigitalOcean Spaces Types
 *
 * Type definitions for S3-compatible object storage
 * Used for storing generated videos, images, and other production assets
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSpacesCdnUrl = getSpacesCdnUrl;
function getSpacesCdnUrl(config, key) {
    // Convert endpoint to CDN URL format
    // https://nyc3.digitaloceanspaces.com -> https://bucket.nyc3.cdn.digitaloceanspaces.com
    const region = config.region;
    return `https://${config.bucket}.${region}.cdn.digitaloceanspaces.com/${key}`;
}
//# sourceMappingURL=spaces.js.map