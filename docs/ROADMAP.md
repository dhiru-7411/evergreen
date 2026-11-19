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

## Direction: learn what's current
Evergreen is growing from a blog into a place to *learn a technology*: each topic page shows the latest version, the alternatives and why you'd pick them, a step-by-step learning path, and tutorials checked against what's current. The site fills these in automatically from APIs and AI drafting grounded in official sources; admins only choose topics.

## ✅ Topics, step 1: live package data
- `Topic` model (`/learn/:slug`): main + related npm packages, alternatives with "pick this if…" notes
- Live data per package from npm (version, downloads, license, links, deprecation) and deps.dev (release date, security advisories); 6h cache, refreshed by the background job and on read, keeps last known data if a source is down
- Related tutorials ranked freshest first; admin role, `make-admin` script, 5 seeded topics

## ✅ Topics, step 2: sources, scope and community resources
- Numbered citations on every fact, a Sources list per topic, editor-written text labelled
- Scope limited to 8 core knowledge areas (`server/config/categories.js`); 9 seeded topics
- Signed-in users suggest resources; automatic checks (reachable, on-topic, not duplicate, version taught) then human review; reports send published resources back to review
- Server-side page fetching hardened against SSRF (private IPs, redirects, DNS rebinding, size and time limits)

## Topics, next steps
- **Learning paths:** ordered steps with prerequisites, each linked to official docs and freshness-checked tutorials; per-user progress
- **AI accuracy check on submissions:** Claude compares a suggested page against the official docs for the current version and gives reviewers a list of claims that look wrong
- **Grounded AI drafting:** Claude API with web search drafts paths, "what's new in vX" and alternatives from official docs and release notes, with citations; regenerated when a major version ships
- **Auto-suggested alternatives** from npm keywords + download data, explained by Claude
- **External tutorials:** pull candidates from dev.to and official docs, score their freshness, rank with reader votes

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
