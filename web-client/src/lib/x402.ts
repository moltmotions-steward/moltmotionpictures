/**
 * x402 Client Library
 * 
 * Handles the HTTP 402 payment flow:
 * 1. Make request → receive 402 with payment requirements
 * 2. Sign payment with wallet (Coinbase Smart Wallet)
 * 3. Retry request with X-PAYMENT header
 * 4. Receive success response
 */

import type { PaymentRequirements, X402Response, TipResult } from '@/types/clips';

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

export interface PaymentError {
  type: 'wallet_not_connected' | 'user_rejected' | 'insufficient_funds' | 'network_error' | 'invalid_response';
  message: string;
  details?: unknown;
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
  private signPayment: ((requirements: PaymentRequirements) => Promise<SignedPayment>) | null = null;

  constructor(config: Partial<X402Config> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Connect wallet and set up payment signing.
   * Called after wallet connection via OnchainKit/Smart Wallet.
   */
  setWallet(
    address: string,
    signer: (requirements: PaymentRequirements) => Promise<SignedPayment>
  ): void {
    this.walletAddress = address;
    this.signPayment = signer;
  }

  /**
   * Clear wallet connection.
   */
  clearWallet(): void {
    this.walletAddress = null;
    this.signPayment = null;
  }

  /**
   * Check if wallet is connected.
   */
  isWalletConnected(): boolean {
    return this.walletAddress !== null && this.signPayment !== null;
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
   * 
   * 1. Makes initial request (will return 402)
   * 2. Parses payment requirements
   * 3. Signs payment with wallet
   * 4. Retries with X-PAYMENT header
   * 5. Returns tip result
   */
  async tipClip(
    clipVariantId: string,
    sessionId: string,
    tipAmountCents: number = this.config.defaultTipCents
  ): Promise<TipResult> {
    if (!this.isWalletConnected()) {
      throw this.createError('wallet_not_connected', 'Please connect your wallet to tip');
    }

    if (tipAmountCents < this.config.minTipCents) {
      throw this.createError('invalid_response', `Minimum tip is $${(this.config.minTipCents / 100).toFixed(2)}`);
    }

    const endpoint = `${this.config.apiBaseUrl}/voting/clips/${clipVariantId}/tip`;

    // Step 1: Make initial request to get payment requirements
    const initialResponse = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        tip_amount_cents: tipAmountCents,
      }),
    });

    // If not 402, handle error or unexpected success
    if (initialResponse.status !== 402) {
      if (initialResponse.ok) {
        // Unexpected success without payment (shouldn't happen)
        return initialResponse.json();
      }
      const error = await initialResponse.json().catch(() => ({ error: 'Unknown error' }));
      throw this.createError('network_error', error.error || 'Request failed');
    }

    // Step 2: Parse 402 response for payment requirements
    const x402Response: X402Response = await initialResponse.json();
    
    if (!x402Response.accepts || x402Response.accepts.length === 0) {
      throw this.createError('invalid_response', 'No payment options available');
    }

    const requirements = x402Response.accepts[0];

    // Step 3: Sign payment with wallet
    let signedPayment: SignedPayment;
    try {
      signedPayment = await this.signPayment!(requirements);
    } catch (error) {
      if (error instanceof Error && error.message.includes('rejected')) {
        throw this.createError('user_rejected', 'Payment was rejected');
      }
      throw this.createError('wallet_not_connected', 'Failed to sign payment');
    }

    // Step 4: Retry with X-PAYMENT header
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
      const error = await paidResponse.json().catch(() => ({ error: 'Payment verification failed' }));
      throw this.createError('network_error', error.error || 'Payment failed');
    }

    // Step 5: Return success result
    return paidResponse.json();
  }

  // --------------------------------------------------------------------------
  // Utility Methods
  // --------------------------------------------------------------------------

  /**
   * Get payment requirements without actually paying.
   * Useful for showing the user what they'll pay before confirming.
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
        session_id: 'preview', // Won't actually vote
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

  /**
   * Create a typed error.
   */
  private createError(type: PaymentError['type'], message: string, details?: unknown): PaymentError {
    return { type, message, details };
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
 * React hook for x402 client.
 * Use with wallet context to auto-connect.
 */
export function useX402() {
  const client = getX402Client();
  
  return {
    client,
    isWalletConnected: client.isWalletConnected(),
    walletAddress: client.getWalletAddress(),
    tipClip: client.tipClip.bind(client),
    formatTip: client.formatTip.bind(client),
    defaultTipCents: DEFAULT_CONFIG.defaultTipCents,
    minTipCents: DEFAULT_CONFIG.minTipCents,
  };
}

export default X402Client;
