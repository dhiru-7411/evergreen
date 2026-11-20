// Sends account emails (verification, password reset).
//
//   SMTP_URL    e.g. smtps://USER:PASS@smtp-relay.brevo.com:465 (any SMTP provider)
//   MAIL_FROM   e.g. "Evergreen <you@example.com>" (must be a sender your provider allows)
//   APP_URL     public address of the site, used in links (default: first CLIENT_URL)
//
// Without SMTP_URL, emails are printed to the server log instead, which is
// enough for local development. Email verification is only enforced when
// real email sending is configured, so nobody gets locked out.
const nodemailer = require('nodemailer');

let transport = null;
const outbox = []; // used by tests and the log mailer

const configured = () => Boolean(process.env.SMTP_URL);

function getTransport() {
  if (!configured()) return null;
  transport ??= nodemailer.createTransport(process.env.SMTP_URL);
  return transport;
}

const appUrl = require('../utils/appUrl');

async function send({ to, subject, text }) {
  const message = { from: process.env.MAIL_FROM || 'Evergreen <no-reply@localhost>', to, subject, text };
  const t = getTransport();
  if (!t) {
    outbox.push(message);
    if (outbox.length > 50) outbox.shift();
    if (process.env.NODE_ENV !== 'test') {
      console.log(`\n[mail] (not sent, no SMTP_URL) to ${to}: ${subject}\n${text}\n`);
    }
    return;
  }
  await t.sendMail(message);
}

const sendVerification = (user, token) =>
  send({
    to: user.email,
    subject: 'Confirm your email for Evergreen',
    text: `Hi ${user.username},

Confirm your email address to start contributing to Evergreen:

${appUrl()}/verify-email?token=${token}

This link expires in 24 hours. If you didn't create an account, you can ignore this email.`,
  });

const sendPasswordReset = (user, token) =>
  send({
    to: user.email,
    subject: 'Reset your Evergreen password',
    text: `Hi ${user.username},

Someone (hopefully you) asked to reset your Evergreen password. Choose a new one here:

${appUrl()}/reset-password?token=${token}

This link expires in 30 minutes and works once. If you didn't ask for this, ignore this email; your password stays the same.`,
  });

const sendPasswordChanged = (user) =>
  send({
    to: user.email,
    subject: 'Your Evergreen password was changed',
    text: `Hi ${user.username},

Your Evergreen password was just changed, and other devices were signed out.

If this wasn't you, reset your password right away: ${appUrl()}/forgot-password`,
  });

// Verification is required only when real email can be sent, unless
// REQUIRE_EMAIL_VERIFICATION says otherwise.
const verificationRequired = () =>
  process.env.REQUIRE_EMAIL_VERIFICATION
    ? process.env.REQUIRE_EMAIL_VERIFICATION === 'true'
    : configured();

module.exports = {
  sendVerification,
  sendPasswordReset,
  sendPasswordChanged,
  verificationRequired,
  configured,
  outbox,
  appUrl,
};
