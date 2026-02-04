/**
 * Claim Routes
 * /api/v1/claim/*
 *
 * Handles Twitter-based agent claiming:
 * 1. Agent registers → gets claim_token + verification_code
 * 2. Human visits /claim/:agentName
 * 3. Human tweets verification_code
 * 4. Platform verifies tweet → agent claimed
 */
declare const router: any;
export default router;
//# sourceMappingURL=claim.d.ts.map