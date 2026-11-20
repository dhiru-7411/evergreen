// Email verification, password reset and password change.
const User = require('../models/User');
const AuthToken = require('../models/AuthToken');
const HttpError = require('../utils/httpError');
const mailer = require('../services/mailer');
const sessions = require('../services/sessions');

const TTL = { 'verify-email': 24 * 60 * 60 * 1000, 'reset-password': 30 * 60 * 1000 };

async function issueToken(userId, type) {
  // Only the newest link of each kind works.
  await AuthToken.deleteMany({ user: userId, type, usedAt: null });
  const token = sessions.newSecret();
  await AuthToken.create({
    user: userId,
    type,
    tokenHash: sessions.sha256(token),
    expiresAt: new Date(Date.now() + TTL[type]),
  });
  return token;
}

// Atomically marks a token used and returns it, or null if invalid/expired/used.
const consumeToken = (token, type) =>
  AuthToken.findOneAndUpdate(
    { tokenHash: sessions.sha256(String(token)), type, usedAt: null, expiresAt: { $gt: new Date() } },
    { usedAt: new Date() },
    { new: true }
  );

async function sendVerificationEmail(user) {
  const token = await issueToken(user._id, 'verify-email');
  await mailer.sendVerification(user, token);
}

const verifyEmail = async (req, res) => {
  const record = await consumeToken(req.body.token, 'verify-email');
  if (!record) throw new HttpError(400, 'This link is invalid or has expired. Request a new one from your account page.');
  await User.updateOne({ _id: record.user }, { emailVerifiedAt: new Date() });
  res.json({ message: 'Email confirmed. Thanks!' });
};

const resendVerification = async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw new HttpError(401, 'Account no longer exists');
  if (user.emailVerifiedAt) return res.json({ message: 'Your email is already confirmed' });
  await sendVerificationEmail(user);
  res.json({ message: `We sent a new link to ${user.email}` });
};

const GENERIC_RESET_MESSAGE = 'If an account uses that email, a reset link is on its way. Check your inbox.';

// Always answers the same way so it can't be used to find out who has an account.
const forgotPassword = async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (user) {
    const token = await issueToken(user._id, 'reset-password');
    await mailer.sendPasswordReset(user, token);
  }
  res.json({ message: GENERIC_RESET_MESSAGE });
};

const resetPassword = async (req, res) => {
  const record = await consumeToken(req.body.token, 'reset-password');
  if (!record) throw new HttpError(400, 'This reset link is invalid or has expired. Request a new one.');
  const user = await User.findById(record.user).select('+password');
  if (!user) throw new HttpError(400, 'This reset link is invalid or has expired. Request a new one.');
  user.password = req.body.password;
  // Receiving the link proves they own the address.
  user.emailVerifiedAt ??= new Date();
  await user.save();
  await sessions.revokeAllSessions(user._id, { reason: 'password reset' });
  sessions.clearCookies(res);
  await mailer.sendPasswordChanged(user);
  res.json({ message: 'Password updated. Sign in with your new password.' });
};

const changePassword = async (req, res) => {
  const user = await User.findById(req.user.id).select('+password');
  if (!user || !(await user.comparePassword(req.body.currentPassword))) {
    throw new HttpError(400, 'Current password is incorrect');
  }
  user.password = req.body.newPassword;
  await user.save();
  const others = await sessions.revokeAllSessions(user._id, { except: req.user.sid, reason: 'password changed' });
  await mailer.sendPasswordChanged(user);
  res.json({ message: `Password changed. ${others} other ${others === 1 ? 'device was' : 'devices were'} signed out.` });
};

module.exports = { verifyEmail, resendVerification, forgotPassword, resetPassword, changePassword, sendVerificationEmail };
