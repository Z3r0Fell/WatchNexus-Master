---
name: react-audit
description: Use when auditing React/JSX frontend codebases. Covers re-render optimization, hooks rules, bundle analysis, state management, and security in React 19.
---

# React Audit Patterns

## Re-render Optimization
```jsx
// BAD - Inline function creates new reference every render
<ExpensiveList onChange={(id) => handleChange(id)} />

// GOOD
const handleChange = useCallback((id) => { ... }, []);

// BAD - No memo on expensive component
// GOOD
const ExpensiveList = React.memo(({ items, onChange }) => { ... });

// BAD - Object/array inline creates new reference
<Menu items={['a', 'b', 'c']} />
// GOOD
const MENU_ITEMS = ['a', 'b', 'c'];
```

## Context Performance
- Split large contexts (AuthContext, ThemeContext, etc.)
- Use context selectors or split into multiple providers
- Memoize context values

## Code Splitting
```jsx
const HeavyPage = React.lazy(() => import('./pages/HeavyPage'));
// Wrap in <Suspense>
```

## Security in React
- `dangerouslySetInnerHTML` — flag with finding
- Meta tags for CSP
- Auth context using httpOnly cookies vs localStorage
- URL parsing and validation

## Bundle Analysis
- Check for duplicate libraries (two package.json = risk)
- Moment.js → date-fns or dayjs
- lodash → tree-shakeable imports only
- Large component files (>300 lines) should be split
