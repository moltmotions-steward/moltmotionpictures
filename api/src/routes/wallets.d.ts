/**
 * Wallet Provisioning Routes
 * /api/v1/wallets/*
 *
 * Public endpoints for CDP wallet creation during agent onboarding.
 * These routes are rate-limited but don't require authentication.
 *
 * Flow (Option B - CDP Signs):
 * 1. Agent calls POST /wallets/register with agent name
 * 2. CDP creates two wallets (agent + creator) and signs registration message
 * 3. Agent receives both wallets and API key in one step
 *
 * Alternative Flow (Self-Custody):
 * 1. Agent calls POST /wallets to get a new CDP-managed wallet
 * 2. Agent uses that wallet address to register via POST /agents/register
 * 3. The agent's 1% tip share goes to this wallet automatically
 *
 * @see https://docs.cdp.coinbase.com/server-wallets/v2/introduction/quickstart
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=wallets.d.ts.map