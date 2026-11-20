const { describe, test, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { app, request, setup, teardown, resetDb, signup, cookieHeader } = require('./helpers');
const mailer = require('../services/mailer');
const AuthToken = require('../models/AuthToken');

before(setup);
after(teardown);
beforeEach(async () => {
  await resetDb();
  mailer.outbox.length = 0;
});
afterEach(() => {
  delete process.env.REQUIRE_EMAIL_VERIFICATION;
});

// Pulls the token out of the newest email's link.
const linkToken = (kind) => {
  const mail = [...mailer.outbox].reverse().find((m) => m.text.includes(`/${kind}?token=`));
  return mail?.text.match(/token=([A-Za-z0-9_-]+)/)?.[1];
};

describe('email verification', () => {
  test('sign-up sends a link that confirms the address once', async () => {
    const alice = await signup('alice');
    assert.equal(mailer.outbox[0].to, 'alice@example.com');
    let me = await request(app).get('/api/auth/me').set(alice.auth);
    assert.equal(me.body.user.emailVerified, false);

    const token = linkToken('verify-email');
    await request(app).post('/api/auth/verify-email').send({ token }).expect(200);
    await request(app).post('/api/auth/verify-email').send({ token }).expect(400); // single use

    me = await request(app).get('/api/auth/me').set(alice.auth);
    assert.equal(me.body.user.emailVerified, true);
  });

  test('only the newest link works, and tokens are stored hashed', async () => {
    const alice = await signup('alice');
    const first = linkToken('verify-email');
    await request(app).post('/api/auth/resend-verification').set(alice.auth).expect(200);
    const second = linkToken('verify-email');
    assert.notEqual(first, second);
    assert.equal(await AuthToken.countDocuments({ tokenHash: first }), 0);
    await request(app).post('/api/auth/verify-email').send({ token: first }).expect(400);
    await request(app).post('/api/auth/verify-email').send({ token: second }).expect(200);
  });

  test('when required, unverified users can read but not contribute', async () => {
    process.env.REQUIRE_EMAIL_VERIFICATION = 'true';
    const alice = await signup('alice');
    const body = { title: 'A post title', content: 'Long enough content for the validator to accept it.', stack: [] };
    const res = await request(app).post('/api/posts').set(alice.auth).send(body).expect(403);
    assert.equal(res.body.code, 'EMAIL_NOT_VERIFIED');
    await request(app).get('/api/posts').set(alice.auth).expect(200);

    await request(app).post('/api/auth/verify-email').send({ token: linkToken('verify-email') }).expect(200);
    await request(app).post('/api/posts').set(alice.auth).send(body).expect(201);
  });

  test('is not enforced when no email service is configured', async () => {
    const alice = await signup('alice');
    const me = await request(app).get('/api/auth/me').set(alice.auth);
    assert.equal(me.body.user.verificationRequired, false);
    await request(app)
      .post('/api/posts')
      .set(alice.auth)
      .send({ title: 'A post title', content: 'Long enough content for the validator to accept it.', stack: [] })
      .expect(201);
  });
});

describe('password reset', () => {
  test('answers the same whether or not the account exists', async () => {
    await signup('alice');
    mailer.outbox.length = 0;
    const known = await request(app).post('/api/auth/forgot-password').send({ email: 'alice@example.com' }).expect(200);
    const unknown = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@example.com' }).expect(200);
    assert.equal(known.body.message, unknown.body.message);
    assert.equal(mailer.outbox.length, 1);
  });

  test('sets a new password, signs out every device, and the link works once', async () => {
    const alice = await signup('alice');
    await request(app).post('/api/auth/forgot-password').send({ email: 'alice@example.com' });
    const token = linkToken('reset-password');

    await request(app).post('/api/auth/reset-password').send({ token, password: 'short' }).expect(400);
    await request(app).post('/api/auth/reset-password').send({ token, password: 'brand-new-pass' }).expect(200);
    await request(app).post('/api/auth/reset-password').send({ token, password: 'another-pass-1' }).expect(400);

    await request(app).get('/api/auth/me').set(alice.auth).expect(401);
    await request(app).post('/api/auth/login').send({ email: 'alice@example.com', password: 'password123' }).expect(401);
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@example.com', password: 'brand-new-pass' })
      .expect(200);
    assert.equal(login.body.user.emailVerified, true); // the link proved they own the address
    assert.match(mailer.outbox.at(-1).subject, /password was changed/);
  });

  test('expired links are rejected', async () => {
    await signup('alice');
    await request(app).post('/api/auth/forgot-password').send({ email: 'alice@example.com' });
    await AuthToken.updateMany({ type: 'reset-password' }, { expiresAt: new Date(Date.now() - 1000) });
    await request(app)
      .post('/api/auth/reset-password')
      .send({ token: linkToken('reset-password'), password: 'brand-new-pass' })
      .expect(400);
  });
});

describe('changing password', () => {
  test('needs the current password and signs out other devices only', async () => {
    const alice = await signup('alice');
    const laptop = {
      Cookie: cookieHeader(
        await request(app).post('/api/auth/login').send({ email: 'alice@example.com', password: 'password123' })
      ),
    };

    await request(app)
      .post('/api/auth/change-password')
      .set(alice.auth)
      .send({ currentPassword: 'wrong-password', newPassword: 'brand-new-pass' })
      .expect(400);
    await request(app)
      .post('/api/auth/change-password')
      .set(alice.auth)
      .send({ currentPassword: 'password123', newPassword: 'password123' })
      .expect(400);
    const res = await request(app)
      .post('/api/auth/change-password')
      .set(alice.auth)
      .send({ currentPassword: 'password123', newPassword: 'brand-new-pass' })
      .expect(200);
    assert.match(res.body.message, /1 other device was signed out/);

    await request(app).get('/api/auth/me').set(alice.auth).expect(200);
    await request(app).get('/api/auth/me').set(laptop).expect(401);
  });
});
