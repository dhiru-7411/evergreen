# Roadmap

Each phase teaches something new and ends with something worth showing.

## ✅ Phase 0: Foundations and the core idea
- Monorepo with preserved Day 1–4 history, root `.gitignore`, `.env.example`s
- Fixed a mass-assignment bug in post updates; zod validation everywhere
- Central error handling, helmet, CORS allow-list, rate limits, pagination
- Freshness engine, background job, revisions with optimistic concurrency, fix requests
- Test suite against in-memory MongoDB, GitHub Actions CI

## ✅ Phase 0.5: Discovery and deploy-readiness
- Search by title, text or package name (regex-escaped, so user input can't inject patterns)
- Public profile pages (`/u/:username`) with posts, average freshness score and fixes merged
- Author names link to profiles everywhere
- Route-level code splitting: entry bundle 640 KB → 195 KB; markdown + highlight.js load only on post pages
- Render Blueprint, Vercel/Netlify SPA rewrites

## Phase 1: Deploy and get real users
- Deploy: client on Vercel/Netlify, API on Render/Fly/Railway, MongoDB Atlas
- Seed with real posts you write about what you learn building this
- Slugs instead of ids in URLs; Open Graph tags so links unfurl nicely on LinkedIn

## Phase 2: Auth done right
- Move the JWT out of `localStorage` into an httpOnly cookie with refresh-token rotation
- GitHub OAuth (it fits a developer audience)
- Email verification and password reset

## Phase 3: Smarter freshness
- **Changelog-aware staleness:** when a package jumps a major version, fetch its release notes and use the Claude API to say *which parts of this post* are likely affected, not just that it's stale
- **Auto-detect the stack:** parse `import`/`require` statements and `npm install` lines in code blocks to suggest a stack while writing
- Watch more ecosystems: PyPI, crates.io, Go modules
- Deprecation signals: npm `deprecated` flags, archived GitHub repos

## Phase 4: Notifications and real-time
- Notify authors when a post turns stale or receives a fix (email digest + in-app)
- "Watch this post": readers get notified when it's updated
- Socket.io for live inbox counts

## Phase 5: Make it a platform
- **Browser extension / embeddable badge:** `![freshness](https://evergreen.dev/badge/:id.svg)` for READMEs and dev.to posts
- Import posts from dev.to, Hashnode or Medium by URL, and start tracking them
- Line-level comments on fix requests, like code review

## Phase 6: Performance and production
- TypeScript across client and server
- Load only the highlight.js languages posts actually use (the Markdown chunk is 323 KB)
- Redis for the registry cache and rate limits so they survive restarts and scale horizontally
- Move the freshness job to a proper queue (BullMQ) with retries
- MongoDB transactions around revision + post writes
- Playwright end-to-end tests in CI, Sentry, uptime monitoring
