const { describe, test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  app,
  request,
  setup,
  teardown,
  resetDb,
  signup,
  makeAdmin,
  LATEST,
  DOWNLOADS,
  PUBLISHED,
  npmDown,
} = require('./helpers');
const packageInfo = require('../services/packageInfo');
const Topic = require('../models/Topic');

before(setup);
after(teardown);
beforeEach(async () => {
  await resetDb();
  packageInfo.clearCache();
  npmDown.value = false;
});

const REACT = {
  name: 'React',
  category: 'frontend',
  summary: 'Components for the web.',
  packages: ['react'],
  alternatives: [
    { name: 'vue', note: 'Gentler learning curve.' },
    { name: 'svelte', note: 'Less boilerplate.' },
  ],
};

const createTopic = (user, body = REACT) => request(app).post('/api/topics').set(user.auth).send(body);

describe('creating topics', () => {
  test('only admins can create topics', async () => {
    const alice = await signup('alice');
    await request(app).post('/api/topics').send(REACT).expect(401);
    await createTopic(alice).expect(403);
    await makeAdmin(alice);
    const res = await createTopic(alice).expect(201);
    assert.equal(res.body.slug, 'react');
    assert.equal(res.body.primary.version, LATEST.react);
  });

  test('rejects a primary package that npm does not know', async () => {
    const admin = await makeAdmin(await signup('admin'));
    const res = await createTopic(admin, { name: 'Nope', category: 'frontend', packages: ['definitely-not-a-real-pkg'] }).expect(422);
    assert.match(res.body.message, /Couldn't find/);
  });

  test('rejects duplicates and invalid package names', async () => {
    const admin = await makeAdmin(await signup('admin'));
    await createTopic(admin).expect(201);
    await createTopic(admin, { ...REACT, name: 'react' }).expect(409);
    await createTopic(admin, { name: 'Bad', category: 'frontend', packages: ['Not A Package!'] }).expect(400);
    await createTopic(admin, { name: 'Empty', category: 'frontend', packages: [] }).expect(400);
    await createTopic(admin, { ...REACT, name: 'Cooking', category: 'cooking' }).expect(400);
  });

  test('slugs are URL-friendly', () => {
    assert.equal(Topic.slugify('Next.js'), 'nextjs');
    assert.equal(Topic.slugify('C++'), 'c-plus-plus');
    assert.equal(Topic.slugify('  Node & Express  '), 'node-express');
  });
});

describe('topic pages', () => {
  test('show live npm data for the topic and its alternatives', async () => {
    const admin = await makeAdmin(await signup('admin'));
    await createTopic(admin).expect(201);

    const { body } = await request(app).get('/api/topics/react').expect(200);
    assert.equal(body.name, 'React');
    assert.equal(body.primary.version, LATEST.react);
    assert.equal(body.primary.weeklyDownloads, DOWNLOADS.react);
    assert.equal(new Date(body.primary.publishedAt).toISOString(), PUBLISHED);
    assert.equal(body.primary.repository, 'https://github.com/example/react');
    assert.equal(body.primary.advisoryCount, 0);
    assert.equal(body.category.id, 'frontend');
    // Every fact is cited: npm and deps.dev for each package, plus official docs.
    const ids = body.sources.map((s) => s.id);
    for (const id of ['npm:react', 'depsdev:react', 'docs:react', 'repo:react', 'npm:vue', 'depsdev:svelte']) {
      assert.ok(ids.includes(id), `missing source ${id}`);
    }
    assert.equal(body.summarySource, 'editor');
    assert.deepEqual(
      body.alternatives.map((a) => [a.name, a.version, a.note]),
      [
        ['vue', LATEST.vue, 'Gentler learning curve.'],
        ['svelte', LATEST.svelte, 'Less boilerplate.'],
      ]
    );
  });

  test('flag deprecated packages', async () => {
    const admin = await makeAdmin(await signup('admin'));
    await createTopic(admin, { name: 'HTTP clients', category: 'backend', packages: ['request'] }).expect(201);
    const { body } = await request(app).get('/api/topics/http-clients').expect(200);
    assert.match(body.primary.deprecated, /deprecated/);
    assert.equal(body.primary.advisoryCount, 1);
  });

  test('list related posts, freshest first', async () => {
    const admin = await makeAdmin(await signup('admin'));
    await createTopic(admin).expect(201);
    const content = 'A tutorial body that is definitely long enough to pass validation.';
    for (const [title, version] of [
      ['Old React', '16'],
      ['Current React', '19'],
    ]) {
      await request(app)
        .post('/api/posts')
        .set(admin.auth)
        .send({ title, content, stack: [{ name: 'react', version }] })
        .expect(201);
    }
    await request(app)
      .post('/api/posts')
      .set(admin.auth)
      .send({ title: 'Unrelated', content, stack: [{ name: 'express', version: '5' }] })
      .expect(201);

    const { body } = await request(app).get('/api/topics/react').expect(200);
    assert.deepEqual(
      body.posts.map((p) => p.title),
      ['Current React', 'Old React']
    );
  });

  test('keep the last known data when npm is unreachable', async () => {
    const admin = await makeAdmin(await signup('admin'));
    await createTopic(admin).expect(201);
    // Make the snapshot old and npm unreachable, then load the page.
    await Topic.updateOne({ slug: 'react' }, { 'live.checkedAt': new Date(Date.now() - 7 * 3600_000) });
    packageInfo.clearCache();
    npmDown.value = true;

    const { body } = await request(app).get('/api/topics/react').expect(200);
    assert.equal(body.primary.version, LATEST.react);
    assert.equal(body.alternatives[0].version, LATEST.vue);
  });

  test('404 for unknown topics; list is public', async () => {
    await request(app).get('/api/topics/nope').expect(404);
    const admin = await makeAdmin(await signup('admin'));
    await createTopic(admin).expect(201);
    const { body } = await request(app).get('/api/topics').expect(200);
    assert.equal(body.length, 1);
    assert.equal(body[0].alternativeCount, 2);
  });

  test('admins can delete topics', async () => {
    const admin = await makeAdmin(await signup('admin'));
    const bob = await signup('bob');
    await createTopic(admin).expect(201);
    await request(app).delete('/api/topics/react').set(bob.auth).expect(403);
    await request(app).delete('/api/topics/react').set(admin.auth).expect(200);
    await request(app).get('/api/topics/react').expect(404);
  });
});

describe('auth exposes role', () => {
  test('users start as regular users', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'carol', email: 'carol@example.com', password: 'password123' })
      .expect(201);
    assert.equal(res.body.user.role, 'user');
  });
});

describe('snapshots', () => {
  const { buildSnapshot } = require('../services/topicService');

  test('reuse last known publish date and downloads when a side lookup fails', () => {
    const prev = [{ name: 'vite', found: true, version: '8.1.1', publishedAt: new Date(PUBLISHED), weeklyDownloads: 5 }];
    const infos = new Map([['vite', { name: 'vite', version: '8.1.1', publishedAt: null, weeklyDownloads: null }]]);
    const [snap] = buildSnapshot(['vite'], infos, prev);
    assert.equal(snap.publishedAt.toISOString(), PUBLISHED);
    assert.equal(snap.weeklyDownloads, 5);
  });

  test('do not reuse a publish date from an older version', () => {
    const prev = [{ name: 'vite', found: true, version: '7.0.0', publishedAt: new Date(PUBLISHED), weeklyDownloads: 5 }];
    const infos = new Map([['vite', { name: 'vite', version: '8.1.1', publishedAt: null, weeklyDownloads: 9 }]]);
    const [snap] = buildSnapshot(['vite'], infos, prev);
    assert.equal(snap.publishedAt, null);
    assert.equal(snap.weeklyDownloads, 9);
  });
});
