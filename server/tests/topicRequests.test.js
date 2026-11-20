const { describe, test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { app, request, setup, teardown, resetDb, signup, makeAdmin } = require('./helpers');

before(setup);
after(teardown);

let admin;
let alice;
let bob;

beforeEach(async () => {
  await resetDb();
  admin = await makeAdmin(await signup('admin'));
  alice = await signup('alice');
  bob = await signup('bob');
  await request(app)
    .post('/api/topics')
    .set(admin.auth)
    .send({ name: 'React', category: 'frontend', packages: ['react'] })
    .expect(201);
});

const ask = (user, body) =>
  request(app).post('/api/topic-requests').set(user.auth).send({ category: 'frontend', ...body });

describe('requesting a topic', () => {
  test('needs an account and one of the core areas', async () => {
    await request(app).post('/api/topic-requests').send({ name: 'Vue', category: 'frontend' }).expect(401);
    const res = await ask(alice, { name: 'Cooking', category: 'cooking' }).expect(400);
    assert.match(JSON.stringify(res.body), /Evergreen only covers these/);
  });

  test('creates an open request with the requester as the first vote', async () => {
    const res = await ask(alice, { name: 'Vue', packageName: 'vue', description: 'Popular alternative to React' }).expect(201);
    assert.equal(res.body.status, 'open');
    assert.equal(res.body.voteCount, 1);
    assert.equal(res.body.voted, true);
    assert.equal(res.body.requestedBy.username, 'alice');
  });

  test('points to existing topics instead of duplicating them', async () => {
    let res = await ask(alice, { name: 'react' }).expect(409);
    assert.match(res.body.message, /already covers React/);
    assert.equal(res.body.details.topic.slug, 'react');
    // Same package under another name is also caught.
    res = await ask(alice, { name: 'ReactJS library', packageName: 'react' }).expect(409);
    assert.match(res.body.message, /already covers React/);
  });

  test('sends people to upvote an existing request', async () => {
    const first = await ask(alice, { name: 'Vue', packageName: 'vue' }).expect(201);
    const res = await ask(bob, { name: 'vue' }).expect(409);
    assert.match(res.body.message, /Upvote it instead/);
    assert.equal(res.body.details.request._id, first.body._id);
    await ask(bob, { name: 'Vue framework', packageName: 'vue' }).expect(409);
  });

  test('rejects npm packages that do not exist', async () => {
    const res = await ask(alice, { name: 'Ghost lib', packageName: 'definitely-not-real-pkg' }).expect(422);
    assert.match(res.body.message, /Couldn't find/);
    // Blank package is fine.
    await ask(alice, { name: 'Ghost lib', packageName: '' }).expect(201);
  });

  test('limits each user to a few open requests', async () => {
    for (const name of ['Topic A', 'Topic B', 'Topic C', 'Topic D', 'Topic E']) await ask(alice, { name }).expect(201);
    const res = await ask(alice, { name: 'Topic F' }).expect(429);
    assert.match(res.body.message, /up to 5 open requests/);
  });
});

describe('voting', () => {
  test('toggles a vote and ranks the list by votes', async () => {
    const vue = (await ask(alice, { name: 'Vue', packageName: 'vue' })).body;
    const svelte = (await ask(alice, { name: 'Svelte', packageName: 'svelte' })).body;

    let res = await request(app).post(`/api/topic-requests/${svelte._id}/vote`).set(bob.auth).expect(200);
    assert.deepEqual([res.body.voteCount, res.body.voted], [2, true]);

    const list = await request(app).get('/api/topic-requests').set(bob.auth).expect(200);
    assert.deepEqual(list.body.map((r) => [r.name, r.voteCount, r.voted]), [
      ['Svelte', 2, true],
      ['Vue', 1, false],
    ]);

    res = await request(app).post(`/api/topic-requests/${svelte._id}/vote`).set(bob.auth).expect(200);
    assert.deepEqual([res.body.voteCount, res.body.voted], [1, false]);
    await request(app).post(`/api/topic-requests/${vue._id}/vote`).expect(401);
  });
});

describe('admin handling', () => {
  test('only admins change status; declined requests leave the open list', async () => {
    const vue = (await ask(alice, { name: 'Vue', packageName: 'vue' })).body;
    await request(app).patch(`/api/topic-requests/${vue._id}`).set(alice.auth).send({ status: 'declined' }).expect(403);
    const res = await request(app)
      .patch(`/api/topic-requests/${vue._id}`)
      .set(admin.auth)
      .send({ status: 'declined', adminNote: 'Covered under React alternatives' })
      .expect(200);
    assert.equal(res.body.adminNote, 'Covered under React alternatives');

    assert.equal((await request(app).get('/api/topic-requests')).body.length, 0);
    const declined = await request(app).get('/api/topic-requests').query({ status: 'declined' }).expect(200);
    assert.equal(declined.body.length, 1);
    await request(app).post(`/api/topic-requests/${vue._id}/vote`).set(bob.auth).expect(404);
  });

  test('creating the topic marks matching requests done and links them', async () => {
    await ask(alice, { name: 'Vue', packageName: 'vue' }).expect(201);
    await request(app)
      .post('/api/topics')
      .set(admin.auth)
      .send({ name: 'Vue', category: 'frontend', packages: ['vue'] })
      .expect(201);
    const done = await request(app).get('/api/topic-requests').query({ status: 'done' }).expect(200);
    assert.equal(done.body[0].topic.slug, 'vue');

    const mine = await request(app).get('/api/topic-requests/mine').set(alice.auth).expect(200);
    assert.equal(mine.body[0].status, 'done');
  });
});
