# Bolt Journal

## 2026-02-01 - [Pagination Count Optimization]
**Learning:** `COUNT(*)` queries are expensive and often unnecessary for "load more" style pagination where exact total count is not displayed.
**Action:** Optimized `NotificationService.getUserNotifications` to use `limit + 1` fetching strategy instead of a separate count query, reducing database roundtrips and scan overhead.
