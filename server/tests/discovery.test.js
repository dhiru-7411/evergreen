const { describe, test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { app, request, setup, teardown, resetDb, signup } = require('./helpers');

const CONTENT = 'This is a tutorial body that is long enough to pass validation.';

before(setup);
after(teardown);
beforeEach(resetDb);

const createPost = (user, body) =>
  request(app)
    .post('/api/posts')
    .set(user.auth)
    .send({ content: CONTENT, stack: [], ...body })
    .expect(201)
    .then((r) => r.body);

describe('search', () => {
  test('matches title, excerpt and stack package, case-insensitively', async () => {
    const alice = await signup('alice');
    await createPost(alice, { title: 'Routing in Express' });
    await createPost(alice, { title: 'State management', content: `${CONTENT} Covers Zustand stores.` });
    await createPost(alice, { title: 'Bundling tips', stack: [{ name: 'vite', version: '8' }] });

    const titles = async (q) =>
      (await request(app).get('/api/posts').query({ q }).expect(200)).body.items.map((p) => p.title);

    assert.deepEqual(await titles('express'), ['Routing in Express']);
    assert.deepEqual(await titles('ZUSTAND'), ['State management']);
    assert.deepEqual(await titles('vite'), ['Bundling tips']);
    assert.equal((await titles('tutorial')).length, 3);
  });

  test('treats regex characters literally', async () => {
    const alice = await signup('alice');
    await createPost(alice, { title: 'Plain title here' });
    const res = await request(app).get('/api/posts').query({ q: '.*' }).expect(200);
    assert.equal(res.body.total, 0);
  });
});

describe('profiles', () => {
  test('summarises posts, freshness and merged fixes without leaking email', async () => {
    const alice = await signup('alice');
    const bob = await signup('bob');
    const post = await createPost(alice, { title: 'Express REST API', stack: [{ name: 'express', version: '5' }] });
    await createPost(alice, { title: 'No stack post' });

    const fix = await request(app)
      .post(`/api/posts/${post._id}/fixes`)
      .set(bob.auth)
      .send({ title: post.title, content: `${CONTENT} Updated.`, stack: post.stack, note: 'Clarify', baseRevision: 1 })
      .expect(201);
    await request(app).post(`/api/fixes/${fix.body._id}/merge`).set(alice.auth).send({}).expect(200);

    const a = await request(app).get('/api/users/Alice').expect(200);
    assert.equal(a.body.user.username, 'alice');
    assert.equal(a.body.user.email, undefined);
    assert.equal(a.body.posts.total, 2);
    assert.equal(a.body.posts.fresh, 1);
    assert.equal(a.body.posts.untracked, 1);
    assert.equal(a.body.averageScore, 100);

    const b = await request(app).get('/api/users/bob').expect(200);
    assert.equal(b.body.posts.total, 0);
    assert.equal(b.body.averageScore, null);
    assert.deepEqual(b.body.fixes, { merged: 1, open: 0 });
  });

  test('404s for unknown users and 400s for invalid names', async () => {
    await request(app).get('/api/users/nobody').expect(404);
    await request(app).get('/api/users/a.b').expect(400);
  });
});
