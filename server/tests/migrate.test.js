const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { app, request, setup, teardown, signup } = require('./helpers');
const Post = require('../models/Post');
const { migrate } = require('../scripts/migrate');

before(setup);
after(teardown);

test('legacy posts become editable after migration', async () => {
  const alice = await signup('alice');
  // Shape of a post written by the original MERN blog: no revision fields.
  const { insertedId } = await Post.collection.insertOne({
    title: 'My first post',
    content: 'Written before Evergreen existed, back in the Day 2 commit.',
    author: new mongoose.Types.ObjectId(alice.id),
    createdAt: new Date('2026-07-17'),
    updatedAt: new Date('2026-07-17'),
  });

  const edit = { content: 'Written before Evergreen existed. Now revised!', note: 'Refresh', baseRevision: 1 };
  await request(app).patch(`/api/posts/${insertedId}`).set(alice.auth).send(edit).expect(409);

  assert.equal(await migrate(), 1);
  assert.equal(await migrate(), 0, 'second run is a no-op');

  await request(app).patch(`/api/posts/${insertedId}`).set(alice.auth).send(edit).expect(200);
  const revs = await request(app).get(`/api/posts/${insertedId}/revisions`).expect(200);
  assert.deepEqual(
    revs.body.map((r) => r.number),
    [2, 1]
  );
});
