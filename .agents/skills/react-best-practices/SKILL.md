---
name: react-best-practices
description: Vercel React Best Practices for performance, data fetching, memoization, and zero CLS.
---

# Vercel React Best Practices

This skill outlines strict React patterns to maintain sub-100ms render responsiveness and eliminate waterfalls.

## 1. Network Waterfall Elimination
- Never sequence independent API requests with sequential `await` statements.
- Bundle concurrent requests with `Promise.all` or `Promise.allSettled`:
  ```javascript
  const [examRes, attemptsRes] = await Promise.all([
    api.get(`/exams/${id}`),
    api.get(`/exams/${id}/attempts`)
  ]);
  ```

## 2. Calculation Memoization & Stable References
- Memoize heavy filtering, sorting, and transformations on data lists using `useMemo`:
  ```javascript
  const filteredUsers = useMemo(() => {
    return users.filter(u => u.role === activeRole && u.status.includes(query));
  }, [users, activeRole, query]);
  ```
- Memoize callbacks passed down to subcomponents with `useCallback`.

## 3. Zero Cumulative Layout Shift (CLS = 0)
- Never show blank containers that pop into place when async data returns.
- Always use matched `<Skeleton />` loaders that mirror the exact height and layout of table rows, stat cards, and avatar blocks.
