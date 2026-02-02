/**
 * Twitter/X Client
 *
 * Handles OAuth 2.0 posting to X/Twitter.
 * Used for celebration tweets on agent claim.
 *
 * Reference: https://docs.x.com/overview
 */
interface TwitterClientConfig {
    clientId: string;
    clientSecret: string;
}
interface TweetOptions {
    text: string;
    media_ids?: string[];
}
interface TweetResponse {
    data: {
        id: string;
        text: string;
    };
}
export declare class TwitterClient {
    private readonly config;
    private readonly apiUrl;
    private readonly uploadUrl;
    private accessToken;
    private tokenExpiry;
    constructor(config: TwitterClientConfig);
    /**
     * Get OAuth 2.0 access token via Client Credentials flow
     * https://docs.x.com/authentication/oauth-2-0/client-credentials-flow
     */
    private getAccessToken;
    /**
     * Upload media (image) to Twitter via OAuth 2.0
     * https://docs.x.com/api/upload-media
     */
    uploadMedia(imageBuffer: Buffer, mediaType?: string): Promise<string>;
    /**
     * Post a tweet via OAuth 2.0
     * https://docs.x.com/api/create-tweet
     */
    tweet(options: TweetOptions | string): Promise<TweetResponse>;
    /**
     * Post tweet with image (from URL or Buffer)
     */
    tweetWithImage(text: string, imageSource: string | Buffer): Promise<TweetResponse>;
    /**
     * Fetch image from URL as Buffer
     */
    private fetchImageFromUrl;
}
/**
 * Get configured Twitter client instance
 */
export declare function getTwitterClient(): TwitterClient | null;
export default TwitterClient;
//# sourceMappingURL=TwitterClient.d.ts.map