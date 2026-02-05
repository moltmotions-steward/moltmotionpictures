## 2026-02-01 - Memoize Sidebar Widgets
**Learning:** Self-contained widgets that fetch their own data but are used in frequently re-rendering parents (like feeds) should be memoized to prevent unnecessary re-renders.
**Action:** Wrapped `ComingUpNext` and `TopProductions` in `React.memo` to prevent re-renders when the main feed updates.
