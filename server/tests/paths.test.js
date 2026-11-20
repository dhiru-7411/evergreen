const { describe, test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { app, request, setup, teardown, resetDb, signup, makeAdmin } = require('./helpers');
const claude = require('../services/claude');
const service = require('../services/learningPathService');
const Topic = require('../models/Topic');

const DOCS = 'https://react.dev';

const step = (title, sources, extra = {}) => ({
  title,
  goal: `Do ${title}`,
  explanation: `Learn ${title}.`,
  prerequisites: [],
  estimatedHours: 2,
  versionNote: '',
  sources,
  ...extra,
});

const GOOD_STEPS = [
  step('Install', [{ url: `${DOCS}/learn/installation`, title: 'Installation' }]),
  step('Components', [{ url: `${DOCS}/learn/your-first-component#intro`, title: 'Your first component' }], { prerequisites: [1] }),
  step('State', [{ url: `${DOCS}/learn/state-a-components-memory`, title: 'State' }], { prerequisites: [2, 5] }),
  step('Effects', [{ url: `${DOCS}/learn/made-up-page`, title: 'Not real' }], { versionNote: 'React 19 changed refs.' }),
  step('Elsewhere', [{ url: 'https://some-blog.example/react', title: 'Blog' }]),
  step('Actions', [{ url: `${DOCS}/reference/react/useActionState`, title: 'useActionState' }]),
];

// Scripted Claude: first a paused research turn, then the submission.
function fakeClient(script) {
  const calls = [];
  return {
    calls,
    beta: {
      messages: {
        stream(params) {
          calls.push(JSON.parse(JSON.stringify(params)));
          const next = script.shift();
          return { finalMessage: async () => (typeof next === 'function' ? next(params) : next) };
        },
      },
    },
  };
}

const usage = (searches = 0, fetches = 0) => ({
  input_tokens: 1000,
  output_tokens: 500,
  server_tool_use: { web_search_requests: searches, web_fetch_requests: fetches },
});

const researchTurn = {
  model: 'claude-opus-5-5',
  stop_reason: 'pause_turn',
  usage: usage(2, 1),
  content: [
    { type: 'server_tool_use', id: 's1', name: 'web_search', input: { query: 'react learn' } },
    {
      type: 'web_search_tool_result',
      tool_use_id: 's1',
      content: [
        { type: 'web_search_result', url: `${DOCS}/learn/installation`, title: 'Installation', encrypted_content: 'x', page_age: null },
        { type: 'web_search_result', url: `${DOCS}/learn/your-first-component`, title: 'Components', encrypted_content: 'x', page_age: null },
      ],
    },
    { type: 'server_tool_use', id: 'f1', name: 'web_fetch', input: { url: `${DOCS}/learn/state-a-components-memory` } },
    {
      type: 'web_fetch_tool_result',
      tool_use_id: 'f1',
      content: { type: 'web_fetch_result', url: `https://www.react.dev/learn/state-a-components-memory/`, retrieved_at: null, content: {} },
    },
    {
      type: 'bash_code_execution_tool_result',
      tool_use_id: 'c1',
      content: { type: 'bash_code_execution_result', stdout: `found ${DOCS}/reference/react/useActionState ok`, stderr: '', return_code: 0 },
    },
  ],
};

const submitTurn = (steps = GOOD_STEPS) => ({
  model: 'claude-opus-5-5',
  stop_reason: 'tool_use',
  usage: usage(1, 2),
  content: [
    { type: 'text', text: 'Here is the path.' },
    {
      type: 'tool_use',
      id: 't1',
      name: 'submit_learning_path',
      input: { intro: 'For people new to React.', assumedKnowledge: ['JavaScript basics'], steps },
    },
  ],
});

async function waitForPath(admin, slug) {
  for (let i = 0; i < 50; i++) {
    const res = await request(app).get(`/api/topics/${slug}/paths`).set(admin.auth).expect(200);
    const latest = res.body.paths[0];
    if (latest && latest.status !== 'generating') return latest;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error('path never finished');
}

let admin;

before(setup);
after(async () => {
  claude.setClient(null);
  await teardown();
});
beforeEach(async () => {
  await resetDb();
  admin = await makeAdmin(await signup('admin'));
  await request(app)
    .post('/api/topics')
    .set(admin.auth)
    .send({ name: 'React', category: 'frontend', packages: ['react'], docsDomains: ['react.dev'] })
    .expect(201);
});

describe('generating a learning path', () => {
  test('researches only official docs, resumes paused turns, and verifies every source', async () => {
    const fake = fakeClient([researchTurn, submitTurn()]);
    claude.setClient(fake);

    const res = await request(app).post('/api/topics/react/paths').set(admin.auth).expect(202);
    assert.equal(res.body.path.status, 'generating');
    const path = await waitForPath(admin, 'react');

    assert.equal(path.status, 'draft');
    assert.equal(path.basedOnVersion, '19.3.0');
    assert.equal(path.basedOnMajor, 19);

    // Web tools were restricted to the docs domain; paused turn was resent with the assistant content.
    const [first, second] = fake.calls;
    assert.deepEqual(first.tools.find((t) => t.name === 'web_search').allowed_domains, ['react.dev']);
    assert.deepEqual(first.tools.find((t) => t.name === 'web_fetch').allowed_domains, ['react.dev']);
    assert.equal(first.tools.find((t) => t.name === 'submit_learning_path').strict, true);
    assert.equal(second.messages.length, 2);
    assert.equal(second.messages[1].role, 'assistant');
    assert.equal(first.model, 'claude-opus-5-5');
    assert.equal(first.output_config.effort, 'high');

    const verified = path.steps.map((s) => s.sources[0].verified);
    // install (search), component (search, #hash ignored), state (fetch, www/trailing slash ignored),
    // made-up page (not seen), blog (off-domain), useActionState (seen in filtering output)
    assert.deepEqual(verified, [true, true, true, false, false, true]);
    assert.ok(path.warnings.some((w) => /Step 4: .*may not exist/.test(w)));
    assert.ok(path.warnings.some((w) => /Step 5: .*not on an official docs site/.test(w)));
    // Prerequisite pointing forward (step 3 -> 5) is dropped.
    assert.deepEqual(path.steps[2].prerequisites, [2]);

    assert.equal(path.generation.webSearches, 3);
    assert.equal(path.generation.webFetches, 3);
    assert.equal(path.generation.inputTokens, 2000);
  });

  test('is hidden until an admin publishes it, and the public only sees verified sources', async () => {
    claude.setClient(fakeClient([researchTurn, submitTurn()]));
    await request(app).post('/api/topics/react/paths').set(admin.auth).expect(202);
    const draft = await waitForPath(admin, 'react');

    let page = await request(app).get('/api/topics/react').expect(200);
    assert.equal(page.body.path, null);

    const alice = await signup('alice');
    await request(app).post(`/api/paths/${draft._id}/publish`).set(alice.auth).send({}).expect(403);
    await request(app).post(`/api/paths/${draft._id}/publish`).set(admin.auth).send({}).expect(200);

    page = await request(app).get('/api/topics/react').expect(200);
    assert.equal(page.body.path.steps.length, 6);
    assert.equal(page.body.path.steps[3].sources.length, 0); // unverified source hidden
    assert.equal(page.body.path.reviewedBy.username, 'admin');
    assert.equal(page.body.path.outdated, false);

    // Publishing a newer draft archives the old one.
    claude.setClient(fakeClient([submitTurn(GOOD_STEPS.slice(0, 5))]));
    await request(app).post('/api/topics/react/paths').set(admin.auth).expect(202);
    const second = await waitForPath(admin, 'react');
    await request(app).post(`/api/paths/${second._id}/publish`).set(admin.auth).send({}).expect(200);
    const list = (await request(app).get('/api/topics/react/paths').set(admin.auth)).body.paths;
    assert.deepEqual(list.map((p) => p.status), ['published', 'archived']);
    await request(app).post(`/api/paths/${draft._id}/publish`).set(admin.auth).send({}).expect(409);
  });

  test('is flagged outdated when a new major version ships', async () => {
    claude.setClient(fakeClient([submitTurn()]));
    await request(app).post('/api/topics/react/paths').set(admin.auth).expect(202);
    const draft = await waitForPath(admin, 'react');
    await request(app).post(`/api/paths/${draft._id}/publish`).set(admin.auth).send({}).expect(200);

    await Topic.updateOne(
      { slug: 'react', 'live.packages.name': 'react' },
      { $set: { 'live.packages.$.version': '20.0.0', 'live.checkedAt': new Date() } }
    );
    const page = await request(app).get('/api/topics/react').expect(200);
    assert.equal(page.body.path.outdated, true);
    assert.equal(page.body.path.currentVersion, '20.0.0');
  });

  test('records refusals and failures instead of publishing anything', async () => {
    claude.setClient(
      fakeClient([{ model: 'claude-opus-5-5', stop_reason: 'refusal', stop_details: { category: 'cyber' }, usage: usage(), content: [] }])
    );
    await request(app).post('/api/topics/react/paths').set(admin.auth).expect(202);
    const failed = await waitForPath(admin, 'react');
    assert.equal(failed.status, 'failed');
    assert.match(failed.error, /declined/);
    await request(app).post(`/api/paths/${failed._id}/publish`).set(admin.auth).send({}).expect(409);
  });

  test('nudges once if Claude stops without submitting', async () => {
    const fake = fakeClient([
      { model: 'claude-opus-5-5', stop_reason: 'end_turn', usage: usage(), content: [{ type: 'text', text: 'Done researching.' }] },
      submitTurn(),
    ]);
    claude.setClient(fake);
    await request(app).post('/api/topics/react/paths').set(admin.auth).expect(202);
    const path = await waitForPath(admin, 'react');
    assert.equal(path.status, 'draft');
    assert.match(fake.calls[1].messages.at(-1).content, /submit_learning_path/);
  });

  test('only admins can generate, and not without an API key', async () => {
    const alice = await signup('alice');
    claude.setClient(fakeClient([]));
    await request(app).post('/api/topics/react/paths').set(alice.auth).expect(403);
    await request(app).get('/api/topics/react/paths').set(alice.auth).expect(403);

    claude.setClient(null);
    const saved = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      await request(app).post('/api/topics/react/paths').set(admin.auth).expect(503);
    } finally {
      if (saved) process.env.ANTHROPIC_API_KEY = saved;
    }
  });
});

describe('docs domains', () => {
  test('fall back to package homepages, skipping github and npm', () => {
    const topic = {
      packages: ['a', 'b', 'c'],
      live: {
        packages: [
          { name: 'a', homepage: 'https://www.vitest.dev/' },
          { name: 'b', homepage: 'https://github.com/x/y#readme' },
          { name: 'c', homepage: 'https://docs.expo.dev' },
        ],
      },
    };
    assert.deepEqual(service.docsDomainsFor(topic), ['vitest.dev', 'docs.expo.dev']);
    assert.deepEqual(service.docsDomainsFor({ ...topic, docsDomains: ['react.dev'] }), ['react.dev']);
  });

  test('editors can set docs domains, which must be bare domains', async () => {
    await request(app)
      .post('/api/topics')
      .set(admin.auth)
      .send({ name: 'Vue', category: 'frontend', packages: ['vue'], docsDomains: ['https://vuejs.org/guide'] })
      .expect(400);
  });
});
