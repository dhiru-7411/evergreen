const { describe, test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { app, request, setup, teardown, resetDb, signup } = require('./helpers');

const CONTENT = 'This is a tutorial body that is long enough to pass validation.';

before(setup);
after(teardown);
beforeEach(resetDb);

async function createPost(user, overrides = {}) {
  const res = await request(app)
    .post('/api/posts')
    .set(user.auth)
    .send({ title: 'Express REST API', content: CONTENT, stack: [{ name: 'express', version: '4' }], ...overrides })
    .expect(201);
  return res.body;
}

describe('auth', () => {
  test('register, login and /me never expose the password hash', async () => {
    const alice = await signup('alice');
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@example.com', password: 'password123' })
      .expect(200);
    assert.ok(login.body.token);

    const me = await request(app).get('/api/auth/me').set(alice.auth).expect(200);
    assert.equal(me.body.user.username, 'alice');
    assert.equal(me.body.user.password, undefined);
  });

  test('rejects weak passwords and wrong credentials', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'bob', email: 'bob@example.com', password: 'short' })
      .expect(400);
    await signup('bob');
    await request(app).post('/api/auth/login').send({ email: 'bob@example.com', password: 'nope' }).expect(401);
  });
});

describe('posts', () => {
  test('create scores freshness against the registry and records revision 1', async () => {
    const alice = await signup('alice');
    const post = await createPost(alice);

    const got = await request(app).get(`/api/posts/${post._id}`).expect(200);
    assert.equal(got.body.freshness.status, 'aging'); // express 4 vs latest 5
    assert.equal(got.body.freshness.packages[0].latest, '5.2.1');
    assert.equal(got.body.revision, 1);

    const revs = await request(app).get(`/api/posts/${post._id}/revisions`).expect(200);
    assert.equal(revs.body.length, 1);
    assert.equal(revs.body[0].note, 'First published');
  });

  test('update ignores fields outside the whitelist (mass assignment)', async () => {
    const alice = await signup('alice');
    const mallory = await signup('mallory');
    const post = await createPost(alice);

    await request(app)
      .patch(`/api/posts/${post._id}`)
      .set(alice.auth)
      .send({ title: 'Updated title', note: 'Retitle', baseRevision: 1, author: mallory.id, revision: 99 })
      .expect(200);

    const got = await request(app).get(`/api/posts/${post._id}`).expect(200);
    assert.equal(got.body.author._id, alice.id);
    assert.equal(got.body.revision, 2);
    assert.equal(got.body.title, 'Updated title');
  });

  test('stale baseRevision produces a 409 conflict', async () => {
    const alice = await signup('alice');
    const post = await createPost(alice);
    const edit = { content: `${CONTENT} Edited.`, note: 'Tweak', baseRevision: 1 };

    await request(app).patch(`/api/posts/${post._id}`).set(alice.auth).send(edit).expect(200);
    const conflict = await request(app).patch(`/api/posts/${post._id}`).set(alice.auth).send(edit).expect(409);
    assert.equal(conflict.body.details.currentRevision, 2);
  });

  test('only the author can edit or delete', async () => {
    const alice = await signup('alice');
    const bob = await signup('bob');
    const post = await createPost(alice);

    await request(app)
      .patch(`/api/posts/${post._id}`)
      .set(bob.auth)
      .send({ title: 'Hijacked', note: 'x'.repeat(5), baseRevision: 1 })
      .expect(403);
    await request(app).delete(`/api/posts/${post._id}`).set(bob.auth).expect(403);
  });

  test('list is newest-first, paginated and filterable by freshness', async () => {
    const alice = await signup('alice');
    await createPost(alice, { title: 'Old express post' });
    await createPost(alice, { title: 'Current react post', stack: [{ name: 'react', version: '19' }] });
    await createPost(alice, { title: 'Essay with no stack', stack: [] });

    const page1 = await request(app).get('/api/posts?limit=2').expect(200);
    assert.equal(page1.body.total, 3);
    assert.equal(page1.body.totalPages, 2);
    assert.equal(page1.body.items[0].title, 'Essay with no stack');
    assert.equal(page1.body.items[0].content, undefined);

    const fresh = await request(app).get('/api/posts?status=fresh').expect(200);
    assert.deepEqual(
      fresh.body.items.map((p) => p.title),
      ['Current react post']
    );

    const stats = await request(app).get('/api/posts/stats').expect(200);
    assert.deepEqual([stats.body.fresh, stats.body.aging, stats.body.untracked], [1, 1, 1]);
  });

  test('invalid ids and unknown routes return clean errors', async () => {
    await request(app).get('/api/posts/not-an-id').expect(400);
    await request(app).get('/api/nope').expect(404);
  });
});

describe('fix requests', () => {
  async function proposeUpgrade(post, user, baseRevision = 1) {
    const res = await request(app)
      .post(`/api/posts/${post._id}/fixes`)
      .set(user.auth)
      .send({
        title: post.title,
        content: `${CONTENT} Now using Express 5 async error handling.`,
        stack: [{ name: 'express', version: '5' }],
        note: 'Upgrade to Express 5',
        baseRevision,
      })
      .expect(201);
    return res.body;
  }

  test('merging a fix creates a revision credited to the contributor and refreshes freshness', async () => {
    const alice = await signup('alice');
    const bob = await signup('bob');
    const post = await createPost(alice);
    const fix = await proposeUpgrade(post, bob);

    const inbox = await request(app).get('/api/fixes/inbox').set(alice.auth).expect(200);
    assert.equal(inbox.body.length, 1);

    const merged = await request(app).post(`/api/fixes/${fix._id}/merge`).set(alice.auth).send({}).expect(200);
    assert.equal(merged.body.fix.status, 'merged');
    assert.equal(merged.body.fix.mergedRevision, 2);

    const got = await request(app).get(`/api/posts/${post._id}`).expect(200);
    assert.equal(got.body.freshness.status, 'fresh');
    assert.deepEqual(
      got.body.contributors.map((c) => c.username),
      ['bob']
    );

    const rev = await request(app).get(`/api/posts/${post._id}/revisions/2`).expect(200);
    assert.equal(rev.body.editor.username, 'bob');
    assert.equal(rev.body.note, 'Upgrade to Express 5');

    // Can't merge twice.
    await request(app).post(`/api/fixes/${fix._id}/merge`).set(alice.auth).send({}).expect(409);
  });

  test('authors cannot propose fixes to themselves and others cannot merge', async () => {
    const alice = await signup('alice');
    const bob = await signup('bob');
    const post = await createPost(alice);

    await request(app)
      .post(`/api/posts/${post._id}/fixes`)
      .set(alice.auth)
      .send({ title: post.title, content: CONTENT, stack: [], note: 'Self fix', baseRevision: 1 })
      .expect(400);

    const fix = await proposeUpgrade(post, bob);
    await request(app).post(`/api/fixes/${fix._id}/merge`).set(bob.auth).send({}).expect(403);
  });

  test('an outdated fix conflicts unless forced, and stays open after a conflict', async () => {
    const alice = await signup('alice');
    const bob = await signup('bob');
    const post = await createPost(alice);
    const fix = await proposeUpgrade(post, bob);

    await request(app)
      .patch(`/api/posts/${post._id}`)
      .set(alice.auth)
      .send({ title: 'Express REST API (2026)', note: 'Retitle', baseRevision: 1 })
      .expect(200);

    const detail = await request(app).get(`/api/fixes/${fix._id}`).set(alice.auth).expect(200);
    assert.equal(detail.body.outdated, true);
    assert.equal(detail.body.base.number, 1);

    await request(app).post(`/api/fixes/${fix._id}/merge`).set(alice.auth).send({}).expect(409);
    const stillOpen = await request(app).get(`/api/fixes/${fix._id}`).expect(200);
    assert.equal(stillOpen.body.status, 'open');

    const forced = await request(app)
      .post(`/api/fixes/${fix._id}/merge`)
      .set(alice.auth)
      .send({ force: true })
      .expect(200);
    assert.equal(forced.body.post.revision, 3);
  });

  test('rejecting records the review note', async () => {
    const alice = await signup('alice');
    const bob = await signup('bob');
    const post = await createPost(alice);
    const fix = await proposeUpgrade(post, bob);

    const res = await request(app)
      .post(`/api/fixes/${fix._id}/reject`)
      .set(alice.auth)
      .send({ reviewNote: 'Covering Express 5 in a separate post' })
      .expect(200);
    assert.equal(res.body.status, 'rejected');

    const mine = await request(app).get('/api/fixes/mine').set(bob.auth).expect(200);
    assert.equal(mine.body[0].status, 'rejected');
  });

  test('deleting a post removes its revisions and fixes', async () => {
    const alice = await signup('alice');
    const bob = await signup('bob');
    const post = await createPost(alice);
    const fix = await proposeUpgrade(post, bob);

    await request(app).delete(`/api/posts/${post._id}`).set(alice.auth).expect(200);
    await request(app).get(`/api/posts/${post._id}/revisions`).expect(404);
    await request(app).get(`/api/fixes/${fix._id}`).expect(404);
  });
});
