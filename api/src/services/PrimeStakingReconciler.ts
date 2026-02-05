import { PrismaClient } from '@prisma/client';
import { CoinbasePrimeClient } from './CoinbasePrimeClient.js';
import config from '../config/index.js';
import { decryptString, loadVaultKeyFromEnv } from '../utils/cryptoVault.js';
import { upsertRewardEvent, updateOperationStatusFromPrime } from './PrimeStakingService.js';

const prisma = new PrismaClient();

const WEI_PER_ETH = 10n ** 18n;

function ethDecimalToWei(amount: string): bigint {
  const trimmed = amount.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return 0n;
  const [whole, frac = ''] = trimmed.split('.');
  const fracPadded = (frac + '0'.repeat(18)).slice(0, 18);
  return BigInt(whole) * WEI_PER_ETH + BigInt(fracPadded);
}

export async function reconcilePrimeStakingAllAgents(): Promise<{
  processed: number;
  rewardsUpserted: number;
  operationsUpdated: number;
  errors: Array<{ agentId: string; error: string }>;
}> {
  if (!config.coinbasePrime.enabled) {
    throw new Error('Prime staking is disabled (set PRIME_STAKING_ENABLED=true)');
  }

  const vaultKey = loadVaultKeyFromEnv(config.coinbasePrime.credentialsEncryptionKey);
  const client = new CoinbasePrimeClient();

  const bindings = await prisma.primeAgentBinding.findMany({
    orderBy: { created_at: 'asc' },
  });

  let rewardsUpserted = 0;
  let operationsUpdated = 0;
  const errors: Array<{ agentId: string; error: string }> = [];

  for (const b of bindings) {
    try {
      const credentials = {
        accessKey: b.access_key,
        passphrase: decryptString(b.passphrase_enc, vaultKey),
        signingKey: decryptString(b.signing_key_enc, vaultKey),
      };

      // Pull recent reward transactions (Prime supports server-side type filtering)
      const txResp = await client.listPortfolioTransactions(
        b.portfolio_id,
        { symbols: 'ETH', types: 'REWARD', limit: 200 },
        credentials
      );

      const transactions: Array<any> = Array.isArray(txResp?.transactions) ? txResp.transactions : [];
      const walletTx = transactions.filter(t => String(t.wallet_id) === b.wallet_id);

      for (const t of walletTx) {
        const amountEth = typeof t.amount === 'string' ? t.amount : '0';
        const amountWei = ethDecimalToWei(amountEth);
        const occurredAt = new Date(t.created_at || Date.now());

        await upsertRewardEvent({
          agentId: b.agent_id,
          portfolioId: b.portfolio_id,
          walletId: b.wallet_id,
          primeTransactionId: String(t.id),
          amountWei,
          occurredAt,
          raw: t,
        });
        rewardsUpserted++;
      }

      // Best-effort operation status reconciliation from transaction status if present
      const ops = await prisma.primeStakingOperation.findMany({
        where: { agent_id: b.agent_id, status: { in: ['initiated', 'processing', 'awaiting_approval'] } },
        orderBy: { created_at: 'asc' },
        take: 200,
      });

      const txById = new Map<string, any>();
      for (const t of transactions) {
        txById.set(String(t.id), t);
      }

      for (const op of ops) {
        if (!op.prime_transaction_id) continue;
        const t = txById.get(String(op.prime_transaction_id));
        if (!t) continue;

        const status = String(t.status || '').toUpperCase();
        if (status === 'COMPLETED' || status === 'SETTLED') {
          await updateOperationStatusFromPrime({ opId: op.id, status: 'completed', primeResponse: t });
          operationsUpdated++;
        } else if (status === 'FAILED' || status === 'CANCELED' || status === 'CANCELLED') {
          await updateOperationStatusFromPrime({
            opId: op.id,
            status: 'failed',
            primeResponse: t,
            errorMessage: String(t.error || t.failure_reason || 'prime_failed'),
          });
          operationsUpdated++;
        }
      }

      await prisma.primeAgentBinding.update({
        where: { id: b.id },
        data: { last_reconciled_at: new Date() },
      });
    } catch (err: any) {
      errors.push({ agentId: b.agent_id, error: err?.message || 'unknown error' });
    }
  }

  return {
    processed: bindings.length,
    rewardsUpserted,
    operationsUpdated,
    errors,
  };
}

