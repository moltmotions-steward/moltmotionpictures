/**
 * X402 Payment Verification Service
 * 
 * Implements secure payment verification via the x402 protocol.
 * This service:
 * 1. Parses the X-PAYMENT header from client requests
 * 2. Builds payment requirements matching what we expect
 * 3. Calls the Coinbase facilitator to verify the payment
 * 4. Returns verified payer address or detailed error
 * 
 * SECURITY: This is the heart of payment verification.
 * NEVER accept a payment without facilitator confirmation.
 * NEVER trust client-provided tx hashes without verification.
 * 
 * @see https://docs.cdp.coinbase.com/x402/
 */
import config from '../config/index.js';

// ============================================================================
// Types
// ============================================================================

/**
 * x402 Payment Requirements - what we expect the client to pay
 */
export interface PaymentRequirements {
  scheme: 'exact';
  network: string; // e.g., 'eip155:8453' for Base mainnet, 'eip155:84532' for Base Sepolia
  amount: string; // Amount in smallest unit (e.g., '25000' for $0.025 USDC with 6 decimals)
  asset: string; // USDC contract address
  payTo: string; // Platform wallet address
  maxTimeoutSeconds: number;
  resource: string; // Resource URL being accessed
  description: string;
  mimeType: string;
  extra?: {
    name: string; // 'USDC'
    version: string; // EIP-3009 version
  };
}

/**
 * x402 Payment Payload - what the client sends in X-PAYMENT header
 */
export interface PaymentPayload {
  x402Version: 1 | 2;
  scheme?: string; // V1
  network?: string; // V1
  resource?: {
    url: string;
    description: string;
    mimeType: string;
  };
  accepted?: PaymentRequirements; // V2
  payload: {
    signature: string;
    authorization: {
      from: string;
      to: string;
      value: string;
      validAfter: string;
      validBefore: string;
      nonce: string;
    };
  };
}

/**
 * Verification response from the facilitator
 */
export interface VerifyResponse {
  isValid: boolean;
  payer: string;
  invalidReason?: string;
}

/**
 * Settlement response from the facilitator
 */
export interface SettleResponse {
  success: boolean;
  transactionHash?: string;
  error?: string;
}

/**
 * Full verification result for internal use
 */
export interface PaymentVerificationResult {
  verified: boolean;
  payer?: string;
  error?: string;
  errorCode?: string;
  paymentPayload?: PaymentPayload;
  requirements?: PaymentRequirements;
}

// ============================================================================
// Configuration Constants
// ============================================================================

// Base network identifiers (CAIP-2 format)
const NETWORK_BASE_MAINNET = 'eip155:8453';
const NETWORK_BASE_SEPOLIA = 'eip155:84532';

// USDC contract addresses
const USDC_BASE_MAINNET = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const USDC_BASE_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

// Use testnet in development, mainnet in production
const IS_PRODUCTION = config.nodeEnv === 'production';
const NETWORK = IS_PRODUCTION ? NETWORK_BASE_MAINNET : NETWORK_BASE_SEPOLIA;
const USDC_ADDRESS = IS_PRODUCTION ? USDC_BASE_MAINNET : USDC_BASE_SEPOLIA;

// x402 facilitator URL (Coinbase hosted)
const FACILITATOR_URL = config.x402.facilitatorUrl || 'https://api.cdp.coinbase.com/platform/v2/x402';

// USDC has 6 decimals
const USDC_DECIMALS = 6;

// ============================================================================
// CDP API Authentication
// ============================================================================

/**
 * Generate a CDP API Bearer token for facilitator requests.
 * Uses ES256 JWT signing as per CDP API v2 authentication spec.
 * @see https://docs.cdp.coinbase.com/api-reference/v2/authentication
 */
async function getCDPAuthHeaders(): Promise<Record<string, string>> {
  const cdpApiKey = config.cdp.apiKeyName;
  const cdpApiSecret = config.cdp.apiKeySecret;
  
  if (!cdpApiKey || !cdpApiSecret) {
    console.warn('[X402] CDP API credentials not configured - verification may fail');
    return { 'Content-Type': 'application/json' };
  }
  
  // Build JWT for CDP API authentication
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: 'ES256',
    kid: cdpApiKey,
    typ: 'JWT',
    nonce: crypto.randomUUID(),
  };
  
  const payload = {
    iss: 'cdp',
    sub: cdpApiKey,
    aud: ['cdp_service'],
    nbf: now,
    exp: now + 120, // 2 minute expiry
    uris: [`${FACILITATOR_URL}/verify`, `${FACILITATOR_URL}/settle`],
  };
  
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  
  // CDP API secret is base64-encoded raw EC private key bytes (not PEM)
  // Convert to PKCS8 DER format for Web Crypto API
  const rawKeyBytes = Buffer.from(cdpApiSecret, 'base64');
  const privateKey = await crypto.subtle.importKey(
    'raw',
    rawKeyBytes,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  ).catch(async () => {
    // Fallback: try as PKCS8 if raw import fails
    return crypto.subtle.importKey(
      'pkcs8',
      rawKeyBytes,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign']
    );
  });
  
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(signingInput)
  );
  
  const encodedSignature = Buffer.from(signature).toString('base64url');
  const jwt = `${signingInput}.${encodedSignature}`;
  
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${jwt}`,
  };
}

/**
 * Convert ECDSA signature from DER/P1363 to compact R||S format for JWT
 */
function signatureToCompact(signature: ArrayBuffer): Uint8Array {
  const sig = new Uint8Array(signature);
  // If already 64 bytes (R||S format), return as-is
  if (sig.length === 64) return sig;
  
  // Web Crypto returns P1363 format (R || S, each 32 bytes for P-256)
  // This is already the correct format for ES256 JWT
  return sig;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert cents to USDC smallest unit (6 decimals)
 * $0.25 = 25 cents = 250000 micro-USDC
 */
export function centsToUsdcAmount(cents: number): string {
  // 1 cent = 0.01 USDC = 10000 micro-USDC (with 6 decimals)
  const microUsdc = cents * 10000;
  return microUsdc.toString();
}

/**
 * Convert USDC amount (6 decimals) to cents
 */
export function usdcAmountToCents(amount: string): number {
  const microUsdc = BigInt(amount);
  const cents = Number(microUsdc / 10000n);
  return cents;
}

/**
 * Parse the X-PAYMENT header (base64-encoded JSON)
 */
export function parsePaymentHeader(headerValue: string | undefined): PaymentPayload | null {
  if (!headerValue) {
    return null;
  }
  
  try {
    // The header may be base64-encoded or raw JSON
    let jsonString: string;
    
    // Try to detect if it's base64
    if (headerValue.startsWith('{')) {
      // Raw JSON
      jsonString = headerValue;
    } else {
      // Base64 encoded
      jsonString = Buffer.from(headerValue, 'base64').toString('utf-8');
    }
    
    const payload = JSON.parse(jsonString) as PaymentPayload;
    
    // Basic validation
    if (!payload.x402Version || !payload.payload) {
      console.error('[X402] Invalid payment payload structure');
      return null;
    }
    
    return payload;
  } catch (error) {
    console.error('[X402] Failed to parse payment header:', error);
    return null;
  }
}

// ============================================================================
// Payment Requirements Builder
// ============================================================================

/**
 * Build payment requirements for a clip vote tip
 */
export function buildPaymentRequirements(
  resourceUrl: string,
  amountCents: number,
  description: string = 'Clip vote tip'
): PaymentRequirements {
  const platformWallet = config.x402.platformWallet;
  
  // In mock mode (testing without real wallets), use a clearly fake address
  const effectiveWallet = platformWallet || (config.x402.mockMode ? '0x0000000000000000000000000000000000000000' : null);
  
  if (!effectiveWallet) {
    throw new Error('Platform wallet not configured - set PLATFORM_WALLET_ADDRESS environment variable');
  }
  
  return {
    scheme: 'exact',
    network: NETWORK,
    amount: centsToUsdcAmount(amountCents),
    asset: USDC_ADDRESS,
    payTo: effectiveWallet,
    maxTimeoutSeconds: 300, // 5 minutes
    resource: resourceUrl,
    description,
    mimeType: 'application/json',
    extra: {
      name: 'USDC',
      version: '2', // EIP-3009 version
    },
  };
}

// ============================================================================
// Facilitator API Calls
// ============================================================================

/**
 * Verify a payment with the x402 facilitator
 * 
 * This is the CRITICAL security function. It calls the Coinbase-hosted
 * facilitator to verify that the payment signature is valid and the
 * client actually has funds to pay.
 * 
 * NEVER skip this verification step!
 */
export async function verifyPayment(
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements
): Promise<VerifyResponse> {
  const headers = await getCDPAuthHeaders();
  
  const requestBody = {
    x402Version: paymentPayload.x402Version,
    paymentPayload,
    paymentRequirements,
  };
  
  console.log('[X402] Verifying payment with facilitator...');
  console.log('[X402] Payer:', paymentPayload.payload?.authorization?.from);
  console.log('[X402] Amount:', paymentRequirements.amount, 'micro-USDC');
  
  try {
    const response = await fetch(`${FACILITATOR_URL}/verify`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });
    
    const data = await response.json() as Record<string, unknown> | null;
    
    if (response.status === 200 && data && typeof data === 'object' && 'isValid' in data) {
      const result = data as unknown as VerifyResponse;
      
      if (result.isValid) {
        console.log('[X402] Payment verified successfully');
        console.log('[X402] Payer address:', result.payer);
      } else {
        console.warn('[X402] Payment verification failed:', result.invalidReason);
      }
      
      return result;
    }
    
    // Non-200 response
    console.error('[X402] Facilitator returned error:', response.status, data);
    return {
      isValid: false,
      payer: paymentPayload.payload?.authorization?.from || '',
      invalidReason: `facilitator_error_${response.status}`,
    };
  } catch (error) {
    console.error('[X402] Facilitator request failed:', error);
    return {
      isValid: false,
      payer: paymentPayload.payload?.authorization?.from || '',
      invalidReason: 'facilitator_unreachable',
    };
  }
}

/**
 * Settle a verified payment with the x402 facilitator
 * 
 * This actually executes the onchain transfer. Call this AFTER
 * you've provided the resource to the client.
 */
export async function settlePayment(
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements
): Promise<SettleResponse> {
  const headers = await getCDPAuthHeaders();
  
  const requestBody = {
    x402Version: paymentPayload.x402Version,
    paymentPayload,
    paymentRequirements,
  };
  
  console.log('[X402] Settling payment with facilitator...');
  
  try {
    const response = await fetch(`${FACILITATOR_URL}/settle`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });
    
    const data = await response.json() as Record<string, unknown>;
    
    if (response.status === 200) {
      console.log('[X402] Payment settled successfully');
      return {
        success: true,
        transactionHash: data.transactionHash as string | undefined,
      };
    }
    
    console.error('[X402] Settlement failed:', response.status, data);
    return {
      success: false,
      error: (data.error as string) || `settlement_error_${response.status}`,
    };
  } catch (error) {
    console.error('[X402] Settlement request failed:', error);
    return {
      success: false,
      error: 'settlement_unreachable',
    };
  }
}

// ============================================================================
// High-Level Verification Workflow
// ============================================================================

/**
 * Complete payment verification workflow for a tip request
 * 
 * This is the main entry point for verifying a tip payment.
 * It:
 * 1. Parses the X-PAYMENT header
 * 2. Builds payment requirements
 * 3. Verifies with the facilitator
 * 4. Returns a structured result
 * 
 * Usage in route handler:
 * ```typescript
 * const result = await verifyTipPayment(
 *   req.headers['x-payment'],
 *   resourceUrl,
 *   tipAmountCents
 * );
 * 
 * if (!result.verified) {
 *   res.status(402).json({
 *     error: 'Payment Required',
 *     ...buildPaymentRequiredResponse(tipAmountCents, resourceUrl)
 *   });
 *   return;
 * }
 * 
 * // Payment verified! Process the vote...
 * ```
 */
export async function verifyTipPayment(
  paymentHeader: string | undefined,
  resourceUrl: string,
  tipAmountCents: number,
  description?: string
): Promise<PaymentVerificationResult> {
  // Step 1: Parse the payment header
  const paymentPayload = parsePaymentHeader(paymentHeader);
  
  if (!paymentPayload) {
    return {
      verified: false,
      error: 'No payment provided',
      errorCode: 'no_payment',
    };
  }
  
  // Step 2: Build requirements
  const requirements = buildPaymentRequirements(resourceUrl, tipAmountCents, description);
  
  // Step 3: Verify with facilitator
  const verifyResult = await verifyPayment(paymentPayload, requirements);
  
  if (!verifyResult.isValid) {
    return {
      verified: false,
      payer: verifyResult.payer,
      error: verifyResult.invalidReason || 'verification_failed',
      errorCode: verifyResult.invalidReason,
      paymentPayload,
      requirements,
    };
  }
  
  // Step 4: Success!
  return {
    verified: true,
    payer: verifyResult.payer,
    paymentPayload,
    requirements,
  };
}

// ============================================================================
// 402 Response Builder
// ============================================================================

/**
 * Build the 402 Payment Required response body
 * 
 * This is sent to clients when they haven't provided a valid payment.
 * The client should:
 * 1. Parse the payment requirements
 * 2. Sign a payment with their wallet
 * 3. Retry the request with X-PAYMENT header
 */
export function buildPaymentRequiredResponse(
  tipAmountCents: number,
  resourceUrl: string,
  clipVariantId: string
) {
  const requirements = buildPaymentRequirements(resourceUrl, tipAmountCents);
  
  return {
    x402Version: 2,
    error: 'Payment Required',
    accepts: [requirements],
    payment_details: {
      amount_cents: tipAmountCents,
      amount_usdc: (tipAmountCents / 100).toFixed(2),
      currency: 'USDC',
      network: IS_PRODUCTION ? 'Base' : 'Base Sepolia',
      clip_variant_id: clipVariantId,
      splits: {
        creator_percent: config.revenueSplit.creatorPercent,
        platform_percent: config.revenueSplit.platformPercent,
        agent_percent: config.revenueSplit.agentPercent,
      },
    },
    message: 'Vote with your wallet. Sign the payment and retry with X-PAYMENT header.',
  };
}

// ============================================================================
// Utility Exports
// ============================================================================

export const X402Constants = {
  NETWORK,
  USDC_ADDRESS,
  USDC_DECIMALS,
  FACILITATOR_URL,
  IS_PRODUCTION,
} as const;

export default {
  verifyTipPayment,
  verifyPayment,
  settlePayment,
  parsePaymentHeader,
  buildPaymentRequirements,
  buildPaymentRequiredResponse,
  centsToUsdcAmount,
  usdcAmountToCents,
  X402Constants,
};
