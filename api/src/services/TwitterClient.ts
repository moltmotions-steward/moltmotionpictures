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

export class TwitterClient {
  private readonly config: TwitterClientConfig;
  private readonly apiUrl = 'https://api.twitter.com/2/tweets';
  private readonly uploadUrl = 'https://upload.twitter.com/2/media/upload';
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(config: TwitterClientConfig) {
    if (!config.clientId || !config.clientSecret) {
      throw new Error('TwitterClient requires OAuth 2.0 credentials (Client ID and Client Secret)');
    }
    this.config = config;
  }

  /**
   * Get OAuth 2.0 access token via Client Credentials flow
   * https://docs.x.com/authentication/oauth-2-0/client-credentials-flow
   */
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const credentials = Buffer.from(
      `${this.config.clientId}:${this.config.clientSecret}`
    ).toString('base64');

    const response = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials&scope=tweet.write%20tweet.moderate.write%20users.read'
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OAuth 2.0 token request failed: ${response.status} ${errorText}`);
    }

    const data = await response.json() as { access_token: string; expires_in: number };
    
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + ((data.expires_in - 300) * 1000);
    
    return this.accessToken;
  }

  /**
   * Upload media (image) to Twitter via OAuth 2.0
   * https://docs.x.com/api/upload-media
   */
  async uploadMedia(imageBuffer: Buffer, mediaType: string = 'image/png'): Promise<string> {
    const accessToken = await this.getAccessToken();
    
    const base64 = imageBuffer.toString('base64');

    const response = await fetch(this.uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: base64,
        media_category: 'TWEET_IMAGE'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Twitter media upload failed: ${response.status} ${errorText}`);
    }

    const result = await response.json() as { media: { media_id_string: string } };
    return result.media.media_id_string;
  }

  /**
   * Post a tweet via OAuth 2.0
   * https://docs.x.com/api/create-tweet
   */
  async tweet(options: TweetOptions | string): Promise<TweetResponse> {
    const payload = typeof options === 'string' ? { text: options } : options;
    const accessToken = await this.getAccessToken();

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Twitter post failed: ${response.status} ${errorText}`);
    }

    return await response.json() as TweetResponse;
  }

  /**
   * Post tweet with image (from URL or Buffer)
   */
  async tweetWithImage(text: string, imageSource: string | Buffer): Promise<TweetResponse> {
    // If image source is a URL, fetch it first
    const imageBuffer = typeof imageSource === 'string'
      ? await this.fetchImageFromUrl(imageSource)
      : imageSource;

    const mediaId = await this.uploadMedia(imageBuffer);
    return this.tweet({ text, media_ids: [mediaId] });
  }

  /**
   * Fetch image from URL as Buffer
   */
  private async fetchImageFromUrl(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image from ${url}: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}

/**
 * Get configured Twitter client instance
 */
export function getTwitterClient(): TwitterClient | null {
  const clientId = process.env.X_CLIENT_ID;
  const clientSecret = process.env.X_CLIENT_ID_SECRET;

  if (!clientId || !clientSecret) {
    console.warn('[Twitter] OAuth 2.0 credentials (Client ID/Secret) not configured - posting disabled');
    return null;
  }

  return new TwitterClient({
    clientId,
    clientSecret
  });
}

export default TwitterClient;
