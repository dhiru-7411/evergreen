// Cookie-based sessions.
//
// - Access token: short-lived JWT in an httpOnly cookie, sent on every request.
// - Refresh token: random, long-lived, httpOnly cookie scoped to /api/auth,
//   stored only as a SHA-256 hash, and replaced on every refresh. Presenting
//   an already-replaced token (outside a short grace window for two tabs
//   refreshing at once) revokes the whole session: someone copied it.
// Neither token is ever readable by JavaScript in the browser.
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const Session = require('../models/Session');

const ACCESS_COOKIE = 'eg_access';
const REFRESH_COOKIE = 'eg_refresh';
const ACCESS_TTL_S = 15 * 60;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const REUSE_GRACE_MS = 30 * 1000;

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const newSecret = () => crypto.randomBytes(32).toString('base64url');
const safeEqual = (a, b) => {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
};

const secure = () => process.env.NODE_ENV === 'production' || process.env.COOKIE_SECURE === 'true';
const baseCookie = () => ({ httpOnly: true, secure: secure(), sameSite: 'lax' });

function setCookies(res, userId, session, secret) {
  const access = jwt.sign({ id: String(userId), sid: String(session._id) }, process.env.JWT_SECRET, {
    expiresIn: ACCESS_TTL_S,
  });
  res.cookie(ACCESS_COOKIE, access, { ...baseCookie(), path: '/', maxAge: ACCESS_TTL_S * 1000 });
  res.cookie(REFRESH_COOKIE, `${session._id}.${secret}`, {
    ...baseCookie(),
    path: '/api/auth',
    maxAge: REFRESH_TTL_MS,
  });
}

function clearCookies(res) {
  res.clearCookie(ACCESS_COOKIE, { ...baseCookie(), path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...baseCookie(), path: '/api/auth' });
}

async function startSession(req, res, userId) {
  const secret = newSecret();
  const session = await Session.create({
    user: userId,
    tokenHash: sha256(secret),
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    userAgent: String(req.get('user-agent') || '').slice(0, 200),
    ip: req.ip || '',
  });
  setCookies(res, userId, session, secret);
  return session;
}

// Returns { userId } with fresh cookies set, or { error } explaining why not.
async function refreshSession(req, res) {
  const raw = req.cookies?.[REFRESH_COOKIE];
  const [id, secret] = String(raw || '').split('.');
  if (!id || !secret || !/^[a-f0-9]{24}$/i.test(id)) return { error: 'missing' };

  const session = await Session.findById(id);
  if (!session || session.revokedAt || session.expiresAt < new Date()) return { error: 'expired' };

  const hash = sha256(secret);
  if (!safeEqual(hash, session.tokenHash)) {
    const isPrevious = session.previousHash && safeEqual(hash, session.previousHash);
    if (isPrevious && Date.now() - session.rotatedAt.getTime() < REUSE_GRACE_MS) {
      // Another tab just refreshed; its new cookies are already in the jar.
      return { error: 'raced' };
    }
    session.revokedAt = new Date();
    session.revokedReason = isPrevious ? 'refresh token reused' : 'invalid refresh token';
    await session.save();
    return { error: 'reused' };
  }

  const next = newSecret();
  session.previousHash = session.tokenHash;
  session.tokenHash = sha256(next);
  session.rotatedAt = new Date();
  session.lastUsedAt = new Date();
  await session.save();
  setCookies(res, session.user, session, next);
  return { userId: session.user };
}

// Verifies an access token from the cookie. Checks the session still exists
// so logging out (or out everywhere) takes effect immediately.
async function authenticate(req) {
  const token = req.cookies?.[ACCESS_COOKIE];
  if (!token) return null;
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
  if (!payload.sid) return null;
  const live = await Session.exists({ _id: payload.sid, revokedAt: null, expiresAt: { $gt: new Date() } });
  return live ? { id: payload.id, sid: payload.sid } : null;
}

async function revokeSession(sessionId, reason = 'logout') {
  await Session.updateOne({ _id: sessionId, revokedAt: null }, { revokedAt: new Date(), revokedReason: reason });
}

async function revokeAllSessions(userId, { except = null, reason = 'logout everywhere' } = {}) {
  const filter = { user: userId, revokedAt: null };
  if (except) filter._id = { $ne: except };
  const result = await Session.updateMany(filter, { revokedAt: new Date(), revokedReason: reason });
  return result.modifiedCount;
}

module.exports = {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  startSession,
  refreshSession,
  authenticate,
  revokeSession,
  revokeAllSessions,
  clearCookies,
  sha256,
  newSecret,
};
