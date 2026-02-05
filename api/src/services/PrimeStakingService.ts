import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import config from '../config/index.js';
import { CoinbasePrimeClient } from './CoinbasePrimeClient.js';
import type { CoinbasePrimeCredentials } from './CoinbasePrimeClient.js';
import { decryptString, encryptString, loadVaultKeyFromEnv } from '../utils/cryptoVault.js';

const prisma = new PrismaClient();

const WEI_PER_ETH = 10n ** 18n;
const MIN_STAKE_WEI = 32n * WEI_PER_ETH;
const MIN_UNSTAKE_WEI = 1n * WEI_PER_ETH;

function weiToEthDecimal(wei: bigint): string {
  const sign = wei < 0n ? '-' : '';
  const abs = wei < 0n ? -wei : wei;
  const whole = abs / WEI_PER_ETH;
  const frac = abs % WEI_PER_ETH;
  if (frac === 0n) return `${sign}${whole.toString()}`;
  const fracStr = frac.toString().padStart(18, '0').replace(/0+$/, '');
  return `${sign}${whole.toString()}.${fracStr}`;
}

function ethDecimalToWei(amount: string): bigint {
  const trimmed = amount.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error('Invalid ETH amount format');
  }

  const [whole, frac = ''] = trimmed.split('.');
  const fracPadded = (frac + '0'.repeat(18)).slice(0, 18);
  return BigInt(whole) * WEI_PER_ETH + BigInt(fracPadded);
}

export interface PrimeStakeParams {
  agentId: string;
  amountWei: bigint;
  idempotencyKey?: string;
}

export interface PrimeUnstakeParams {
  agentId: string;
  amountWei: bigint;
  idempotencyKey?: string;
}

export interface PrimeClaimParams {
  agentId: string;
  amountWei?: bigint;
  idempotencyKey?: string;
}

export async function upsertPrimeAgentBinding(params: {
  agentId: string;
  portfolioId: string;
  walletId: string;
  accessKey: string;
  passphrase: string;
  signingKey: string;
}) {
  const vaultKey = loadVaultKeyFromEnv(config.coinbasePrime.credentialsEncryptionKey);

  const passphraseEnc = encryptString(params.passphrase, vaultKey);
  const signingKeyEnc = encryptString(params.signingKey, vaultKey);

  return prisma.primeAgentBinding.upsert({
    where: { agent_id: params.agentId },
    create: {
      agent_id: params.agentId,
      portfolio_id: params.portfolioId,
      wallet_id: params.walletId,
      access_key: params.accessKey,
      passphrase_enc: passphraseEnc,
      signing_key_enc: signingKeyEnc,
    },
    update: {
      portfolio_id: params.portfolioId,
      wallet_id: params.walletId,
      access_key: params.accessKey,
      passphrase_enc: passphraseEnc,
      signing_key_enc: signingKeyEnc,
    },
  });
}

export async function getPrimeAgentBindingPublic(agentId: string) {
  return prisma.primeAgentBinding.findUnique({
    where: { agent_id: agentId },
    select: {
      agent_id: true,
      portfolio_id: true,
      wallet_id: true,
      access_key: true,
      last_reconciled_at: true,
      updated_at: true,
    },
  });
}

async function getPrimeCredentialsForAgent(agentId: string): Promise<{
  binding: { portfolioId: string; walletId: string; accessKey: string; lastReconciledAt: Date | null };
  credentials: CoinbasePrimeCredentials;
}> {
  const binding = await prisma.primeAgentBinding.findUnique({
    where: { agent_id: agentId },
  });

  if (!binding) {
    throw new Error('Agent is not bound to Coinbase Prime (contact admin)');
  }

  const vaultKey = loadVaultKeyFromEnv(config.coinbasePrime.credentialsEncryptionKey);
  const passphrase = decryptString(binding.passphrase_enc, vaultKey);
  const signingKey = decryptString(binding.signing_key_enc, vaultKey);

  return {
    binding: {
      portfolioId: binding.portfolio_id,
      walletId: binding.wallet_id,
      accessKey: binding.access_key,
      lastReconciledAt: binding.last_reconciled_at,
    },
    credentials: {
      accessKey: binding.access_key,
      passphrase,
      signingKey,
    },
  };
}

async function createOrGetOperation(params: {
  agentId: string;
  portfolioId: string;
  walletId: string;
  operationType: 'stake' | 'unstake' | 'claim';
  amountWei?: bigint;
  idempotencyKey: string;
  primeRequest: unknown;
}) {
  const existing = await prisma.primeStakingOperation.findUnique({
    where: {
      agent_id_operation_type_idempotency_key: {
        agent_id: params.agentId,
        operation_type: params.operationType,
        idempotency_key: params.idempotencyKey,
      },
    },
  });

  if (existing) return { op: existing, created: false as const };

  const created = await prisma.primeStakingOperation.create({
    data: {
      agent_id: params.agentId,
      portfolio_id: params.portfolioId,
      wallet_id: params.walletId,
      asset: 'ETH',
      operation_type: params.operationType,
      amount_wei: params.amountWei,
      idempotency_key: params.idempotencyKey,
      status: 'initiated',
      prime_request: params.primeRequest as any,
    },
  });

  return { op: created, created: true as const };
}

export async function getPools() {
  return [
    {
      id: 'coinbase-prime-eth',
      name: 'Coinbase Prime ETH Staking',
      asset: 'ETH',
      source: 'coinbase_prime',
      minStakeWei: MIN_STAKE_WEI.toString(),
      minUnstakeWei: MIN_UNSTAKE_WEI.toString(),
      notes: 'Source of truth is Coinbase Prime. No internal APY math.',
    },
  ];
}

export async function stake(params: PrimeStakeParams) {
  if (!config.coinbasePrime.enabled) {
    throw new Error('Prime staking is disabled (set PRIME_STAKING_ENABLED=true)');
  }

  if (params.amountWei < MIN_STAKE_WEI) {
    throw new Error(`Minimum stake is 32 ETH (${MIN_STAKE_WEI.toString()} wei)`);
  }

  const { binding, credentials } = await getPrimeCredentialsForAgent(params.agentId);
  const idempotencyKey = params.idempotencyKey || uuidv4();
  const amountEth = weiToEthDecimal(params.amountWei);

  const primeRequest = {
    portfolioId: binding.portfolioId,
    walletId: binding.walletId,
    amount: amountEth,
    idempotencyKey,
  };

  const { op, created } = await createOrGetOperation({
    agentId: params.agentId,
    portfolioId: binding.portfolioId,
    walletId: binding.walletId,
    operationType: 'stake',
    amountWei: params.amountWei,
    idempotencyKey,
    primeRequest,
  });

  if (!created) return op;

  const client = new CoinbasePrimeClient();
  const resp = await client.initiateStake(binding.portfolioId, binding.walletId, amountEth, idempotencyKey, credentials);

  return prisma.primeStakingOperation.update({
    where: { id: op.id },
    data: {
      prime_activity_id: resp.activity_id,
      prime_transaction_id: resp.transaction_id,
      status: 'processing',
      prime_response: resp as any,
    },
  });
}

export async function unstake(params: PrimeUnstakeParams) {
  if (!config.coinbasePrime.enabled) {
    throw new Error('Prime staking is disabled (set PRIME_STAKING_ENABLED=true)');
  }

  if (params.amountWei < MIN_UNSTAKE_WEI) {
    throw new Error(`Minimum unstake is 1 ETH (${MIN_UNSTAKE_WEI.toString()} wei)`);
  }

  const { binding, credentials } = await getPrimeCredentialsForAgent(params.agentId);
  const idempotencyKey = params.idempotencyKey || uuidv4();
  const amountEth = weiToEthDecimal(params.amountWei);

  const primeRequest = {
    portfolioId: binding.portfolioId,
    walletId: binding.walletId,
    amount: amountEth,
    idempotencyKey,
  };

  const { op, created } = await createOrGetOperation({
    agentId: params.agentId,
    portfolioId: binding.portfolioId,
    walletId: binding.walletId,
    operationType: 'unstake',
    amountWei: params.amountWei,
    idempotencyKey,
    primeRequest,
  });

  if (!created) return op;

  const client = new CoinbasePrimeClient();
  const resp = await client.requestUnstake(binding.portfolioId, binding.walletId, amountEth, idempotencyKey, credentials);

  return prisma.primeStakingOperation.update({
    where: { id: op.id },
    data: {
      prime_activity_id: resp.activity_id,
      prime_transaction_id: resp.transaction_id,
      status: 'processing',
      prime_response: resp as any,
    },
  });
}

export async function claim(params: PrimeClaimParams) {
  if (!config.coinbasePrime.enabled) {
    throw new Error('Prime staking is disabled (set PRIME_STAKING_ENABLED=true)');
  }

  const { binding, credentials } = await getPrimeCredentialsForAgent(params.agentId);
  const idempotencyKey = params.idempotencyKey || uuidv4();
  const amountEth = params.amountWei !== undefined ? weiToEthDecimal(params.amountWei) : undefined;

  const primeRequest = {
    portfolioId: binding.portfolioId,
    walletId: binding.walletId,
    amount: amountEth,
    idempotencyKey,
  };

  const { op, created } = await createOrGetOperation({
    agentId: params.agentId,
    portfolioId: binding.portfolioId,
    walletId: binding.walletId,
    operationType: 'claim',
    amountWei: params.amountWei,
    idempotencyKey,
    primeRequest,
  });

  if (!created) return op;

  const client = new CoinbasePrimeClient();
  const resp = await client.claimRewards(binding.portfolioId, binding.walletId, amountEth, idempotencyKey, credentials);

  return prisma.primeStakingOperation.update({
    where: { id: op.id },
    data: {
      prime_activity_id: resp.activity_id,
      prime_transaction_id: resp.transaction_id,
      status: 'processing',
      prime_response: resp as any,
    },
  });
}

export async function getStatus(agentId: string) {
  if (!config.coinbasePrime.enabled) {
    throw new Error('Prime staking is disabled (set PRIME_STAKING_ENABLED=true)');
  }

  const { binding, credentials } = await getPrimeCredentialsForAgent(agentId);
  const client = new CoinbasePrimeClient();

  const [stakingStatus, unstakingStatus, recentOps] = await Promise.all([
    client.getStakingStatus(binding.portfolioId, binding.walletId, credentials),
    client.getUnstakingStatus(binding.portfolioId, binding.walletId, credentials),
    prisma.primeStakingOperation.findMany({
      where: { agent_id: agentId },
      orderBy: { created_at: 'desc' },
      take: 20,
    }),
  ]);

  return {
    binding,
    prime: {
      stakingStatus,
      unstakingStatus,
    },
    recentOperations: recentOps,
  };
}

export async function getEarnings(agentId: string) {
  if (!config.coinbasePrime.enabled) {
    throw new Error('Prime staking is disabled (set PRIME_STAKING_ENABLED=true)');
  }

  const { binding, credentials } = await getPrimeCredentialsForAgent(agentId);
  const client = new CoinbasePrimeClient();

  // Prime portfolio transactions endpoint supports type filtering.
  // We filter down to the bound wallet_id to keep it tenant-safe.
  const tx = await client.listPortfolioTransactions(
    binding.portfolioId,
    { symbols: 'ETH', types: 'REWARD', limit: 200 },
    credentials
  );

  const transactions: Array<any> = Array.isArray(tx?.transactions) ? tx.transactions : [];
  const filtered = transactions.filter(t => String(t.wallet_id) === binding.walletId);

  const rewards = filtered.map(t => {
    const amountEth = typeof t.amount === 'string' ? t.amount : '0';
    const amountWei = ethDecimalToWei(amountEth);
    return {
      prime_transaction_id: t.id,
      amountEth,
      amountWei: amountWei.toString(),
      occurredAt: t.created_at || t.timestamp || null,
      raw: t,
    };
  });

  const totalWei = rewards.reduce((sum, r) => sum + BigInt(r.amountWei), 0n);

  return {
    binding,
    rewards,
    totalRewardWei: totalWei.toString(),
  };
}

export async function markBindingReconciled(agentId: string) {
  return prisma.primeAgentBinding.update({
    where: { agent_id: agentId },
    data: { last_reconciled_at: new Date() },
  });
}

export async function upsertRewardEvent(params: {
  agentId: string;
  portfolioId: string;
  walletId: string;
  primeTransactionId: string;
  amountWei: bigint;
  occurredAt: Date;
  raw?: unknown;
}) {
  return prisma.primeRewardEvent.upsert({
    where: { prime_transaction_id: params.primeTransactionId },
    create: {
      agent_id: params.agentId,
      portfolio_id: params.portfolioId,
      wallet_id: params.walletId,
      asset: 'ETH',
      amount_wei: params.amountWei,
      prime_transaction_id: params.primeTransactionId,
      occurred_at: params.occurredAt,
      raw: params.raw as any,
    },
    update: {
      raw: params.raw as any,
    },
  });
}

export async function updateOperationStatusFromPrime(params: {
  opId: string;
  status: 'initiated' | 'awaiting_approval' | 'processing' | 'completed' | 'failed';
  primeResponse?: unknown;
  errorMessage?: string | null;
}) {
  return prisma.primeStakingOperation.update({
    where: { id: params.opId },
    data: {
      status: params.status,
      prime_response: params.primeResponse as any,
      error_message: params.errorMessage ?? undefined,
    },
  });
}
