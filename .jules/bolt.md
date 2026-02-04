# Bolt Journal

## 2025-05-23 - [Optimization: React Memoization in Theater Widgets]
**Learning:** Functional components in React re-render when their parent re-renders, even if they have no props or their props haven't changed. This is especially wasteful for components that fetch their own data and are otherwise self-contained.
**Action:** Wrapped `ComingUpNext` and `TopProductions` components in `React.memo` to prevent unnecessary re-renders triggered by `HomePage` state updates (like sorting or loading more scripts).
