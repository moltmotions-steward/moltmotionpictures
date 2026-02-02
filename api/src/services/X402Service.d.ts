/**
 * x402 Payment Requirements - what we expect the client to pay
 */
export interface PaymentRequirements {
    scheme: 'exact';
    network: string;
    amount: string;
    asset: string;
    payTo: string;
    maxTimeoutSeconds: number;
    resource: string;
    description: string;
    mimeType: string;
    extra?: {
        name: string;
        version: string;
    };
}
/**
 * x402 Payment Payload - what the client sends in X-PAYMENT header
 */
export interface PaymentPayload {
    x402Version: 1 | 2;
    scheme?: string;
    network?: string;
    resource?: {
        url: string;
        description: string;
        mimeType: string;
    };
    accepted?: PaymentRequirements;
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
/**
 * Convert cents to USDC smallest unit (6 decimals)
 * $0.25 = 25 cents = 250000 micro-USDC
 */
export declare function centsToUsdcAmount(cents: number): string;
/**
 * Convert USDC amount (6 decimals) to cents
 */
export declare function usdcAmountToCents(amount: string): number;
/**
 * Parse the X-PAYMENT header (base64-encoded JSON)
 */
export declare function parsePaymentHeader(headerValue: string | undefined): PaymentPayload | null;
/**
 * Build payment requirements for a clip vote tip
 */
export declare function buildPaymentRequirements(resourceUrl: string, amountCents: number, description?: string): PaymentRequirements;
/**
 * Verify a payment with the x402 facilitator
 *
 * This is the CRITICAL security function. It calls the Coinbase-hosted
 * facilitator to verify that the payment signature is valid and the
 * client actually has funds to pay.
 *
 * NEVER skip this verification step!
 */
export declare function verifyPayment(paymentPayload: PaymentPayload, paymentRequirements: PaymentRequirements): Promise<VerifyResponse>;
/**
 * Settle a verified payment with the x402 facilitator
 *
 * This actually executes the onchain transfer. Call this AFTER
 * you've provided the resource to the client.
 */
export declare function settlePayment(paymentPayload: PaymentPayload, paymentRequirements: PaymentRequirements): Promise<SettleResponse>;
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
export declare function verifyTipPayment(paymentHeader: string | undefined, resourceUrl: string, tipAmountCents: number, description?: string): Promise<PaymentVerificationResult>;
/**
 * Build the 402 Payment Required response body
 *
 * This is sent to clients when they haven't provided a valid payment.
 * The client should:
 * 1. Parse the payment requirements
 * 2. Sign a payment with their wallet
 * 3. Retry the request with X-PAYMENT header
 */
export declare function buildPaymentRequiredResponse(tipAmountCents: number, resourceUrl: string, clipVariantId: string): {
    x402Version: number;
    error: string;
    accepts: PaymentRequirements[];
    payment_details: {
        amount_cents: number;
        amount_usdc: string;
        currency: string;
        network: string;
        clip_variant_id: string;
        splits: {
            creator_percent: number;
            platform_percent: number;
            agent_percent: number;
        };
    };
    message: string;
};
export declare const X402Constants: {
    readonly NETWORK: "eip155:8453" | "eip155:84532";
    readonly USDC_ADDRESS: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" | "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
    readonly USDC_DECIMALS: 6;
    readonly FACILITATOR_URL: string;
    readonly IS_PRODUCTION: boolean;
};
declare const _default: {
    verifyTipPayment: typeof verifyTipPayment;
    verifyPayment: typeof verifyPayment;
    settlePayment: typeof settlePayment;
    parsePaymentHeader: typeof parsePaymentHeader;
    buildPaymentRequirements: typeof buildPaymentRequirements;
    buildPaymentRequiredResponse: typeof buildPaymentRequiredResponse;
    centsToUsdcAmount: typeof centsToUsdcAmount;
    usdcAmountToCents: typeof usdcAmountToCents;
    X402Constants: {
        readonly NETWORK: "eip155:8453" | "eip155:84532";
        readonly USDC_ADDRESS: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" | "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
        readonly USDC_DECIMALS: 6;
        readonly FACILITATOR_URL: string;
        readonly IS_PRODUCTION: boolean;
    };
};
export default _default;
//# sourceMappingURL=X402Service.d.ts.map