---
name: react-best-practices
description: React and Next.js performance optimization guidelines from Vercel Engineering.
---

# React Best Practices

Reference these guidelines when reviewing code for performance issues, writing new components, or optimizing.

## Rule Categories by Priority (Full Rules below)

### 1. Eliminating Waterfalls (CRITICAL)
- `async-defer-await`: Move await into branches where actually used
- `async-parallel`: Use Promise.all() for independent operations
- `async-dependencies`: Use better-all for partial dependencies
- `async-api-routes`: Start promises early, await late in API routes
- `async-suspense-boundaries`: Use Suspense to stream content

### 2. Bundle Size Optimization (CRITICAL)
- `bundle-barrel-imports`: Import directly, avoid barrel files (e.g. `import X from 'pkg/X'`)
- `bundle-dynamic-imports`: Use next/dynamic for heavy components (lazy load)
- `bundle-defer-third-party`: Load analytics/logging after hydration
- `bundle-conditional`: Load modules only when feature is activated
- `bundle-preload`: Preload on hover/focus for perceived speed

### 3. Server-Side Performance (HIGH)
- `server-cache-react`: Use React.cache() for per-request deduplication of DB queries/fetch
- `server-cache-lru`: Use LRU cache for cross-request caching
- `server-serialization`: Minimize data passed to client components (only what's needed)
- `server-parallel-fetching`: Restructure components to parallelize fetches (hoist fetches)
- `server-after-nonblocking`: Use after() for non-blocking operations

### 4. Client-Side Data Fetching (MEDIUM-HIGH)
- `client-swr-dedup`: Use SWR for automatic request deduplication
- `client-event-listeners`: Deduplicate global event listeners

### 5. Re-render Optimization (MEDIUM)
- `rerender-memo`: Extract expensive work into memoized components
- `rerender-dependencies`: Use primitive dependencies in effects
- `rerender-functional-setstate`: Use functional setState for stable callbacks

### 6. Rendering Performance (MEDIUM)
- `rendering-animate-svg-wrapper`: Animate div wrapper, not SVG element
- `rendering-content-visibility`: Use content-visibility for long lists
- `rendering-conditional-render`: Use ternary, not && for conditionals

### 7. JavaScript Performance (LOW-MEDIUM)
- `js-set-map-lookups`: Use Set/Map for O(1) lookups
- `js-early-exit`: Return early from functions

## Detailed Rules (Selected)

### 1.1 Defer Await Until Needed
Move `await` operations into the branches where they're actually used to avoid blocking code paths that don't need them.

### 1.4 Promise.all() for Independent Operations
When async operations have no interdependencies, execute them concurrently using `Promise.all()`.
Incorrect:
```javascript
const user = await fetchUser()
const posts = await fetchPosts()
```
Correct:
```javascript
const [user, posts] = await Promise.all([fetchUser(), fetchPosts()])
```

### 1.5 Strategic Suspense Boundaries
Instead of awaiting data in async components before returning JSX, use Suspense boundaries to show the wrapper UI faster while data loads.

### 2.1 Avoid Barrel File Imports
Import directly from source files instead of barrel files to avoid loading thousands of unused modules.
Incorrect: `import { Check } from 'lucide-react'`
Correct: `import Check from 'lucide-react/dist/esm/icons/check'`

### 2.4 Dynamic Imports for Heavy Components
Use `next/dynamic` to lazy-load large components not needed on initial render.
```javascript
const MonacoEditor = dynamic(() => import('./monaco-editor').then(m => m.MonacoEditor), { ssr: false })
```

### 3.2 Minimize Serialization at RSC Boundaries
The React Server/Client boundary serializes all object properties. Only pass fields that the client actually uses.

### 3.3 Parallel Data Fetching with Component Composition
Restructure components to parallelize data fetching. Instead of `Page -> await -> Sidebar -> await`, make Page render `Header` and `Sidebar` which both fetch independently.

### 3.4 Per-Request Deduplication with React.cache()
Use `React.cache()` for server-side request deduplication (DB queries, etc.). `fetch` is already deduplicated in Next.js.

### 3.5 Use after() for Non-Blocking Operations
Use `after()` to schedule work (logging, analytics) that should execute after a response is sent.
