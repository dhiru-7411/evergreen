const User = require('../models/User');
const Session = require('../models/Session');
const HttpError = require('../utils/httpError');
const sessions = require('../services/sessions');

const publicUser = (user) => ({
  id: user._id,
  username: user.username,
  email: user.email,
  role: user.role ?? 'user',
});

const register = async (req, res) => {
  const { username, email, password } = req.body;

  const existingUser = await User.findOne({ $or: [{ username }, { email }] });
  if (existingUser) throw new HttpError(409, 'Username or email already in use');

  const user = await User.create({ username, email, password });
  await sessions.startSession(req, res, user._id);
  res.status(201).json({ user: publicUser(user) });
};

const login = async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password');
  // Same message for both cases so the endpoint can't be used to probe for accounts.
  if (!user || !(await user.comparePassword(password))) {
    throw new HttpError(401, 'Invalid email or password');
  }

  await sessions.startSession(req, res, user._id);
  res.status(200).json({ user: publicUser(user) });
};

// Swaps a refresh token for new cookies. Called by the client when an
// access token has expired.
const refresh = async (req, res) => {
  const result = await sessions.refreshSession(req, res);
  if (result.error === 'raced') return res.status(409).json({ message: 'Session was just refreshed; retry' });
  if (result.error) {
    sessions.clearCookies(res);
    return res.status(401).json({ message: 'Please sign in again' });
  }
  const user = await User.findById(result.userId);
  if (!user) {
    sessions.clearCookies(res);
    return res.status(401).json({ message: 'Account no longer exists' });
  }
  res.json({ user: publicUser(user) });
};

const me = async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw new HttpError(401, 'Account no longer exists');
  res.json({ user: publicUser(user) });
};

// Works even with an expired access token: the refresh cookie identifies the session.
const logout = async (req, res) => {
  const sid = req.user?.sid ?? String(req.cookies?.[sessions.REFRESH_COOKIE] || '').split('.')[0];
  if (/^[a-f0-9]{24}$/i.test(sid || '')) await sessions.revokeSession(sid);
  sessions.clearCookies(res);
  res.json({ message: 'Signed out' });
};

const logoutEverywhere = async (req, res) => {
  const count = await sessions.revokeAllSessions(req.user.id);
  sessions.clearCookies(res);
  res.json({ message: `Signed out of ${count} ${count === 1 ? 'device' : 'devices'}` });
};

// Devices currently signed in, so users can spot one they don't recognise.
const listSessions = async (req, res) => {
  const list = await Session.find({ user: req.user.id, revokedAt: null, expiresAt: { $gt: new Date() } })
    .sort({ lastUsedAt: -1 })
    .select('userAgent ip createdAt lastUsedAt')
    .lean();
  res.json(list.map((s) => ({ ...s, current: String(s._id) === req.user.sid })));
};

const revokeOne = async (req, res) => {
  const result = await Session.updateOne(
    { _id: req.params.id, user: req.user.id, revokedAt: null },
    { revokedAt: new Date(), revokedReason: 'revoked by user' }
  );
  if (result.modifiedCount === 0) throw new HttpError(404, 'Session not found');
  if (req.params.id === req.user.sid) sessions.clearCookies(res);
  res.json({ message: 'Device signed out' });
};

module.exports = { register, login, refresh, me, logout, logoutEverywhere, listSessions, revokeOne, publicUser };
