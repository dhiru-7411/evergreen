const { describe, test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { app, request, setup, teardown, resetDb, signup } = require('./helpers');
const { slugify } = require('../utils/slugify');

const CONTENT = 'This is a tutorial body that is long enough to pass validation.';

before(setup);
after(teardown);
beforeEach(resetDb);

const create = (user, title) =>
  request(app).post('/api/posts').set(user.auth).send({ title, content: CONTENT, stack: [] }).expect(201).then((r) => r.body);

describe('readable post URLs', () => {
  test('posts get a slug from their title, unique across posts', async () => {
    const alice = await signup('alice');
    const a = await create(alice, 'Building a REST API with Express 5!');
    const b = await create(alice, 'Building a REST API with Express 5');
    assert.equal(a.slug, 'building-a-rest-api-with-express-5');
    assert.equal(b.slug, 'building-a-rest-api-with-express-5-2');
  });

  test('every post route works with the slug or the id', async () => {
    const alice = await signup('alice');
    const post = await create(alice, 'Data fetching in React 19');
    const bySlug = await request(app).get(`/api/posts/${post.slug}`).expect(200);
    const byId = await request(app).get(`/api/posts/${post._id}`).expect(200);
    assert.equal(bySlug.body._id, byId.body._id);
    await request(app).get(`/api/posts/${post.slug.toUpperCase()}`).expect(200);
    await request(app).get(`/api/posts/${post.slug}/revisions`).expect(200);
    await request(app).get(`/api/posts/${post.slug}/revisions/1`).expect(200);
    await request(app)
      .patch(`/api/posts/${post.slug}`)
      .set(alice.auth)
      .send({ title: 'Data fetching in React 19, updated', note: 'Retitle', baseRevision: 1 })
      .expect(200);
  });

  test('the slug stays the same when the title changes, so shared links keep working', async () => {
    const alice = await signup('alice');
    const post = await create(alice, 'Original title here');
    await request(app)
      .patch(`/api/posts/${post._id}`)
      .set(alice.auth)
      .send({ title: 'A completely different title', note: 'Retitle', baseRevision: 1 })
      .expect(200);
    const res = await request(app).get('/api/posts/original-title-here').expect(200);
    assert.equal(res.body.title, 'A completely different title');
  });

  test('slugs never look like ids', async () => {
    const alice = await signup('alice');
    const post = await create(alice, 'aaaaaaaaaaaaaaaaaaaaaaaa');
    assert.equal(post.slug, 'aaaaaaaaaaaaaaaaaaaaaaaa-post');
    await request(app).get(`/api/posts/${post.slug}`).expect(200);
  });

  test('slugify handles punctuation, accents and symbols', () => {
    assert.equal(slugify('Next.js 16 & React'), 'nextjs-16-react');
    assert.equal(slugify('Café au lait'), 'cafe-au-lait');
    assert.equal(slugify('C# for C++ devs'), 'c-sharp-for-c-plus-plus-devs');
    assert.equal(slugify('  ---  '), '');
  });
});
