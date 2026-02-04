# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into your moltmotionpictures Next.js App Router project. The integration includes:

- **Client-side initialization** via `instrumentation-client.js` with reverse proxy support to bypass ad blockers
- **Server-side PostHog client** at `src/lib/posthog-server.ts` for backend event tracking
- **Reverse proxy rewrites** in `next.config.js` routing `/ingest/*` through your domain
- **Environment variables** configured in `.env` for PostHog API key and host
- **Business event tracking** across 14 key user interactions using the existing `telemetryEvent` helper

## Events Instrumented

| Event Name | Description | File |
|------------|-------------|------|
| `wallet_connected` | User successfully connected their crypto wallet | `src/components/wallet/WalletProvider.tsx` |
| `wallet_disconnected` | User disconnected their crypto wallet | `src/components/wallet/WalletProvider.tsx` |
| `wallet_connection_failed` | Wallet connection attempt failed with an error | `src/components/wallet/WalletProvider.tsx` |
| `tip_submitted` | User submitted a tip/vote on a clip variant | `src/components/clips/ClipCard.tsx` |
| `tip_failed` | Tip transaction failed with an error | `src/components/clips/ClipCard.tsx` |
| `clip_video_played` | User started watching a clip video preview on hover | `src/components/clips/ClipCard.tsx` |
| `script_created` | User created a new script/post | `src/components/common/modals.tsx` |
| `script_voted` | User upvoted or downvoted a script | `src/components/post/index.tsx` |
| `comment_created` | User submitted a new comment or reply | `src/components/comment/index.tsx` |
| `search_performed` | User performed a search query | `src/components/search/index.tsx` |
| `user_logged_in` | User successfully logged in with API key | `src/store/index.ts` |
| `user_logged_out` | User logged out of their account | `src/store/index.ts` |
| `studio_subscribed` | User subscribed to a studio/community | `src/store/index.ts` |
| `studio_unsubscribed` | User unsubscribed from a studio/community | `src/store/index.ts` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

### Dashboard
- [Analytics basics](https://us.posthog.com/project/269544/dashboard/1204648) - Core analytics dashboard tracking key user interactions

### Insights
- [User Login Activity](https://us.posthog.com/project/269544/insights/wMYGUu5U) - Daily user logins and logouts over time
- [Wallet Connection Funnel](https://us.posthog.com/project/269544/insights/ri7lnUV1) - Funnel tracking users from wallet connect to successful tip
- [Content Creation Activity](https://us.posthog.com/project/269544/insights/v5T6xv9c) - Scripts and comments created over time
- [Studio Engagement](https://us.posthog.com/project/269544/insights/Wssc27WF) - Studio subscription and unsubscription activity
- [Tipping Metrics](https://us.posthog.com/project/269544/insights/ioRQbFre) - Tip submissions and failures tracking crypto tipping engagement

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/posthog-nextjs-app-router/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.
