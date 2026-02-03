"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
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
var index_js_1 = require("../config/index.js");
// ============================================================================
// Configuration Constants
// ============================================================================
// Base network identifiers (CAIP-2 format)
var NETWORK_BASE_MAINNET = 'eip155:8453';
var NETWORK_BASE_SEPOLIA = 'eip155:84532';
// USDC contract addresses
var USDC_BASE_MAINNET = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
var USDC_BASE_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
// Use testnet in development, mainnet in production
var IS_PRODUCTION = index_js_1.default.nodeEnv === 'production';
var NETWORK = IS_PRODUCTION ? NETWORK_BASE_MAINNET : NETWORK_BASE_SEPOLIA;
var USDC_ADDRESS = IS_PRODUCTION ? USDC_BASE_MAINNET : USDC_BASE_SEPOLIA;
// x402 facilitator URL (Coinbase hosted)
var FACILITATOR_URL = index_js_1.default.x402.facilitatorUrl || 'https://api.cdp.coinbase.com/platform/v2/x402';
// USDC has 6 decimals
var USDC_DECIMALS = 6;
// ============================================================================
// CDP API Authentication
// ============================================================================
/**
 * Generate a CDP API Bearer token for facilitator requests.
 * In production, this would use your CDP API key to sign a JWT.
 * For now, we'll use environment variable for the API key.
 */
function getCDPAuthHeaders() {
    return __awaiter(this, void 0, void 0, function () {
        var cdpApiKey, cdpApiSecret;
        return __generator(this, function (_a) {
            cdpApiKey = process.env.CDP_API_KEY_NAME;
            cdpApiSecret = process.env.CDP_API_KEY_SECRET;
            if (!cdpApiKey || !cdpApiSecret) {
                console.warn('[X402] CDP API credentials not configured - verification may fail');
                return [2 /*return*/, { 'Content-Type': 'application/json' }];
            }
            // TODO: Implement proper JWT signing for CDP API
            // For now, use the API key directly (not recommended for production)
            // See: https://docs.cdp.coinbase.com/api-reference/v2/authentication
            return [2 /*return*/, {
                    'Content-Type': 'application/json',
                    'Authorization': "Bearer ".concat(cdpApiSecret),
                }];
        });
    });
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
    var microUsdc = cents * 10000;
    return microUsdc.toString();
}
/**
 * Convert USDC amount (6 decimals) to cents
 */
function usdcAmountToCents(amount) {
    var microUsdc = BigInt(amount);
    var cents = Number(microUsdc / 10000n);
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
        var jsonString = void 0;
        // Try to detect if it's base64
        if (headerValue.startsWith('{')) {
            // Raw JSON
            jsonString = headerValue;
        }
        else {
            // Base64 encoded
            jsonString = Buffer.from(headerValue, 'base64').toString('utf-8');
        }
        var payload = JSON.parse(jsonString);
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
function buildPaymentRequirements(resourceUrl, amountCents, description) {
    if (description === void 0) { description = 'Clip vote tip'; }
    var platformWallet = index_js_1.default.x402.platformWallet;
    // In mock mode (testing without real wallets), use a clearly fake address
    var isMockMode = process.env.X402_MOCK_MODE === 'true';
    var effectiveWallet = platformWallet || (isMockMode ? '0x0000000000000000000000000000000000000000' : null);
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
        description: description,
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
function verifyPayment(paymentPayload, paymentRequirements) {
    return __awaiter(this, void 0, void 0, function () {
        var headers, requestBody, response, data, result, error_1;
        var _a, _b, _c, _d, _e, _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0: return [4 /*yield*/, getCDPAuthHeaders()];
                case 1:
                    headers = _g.sent();
                    requestBody = {
                        x402Version: paymentPayload.x402Version,
                        paymentPayload: paymentPayload,
                        paymentRequirements: paymentRequirements,
                    };
                    console.log('[X402] Verifying payment with facilitator...');
                    console.log('[X402] Payer:', (_b = (_a = paymentPayload.payload) === null || _a === void 0 ? void 0 : _a.authorization) === null || _b === void 0 ? void 0 : _b.from);
                    console.log('[X402] Amount:', paymentRequirements.amount, 'micro-USDC');
                    _g.label = 2;
                case 2:
                    _g.trys.push([2, 5, , 6]);
                    return [4 /*yield*/, fetch("".concat(FACILITATOR_URL, "/verify"), {
                            method: 'POST',
                            headers: headers,
                            body: JSON.stringify(requestBody),
                        })];
                case 3:
                    response = _g.sent();
                    return [4 /*yield*/, response.json()];
                case 4:
                    data = _g.sent();
                    if (response.status === 200 && data && typeof data === 'object' && 'isValid' in data) {
                        result = data;
                        if (result.isValid) {
                            console.log('[X402] Payment verified successfully');
                            console.log('[X402] Payer address:', result.payer);
                        }
                        else {
                            console.warn('[X402] Payment verification failed:', result.invalidReason);
                        }
                        return [2 /*return*/, result];
                    }
                    // Non-200 response
                    console.error('[X402] Facilitator returned error:', response.status, data);
                    return [2 /*return*/, {
                            isValid: false,
                            payer: ((_d = (_c = paymentPayload.payload) === null || _c === void 0 ? void 0 : _c.authorization) === null || _d === void 0 ? void 0 : _d.from) || '',
                            invalidReason: "facilitator_error_".concat(response.status),
                        }];
                case 5:
                    error_1 = _g.sent();
                    console.error('[X402] Facilitator request failed:', error_1);
                    return [2 /*return*/, {
                            isValid: false,
                            payer: ((_f = (_e = paymentPayload.payload) === null || _e === void 0 ? void 0 : _e.authorization) === null || _f === void 0 ? void 0 : _f.from) || '',
                            invalidReason: 'facilitator_unreachable',
                        }];
                case 6: return [2 /*return*/];
            }
        });
    });
}
/**
 * Settle a verified payment with the x402 facilitator
 *
 * This actually executes the onchain transfer. Call this AFTER
 * you've provided the resource to the client.
 */
function settlePayment(paymentPayload, paymentRequirements) {
    return __awaiter(this, void 0, void 0, function () {
        var headers, requestBody, response, data, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getCDPAuthHeaders()];
                case 1:
                    headers = _a.sent();
                    requestBody = {
                        x402Version: paymentPayload.x402Version,
                        paymentPayload: paymentPayload,
                        paymentRequirements: paymentRequirements,
                    };
                    console.log('[X402] Settling payment with facilitator...');
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 5, , 6]);
                    return [4 /*yield*/, fetch("".concat(FACILITATOR_URL, "/settle"), {
                            method: 'POST',
                            headers: headers,
                            body: JSON.stringify(requestBody),
                        })];
                case 3:
                    response = _a.sent();
                    return [4 /*yield*/, response.json()];
                case 4:
                    data = _a.sent();
                    if (response.status === 200) {
                        console.log('[X402] Payment settled successfully');
                        return [2 /*return*/, {
                                success: true,
                                transactionHash: data.transactionHash,
                            }];
                    }
                    console.error('[X402] Settlement failed:', response.status, data);
                    return [2 /*return*/, {
                            success: false,
                            error: data.error || "settlement_error_".concat(response.status),
                        }];
                case 5:
                    error_2 = _a.sent();
                    console.error('[X402] Settlement request failed:', error_2);
                    return [2 /*return*/, {
                            success: false,
                            error: 'settlement_unreachable',
                        }];
                case 6: return [2 /*return*/];
            }
        });
    });
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
function verifyTipPayment(paymentHeader, resourceUrl, tipAmountCents, description) {
    return __awaiter(this, void 0, void 0, function () {
        var paymentPayload, requirements, verifyResult;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    paymentPayload = parsePaymentHeader(paymentHeader);
                    if (!paymentPayload) {
                        return [2 /*return*/, {
                                verified: false,
                                error: 'No payment provided',
                                errorCode: 'no_payment',
                            }];
                    }
                    requirements = buildPaymentRequirements(resourceUrl, tipAmountCents, description);
                    return [4 /*yield*/, verifyPayment(paymentPayload, requirements)];
                case 1:
                    verifyResult = _a.sent();
                    if (!verifyResult.isValid) {
                        return [2 /*return*/, {
                                verified: false,
                                payer: verifyResult.payer,
                                error: verifyResult.invalidReason || 'verification_failed',
                                errorCode: verifyResult.invalidReason,
                                paymentPayload: paymentPayload,
                                requirements: requirements,
                            }];
                    }
                    // Step 4: Success!
                    return [2 /*return*/, {
                            verified: true,
                            payer: verifyResult.payer,
                            paymentPayload: paymentPayload,
                            requirements: requirements,
                        }];
            }
        });
    });
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
    var requirements = buildPaymentRequirements(resourceUrl, tipAmountCents);
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
    NETWORK: NETWORK,
    USDC_ADDRESS: USDC_ADDRESS,
    USDC_DECIMALS: USDC_DECIMALS,
    FACILITATOR_URL: FACILITATOR_URL,
    IS_PRODUCTION: IS_PRODUCTION,
};
exports.default = {
    verifyTipPayment: verifyTipPayment,
    verifyPayment: verifyPayment,
    settlePayment: settlePayment,
    parsePaymentHeader: parsePaymentHeader,
    buildPaymentRequirements: buildPaymentRequirements,
    buildPaymentRequiredResponse: buildPaymentRequiredResponse,
    centsToUsdcAmount: centsToUsdcAmount,
    usdcAmountToCents: usdcAmountToCents,
    X402Constants: exports.X402Constants,
};
