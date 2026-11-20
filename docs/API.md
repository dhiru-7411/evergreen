# API

All endpoints live under `/api`. The site calls them on its own address (Vercel forwards to Render), so login cookies are first-party.

**Auth legend:** blank = public · **✓** = signed in · **✓ verified** = signed in with a confirmed email (enforced only when email sending is configured) · **author** = the post's author · **admin** = admin account.

Signed-in requests use httpOnly cookies set by `login` / `register`; there is no token in the response body. State-changing requests from other origins are refused (403). Validation errors return `400` with `{ message, errors: [{ path, message }] }`.

## Accounts

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| POST | `/auth/register` · `/auth/login` | | Create an account or sign in; sets session cookies. Sign-up sends a verification email |
| POST | `/auth/refresh` | refresh cookie | Rotates the refresh token and issues a new access token; replaying an old one revokes the session |
| POST | `/auth/logout` | | Ends this session (works with an expired access token) |
| POST | `/auth/logout-all` | ✓ | Ends every session for the account |
| GET | `/auth/me` | ✓ | Current user, including `emailVerified` and `verificationRequired` |
| GET | `/auth/sessions` | ✓ | Signed-in devices; `DELETE /auth/sessions/:id` signs one out |
| POST | `/auth/verify-email` | | Confirms an email from the emailed link (`token`) |
| POST | `/auth/resend-verification` | ✓ | Sends a new verification link |
| POST | `/auth/forgot-password` | | Emails a reset link; the same answer whether or not the account exists |
| POST | `/auth/reset-password` | | Sets a new password from the link (`token`, `password`) and signs out every device |
| POST | `/auth/change-password` | ✓ | Needs `currentPassword`; signs out other devices |

## Topics and learning paths

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| GET | `/topics` | | All topics with live data for their main package |
| GET | `/topics/categories` | | The 8 knowledge areas Evergreen covers |
| GET | `/topics/:slug` | | Topic page: live package data with sources, alternatives, the published learning path, community resources and related posts (live data refreshes after 6h) |
| POST | `/topics` | admin | Create from a name, area, npm packages, alternatives, keywords and docs domains |
| DELETE | `/topics/:slug` | admin | Remove a topic, its resources and paths |
| GET | `/topics/:slug/paths` | admin | All learning-path drafts and versions for a topic, with warnings |
| POST | `/topics/:slug/paths` | admin | Draft a path with AI (only when `ANTHROPIC_API_KEY` is set; monthly budget enforced) |
| POST | `/paths/:id/publish` · `/reject` | admin | Review a draft; publishing archives the previous path |

## Community

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| POST | `/topics/:slug/resources` | ✓ verified | Suggest a resource; checks reachability, relevance, duplicates and the version it teaches |
| GET | `/resources/review` | admin | Pending resources and reported ones |
| POST | `/resources/:id/approve` · `/reject` | admin | Review a resource (optional `reviewNote`) |
| POST | `/resources/:id/report` | ✓ verified | Report a problem with a published resource |
| GET | `/topic-requests?status` | | Requests, most votes first (`open` + `planned` by default) |
| GET | `/topic-requests/mine` | ✓ | Your requests |
| POST | `/topic-requests` | ✓ verified | Request a topic in one of the 8 areas |
| POST | `/topic-requests/:id/vote` | ✓ verified | Toggle your vote |
| PATCH | `/topic-requests/:id` | admin | Set status (`planned`, `declined`…), note or linked topic |

## Posts and fixes

`:id` accepts the post's readable slug or its id.

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| GET | `/posts?page&limit&status&author&q` | | Paginated feed; filter by freshness, author or search text |
| GET | `/posts/stats` | | Freshness breakdown across all posts |
| POST | `/posts` | ✓ verified | Create (revision 1, readable slug from the title) |
| GET | `/posts/:id` | | Post, contributors and open fix count |
| PATCH | `/posts/:id` | author | New revision; needs `note` and `baseRevision` (409 if someone saved first) |
| DELETE | `/posts/:id` | author | Delete the post, its revisions and fixes |
| POST | `/posts/:id/freshness` | ✓ | Re-check against npm now |
| GET | `/posts/:id/revisions[/:number]` | | History, or one snapshot |
| GET · POST | `/posts/:id/fixes` | POST ✓ verified | List or propose a fix |
| GET | `/fixes/inbox` · `/fixes/mine` | ✓ | Fixes to review, or fixes you proposed |
| GET | `/fixes/:fixId` | | A fix plus its base revision, for diffing |
| POST | `/fixes/:fixId/merge` · `/reject` | author | Review a fix |
| GET | `/users/:username` | | Public profile: posts by freshness, average score, merged fixes |

## Sharing and search engines

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/og?path=/learn/react` | HTML with Open Graph and Twitter tags for a page (served to link-preview bots) |
| GET | `/sitemap.xml` | Every topic and post by readable URL |
| GET | `/robots.txt` | Points to the sitemap and keeps private pages out of search |
| GET | `/health` | `{ "ok": true }` |
