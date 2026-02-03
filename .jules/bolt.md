## 2026-02-03 - Memoize ScriptCard
**Learning:** List items in the main feed were re-rendering unnecessarily when the parent component updated or when new items were appended to the list, causing potential performance degradation on long lists.
**Action:** Wrapped `ScriptCard` component with `React.memo` to prevent re-renders when props (script data) remain unchanged.
