## 2026-02-02 - Payload Optimization in Post Feed
**Learning:** Returning full text content in list endpoints (feeds) wastes bandwidth when only a preview is displayed.
**Action:** Truncated `content` field to 1000 chars in `PostService.getFeed` and `PostService.getPersonalizedFeed` SQL queries.
