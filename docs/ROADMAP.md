# Roadmap

Evergreen started as a MERN blog (Days 1–4 in the git history), grew a freshness engine for its tutorials, and became a place to learn the core skills of building software as they are today.

## ✅ Done

**Foundations**
- Express 5 API with zod validation, central error handling, helmet, CORS allow-list, rate limits, pagination
- Freshness engine (npm), background re-checks, revisions with optimistic concurrency, reader-proposed fixes
- Search, public profiles, route-level code splitting

**Learn by topic**
- Topics in 8 core areas with live package data from npm and deps.dev, numbered citations, editor text labelled
- Alternatives with "pick this if…" notes and live comparisons
- Learning paths from official docs: every source opened and checked (including "soft 404" detection), admin review before publishing, "outdated" banner on new majors. Hand-written by default (`content/paths/`), optional Claude drafting with a monthly budget
- Community resources with SSRF-safe automatic checks, editor review and reader reports
- Request a topic, with voting and duplicate detection

**Accounts and security**
- httpOnly cookie sessions, refresh-token rotation and reuse detection, log out everywhere, device list
- CSRF origin checks, email verification, password reset and change
- All `npm audit` findings fixed

**Sharing, quality and hosting**
- Readable post URLs, Open Graph link previews, page titles, sitemap and robots.txt
- Accessibility (axe-core, WCAG 2.2 AA: 0 violations) and mobile layout fixes
- Deployed on Vercel + Render + MongoDB Atlas + Brevo, with a daily live-site check
- 100 API and unit tests, CI on every push

## Next

**For learners**
- Track progress through a learning path
- Follow a topic and get an email when it ships a new major version
- More topics from the request queue (e.g. Docker, Python), including other ecosystems such as PyPI

**For contributors**
- Notifications when a suggestion is approved or a fix is merged
- Line-level comments on fix requests, like code review
- Sign in with GitHub

**For tutorial authors elsewhere**
- An embeddable freshness badge for READMEs and blog posts
- Import a post from dev.to or Medium by URL and track its freshness

**Engineering**
- TypeScript across client and server
- Playwright end-to-end tests in CI; error monitoring
- Load only the highlight.js languages posts actually use (smaller post pages)
- Redis for caches and rate limits; a job queue for freshness checks
- A custom domain (better email deliverability, nicer links)
