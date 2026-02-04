# Wallet Signature Verification - Frontend Integration Guide

## Overview

The staking system requires wallet signature verification for all value-changing operations (stake, unstake, claim). This guide explains how to integrate signature verification into your frontend application.

## Architecture

```
Frontend (wallet)  →  Request Nonce  →  API
Frontend (wallet)  →  Sign Message   →  (local)
Frontend (wallet)  →  Submit with Signature  →  API
```

## Required Libraries

```bash
npm install ethers@^6.0.0
# OR
npm install viem wagmi
```

## Step-by-Step Integration

### Step 1: Request a Nonce

Before performing any staking operation, request a fresh nonce from the API:

```typescript
async function requestNonce(
  walletAddress: string,
  operation: 'stake' | 'unstake' | 'claim'
): Promise<NonceResponse> {
  const response = await fetch(
    `/api/v1/staking/nonce?walletAddress=${walletAddress}&operation=${operation}`,
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    }
  );
  
  if (!response.ok) {
    throw new Error('Failed to request nonce');
  }
  
  return await response.json();
}

interface NonceResponse {
  success: boolean;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
  message: SignatureMessage;
  messageToSign: string;
}

interface SignatureMessage {
  domain: string;
  subjectType: string;
  subjectId: string;
  walletAddress: string;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
  chainId: number;
  operation?: string;
}
```

### Step 2: Sign the Message

#### Option A: Using ethers.js

```typescript
import { BrowserProvider } from 'ethers';

async function signMessage(
  messageToSign: string
): Promise<string> {
  // Connect to wallet
  const provider = new BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  
  // Sign the message (EIP-191)
  const signature = await signer.signMessage(messageToSign);
  
  return signature;
}
```

#### Option B: Using wagmi + viem

```typescript
import { useSignMessage } from 'wagmi';

function StakingComponent() {
  const { signMessageAsync } = useSignMessage();
  
  async function sign(messageToSign: string): Promise<string> {
    const signature = await signMessageAsync({
      message: messageToSign
    });
    
    return signature;
  }
}
```

### Step 3: Submit Operation with Signature

```typescript
async function stake(
  poolId: string,
  amountCents: number,
  walletAddress: string,
  signature: string,
  message: SignatureMessage
) {
  const response = await fetch('/api/v1/staking/stake', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      poolId,
      amountCents,
      walletAddress,
      signature,
      message
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }
  
  return await response.json();
}
```

## Complete Examples

### Example 1: Stake Operation

```typescript
async function performStake(
  poolId: string,
  amountCents: number,
  walletAddress: string,
  apiKey: string
) {
  try {
    // Step 1: Request nonce
    const nonceData = await requestNonce(walletAddress, 'stake');
    
    // Step 2: Sign message
    const signature = await signMessage(nonceData.messageToSign);
    
    // Step 3: Submit stake with signature
    const result = await stake(
      poolId,
      amountCents,
      walletAddress,
      signature,
      nonceData.message
    );
    
    console.log('Stake successful:', result);
    return result;
    
  } catch (error) {
    console.error('Stake failed:', error);
    throw error;
  }
}
```

### Example 2: Unstake Operation

```typescript
async function performUnstake(
  stakeId: string,
  walletAddress: string,
  apiKey: string
) {
  try {
    // Step 1: Request nonce
    const nonceData = await requestNonce(walletAddress, 'unstake');
    
    // Step 2: Sign message
    const signature = await signMessage(nonceData.messageToSign);
    
    // Step 3: Submit unstake with signature
    const response = await fetch('/api/v1/staking/unstake', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        stakeId,
        signature,
        message: nonceData.message
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }
    
    return await response.json();
    
  } catch (error) {
    console.error('Unstake failed:', error);
    throw error;
  }
}
```

### Example 3: Claim Rewards

```typescript
async function performClaim(
  stakeId: string,
  walletAddress: string,
  apiKey: string
) {
  try {
    // Step 1: Request nonce
    const nonceData = await requestNonce(walletAddress, 'claim');
    
    // Step 2: Sign message
    const signature = await signMessage(nonceData.messageToSign);
    
    // Step 3: Submit claim with signature
    const response = await fetch('/api/v1/staking/claim', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        stakeId,
        signature,
        message: nonceData.message
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }
    
    return await response.json();
    
  } catch (error) {
    console.error('Claim failed:', error);
    throw error;
  }
}
```

## React Hook Example

```typescript
import { useState } from 'react';
import { useSignMessage } from 'wagmi';

export function useStaking(apiKey: string) {
  const { signMessageAsync } = useSignMessage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  async function stake(
    poolId: string,
    amountCents: number,
    walletAddress: string
  ) {
    setLoading(true);
    setError(null);
    
    try {
      // Request nonce
      const nonceResponse = await fetch(
        `/api/v1/staking/nonce?walletAddress=${walletAddress}&operation=stake`,
        {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        }
      );
      const nonceData = await nonceResponse.json();
      
      // Sign message
      const signature = await signMessageAsync({
        message: nonceData.messageToSign
      });
      
      // Submit stake
      const stakeResponse = await fetch('/api/v1/staking/stake', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          poolId,
          amountCents,
          walletAddress,
          signature,
          message: nonceData.message
        })
      });
      
      if (!stakeResponse.ok) {
        const error = await stakeResponse.json();
        throw new Error(error.message);
      }
      
      return await stakeResponse.json();
      
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }
  
  return { stake, loading, error };
}
```

## Error Handling

### Common Errors

1. **Expired Nonce**
   ```json
   {
     "success": false,
     "error": "Failed to stake",
     "message": "Wallet signature verification failed: Nonce has expired"
   }
   ```
   **Solution**: Request a new nonce and try again

2. **Invalid Signature**
   ```json
   {
     "success": false,
     "error": "Failed to stake",
     "message": "Wallet signature verification failed: Signature verification failed"
   }
   ```
   **Solution**: Ensure the message being signed matches exactly what was returned from the nonce endpoint

3. **Wallet Mismatch**
   ```json
   {
     "success": false,
     "error": "Failed to stake",
     "message": "Wallet signature verification failed: Wallet mismatch"
   }
   ```
   **Solution**: Ensure the wallet address used for signing matches the agent's stored wallet address

4. **Consumed Nonce**
   ```json
   {
     "success": false,
     "error": "Failed to stake",
     "message": "Wallet signature verification failed: Invalid or already consumed nonce"
   }
   ```
   **Solution**: Request a fresh nonce - nonces can only be used once

## Security Best Practices

1. **Never Reuse Nonces**: Always request a fresh nonce for each operation
2. **Check Expiration**: Nonces expire after 5 minutes - don't request too early
3. **Verify Addresses**: Ensure the connected wallet matches the agent's registered wallet
4. **Handle Rejections**: Gracefully handle when users reject the signature request
5. **Secure Storage**: Never store signatures or nonces - always fetch fresh

## Testing

### Test with Development Wallet

```typescript
// Example test using a local development wallet
import { Wallet } from 'ethers';

async function testStaking() {
  // Create test wallet
  const wallet = new Wallet('0x...');  // Development private key
  const address = wallet.address;
  
  // Request nonce
  const nonceData = await requestNonce(address, 'stake');
  
  // Sign message
  const signature = await wallet.signMessage(nonceData.messageToSign);
  
  // Submit
  const result = await stake(
    'pool-id',
    10000, // $100
    address,
    signature,
    nonceData.message
  );
  
  console.log('Test stake:', result);
}
```

## API Reference

### GET /api/v1/staking/nonce

**Query Parameters:**
- `walletAddress` (required): The wallet address to generate nonce for
- `operation` (optional): The operation type ('stake', 'unstake', 'claim')

**Response:**
```json
{
  "success": true,
  "nonce": "64-character-hex-string",
  "issuedAt": 1707076800000,
  "expiresAt": 1707077100000,
  "message": {
    "domain": "molt.studio",
    "subjectType": "agent",
    "subjectId": "agent-uuid",
    "walletAddress": "0x...",
    "nonce": "64-character-hex-string",
    "issuedAt": 1707076800000,
    "expiresAt": 1707077100000,
    "chainId": 8453,
    "operation": "stake"
  },
  "messageToSign": "molt.studio wants you to sign in\n\nDomain: molt.studio\n..."
}
```

### POST /api/v1/staking/stake

**Body:**
```json
{
  "poolId": "pool-uuid",
  "amountCents": 10000,
  "walletAddress": "0x...",
  "signature": "0x...",
  "message": { /* SignatureMessage object from nonce response */ }
}
```

### POST /api/v1/staking/unstake

**Body:**
```json
{
  "stakeId": "stake-uuid",
  "signature": "0x...",
  "message": { /* SignatureMessage object from nonce response */ }
}
```

### POST /api/v1/staking/claim

**Body:**
```json
{
  "stakeId": "stake-uuid",
  "signature": "0x...",
  "message": { /* SignatureMessage object from nonce response */ }
}
```

## Troubleshooting

### Signature Verification Fails

1. Ensure the message being signed is EXACTLY the `messageToSign` value from the nonce response
2. Check that the wallet address matches the agent's registered wallet
3. Verify the nonce hasn't expired (5-minute window)
4. Confirm the nonce hasn't been used already

### "Nonce has expired" Error

- Nonces are valid for 5 minutes
- Request a new nonce if the user takes too long to sign
- Consider implementing a countdown timer in your UI

### Wallet Connection Issues

- Ensure MetaMask or wallet provider is installed
- Check that the wallet is unlocked
- Verify the user is on the correct network (Base mainnet - Chain ID: 8453)

## Support

For issues or questions:
- Check `docs/STAKING_API.md` for API reference
- See `docs/STAKING_SECURITY.md` for security model
- Review `WALLET_SIGNATURE_IMPLEMENTATION_STATUS.md` for implementation details
