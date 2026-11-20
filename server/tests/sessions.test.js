const { describe, test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { app, request, setup, teardown, resetDb, signup, cookieHeader } = require('./helpers');
const Session = require('../models/Session');

before(setup);
after(teardown);
beforeEach(resetDb);

const cookieValue = (res, name) =>
  (res.headers['set-cookie'] || []).map((c) => c.split(';')[0]).find((c) => c.startsWith(`${name}=`));

const login = (email = 'alice@example.com') =>
  request(app).post('/api/auth/login').send({ email, password: 'password123' }).expect(200);

describe('sessions', () => {
  test('refresh rotates the refresh token and issues a new access token', async () => {
    const alice = await signup('alice');
    const refreshCookie = cookieValue({ headers: { 'set-cookie': alice.cookies } }, 'eg_refresh');

    const res = await request(app).post('/api/auth/refresh').set('Cookie', refreshCookie).expect(200);
    assert.equal(res.body.user.username, 'alice');
    const rotated = cookieValue(res, 'eg_refresh');
    assert.ok(rotated && rotated !== refreshCookie);
    await request(app).get('/api/auth/me').set('Cookie', cookieValue(res, 'eg_access')).expect(200);
  });

  test('replaying an old refresh token after the grace window revokes the session', async () => {
    const alice = await signup('alice');
    const old = cookieValue({ headers: { 'set-cookie': alice.cookies } }, 'eg_refresh');
    const res = await request(app).post('/api/auth/refresh').set('Cookie', old).expect(200);

    // Within the grace window (two tabs refreshing at once) it's a harmless race.
    await request(app).post('/api/auth/refresh').set('Cookie', old).expect(409);

    // Later, the same old token means it was copied: kill the session.
    await Session.updateMany({}, { rotatedAt: new Date(Date.now() - 60_000) });
    await request(app).post('/api/auth/refresh').set('Cookie', old).expect(401);
    const session = await Session.findOne();
    assert.equal(session.revokedReason, 'refresh token reused');

    // Even the legitimate newest tokens stop working.
    await request(app).post('/api/auth/refresh').set('Cookie', cookieValue(res, 'eg_refresh')).expect(401);
    await request(app).get('/api/auth/me').set('Cookie', cookieValue(res, 'eg_access')).expect(401);
  });

  test('a tampered or unknown refresh token is rejected', async () => {
    await signup('alice');
    const session = await Session.findOne();
    await request(app).post('/api/auth/refresh').set('Cookie', `eg_refresh=${session._id}.forged`).expect(401);
    await request(app).post('/api/auth/refresh').set('Cookie', 'eg_refresh=garbage').expect(401);
    await request(app).post('/api/auth/refresh').expect(401);
  });

  test('logout ends the session immediately, even before the access token expires', async () => {
    const alice = await signup('alice');
    await request(app).get('/api/auth/me').set(alice.auth).expect(200);
    const res = await request(app).post('/api/auth/logout').set(alice.auth).expect(200);
    assert.match(res.headers['set-cookie'].join(' '), /eg_access=;/);
    await request(app).get('/api/auth/me').set(alice.auth).expect(401);
  });

  test('log out everywhere ends every device', async () => {
    await signup('alice');
    const laptop = { Cookie: cookieHeader(await login()) };
    const phone = { Cookie: cookieHeader(await login()) };

    const list = await request(app).get('/api/auth/sessions').set(phone).expect(200);
    assert.equal(list.body.length, 3);
    assert.equal(list.body.filter((s) => s.current).length, 1);

    const res = await request(app).post('/api/auth/logout-all').set(phone).expect(200);
    assert.match(res.body.message, /3 devices/);
    await request(app).get('/api/auth/me').set(laptop).expect(401);
    await request(app).get('/api/auth/me').set(phone).expect(401);
  });

  test('users can sign out one device but not touch other people’s sessions', async () => {
    const alice = await signup('alice');
    const bob = await signup('bob');
    const laptop = { Cookie: cookieHeader(await login()) };
    const [, other] = (await request(app).get('/api/auth/sessions').set(laptop)).body;
    const bobSession = (await request(app).get('/api/auth/sessions').set(bob.auth)).body[0];

    await request(app).delete(`/api/auth/sessions/${bobSession._id}`).set(laptop).expect(404);
    await request(app).delete(`/api/auth/sessions/${other._id}`).set(laptop).expect(200);
    await request(app).get('/api/auth/me').set(alice.auth).expect(401); // that was alice's first session
    await request(app).get('/api/auth/me').set(laptop).expect(200);
  });

  test('access tokens alone are not enough once expired', async () => {
    const alice = await signup('alice');
    const session = await Session.findOne();
    const expired = jwt.sign({ id: alice.id, sid: String(session._id) }, process.env.JWT_SECRET, { expiresIn: -10 });
    await request(app).get('/api/auth/me').set('Cookie', `eg_access=${expired}`).expect(401);
    // Old-style Authorization headers are no longer accepted.
    const valid = jwt.sign({ id: alice.id, sid: String(session._id) }, process.env.JWT_SECRET);
    await request(app).get('/api/auth/me').set('Authorization', `Bearer ${valid}`).expect(401);
  });
});

describe('cross-site request protection', () => {
  test('state-changing requests from other sites are refused', async () => {
    const alice = await signup('alice');
    await request(app)
      .post('/api/auth/logout-all')
      .set(alice.auth)
      .set('Origin', 'https://evil.example')
      .expect(403);
    await request(app)
      .post('/api/auth/logout-all')
      .set(alice.auth)
      .set('Sec-Fetch-Site', 'cross-site')
      .expect(403);
    // Reads are unaffected, and the allowed front-end origin works.
    await request(app).get('/api/auth/me').set(alice.auth).set('Origin', 'https://evil.example').expect(200);
    await request(app)
      .post('/api/auth/logout')
      .set(alice.auth)
      .set('Origin', 'http://localhost:5173')
      .expect(200);
  });
});
