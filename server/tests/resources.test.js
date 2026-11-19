const { describe, test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { app, request, setup, teardown, resetDb, signup, makeAdmin } = require('./helpers');
const checker = require('../services/resourceChecker');
const { isPrivateAddress, checkUrl, safeFetchPage } = require('../services/safeFetch');

// Fake web: URL -> HTML. Anything else is a 404.
const PAGES = {
  'https://example.com/react-19-hooks': `<html><head><title>React 19 hooks guide</title></head>
    <body><p>Install react@19 and learn how React hooks work. React makes this simple.</p></body></html>`,
  'https://example.com/old-react': `<html><head><title>Learn React 16</title></head>
    <body><p>This React tutorial uses react@16 class components. React is great.</p></body></html>`,
  'https://example.com/cooking': `<html><head><title>Best pasta recipes</title></head><body>Boil water.</body></html>`,
  'https://example.com/no-version': `<html><head><title>Thinking in React</title></head><body>React React</body></html>`,
};

let admin;
let alice;

before(async () => {
  await setup();
  checker.setPageFetcher(async (url) => {
    const body = PAGES[url];
    return body
      ? { ok: true, status: 200, finalUrl: url, contentType: 'text/html', body }
      : { ok: false, status: 404, finalUrl: url, body: '' };
  });
});
after(async () => {
  checker.resetPageFetcher();
  await teardown();
});
beforeEach(async () => {
  await resetDb();
  admin = await makeAdmin(await signup('admin'));
  alice = await signup('alice');
  await request(app)
    .post('/api/topics')
    .set(admin.auth)
    .send({ name: 'React', category: 'frontend', packages: ['react'] })
    .expect(201);
});

const submit = (user, body) =>
  request(app)
    .post('/api/topics/react/resources')
    .set(user.auth)
    .send({ title: 'A helpful React guide', ...body });

describe('submitting resources', () => {
  test('requires an account', async () => {
    await request(app).post('/api/topics/react/resources').send({ url: 'https://example.com/react-19-hooks', title: 'Guide here' }).expect(401);
  });

  test('passes checks, waits for review, then appears once approved', async () => {
    const res = await submit(alice, { url: 'https://example.com/react-19-hooks' }).expect(201);
    assert.equal(res.body.status, 'pending');
    assert.equal(res.body.checks.relevant, true);
    assert.equal(res.body.checks.version.status, 'current');
    assert.equal(res.body.checks.version.mentionedMajor, 19);

    // Not public yet, but alice can see her own pending suggestion.
    let page = await request(app).get('/api/topics/react').expect(200);
    assert.equal(page.body.resources.length, 0);
    page = await request(app).get('/api/topics/react').set(alice.auth).expect(200);
    assert.equal(page.body.myResources[0].status, 'pending');

    const queue = await request(app).get('/api/resources/review').set(admin.auth).expect(200);
    assert.equal(queue.body.pending.length, 1);
    await request(app).get('/api/resources/review').set(alice.auth).expect(403);

    await request(app).post(`/api/resources/${res.body._id}/approve`).set(alice.auth).send({}).expect(403);
    await request(app).post(`/api/resources/${res.body._id}/approve`).set(admin.auth).send({}).expect(200);

    page = await request(app).get('/api/topics/react').expect(200);
    assert.equal(page.body.resources.length, 1);
    assert.equal(page.body.resources[0].submittedBy.username, 'alice');
    assert.equal(page.body.resources[0].reviewedBy.username, 'admin');
  });

  test('rejects pages that are not about the topic', async () => {
    const res = await submit(alice, { url: 'https://example.com/cooking' }).expect(422);
    assert.match(res.body.message, /doesn't seem to be about React/);
  });

  test('rejects dead links', async () => {
    const res = await submit(alice, { url: 'https://example.com/missing' }).expect(422);
    assert.match(res.body.message, /couldn't open/);
  });

  test('flags tutorials written for an old major version', async () => {
    const res = await submit(alice, { url: 'https://example.com/old-react' }).expect(201);
    assert.equal(res.body.checks.version.status, 'outdated');
    assert.equal(res.body.checks.version.mentionedMajor, 16);
  });

  test('blocks duplicates, ignoring tracking params and www', async () => {
    await submit(alice, { url: 'https://example.com/react-19-hooks' }).expect(201);
    await submit(alice, { url: 'https://www.example.com/react-19-hooks?utm_source=x#top' }).expect(409);
  });

  test('blocks private-network URLs', async () => {
    checker.resetPageFetcher();
    try {
      const res = await submit(alice, { url: 'http://127.0.0.1/admin' }).expect(400);
      assert.match(res.body.message, /private network/);
      await submit(alice, { url: 'ftp://example.com/file' }).expect(400);
    } finally {
      checker.setPageFetcher(async (url) => {
        const body = PAGES[url];
        return body
          ? { ok: true, status: 200, finalUrl: url, contentType: 'text/html', body }
          : { ok: false, status: 404, finalUrl: url, body: '' };
      });
    }
  });

  test('admin suggestions are published straight away', async () => {
    const res = await submit(admin, { url: 'https://example.com/no-version' }).expect(201);
    assert.equal(res.body.status, 'approved');
    assert.equal(res.body.checks.version.status, 'unknown');
  });

  test('rejected resources show the reason to their submitter', async () => {
    const res = await submit(alice, { url: 'https://example.com/react-19-hooks' }).expect(201);
    await request(app)
      .post(`/api/resources/${res.body._id}/reject`)
      .set(admin.auth)
      .send({ reviewNote: 'Code sample is wrong' })
      .expect(200);
    const page = await request(app).get('/api/topics/react').set(alice.auth).expect(200);
    assert.equal(page.body.myResources[0].status, 'rejected');
    assert.equal(page.body.myResources[0].reviewNote, 'Code sample is wrong');
    await submit(alice, { url: 'https://example.com/react-19-hooks' }).expect(409);
  });
});

describe('reporting resources', () => {
  test('reports send an approved resource back to reviewers', async () => {
    const { body } = await submit(admin, { url: 'https://example.com/react-19-hooks' }).expect(201);
    await request(app).post(`/api/resources/${body._id}/report`).set(alice.auth).send({ reason: 'short' }).expect(400);
    await request(app)
      .post(`/api/resources/${body._id}/report`)
      .set(alice.auth)
      .send({ reason: 'The second example no longer works in React 19' })
      .expect(201);
    await request(app)
      .post(`/api/resources/${body._id}/report`)
      .set(alice.auth)
      .send({ reason: 'Reporting the same thing twice' })
      .expect(409);

    const queue = await request(app).get('/api/resources/review').set(admin.auth).expect(200);
    assert.equal(queue.body.reported.length, 1);
    assert.equal(queue.body.reported[0].reports[0].user.username, 'alice');

    // Reporter identities and reasons are not public.
    const page = await request(app).get('/api/topics/react').expect(200);
    assert.equal(page.body.resources[0].reports, undefined);
  });

  test('deleting a topic removes its resources', async () => {
    await submit(alice, { url: 'https://example.com/react-19-hooks' }).expect(201);
    await request(app).delete('/api/topics/react').set(admin.auth).expect(200);
    const queue = await request(app).get('/api/resources/review').set(admin.auth).expect(200);
    assert.equal(queue.body.pending.length, 0);
  });
});

describe('checker units', () => {
  const topic = { name: 'Next.js', packages: ['next'] };

  test('finds major versions in common spellings', () => {
    assert.deepEqual(checker.versionsMentioned(topic, 'Upgrade to Next.js 15 from next@^14.2 and Next v13'), [13, 14, 15]);
    assert.deepEqual(checker.versionsMentioned({ name: 'TanStack Query', packages: ['@tanstack/react-query'] }, 'uses @tanstack/react-query@5'), [5]);
  });

  test('ignores numbers that cannot be versions', () => {
    assert.deepEqual(checker.versionVerdict([2024], '16.1.0'), { status: 'unknown', latestMajor: 16, mentionedMajor: null });
    assert.equal(checker.versionVerdict([15, 16], '16.1.0').status, 'current');
  });

  test('relevance needs more than a passing mention', () => {
    const one = checker.relevance(topic, { title: 'Cooking', text: 'I once used Next.js.' });
    assert.equal(one.relevant, false);
    const titled = checker.relevance(topic, { title: 'Next.js routing', text: '' });
    assert.equal(titled.relevant, true);
    // Matching is word-bounded: "nextcloud" is not "next".
    assert.equal(checker.relevance({ name: 'Next', packages: ['next'] }, { title: '', text: 'nextcloud nextcloud nextcloud' }).relevant, false);
  });

  test('generic scoped names do not count, keywords do', () => {
    const ai = { name: 'Building with LLMs', packages: ['@anthropic-ai/sdk'], keywords: ['Claude'] };
    assert.ok(!checker.topicTerms(ai).includes('sdk'));
    assert.equal(checker.relevance(ai, { title: 'Payments SDK', text: 'sdk sdk sdk' }).relevant, false);
    assert.equal(checker.relevance(ai, { title: 'Calling Claude from Node', text: '' }).relevant, true);
  });

  test('private address detection', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.0.1', '172.20.1.1', '169.254.169.254', '::1', 'fd00::1', '::ffff:127.0.0.1']) {
      assert.equal(isPrivateAddress(ip), true, ip);
    }
    for (const ip of ['8.8.8.8', '104.16.6.34', '2606:4700::6810:634']) assert.equal(isPrivateAddress(ip), false, ip);
  });

  test('url rules', () => {
    assert.throws(() => checkUrl('file:///etc/passwd'));
    assert.throws(() => checkUrl('https://user:pw@example.com'));
    assert.throws(() => checkUrl('https://example.com:8080/'));
    assert.throws(() => checkUrl('http://[::1]/'));
    assert.ok(checkUrl('https://react.dev/learn'));
  });

  test('hostnames that resolve to private addresses are refused', async () => {
    await assert.rejects(() => safeFetchPage('http://localhost/'), /private network/);
  });
});
