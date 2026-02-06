/**
 * x402 Client Library
 *
 * Handles the HTTP 402 payment flow:
 * 1. Make request -> receive 402 with payment requirements
 * 2. Sign payment with wallet
 * 3. Retry request with X-PAYMENT header
 * 4. Receive success response
 */

import type { PaymentRequirements, X402Response, TipResult } from '@/types/clips';
import { telemetryEvent, telemetryError } from '@/lib/telemetry';

// ============================================================================
// Types
// ============================================================================

export interface X402Config {
  /** Base API URL */
  apiBaseUrl: string;
  /** Default tip amount in cents */
  defaultTipCents: number;
  /** Minimum tip amount in cents */
  minTipCents: number;
}

export interface SignedPayment {
  /** Base64-encoded payment payload for X-PAYMENT header */
  paymentHeader: string;
  /** Payer's wallet address */
  payerAddress: string;
}

export type X402ClientErrorType =
  | 'auth_cancelled'
  | 'insufficient_funds'
  | 'wallet_unavailable'
  | 'network_error'
  | 'payment_failed';

export interface PaymentError {
  type: X402ClientErrorType;
  message: string;
  retryable: boolean;
  errorCode?: string;
  details?: unknown;
}

export type EnsurePaymentReady = (options?: {
  preferred?: 'cdp_first' | 'injected_first';
}) => Promise<{ address: string; providerType: 'cdp_embedded' | 'injected' }>;

export class X402PaymentError extends Error {
  readonly type: X402ClientErrorType;
  readonly retryable: boolean;
  readonly details?: unknown;
  readonly errorCode?: string;

  constructor(type: X402ClientErrorType, message: string, retryable: boolean, details?: unknown, errorCode?: string) {
    super(message);
    this.name = 'X402PaymentError';
    this.type = type;
    this.retryable = retryable;
    this.details = details;
    this.errorCode = errorCode;
  }
}

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_CONFIG: X402Config = {
  apiBaseUrl: process.env.NEXT_PUBLIC_API_URL || 'https://www.moltmotionpictures.com/api/v1',
  defaultTipCents: 25,
  minTipCents: 10,
};

// ============================================================================
// x402 Client Class
// ============================================================================

export class X402Client {
  private config: X402Config;
  private walletAddress: string | null = null;
  private signPaymentFn: ((requirements: PaymentRequirements) => Promise<SignedPayment>) | null = null;
  private ensurePaymentReadyFn: EnsurePaymentReady | null = null;

  constructor(config: Partial<X402Config> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Connect wallet and set up payment signing.
   */
  setWallet(
    address: string,
    signer: (requirements: PaymentRequirements) => Promise<SignedPayment>
  ): void {
    this.walletAddress = address;
    this.signPaymentFn = signer;
  }

  /**
   * Clear wallet connection.
   */
  clearWallet(): void {
    this.walletAddress = null;
    this.signPaymentFn = null;
  }

  /**
   * Set a function that can prompt auth/wallet setup when payment is attempted.
   */
  setEnsurePaymentReady(fn: EnsurePaymentReady | null): void {
    this.ensurePaymentReadyFn = fn;
  }

  /**
   * Check if wallet is connected.
   */
  isWalletConnected(): boolean {
    return this.walletAddress !== null && this.signPaymentFn !== null;
  }

  /**
   * Get connected wallet address.
   */
  getWalletAddress(): string | null {
    return this.walletAddress;
  }

  // --------------------------------------------------------------------------
  // Core Payment Flow
  // --------------------------------------------------------------------------

  /**
   * Tip a clip variant with x402 payment flow.
   */
  async tipClip(
    clipVariantId: string,
    sessionId: string,
    tipAmountCents: number = this.config.defaultTipCents
  ): Promise<TipResult> {
    await this.ensureWalletReady();

    if (tipAmountCents < this.config.minTipCents) {
      throw this.createError('payment_failed', `Minimum tip is $${(this.config.minTipCents / 100).toFixed(2)}`, false);
    }

    const endpoint = `${this.config.apiBaseUrl}/voting/clips/${clipVariantId}/tip`;

    // Step 1: Make initial request to get payment requirements.
    const initialResponse = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        tip_amount_cents: tipAmountCents,
      }),
    });

    if (initialResponse.status !== 402) {
      if (initialResponse.ok) {
        return initialResponse.json();
      }
      throw await this.createApiError(initialResponse);
    }

    // Step 2: Parse 402 response for payment requirements.
    const x402Response: X402Response = await initialResponse.json();
    if (!x402Response.accepts || x402Response.accepts.length === 0) {
      throw this.createError('network_error', 'No payment options available', true);
    }

    const requirements = x402Response.accepts[0];

    telemetryEvent('checkout_payment_started', {
      clip_id: clipVariantId,
      amount_cents: tipAmountCents,
      network: requirements.network,
    });

    try {
      // Step 3: Sign payment with wallet.
      const signedPayment = await this.signRequirements(requirements);

      // Step 4: Retry with X-PAYMENT header.
      const paidResponse = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-PAYMENT': signedPayment.paymentHeader,
        },
        body: JSON.stringify({
          session_id: sessionId,
          tip_amount_cents: tipAmountCents,
        }),
      });

      if (!paidResponse.ok) {
        throw await this.createApiError(paidResponse);
      }

      telemetryEvent('checkout_payment_completed', {
        clip_id: clipVariantId,
        amount_cents: tipAmountCents,
        payer: signedPayment.payerAddress,
      });

      // Step 5: Return success result.
      return paidResponse.json();
    } catch (error) {
       telemetryError('Payment failed', error, {
        clip_id: clipVariantId,
        amount_cents: tipAmountCents,
      });
      throw error;
    }
  }

  /**
   * Tip a series with x402 payment flow.
   */
  async tipSeries(
    seriesId: string,
    tipAmountCents: number = this.config.defaultTipCents
  ): Promise<any> {
    await this.ensureWalletReady();

    if (tipAmountCents < this.config.minTipCents) {
      throw this.createError('payment_failed', `Minimum tip is $${(this.config.minTipCents / 100).toFixed(2)}`, false);
    }

    const endpoint = `${this.config.apiBaseUrl}/series/${seriesId}/tip`;

    const initialResponse = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tip_amount_cents: tipAmountCents }),
    });

    if (initialResponse.status !== 402) {
      if (initialResponse.ok) {
        return initialResponse.json();
      }
      throw await this.createApiError(initialResponse);
    }

    const x402Response: X402Response = await initialResponse.json();
    if (!x402Response.accepts || x402Response.accepts.length === 0) {
      throw this.createError('network_error', 'No payment options available', true);
    }

    const requirements = x402Response.accepts[0];

    telemetryEvent('checkout_payment_started', {
      series_id: seriesId,
      amount_cents: tipAmountCents,
      network: requirements.network,
    });

    try {
      const signedPayment = await this.signRequirements(requirements);

      const paidResponse = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-PAYMENT': signedPayment.paymentHeader,
        },
        body: JSON.stringify({ tip_amount_cents: tipAmountCents }),
      });

      if (!paidResponse.ok) {
        throw await this.createApiError(paidResponse);
      }

      telemetryEvent('checkout_payment_completed', {
        series_id: seriesId,
        amount_cents: tipAmountCents,
        payer: signedPayment.payerAddress,
      });

      return paidResponse.json();
    } catch (error) {
      telemetryError('Payment failed', error, {
        series_id: seriesId,
        amount_cents: tipAmountCents,
      });
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // Utility Methods
  // --------------------------------------------------------------------------

  /**
   * Get payment requirements without paying.
   */
  async getPaymentRequirements(
    clipVariantId: string,
    tipAmountCents: number = this.config.defaultTipCents
  ): Promise<PaymentRequirements | null> {
    const endpoint = `${this.config.apiBaseUrl}/voting/clips/${clipVariantId}/tip`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: 'preview',
        tip_amount_cents: tipAmountCents,
      }),
    });

    if (response.status !== 402) {
      return null;
    }

    const x402Response: X402Response = await response.json();
    return x402Response.accepts?.[0] || null;
  }

  /**
   * Format cents to display string.
   */
  formatTip(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
  }

  /**
   * Parse USDC amount from requirements (6 decimals).
   */
  parseUsdcAmount(amount: string): number {
    return parseInt(amount, 10) / 1_000_000;
  }

  private async ensureWalletReady(): Promise<void> {
    if (this.isWalletConnected()) return;

    if (this.ensurePaymentReadyFn) {
      try {
        await this.ensurePaymentReadyFn({ preferred: 'cdp_first' });
      } catch (error) {
        throw this.normalizeEnsureReadyError(error);
      }
    }

    if (!this.isWalletConnected()) {
      throw this.createError('wallet_unavailable', 'Please connect your wallet to tip', false);
    }
  }

  private async signRequirements(requirements: PaymentRequirements): Promise<SignedPayment> {
    if (!this.signPaymentFn) {
      throw this.createError('wallet_unavailable', 'Please connect your wallet to tip', false);
    }

    try {
      return await this.signPaymentFn(requirements);
    } catch (error) {
      if (error instanceof X402PaymentError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : 'Failed to sign payment';
      if (/cancel|rejected|denied/i.test(message)) {
        throw this.createError('auth_cancelled', 'Payment signature was cancelled', true, error);
      }

      throw this.createError('wallet_unavailable', message, false, error);
    }
  }

  private normalizeEnsureReadyError(error: unknown): X402PaymentError {
    if (error instanceof X402PaymentError) {
      return error;
    }

    const maybeType = typeof error === 'object' && error !== null && 'type' in error
      ? String((error as { type?: string }).type)
      : null;
    const maybeMessage = typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message?: string }).message)
      : error instanceof Error ? error.message : 'Wallet connection failed';
    const retryable = typeof error === 'object' && error !== null && 'retryable' in error
      ? Boolean((error as { retryable?: boolean }).retryable)
      : false;

    if (maybeType === 'auth_cancelled') {
      return this.createError('auth_cancelled', maybeMessage, false, error);
    }
    if (maybeType === 'insufficient_funds') {
      return this.createError('insufficient_funds', maybeMessage, true, error);
    }
    if (maybeType === 'wallet_unavailable') {
      return this.createError('wallet_unavailable', maybeMessage, false, error);
    }
    if (maybeType === 'payment_failed') {
      return this.createError('payment_failed', maybeMessage, retryable || true, error);
    }

    if (/cancel|dismiss|closed/i.test(maybeMessage)) {
      return this.createError('auth_cancelled', maybeMessage, false, error);
    }

    return this.createError('wallet_unavailable', maybeMessage, false, error);
  }

  private async createApiError(response: Response): Promise<X402PaymentError> {
    let payload: any = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    const message = payload?.message || payload?.error || `Request failed with status ${response.status}`;
    const errorCode = payload?.error_code;

    // Handle stable error codes
    if (errorCode === 'INSUFFICIENT_FUNDS') {
      return this.createError('insufficient_funds', message, true, payload, errorCode);
    }
    if (errorCode === 'PAYMENT_SETTLEMENT_FAILED') {
      return this.createError('payment_failed', message, true, payload, errorCode);
    }
    if (errorCode === 'WALLET_SIGNATURE_INVALID') {
      return this.createError('payment_failed', message, true, payload, errorCode);
    }
    if (errorCode === 'PAYMENT_DECLINED') {
      return this.createError('payment_failed', message, false, payload, errorCode); // Declined usually non-retryable immediately
    }
    if (errorCode === 'PAYMENT_REQUIRED') {
       return this.createError('payment_failed', message, true, payload, errorCode);
    }

    // Fallback heuristic matching for backward compatibility
    if (/insufficient funds/i.test(message)) {
      return this.createError('insufficient_funds', message, true, payload, errorCode);
    }
    
    if (response.status === 402) {
      return this.createError('payment_failed', message, true, payload, errorCode);
    }

    if (response.status >= 500) {
      return this.createError('network_error', message, true, payload, errorCode);
    }

    return this.createError('payment_failed', message, false, payload, errorCode);
  }

  private createError(
    type: X402ClientErrorType,
    message: string,
    retryable: boolean,
    details?: unknown,
    errorCode?: string
  ): X402PaymentError {
    return new X402PaymentError(type, message, retryable, details, errorCode);
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

let clientInstance: X402Client | null = null;

export function getX402Client(): X402Client {
  if (!clientInstance) {
    clientInstance = new X402Client();
  }
  return clientInstance;
}

/**
 * React helper for x402 client.
 */
export function useX402() {
  const client = getX402Client();

  return {
    client,
    isWalletConnected: client.isWalletConnected(),
    walletAddress: client.getWalletAddress(),
    tipClip: client.tipClip.bind(client),
    tipSeries: client.tipSeries.bind(client),
    formatTip: client.formatTip.bind(client),
    defaultTipCents: DEFAULT_CONFIG.defaultTipCents,
    minTipCents: DEFAULT_CONFIG.minTipCents,
  };
}

export default X402Client;
