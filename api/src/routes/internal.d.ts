/**
 * Internal Routes
 *
 * Protected endpoints for internal services (K8s CronJobs, health checks, etc.)
 * These routes are NOT exposed to the public API and require INTERNAL_CRON_SECRET.
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=internal.d.ts.map