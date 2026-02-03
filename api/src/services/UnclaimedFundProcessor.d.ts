/**
 * UnclaimedFundProcessor
 *
 * Sweeps expired unclaimed funds (e.g. missing creator wallet) to the platform treasury.
 * This is designed to run as a cron job (daily is sufficient).
 */
export interface UnclaimedSweepStats {
    scanned: number;
    sweptMarked: number;
    payoutsCreated: number;
    treasuryWallet: string;
    errors: string[];
}
export declare function sweepExpiredUnclaimedFunds(limit?: number): Promise<UnclaimedSweepStats>;
declare const _default: {
    sweepExpiredUnclaimedFunds: typeof sweepExpiredUnclaimedFunds;
};
export default _default;
//# sourceMappingURL=UnclaimedFundProcessor.d.ts.map