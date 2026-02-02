"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.X402Constants = void 0;
exports.centsToUsdcAmount = centsToUsdcAmount;
exports.usdcAmountToCents = usdcAmountToCents;
exports.parsePaymentHeader = parsePaymentHeader;
exports.buildPaymentRequirements = buildPaymentRequirements;
exports.verifyPayment = verifyPayment;
exports.settlePayment = settlePayment;
exports.verifyTipPayment = verifyTipPayment;
exports.buildPaymentRequiredResponse = buildPaymentRequiredResponse;
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
const index_js_1 = __importDefault(require("../config/index.js"));
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
const IS_PRODUCTION = index_js_1.default.nodeEnv === 'production';
const NETWORK = IS_PRODUCTION ? NETWORK_BASE_MAINNET : NETWORK_BASE_SEPOLIA;
const USDC_ADDRESS = IS_PRODUCTION ? USDC_BASE_MAINNET : USDC_BASE_SEPOLIA;
// x402 facilitator URL (Coinbase hosted)
const FACILITATOR_URL = index_js_1.default.x402.facilitatorUrl || 'https://api.cdp.coinbase.com/platform/v2/x402';
// USDC has 6 decimals
const USDC_DECIMALS = 6;
// ============================================================================
// CDP API Authentication
// ============================================================================
/**
 * Generate a CDP API Bearer token for facilitator requests.
 * In production, this would use your CDP API key to sign a JWT.
 * For now, we'll use environment variable for the API key.
 */
async function getCDPAuthHeaders() {
    const cdpApiKey = process.env.CDP_API_KEY_NAME;
    const cdpApiSecret = process.env.CDP_API_KEY_SECRET;
    if (!cdpApiKey || !cdpApiSecret) {
        console.warn('[X402] CDP API credentials not configured - verification may fail');
        return { 'Content-Type': 'application/json' };
    }
    // TODO: Implement proper JWT signing for CDP API
    // For now, use the API key directly (not recommended for production)
    // See: https://docs.cdp.coinbase.com/api-reference/v2/authentication
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cdpApiSecret}`,
    };
}
// ============================================================================
// Helper Functions
// ============================================================================
/**
 * Convert cents to USDC smallest unit (6 decimals)
 * $0.25 = 25 cents = 250000 micro-USDC
 */
function centsToUsdcAmount(cents) {
    // 1 cent = 0.01 USDC = 10000 micro-USDC (with 6 decimals)
    const microUsdc = cents * 10000;
    return microUsdc.toString();
}
/**
 * Convert USDC amount (6 decimals) to cents
 */
function usdcAmountToCents(amount) {
    const microUsdc = BigInt(amount);
    const cents = Number(microUsdc / 10000n);
    return cents;
}
/**
 * Parse the X-PAYMENT header (base64-encoded JSON)
 */
function parsePaymentHeader(headerValue) {
    if (!headerValue) {
        return null;
    }
    try {
        // The header may be base64-encoded or raw JSON
        let jsonString;
        // Try to detect if it's base64
        if (headerValue.startsWith('{')) {
            // Raw JSON
            jsonString = headerValue;
        }
        else {
            // Base64 encoded
            jsonString = Buffer.from(headerValue, 'base64').toString('utf-8');
        }
        const payload = JSON.parse(jsonString);
        // Basic validation
        if (!payload.x402Version || !payload.payload) {
            console.error('[X402] Invalid payment payload structure');
            return null;
        }
        return payload;
    }
    catch (error) {
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
function buildPaymentRequirements(resourceUrl, amountCents, description = 'Clip vote tip') {
    const platformWallet = index_js_1.default.x402.platformWallet;
    if (!platformWallet) {
        throw new Error('Platform wallet not configured');
    }
    return {
        scheme: 'exact',
        network: NETWORK,
        amount: centsToUsdcAmount(amountCents),
        asset: USDC_ADDRESS,
        payTo: platformWallet,
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
async function verifyPayment(paymentPayload, paymentRequirements) {
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
        const data = await response.json();
        if (response.status === 200 && data && typeof data === 'object' && 'isValid' in data) {
            const result = data;
            if (result.isValid) {
                console.log('[X402] Payment verified successfully');
                console.log('[X402] Payer address:', result.payer);
            }
            else {
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
    }
    catch (error) {
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
async function settlePayment(paymentPayload, paymentRequirements) {
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
        const data = await response.json();
        if (response.status === 200) {
            console.log('[X402] Payment settled successfully');
            return {
                success: true,
                transactionHash: data.transactionHash,
            };
        }
        console.error('[X402] Settlement failed:', response.status, data);
        return {
            success: false,
            error: data.error || `settlement_error_${response.status}`,
        };
    }
    catch (error) {
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
async function verifyTipPayment(paymentHeader, resourceUrl, tipAmountCents, description) {
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
function buildPaymentRequiredResponse(tipAmountCents, resourceUrl, clipVariantId) {
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
                creator_percent: index_js_1.default.revenueSplit.creatorPercent,
                platform_percent: index_js_1.default.revenueSplit.platformPercent,
                agent_percent: index_js_1.default.revenueSplit.agentPercent,
            },
        },
        message: 'Vote with your wallet. Sign the payment and retry with X-PAYMENT header.',
    };
}
// ============================================================================
// Utility Exports
// ============================================================================
exports.X402Constants = {
    NETWORK,
    USDC_ADDRESS,
    USDC_DECIMALS,
    FACILITATOR_URL,
    IS_PRODUCTION,
};
exports.default = {
    verifyTipPayment,
    verifyPayment,
    settlePayment,
    parsePaymentHeader,
    buildPaymentRequirements,
    buildPaymentRequiredResponse,
    centsToUsdcAmount,
    usdcAmountToCents,
    X402Constants: exports.X402Constants,
};
//# sourceMappingURL=X402Service.js.map