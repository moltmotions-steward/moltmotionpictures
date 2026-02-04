/**
 * PaymentMetrics - Observability for x402 payment system
 *
 * This service tracks payment-related metrics for:
 * - Monitoring dashboards
 * - Alerting on failures
 * - Revenue reporting
 * - Debugging payment issues
 *
 * In production, these metrics would be exported to:
 * - Prometheus/Grafana for visualization
 * - CloudWatch/Datadog for alerting
 * - Internal dashboards for business intelligence
 */
export declare function recordPaymentReceived(amountCents: number): void;
export declare function recordPaymentSettled(amountCents: number): void;
export declare function recordPaymentFailed(reason: string): void;
export declare function recordPayoutCreated(amountCents: number): void;
export declare function recordPayoutCompleted(amountCents: number): void;
export declare function recordPayoutFailed(amountCents: number, reason: string): void;
export declare function recordRefundCreated(amountCents: number): void;
export declare function recordRefundCompleted(amountCents: number): void;
export declare function recordRefundFailed(amountCents: number): void;
/**
 * Get current metrics snapshot
 */
export declare function getMetricsSnapshot(): {
    timestamp: string;
    environment: string;
    counters: {
        payments: {
            received: number;
            settled: number;
            failed: number;
        };
        payouts: {
            created: number;
            completed: number;
            failed: number;
        };
        refunds: {
            created: number;
            completed: number;
            failed: number;
        };
    };
    gauges: {
        pendingPayoutsCents: number;
        pendingRefundsCents: number;
        platformBalanceCents: number;
    };
    revenue: {
        totalCents: number;
        creatorCents: number;
        platformCents: number;
        agentCents: number;
    };
};
/**
 * Get Prometheus-formatted metrics for scraping
 */
export declare function getPrometheusMetrics(): string;
/**
 * Update gauge values from database (called periodically)
 */
export declare function refreshGauges(): Promise<void>;
/**
 * Get daily revenue summary from database
 */
export declare function getDailyRevenue(date?: Date): Promise<{
    date: string;
    voteCount: any;
    totalCents: any;
    totalUsd: string;
    splits: {
        creator: {
            cents: number;
            usd: string;
        };
        platform: {
            cents: number;
            usd: string;
        };
        agent: {
            cents: number;
            usd: string;
        };
    };
}>;
/**
 * Get weekly revenue trend
 */
export declare function getWeeklyRevenue(): Promise<{
    date: string;
    voteCount: any;
    totalCents: any;
    totalUsd: string;
    splits: {
        creator: {
            cents: number;
            usd: string;
        };
        platform: {
            cents: number;
            usd: string;
        };
        agent: {
            cents: number;
            usd: string;
        };
    };
}[]>;
/**
 * Get payout statistics
 */
export declare function getPayoutStats(): Promise<{
    pending: {
        count: any;
        totalCents: any;
    };
    completed: {
        count: any;
        totalCents: any;
    };
    failed: {
        count: any;
        totalCents: any;
    };
}>;
/**
 * Check payment system health
 */
export declare function getPaymentHealth(): Promise<{
    healthy: boolean;
    issues: string[];
    timestamp: string;
}>;
//# sourceMappingURL=PaymentMetrics.d.ts.map