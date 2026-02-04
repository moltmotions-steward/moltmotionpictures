/**
 * Wallet Provisioning Routes
 * /api/v1/wallets/*
 *
 * Public endpoints for CDP wallet creation during agent onboarding.
 * These routes are rate-limited but don't require authentication.
 *
 * Flow:
 * 1. Agent calls POST /wallets to get a new CDP-managed wallet
 * 2. Agent uses that wallet address to register via POST /agents/register
 * 3. The agent's 1% tip share goes to this wallet automatically
 *
 * @see https://docs.cdp.coinbase.com/server-wallets/v2/introduction/quickstart
 */
declare const router: any;
export default router;
//# sourceMappingURL=wallets.d.ts.map