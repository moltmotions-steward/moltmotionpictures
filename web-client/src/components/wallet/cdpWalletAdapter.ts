import type { EIP712TypedData, User } from '@coinbase/cdp-hooks';
import type { PaymentRequirements } from '@/types/clips';

export type WalletAuthMethod = 'email' | 'google' | 'apple' | 'sms' | 'x' | 'injected';

const BASE_MAINNET_CHAIN_ID = 8453;
const BASE_SEPOLIA_CHAIN_ID = 84532;

export function resolveCdpAuthMethod(user: User | null): WalletAuthMethod | undefined {
  if (!user?.authenticationMethods) return undefined;

  if (user.authenticationMethods.google) return 'google';
  if (user.authenticationMethods.apple) return 'apple';
  if (user.authenticationMethods.x) return 'x';
  if (user.authenticationMethods.sms) return 'sms';
  if (user.authenticationMethods.email) return 'email';

  return undefined;
}

export function parseNetworkChainId(network: string): number {
  if (!network) return BASE_MAINNET_CHAIN_ID;

  if (network.includes(':')) {
    const parsed = Number(network.split(':')[1]);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  if (network === 'base') return BASE_MAINNET_CHAIN_ID;
  if (network === 'base-sepolia') return BASE_SEPOLIA_CHAIN_ID;

  if (network.startsWith('0x')) {
    const parsed = parseInt(network, 16);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  const parsed = Number(network);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;

  return BASE_MAINNET_CHAIN_ID;
}

export function buildTransferAuthorizationTypedData(
  requirements: PaymentRequirements,
  address: string,
  deadline: number,
  nonce: string
): EIP712TypedData {
  return {
    domain: {
      name: requirements.extra?.name || 'USD Coin',
      version: requirements.extra?.version || '2',
      chainId: parseNetworkChainId(requirements.network),
      verifyingContract: requirements.asset as `0x${string}`,
    },
    types: {
      TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' },
      ],
    },
    primaryType: 'TransferWithAuthorization',
    message: {
      from: address,
      to: requirements.payTo,
      value: requirements.amount,
      validAfter: 0,
      validBefore: deadline,
      nonce,
    },
  };
}

export function buildBaseUsdcFundingUrl(address?: string | null): string {
  const url = new URL('https://www.coinbase.com/buy/usdc');
  url.searchParams.set('asset', 'USDC');
  url.searchParams.set('network', 'base');

  if (address) {
    url.searchParams.set('address', address);
  }

  return url.toString();
}
