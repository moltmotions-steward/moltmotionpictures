import crypto from 'crypto';
import config from '../config/index.js';

export interface CoinbasePrimeCredentials {
  accessKey: string;
  passphrase: string;
  signingKey: string; // base64 signing key as provided by Prime UI
}

export interface PrimeStakingResponse {
  wallet_id: string;
  transaction_id: string;
  activity_id: string;
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function decodeSigningKey(signingKey: string): Buffer {
  const trimmed = signingKey.trim();
  try {
    // Prime docs show signing_key is base64 that should be decoded before HMAC.
    const buf = Buffer.from(trimmed, 'base64');
    if (buf.length > 0) return buf;
  } catch {
    // ignore
  }
  return Buffer.from(trimmed, 'utf8');
}

function buildSignaturePayload(timestampSeconds: string, method: string, requestPathWithQuery: string, body: string) {
  return `${timestampSeconds}${method}${requestPathWithQuery}${body}`;
}

export function signPrimeRequest(params: {
  timestampSeconds: string;
  method: string;
  requestPathWithQuery: string;
  body: string;
  signingKey: string;
}): string {
  const { timestampSeconds, method, requestPathWithQuery, body, signingKey } = params;
  const payload = buildSignaturePayload(timestampSeconds, method, requestPathWithQuery, body);
  const keyBytes = decodeSigningKey(signingKey);
  return crypto.createHmac('sha256', keyBytes).update(payload).digest('base64');
}

export class CoinbasePrimeClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(opts?: { baseUrl?: string; timeoutMs?: number; maxRetries?: number }) {
    this.baseUrl = opts?.baseUrl || config.coinbasePrime.baseUrl;
    this.timeoutMs = opts?.timeoutMs ?? config.coinbasePrime.timeoutMs;
    this.maxRetries = opts?.maxRetries ?? config.coinbasePrime.maxRetries;
  }

  private async request<T>(params: {
    method: HttpMethod;
    path: string;
    query?: Record<string, string | number | undefined>;
    body?: unknown;
    credentials: CoinbasePrimeCredentials;
    retrySafe?: boolean;
  }): Promise<T> {
    const url = new URL(params.path, this.baseUrl);
    if (params.query) {
      for (const [k, v] of Object.entries(params.query)) {
        if (v === undefined) continue;
        url.searchParams.set(k, String(v));
      }
    }

    const bodyString = params.body === undefined ? '' : JSON.stringify(params.body);
    const requestPathWithQuery = `${url.pathname}${url.search}`;

    const attemptRequest = async (): Promise<Response> => {
      const timestampSeconds = String(Math.floor(Date.now() / 1000));
      const signature = signPrimeRequest({
        timestampSeconds,
        method: params.method,
        requestPathWithQuery,
        body: bodyString,
        signingKey: params.credentials.signingKey,
      });

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        return await fetch(url.toString(), {
          method: params.method,
          headers: {
            'Content-Type': 'application/json',
            'X-CB-ACCESS-KEY': params.credentials.accessKey,
            'X-CB-ACCESS-PASSPHRASE': params.credentials.passphrase,
            'X-CB-ACCESS-SIGNATURE': signature,
            'X-CB-ACCESS-TIMESTAMP': timestampSeconds,
          },
          body: params.method === 'GET' || params.method === 'DELETE' ? undefined : bodyString,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
    };

    let lastError: unknown;
    const retrySafe = params.retrySafe ?? (params.method === 'GET');
    const attempts = retrySafe ? Math.max(1, this.maxRetries + 1) : 1;

    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const res = await attemptRequest();

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          const err = new Error(`Prime API error ${res.status}: ${text || res.statusText}`);
          (err as any).status = res.status;
          throw err;
        }

        const json = (await res.json().catch(() => null)) as T | null;
        if (json === null) {
          throw new Error('Prime API returned non-JSON response');
        }
        return json;
      } catch (err) {
        lastError = err;
        if (attempt === attempts - 1) break;
        // basic jittered backoff
        await sleep(200 * Math.pow(2, attempt) + Math.floor(Math.random() * 100));
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Prime API request failed');
  }

  async getStakingStatus(portfolioId: string, walletId: string, credentials: CoinbasePrimeCredentials) {
    return this.request<any>({
      method: 'GET',
      path: `/v1/portfolios/${portfolioId}/wallets/${walletId}/staking/status`,
      credentials,
      retrySafe: true,
    });
  }

  async getUnstakingStatus(portfolioId: string, walletId: string, credentials: CoinbasePrimeCredentials) {
    return this.request<any>({
      method: 'GET',
      path: `/v1/portfolios/${portfolioId}/wallets/${walletId}/staking/unstake/status`,
      credentials,
      retrySafe: true,
    });
  }

  async initiateStake(portfolioId: string, walletId: string, amount: string, idempotencyKey: string, credentials: CoinbasePrimeCredentials): Promise<PrimeStakingResponse> {
    return this.request<PrimeStakingResponse>({
      method: 'POST',
      path: `/v1/portfolios/${portfolioId}/wallets/${walletId}/staking/initiate`,
      body: {
        idempotency_key: idempotencyKey,
        inputs: {
          amount,
        },
      },
      credentials,
      retrySafe: false,
    });
  }

  async requestUnstake(portfolioId: string, walletId: string, amount: string, idempotencyKey: string, credentials: CoinbasePrimeCredentials): Promise<PrimeStakingResponse> {
    return this.request<PrimeStakingResponse>({
      method: 'POST',
      path: `/v1/portfolios/${portfolioId}/wallets/${walletId}/staking/unstake`,
      body: {
        idempotency_key: idempotencyKey,
        inputs: {
          amount,
        },
      },
      credentials,
      retrySafe: false,
    });
  }

  async claimRewards(portfolioId: string, walletId: string, amount: string | undefined, idempotencyKey: string, credentials: CoinbasePrimeCredentials): Promise<PrimeStakingResponse> {
    return this.request<PrimeStakingResponse>({
      method: 'POST',
      path: `/v1/portfolios/${portfolioId}/wallets/${walletId}/staking/claim_rewards`,
      body: {
        idempotency_key: idempotencyKey,
        inputs: amount ? { amount } : {},
      },
      credentials,
      retrySafe: false,
    });
  }

  async listPortfolioTransactions(portfolioId: string, query: { symbols?: string; types?: string; cursor?: string; limit?: number }, credentials: CoinbasePrimeCredentials) {
    return this.request<any>({
      method: 'GET',
      path: `/v1/portfolios/${portfolioId}/transactions`,
      query: {
        symbols: query.symbols,
        types: query.types,
        cursor: query.cursor,
        limit: query.limit,
      },
      credentials,
      retrySafe: true,
    });
  }
}

