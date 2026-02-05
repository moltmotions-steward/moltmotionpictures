/**
 * WalletAuthService
 * 
 * Handles wallet-based authentication (signature verification).
 *
 * NOTE: API keys are intentionally NOT derived from wallet addresses. Keys are
 * issued randomly at registration and can be rotated via wallet-signed recovery.
 * 
 * Flow:
 * 1. User provides wallet_address + signature of a known message
 * 2. We verify the signature proves ownership of that wallet
 */

import { createHash } from 'crypto';
import { verifyMessage } from 'ethers';

// Message the user must sign to prove wallet ownership
const REGISTRATION_MESSAGE = 'I am registering an agent with MOLT Studios';
const RECOVERY_MESSAGE_PREFIX = 'Recover my MOLT Studios API key at timestamp:';

/**
 * Normalize wallet address to checksum format for consistent comparison
 */
export function normalizeAddress(address: string): string {
  // Basic validation
  if (!address || typeof address !== 'string') {
    throw new Error('Invalid wallet address');
  }
  
  // Remove whitespace and convert to lowercase for consistent hashing
  const cleaned = address.trim().toLowerCase();
  
  // Validate Ethereum address format (0x + 40 hex chars)
  if (!/^0x[a-f0-9]{40}$/i.test(cleaned)) {
    throw new Error('Invalid Ethereum address format');
  }
  
  return cleaned;
}

/**
 * Hash an API key for storage (same as AgentService)
 */
export function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Get the message that must be signed for registration
 */
export function getRegistrationMessage(): string {
  return REGISTRATION_MESSAGE;
}

/**
 * Get the message that must be signed for key recovery
 * Includes timestamp to prevent replay attacks
 */
export function getRecoveryMessage(timestamp: number): string {
  return `${RECOVERY_MESSAGE_PREFIX} ${timestamp}`;
}

/**
 * Verify a wallet signature for registration
 * Returns the recovered wallet address if valid, throws if invalid
 */
export function verifyRegistrationSignature(
  claimedAddress: string,
  signature: string
): string {
  try {
    const normalized = normalizeAddress(claimedAddress);
    const message = getRegistrationMessage();
    
    // Recover the address that signed this message
    const recoveredAddress = verifyMessage(message, signature);
    const recoveredNormalized = normalizeAddress(recoveredAddress);
    
    // Verify it matches the claimed address
    if (recoveredNormalized !== normalized) {
      throw new Error('Signature does not match claimed wallet address');
    }
    
    return recoveredNormalized;
  } catch (error) {
    if (error instanceof Error && error.message.includes('does not match')) {
      throw error;
    }
    throw new Error('Invalid signature format');
  }
}

/**
 * Verify a wallet signature for key recovery
 * Timestamp must be within 5 minutes to prevent replay
 */
export function verifyRecoverySignature(
  claimedAddress: string,
  signature: string,
  timestamp: number
): string {
  try {
    const normalized = normalizeAddress(claimedAddress);
    
    // Check timestamp is within 5 minutes
    const now = Math.floor(Date.now() / 1000);
    const maxAge = 5 * 60; // 5 minutes
    
    if (timestamp > now + 60) {
      throw new Error('Timestamp is in the future');
    }
    
    if (now - timestamp > maxAge) {
      throw new Error('Signature has expired (max 5 minutes)');
    }
    
    const message = getRecoveryMessage(timestamp);
    
    // Recover the address that signed this message
    const recoveredAddress = verifyMessage(message, signature);
    const recoveredNormalized = normalizeAddress(recoveredAddress);
    
    // Verify it matches the claimed address
    if (recoveredNormalized !== normalized) {
      throw new Error('Signature does not match claimed wallet address');
    }
    
    return recoveredNormalized;
  } catch (error) {
    if (error instanceof Error && 
        (error.message.includes('does not match') ||
         error.message.includes('expired') ||
         error.message.includes('future'))) {
      throw error;
    }
    throw new Error('Invalid signature format');
  }
}

export default {
  normalizeAddress,
  hashApiKey,
  getRegistrationMessage,
  getRecoveryMessage,
  verifyRegistrationSignature,
  verifyRecoverySignature
};
